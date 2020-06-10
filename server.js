const envConfig = require("dotenv").config();
const express = require("express");
const Ably = require("ably");
const p2 = require("p2");
const app = express();
const ABLY_API_KEY = process.env.ABLY_API_KEY;

const CANVAS_HEIGHT = 750;
const CANVAS_WIDTH = 1400;
const SHIP_PLATFORM = 718;
const PLAYER_VERTICAL_INCREMENT = 20;
const PLAYER_VERTICAL_MOVEMENT_UPDATE_INTERVAL = 1000;
const PLAYER_SCORE_INCREMENT = 5;
const P2_WORLD_TIME_STEP = 1 / 16;
const MIN_PLAYERS_TO_START_GAME = 3;
const GAME_TICKER_MS = 100;

let peopleAccessingTheWebsite = 0;
let players = {};
let playerChannels = {};
let shipX = Math.floor((Math.random() * 1370 + 30) * 1000) / 1000;
let shipY = SHIP_PLATFORM;
let avatarColors = ["green", "cyan", "yellow"];
let avatarTypes = ["A", "B", "C"];
let gameOn = false;
let alivePlayers = 0;
let totalPlayers = 0;
let gameRoom;
let deadPlayerCh;
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

const realtime = Ably.Realtime({
  key: ABLY_API_KEY,
  echoMessages: false,
});

//create a uniqueId to assign to clients on auth
const uniqueId = function () {
  return "id-" + totalPlayers + Math.random().toString(36).substr(2, 16);
};

app.use(express.static("public"));

app.get("/auth", (request, response) => {
  const tokenParams = { clientId: uniqueId() };
  realtime.auth.createTokenRequest(tokenParams, function (err, tokenRequest) {
    if (err) {
      response
        .status(500)
        .send("Error requesting token: " + JSON.stringify(err));
    } else {
      response.setHeader("Content-Type", "application/json");
      response.send(JSON.stringify(tokenRequest));
    }
  });
});

app.get("/", (request, response) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  if (++peopleAccessingTheWebsite > MIN_PLAYERS_TO_START_GAME) {
    response.sendFile(__dirname + "/views/gameRoomFull.html");
  } else {
    response.sendFile(__dirname + "/views/intro.html");
  }
});

app.get("/gameplay", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

app.get("/winner", (request, response) => {
  response.sendFile(__dirname + "/views/winner.html");
});

app.get("/gameover", (request, response) => {
  response.sendFile(__dirname + "/views/gameover.html");
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

//game server

realtime.connection.once("connected", () => {
  gameRoom = realtime.channels.get("game-room");
  deadPlayerCh = realtime.channels.get("dead-player");

  gameRoom.presence.subscribe("enter", (player) => {
    let newPlayerId;
    alivePlayers++;
    totalPlayers++;

    if (totalPlayers === 1) {
      gameTickerOn = true;
      startGameDataTicker();
    }

    newPlayerId = player.clientId;
    playerChannels[newPlayerId] = realtime.channels.get(
      "clientChannel-" + player.clientId
    );

    newPlayerObject = {
      id: newPlayerId,
      x: Math.floor((Math.random() * 1370 + 30) * 1000) / 1000,
      y: 20,
      invaderAvatarType: avatarTypes[randomAvatarSelector()],
      invaderAvatarColor: avatarColors[randomAvatarSelector()],
      score: 0,
      nickname: player.data,
      isAlive: true,
    };
    players[newPlayerId] = newPlayerObject;
    if (totalPlayers === MIN_PLAYERS_TO_START_GAME) {
      startShipAndBullets();
    }
    subscribeToPlayerInput(playerChannels[newPlayerId], newPlayerId);
  });

  gameRoom.presence.subscribe("leave", (player) => {
    let leavingPlayer = player.clientId;
    alivePlayers--;
    totalPlayers--;
    delete players[leavingPlayer];
    if (totalPlayers <= 0) {
      resetServerState();
    }
  });

  deadPlayerCh.subscribe("dead-notif", (msg) => {
    players[msg.data.deadPlayerId].isAlive = false;
    killerBulletId = msg.data.killerBulletId;
    alivePlayers--;
    if (alivePlayers == 0) {
      setTimeout(() => {
        finishGame("");
      }, 1000);
    }
  });
});

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
          y: SHIP_PLATFORM,
          id:
            "bulletId-" + Math.floor((Math.random() * 2000 + 50) * 1000) / 1000,
        };
      }
      if (shipBody) {
        copyOfShipBody = shipBody;
      }
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

function subscribeToPlayerInput(channelInstance, playerId) {
  channelInstance.subscribe("pos", (msg) => {
    if (msg.data.keyPressed == "left") {
      if (players[playerId].x - 20 < 20) {
        players[playerId].x = 20;
      } else {
        players[playerId].x -= 20;
      }
    } else if (msg.data.keyPressed == "right") {
      if (players[playerId].x + 20 > 1380) {
        players[playerId].x = 1380;
      } else {
        players[playerId].x += 20;
      }
    }
  });
}

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

function finishGame(playerId) {
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

  gameRoom.publish("game-over", {
    winner: winnerName,
    firstRunnerUp: firstRunnerUpName,
    secondRunnerUp: secondRunnerUpName,
    totalPlayers: totalPlayers,
  });

  resetServerState();
}

function resetServerState() {
  peopleAccessingTheWebsite = 0;
  gameOn = false;
  gameTickerOn = false;
  totalPlayers = 0;
  alivePlayers = 0;
  for (let item in playerChannels) {
    playerChannels[item].detach();
  }
}

function randomAvatarSelector() {
  return Math.floor(Math.random() * 3);
}

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

// method to return random velocity
function calcRandomVelocity() {
  let randomShipXVelocity = Math.floor(Math.random() * 200) + 20;
  randomShipXVelocity *= Math.floor(Math.random() * 2) == 1 ? 1 : -1;
  return randomShipXVelocity;
}
