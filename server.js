const express = require("express");
const Ably = require("ably");
const p2 = require("p2");
const app = express();

let peopleAccessingTheWebsite = 0;

const realtime = Ably.Realtime({
  key: process.env.ABLY_API_KEY,
  echoMessages: false
});

//create a uniqueId to assign to clients on auth
const uniqueId = function() {
  return ( "id-" + Math.random().toString(36).substr(2, 16));
};

app.use(express.static("public"));

app.get("/", (request, response) => {
  if(peopleAccessingTheWebsite >= 20){
    console.log(peopleAccessingTheWebsite)
    response.sendFile(__dirname + "/views/gameRoomFull.html");
  }else{
    peopleAccessingTheWebsite ++;
    console.log(peopleAccessingTheWebsite)
    response.sendFile(__dirname + "/views/intro.html");
    //response.sendFile(__dirname + "/views/gameRoomFull.html");
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

app.get("/auth", (request, response) => {
  const tokenParams = { clientId: uniqueId() };
  realtime.auth.createTokenRequest(tokenParams, function(err, tokenRequest) {
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

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

//---------------------------------------------------------------------------//
// Game logic //

// config width: 1400, height: 750
// ship framewidth is 60

let gameState;
let playerChannels = {};

let shipX = Math.floor((Math.random() * 1370 + 30) * 1000) / 1000;
let shipY = 20;
let avatarColors = ["green", "cyan", "yellow"];
let avatarTypes = ["A", "B", "C"];

function randomAvatarSelector() {
  return Math.floor(Math.random() * 3);
}

let shipBody = new p2.Body({
  position: [shipX, shipY],
  velocity: [calcRandomVelocity(), 0]
});

let world = new p2.World({
  gravity: [0, -9.82]
});

world.addBody(shipBody);

let players = {}
/* sample structure of the players array
"id-xyz123": {
  id: "",
  x: "",
  y: "",
  invaderAvatarType: "A",
  invaderAvatarColor: "green",
  score: 0,
  nickname: ""
}
*/

let playerCount = 0;
// let bulletObj = {
//   x: "",
//   y: "",
//   id: ""
// };

let bulletTimerCount = 60;
let bulletOrNo;
let gameDuration = 0;

//let bullets = [{ id: bulletObj }];
let gameRoom = realtime.channels.get("game-room");
let deadPlayerCh = realtime.channels.get("dead-player");


//subscribe to players entering
gameRoom.presence.subscribe("enter", player => {
  playerChannels[player.clientId] = realtime.channels.get("clientChannel-" + player.clientId);
  //subscribe to the x position of this player
  playerChannels[player.clientId].subscribe("pos", msg => {
    handlePlayerInput(msg.data, player.clientId);
  });
  
  //reset the arrays adn start the game ticker and ship movement when the first player joins
  //this needs revisiting for when all players have died
  if (++playerCount === 1) {
    console.log(`player is ${playerCount}`)
    setTimeout(() => {
      console.log('timeout')
      gameRoom.publish("game-over", {
        winner: "timeout"
      })
    }, 120000)
    players = {};
    //bulletObj = {};
    startShip();
    startGameDataTicker();
  }
  
  console.log(`new player is ${playerCount}`)

  //create a new entry for the player who just entered the game
  let playerData = {
    id: player.clientId,
    x: Math.floor((Math.random() * 1370 + 30) * 1000) / 1000,
    y: 20,
    invaderAvatarType: avatarTypes[randomAvatarSelector()],
    invaderAvatarColor: avatarColors[randomAvatarSelector()],
    score: 0,
    nickname: player.data
  };
  
  //add new player to the array
  players[player.clientId] = playerData;
  
  //revisit why the timeout is required
  setTimeout(() => {
    gameRoom.publish("player-join", playerData);
  }, 1000);

  //start moving the y position of existing players
  startDownwardMovement(player.clientId);
}); //end of enter subscribe

//method to update the x position of the player per message from the client
function handlePlayerInput(data, playerId) {
  if (data.keyPressed == "left") {
    if (players[playerId].x - 20 < 0) {
      players[playerId].x = 20;
    } else {
      players[playerId].x -= 20;
    }
  } else if (data.keyPressed == "right") {
    if (players[playerId].x + 20 > 1400) {
      players[playerId].x = 1380;
    } else {
      players[playerId].x += 20;
    }
  }
}

//subscribe to players leaving
gameRoom.presence.subscribe("leave", player => {
  gameRoom.publish("player-leave", {
    id: player.clientId
  });
  delete playerChannels[player.clientId];
  playerCount--;
  peopleAccessingTheWebsite --;
  //console.log(peopleAccessingTheWebsite)
}); //end of leave subscribe

//this will be expensive to do for all players on server side  - consider moving to the client side later??
function startDownwardMovement(playerId) {
  let interval = setInterval(() => {
    if (players[playerId] != undefined && playerCount != 0) {
      players[playerId].y += 20;
      players[playerId].score += 5;
      
      // if the player has reached the bottom end, publish game over
      if (players[playerId].y > 720) {
        gameRoom.publish("game-over", {
          winner: players[playerId].id
        });
        playerCount = 0;
      }
    } else {
      clearInterval(interval);
    }
  }, 1000);
}

// method to publish game state to all the players
function startGameDataTicker() {
  let gameDataTick = setInterval(() => {
    if (playerCount === 0) {
      clearInterval(gameDataTick);
    }
    bulletOrNo = "";
    bulletTimerCount += 60;
    
    //publish a bullet every half second
    if (bulletTimerCount > 500) {
      bulletTimerCount = 0;
      bulletOrNo = {
        y: 718,
        id: "bulletId-" + Math.floor((Math.random() * 2000 + 50) * 1000) / 1000
      };
    }
    
    //publish the current game state to all the clients
    gameRoom.publish("game-state", {
      players: players,
      playerCount: playerCount,
      //bullets: bullets,
      shipBody: shipBody.position,
      bullet: bulletOrNo
    });
  }, 100);
}

//subscribe to players death notification
deadPlayerCh.subscribe("dead-notif", msg => {
  
  //publish this info to all the clients
  deadPlayerCh.publish("dead-notif-fanout", {
    bulletId: msg.data.bulletId,
    deadPlayerId: msg.data.deadPlayerId
  });
  // revisit delete on death here as it's needed for leaderboard
  delete players[msg.data.deadPlayerId];
});

//start the ship movement when at least one player is playing
function startShip() {
  //update ship velocity and direction randomly every 5 seconds
  let interval = setInterval(() => {
    shipBody.velocity[0] = calcRandomVelocity();
  }, 5000);
}



//--game physics--//

// To get the trajectories of the bodies,
// we must step the world forward in time.
// This is done using a fixed time step size.
var timeStep = 1 / 16; // seconds

//movement of the world, updates the position of the objects as per the physics
setInterval(function() {
  world.step(timeStep);
  if (shipBody.position[0] > 1400 && shipBody.velocity[0] > 0) {
    shipBody.position[0] = 0;
  } else if (shipBody.position[0] < 0 && shipBody.velocity[0] < 0) {
    shipBody.position[0] = 1400;
  }
}, 1000 * timeStep); 

// method to return random velocity
function calcRandomVelocity() {
  let randomShipXVelocity = Math.floor(Math.random() * 200) + 20;
  randomShipXVelocity *= Math.floor(Math.random() * 2) == 1 ? 1 : -1;
  return randomShipXVelocity;
}


/* TODOS
- fix avatars getting struck
- debug why explosion doesn't happen when window is not in focus
- player got killed test
- fix start lag
- look for an option to start the game after everyone joins
*/