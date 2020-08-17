const {
  Worker,
  isMainThread,
  parentPort,
  threadId,
  workerData,
} = require("worker_threads");
const envConfig = require("dotenv").config();
const Ably = require("ably");
const p2 = require("p2");

const ABLY_API_KEY = process.env.ABLY_API_KEY;

const CANVAS_HEIGHT = 700;
const CANVAS_WIDTH = 1400;
const SHIP_PLATFORM = CANVAS_HEIGHT - 12;
const BULLET_PLATFORM = SHIP_PLATFORM - 32;
const PLAYER_VERTICAL_INCREMENT = 20;
const PLAYER_VERTICAL_MOVEMENT_UPDATE_INTERVAL = 1000;
const PLAYER_SCORE_INCREMENT = 5;
const P2_WORLD_TIME_STEP = 1 / 16;
const MIN_PLAYERS_TO_START_GAME = 6;
const GAME_TICKER_MS = 100;

let players = {};
let playerChannels = {};
let shipX = between(20, CANVAS_WIDTH - 20);
let shipY = SHIP_PLATFORM;
let colorIndex = 0;
let avatarTypes = ["A", "B", "C"];
let gameOn = false;
let alivePlayers = 0;
let totalPlayers = 0;
let gameRoomName = workerData.hostRoomCode + ":primary";
let roomCode = workerData.hostRoomCode;
let hostClientId = workerData.hostClientId;
let hostNickname = workerData.hostNickname;
let gameRoom;
let gameTickerOn = false;
let bulletTimer = 0;
let shipBody;
let world;
let shipVelocityTimer = 0;
let killerBulletId = "";
let copyOfShipBody = {
  position: "",
  velocity: "",
};

// instantiate to Ably
const realtime = Ably.Realtime({
  key: ABLY_API_KEY,
  echoMessages: false,
});

// wait until connection with Ably is established
realtime.connection.once("connected", () => {
  gameRoom = realtime.channels.get(gameRoomName);

  // subscribe to new players entering the game
  gameRoom.presence.subscribe("enter", (player) => {
    console.log("new player");
    let newPlayerId;
    alivePlayers++;
    totalPlayers++;
    parentPort.postMessage({
      roomName: roomCode,
      totalPlayers: totalPlayers,
      gameOn: gameOn,
    });
    newPlayerId = player.clientId;
    playerChannels[newPlayerId] = realtime.channels.get(
      workerData.hostRoomCode + ":clientChannel-" + player.clientId
    );
    if (++colorIndex == 6) {
      colorIndex = 0;
    }
    if (totalPlayers == 1) {
      gameTickerOn = true;
      startGameDataTicker();
    }
    newPlayerObject = {
      id: newPlayerId,
      invaderAvatarType: avatarTypes[between(0, 3)],
      invaderAvatarColor: randomColorGenerator(),
      x: playerXposition(colorIndex),
      y: 20,
      score: 0,
      nickname: player.data.nickname,
      isAlive: true,
    };
    players[newPlayerId] = newPlayerObject;
    subscribeToPlayerInput(playerChannels[newPlayerId], newPlayerId);
  });

  // subscribe to players leaving the game
  gameRoom.presence.subscribe("leave", (player) => {
    let leavingPlayer = player.clientId;
    alivePlayers--;
    totalPlayers--;
    parentPort.postMessage({
      roomName: roomCode,
      totalPlayers: totalPlayers,
    });
    delete players[leavingPlayer];
    if (totalPlayers <= 0) {
      killWorkerThread();
    }
  });
  gameRoom.publish("thread-ready", {
    start: true,
  });
});

// start the ship and bullets
function startShipAndBullets() {
  gameOn = true;

  world = new p2.World({
    gravity: [0, -9.82],
  });
  shipBody = new p2.Body({
    position: [shipX, shipY],
    velocity: [calcRandomVelocity(), 0],
  });
  world.addBody(shipBody);
  startMovingPhysicsWorld();

  for (let playerId in players) {
    startDownwardMovement(playerId);
  }
}

// start the game tick
function startGameDataTicker() {
  let tickInterval = setInterval(() => {
    if (!gameTickerOn) {
      clearInterval(tickInterval);
    } else {
      bulletOrBlank = "";
      bulletTimer += GAME_TICKER_MS;
      if (bulletTimer >= GAME_TICKER_MS * 5) {
        bulletTimer = 0;
        bulletOrBlank = {
          y: BULLET_PLATFORM,
          id: "bulletId-" + generateRandomId(),
        };
      }
      if (shipBody) {
        copyOfShipBody = shipBody;
      }

      // fan out the latest game state
      gameRoom.publish("game-state", {
        players: players,
        playerCount: totalPlayers,
        shipBody: copyOfShipBody.position,
        bulletOrBlank: bulletOrBlank,
        gameOn: gameOn,
        killerBullet: killerBulletId,
      });
    }
  }, GAME_TICKER_MS);
}

// subscribe to each player's input events
function subscribeToPlayerInput(channelInstance, playerId) {
  channelInstance.subscribe("pos", (msg) => {
    if (msg.data.keyPressed == "left") {
      if (players[playerId].x - 20 < 20) {
        players[playerId].x = 25;
      } else {
        players[playerId].x -= 20;
      }
    } else if (msg.data.keyPressed == "right") {
      if (players[playerId].x + 20 > 1380) {
        players[playerId].x = 1375;
      } else {
        players[playerId].x += 20;
      }
    }
  });
  channelInstance.subscribe("start-game", (msg) => {
    startShipAndBullets();
  });

  // subscribe to players being shot
  channelInstance.subscribe("dead-notif", (msg) => {
    players[msg.data.deadPlayerId].isAlive = false;
    killerBulletId = msg.data.killerBulletId;
    alivePlayers--;
    if (alivePlayers == 0) {
      setTimeout(() => {
        finishGame("");
      }, 1000);
    }
  });
}

// update the y position of each player when the game starts
function startDownwardMovement(playerId) {
  let interval = setInterval(() => {
    if (players[playerId] && players[playerId].isAlive) {
      players[playerId].y += PLAYER_VERTICAL_INCREMENT;
      players[playerId].score += PLAYER_SCORE_INCREMENT;

      if (players[playerId].y > SHIP_PLATFORM) {
        finishGame(playerId);
        clearInterval(interval);
      }
    } else {
      clearInterval(interval);
    }
  }, PLAYER_VERTICAL_MOVEMENT_UPDATE_INTERVAL);
}

// finish the game
function finishGame(playerId) {
  console.log("finished");
  let firstRunnerUpName = "";
  let secondRunnerUpName = "";
  let winnerName = "Nobody";
  let leftoverPlayers = new Array();
  for (let item in players) {
    leftoverPlayers.push({
      nickname: players[item].nickname,
      score: players[item].score,
    });
  }

  leftoverPlayers.sort((a, b) => {
    return b.score - a.score;
  });
  if (playerId == "") {
    if (leftoverPlayers.length >= 3) {
      firstRunnerUpName = leftoverPlayers[0].nickname;
      secondRunnerUpName = leftoverPlayers[1].nickname;
    } else if (leftoverPlayers == 2) {
      firstRunnerUp = leftoverPlayers[0].nickname;
    }
  } else {
    winnerName = players[playerId].nickname;
    if (leftoverPlayers.length >= 3) {
      firstRunnerUpName = leftoverPlayers[1].nickname;
      secondRunnerUpName = leftoverPlayers[2].nickname;
    } else if (leftoverPlayers.length == 2) {
      firstRunnerUpName = leftoverPlayers[1].nickname;
    }
  }

  // fan out leaderboard info when the game has finished
  gameRoom.publish("game-over", {
    winner: winnerName,
    firstRunnerUp: firstRunnerUpName,
    secondRunnerUp: secondRunnerUpName,
    totalPlayers: totalPlayers,
  });

  killWorkerThread();
}

// reset all variables in the server
function killWorkerThread() {
  parentPort.postMessage({
    resetEntry: true,
    roomName: roomCode,
  });
  for (let item in playerChannels) {
    playerChannels[item].detach();
  }
  process.exit(0);
}

// assign player position per color to form pride rainbow
function playerXposition(index) {
  switch (index) {
    case 0:
      return between(22, 246);
    case 1:
      return between(247, 474);
    case 2:
      return between(475, 702);
    case 3:
      return between(703, 930);
    case 4:
      return between(931, 1158);
    case 5:
      return between(1159, 1378);
    default:
      return between(22, 246);
  }
}

function between(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function generateRandomId() {
  return Math.random().toString(36).substr(2, 8);
}

// start the server-side physics world
function startMovingPhysicsWorld() {
  let p2WorldInterval = setInterval(function () {
    if (!gameOn) {
      clearInterval(p2WorldInterval);
    } else {
      // updates velocity every 5 seconds
      if (++shipVelocityTimer >= 80) {
        shipVelocityTimer = 0;
        shipBody.velocity[0] = calcRandomVelocity();
      }
      world.step(P2_WORLD_TIME_STEP);
      if (shipBody.position[0] > 1400 && shipBody.velocity[0] > 0) {
        shipBody.position[0] = 0;
      } else if (shipBody.position[0] < 0 && shipBody.velocity[0] < 0) {
        shipBody.position[0] = 1400;
      }
    }
  }, 1000 * P2_WORLD_TIME_STEP);
}

// calculate a random horizontal velocity for the ship
function calcRandomVelocity() {
  let randomShipXVelocity = between(20, 200);
  randomShipXVelocity *= Math.floor(Math.random() * 2) == 1 ? 1 : -1;
  return randomShipXVelocity;
}

// method to randomly generate a color for the player
function randomColorGenerator() {
  const randomColor = "000000".replace(/0/g, function () {
    return (~~(Math.random() * 16)).toString(16);
  });
  return "0x" + randomColor;
}
