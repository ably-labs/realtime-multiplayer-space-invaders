const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
  threadId,
  MessageChannel,
} = require("worker_threads");

const envConfig = require("dotenv").config();
const express = require("express");
const Ably = require("ably");
const p2 = require("p2");
const app = express();
const ABLY_API_KEY = process.env.ABLY_API_KEY;
const globalGameName = "main-game-thread";
const GAME_ROOM_CAPACITY = 6;
let globalChannel;
let activeGameRooms = {};

// instantiate to Ably
const realtime = Ably.Realtime({
  key: ABLY_API_KEY,
  echoMessages: false,
});

// create a uniqueId to assign to clients on auth
const uniqueId = function () {
  return "id-" + Math.random().toString(36).substr(2, 16);
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
  response.sendFile(__dirname + "/views/intro.html");
});

app.get("/gameplay", (request, response) => {
  let requestedRoom = request.query.roomCode;
  let isReqHost = request.query.isHost == "true";
  if (!isReqHost && activeGameRooms[requestedRoom]) {
    if (
      activeGameRooms[requestedRoom].totalPlayers + 1 <= GAME_ROOM_CAPACITY &&
      !activeGameRooms[requestedRoom].gameOn
    ) {
      response.sendFile(__dirname + "/views/index.html");
    } else {
      console.log("here");
      response.sendFile(__dirname + "/views/gameRoomFull.html");
    }
  } else if (isReqHost) {
    response.sendFile(__dirname + "/views/index.html");
  } else {
    response.sendFile(__dirname + "/views/gameRoomFull.html");
  }
  console.log(JSON.stringify(activeGameRooms));
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

// wait until connection with Ably is established
realtime.connection.once("connected", () => {
  globalChannel = realtime.channels.get(globalGameName);
  // subscribe to new players entering the game
  globalChannel.presence.subscribe("enter", (player) => {
    generateNewGameThread(
      player.data.isHost,
      player.data.nickname,
      player.data.roomCode,
      player.clientId
    );
  });
});

function generateNewGameThread(
  isHost,
  hostNickname,
  hostRoomCode,
  hostClientId
) {
  if (isHost && isMainThread) {
    const worker = new Worker("./server-worker.js", {
      workerData: {
        hostNickname: hostNickname,
        hostRoomCode: hostRoomCode,
        hostClientId: hostClientId,
      },
    });
    console.log(`CREATING NEW THREAD WITH ID ${threadId}`);
    worker.on("error", (error) => {
      console.log(`WORKER EXITED DUE TO AN ERROR ${error}`);
    });
    worker.on("message", (msg) => {
      if (msg.roomName && !msg.resetEntry) {
        activeGameRooms[msg.roomName] = {
          roomName: msg.roomName,
          totalPlayers: msg.totalPlayers,
          gameOn: msg.gameOn,
        };
      } else if (msg.roomName && msg.resetEntry) {
        delete activeGameRooms[msg.roomName];
      }
    });
    worker.on("exit", (code) => {
      console.log(`WORKER EXITED WITH THREAD ID ${threadId}`);
      if (code !== 0) {
        console.log(`WORKER EXITED DUE TO AN ERROR WITH CODE ${code}`);
      }
    });
  }
}
