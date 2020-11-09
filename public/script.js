let globalChannel;
let myClientId;
let myChannel;
let myChannelName;
let gameOn = false;
let players = {};
let totalPlayers = 0;
let latestShipPosition;
let bulletThatShotMe;
let bulletThatShotSomeone;
let bulletOutOfBounds = "";
let amIalive = false;
let game;
let myGameRoomName;
let myGameRoomCh;

const myNickname = localStorage.getItem("nickname");
const myGameRoomCode = localStorage.getItem("roomCode");
const amIHost = localStorage.getItem("isHost");
const startGameBtn = document.getElementById("btn-startgame");
const audioControlChkbox = document.getElementById("audio-chkbox");

document.getElementById("room-code").innerHTML =
  "Other players can join using the code: " + myGameRoomCode;

// connect to Ably
const realtime = Ably.Realtime({
  authUrl: "/auth",
});

//show modal
if (amIHost == "true") {
  document.querySelector(".bg-modal").style.display = "flex";
  document.getElementById("game-link").innerHTML =
    "Invite your friends to join using the code: <br/>" + myGameRoomCode;
  document.querySelector(".close").addEventListener("click", () => {
    document.querySelector(".bg-modal").style.display = "none";
  });
}

function copyGameCode() {
  navigator.clipboard.writeText(myGameRoomCode);
  let copyButton = document.getElementById("copy-button");
  copyButton.style.backgroundColor = "white";
  copyButton.style.color = "black";
  copyButton.style.border = "2px solid black";
  copyButton.innerHTML = "Copied!";
}

// once connected to Ably, instantiate channels and launch the game
realtime.connection.once("connected", () => {
  myClientId = realtime.auth.clientId;
  myGameRoomName = myGameRoomCode + ":primary";
  myChannelName = myGameRoomCode + ":clientChannel-" + myClientId;
  myGameRoomCh = realtime.channels.get(myGameRoomName);
  myChannel = realtime.channels.get(myChannelName);

  if (amIHost == "true") {
    const globalGameName = "main-game-thread";
    globalChannel = realtime.channels.get(globalGameName);
    myGameRoomCh.subscribe("thread-ready", (msg) => {
      myGameRoomCh.presence.enter({
        nickname: myNickname,
        isHost: amIHost,
      });
    });
    globalChannel.presence.enter({
      nickname: myNickname,
      roomCode: myGameRoomCode,
      isHost: amIHost,
    });
    startGameBtn.style.display = "inline-block";
  } else if (amIHost != "true") {
    myGameRoomCh.presence.enter({
      nickname: myNickname,
      isHost: amIHost,
    });
    startGameBtn.style.display = "none";
  }
  game = new Phaser.Game(config);
});

function startGame() {
  myChannel.publish("start-game", {
    start: true,
  });
}

// primary game scene
class GameScene extends Phaser.Scene {
  constructor() {
    super("gameScene");
  }

  preload() {
    this.load.spritesheet(
      "avatarAanimated",
      "https://cdn.glitch.com/c0cf9403-8071-4ec0-afd7-8a5293120d79%2FavatarAanimated.png?v=1592436546438",
      {
        frameWidth: 48,
        frameHeight: 32,
      }
    );
    this.load.spritesheet(
      "avatarBanimated",
      "https://cdn.glitch.com/c0cf9403-8071-4ec0-afd7-8a5293120d79%2FavatarBanimated.png?v=1592436575703",
      {
        frameWidth: 48,
        frameHeight: 32,
      }
    );
    this.load.spritesheet(
      "avatarCanimated",
      "https://cdn.glitch.com/c0cf9403-8071-4ec0-afd7-8a5293120d79%2FavatarCanimated.png?v=1592436609339",
      {
        frameWidth: 48,
        frameHeight: 32,
      }
    );
    this.load.spritesheet(
      "ship",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FShip%402x.png?v=1589228730678",
      {
        frameWidth: 60,
        frameHeight: 32,
      }
    );
    this.load.spritesheet(
      "bullet",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2Fbullet.png?v=1589229887570",
      {
        frameWidth: 48,
        frameHeight: 48,
      }
    );
    this.load.spritesheet(
      "explosion",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2Fexplosion57%20(2).png?v=1589491279459",
      {
        frameWidth: 48,
        frameHeight: 48,
      }
    );
    this.load.audio(
      "move1",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2Ffastinvader1.mp3?v=1589983955301"
    );
    this.load.audio(
      "move2",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2Ffastinvader2.mp3?v=1589983959381"
    );
    this.load.audio(
      "move3",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2Ffastinvader3.mp3?v=1589983969580"
    );
    this.load.audio(
      "move4",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2Ffastinvader4.mp3?v=1589983973991"
    );
    this.load.audio(
      "myDeath",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2Fexplosion.mp3?v=1589984025058"
    );
    this.load.audio(
      "opponentDeath",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2Finvaderkilled.mp3?v=1589983981160"
    );
    this.load.audio(
      "shoot",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2Fshoot.mp3?v=1589983990745"
    );
  }
  create() {
    this.avatars = {};
    this.visibleBullets = {};
    this.ship = {};
    this.cursorKeys = this.input.keyboard.createCursorKeys();

    // explode animation to play when a bullet hits an avatar
    this.anims.create({
      key: "explode",
      frames: this.anims.generateFrameNumbers("explosion"),
      frameRate: 20,
      repeat: 0,
      hideOnComplete: true,
    });

    this.anims.create({
      key: "animateA",
      frames: this.anims.generateFrameNumbers("avatarAanimated"),
      frameRate: 2,
      repeat: -1,
    });

    this.anims.create({
      key: "animateB",
      frames: this.anims.generateFrameNumbers("avatarBanimated"),
      frameRate: 2,
      repeat: -1,
    });

    this.anims.create({
      key: "animateC",
      frames: this.anims.generateFrameNumbers("avatarCanimated"),
      frameRate: 2,
      repeat: -1,
    });

    this.soundLoop = 0;
    this.shootSound = this.sound.add("shoot");
    this.move1 = this.sound.add("move1");
    this.move2 = this.sound.add("move2");
    this.move3 = this.sound.add("move3");
    this.move4 = this.sound.add("move4");
    this.myDeathSound = this.sound.add("myDeath");
    this.opponentDeathSound = this.sound.add("opponentDeath");
    this.movingSounds = [this.move1, this.move2, this.move3, this.move4];

    setInterval(() => {
      if (audioControlChkbox.checked === true) {
        this.movingSounds[this.soundLoop].play();
        this.soundLoop++;
        if (this.soundLoop == 4) {
          this.soundLoop = 0;
        }
      }
    }, 500);

    // subscribe to the game tick
    myGameRoomCh.subscribe("game-state", (msg) => {
      if (msg.data.gameOn) {
        gameOn = true;
        if (msg.data.shipBody["0"]) {
          latestShipPosition = msg.data.shipBody["0"];
        }
        if (msg.data.bulletOrBlank != "") {
          let bulletId = msg.data.bulletOrBlank.id;
          this.visibleBullets[bulletId] = {
            id: bulletId,
            y: msg.data.bulletOrBlank.y,
            toLaunch: true,
            bulletSprite: "",
          };
        }
        if (msg.data.killerBulletId) {
          bulletThatShotSomeone = msg.data.killerBulletId;
        }
      }
      players = msg.data.players;
      totalPlayers = msg.data.playerCount;
    });

    // subscribe to the game over event and switch to a new page
    myGameRoomCh.subscribe("game-over", (msg) => {
      gameOn = false;
      localStorage.setItem("totalPlayers", msg.data.totalPlayers);
      localStorage.setItem("winner", msg.data.winner);
      localStorage.setItem("firstRunnerUp", msg.data.firstRunnerUp);
      localStorage.setItem("secondRunnerUp", msg.data.secondRunnerUp);
      myGameRoomCh.detach();
      myChannel.detach();
      if (msg.data.winner == "Nobody") {
        window.location.replace("/gameover");
      } else {
        window.location.replace("/winner");
      }
    });
  }

  update() {
    if (gameOn) {
      // create and update the position of the ship
      if (this.ship.x) {
        this.ship.x = latestShipPosition;
      } else {
        this.ship = this.physics.add
          .sprite(latestShipPosition, config.scale.height - 32, "ship")
          .setOrigin(0.5, 0.5);

        this.ship.x = latestShipPosition;
      }
      // create and update the position of the bullets
      for (let item in this.visibleBullets) {
        if (this.visibleBullets[item].toLaunch) {
          this.visibleBullets[item].toLaunch = false;
          this.createBullet(this.visibleBullets[item]);
        } else {
          this.visibleBullets[item].bulletSprite.y -= 20;
          if (
            this.visibleBullets[item].bulletSprite.y < 0 ||
            this.visibleBullets[item].id == bulletThatShotSomeone
          ) {
            this.visibleBullets[item].bulletSprite.destroy();
            delete this.visibleBullets[item];
          }
        }
      }
    }

    // remove avatars of players that have left the game
    for (let item in this.avatars) {
      if (!players[item]) {
        this.avatars[item].destroy();
        delete this.avatars[item];
      }
    }

    // create and update avatars and scores of all the players
    for (let item in players) {
      let avatarId = players[item].id;
      if (this.avatars[avatarId] && players[item].isAlive) {
        this.avatars[avatarId].x = players[item].x;
        this.avatars[avatarId].y = players[item].y;
        if (avatarId == myClientId) {
          document.getElementById("score").innerHTML =
            "Score: " + players[item].score;
        }
      } else if (!this.avatars[avatarId] && players[item].isAlive) {
        if (players[item].id != myClientId) {
          let avatarName =
            "avatar" + players[item].invaderAvatarType + "animated";
          this.avatars[avatarId] = this.physics.add
            .sprite(players[item].x, players[item].y, avatarName)
            .setOrigin(0.5, 0.5)
            .setTintFill(players[item].invaderAvatarColor.toString());
          console.log(players[item].invaderAvatarColor);
          this.avatars[avatarId].play(
            "animate" + players[item].invaderAvatarType
          );
          this.avatars[avatarId].setCollideWorldBounds(true);
          document.getElementById("join-leave-updates").innerHTML =
            players[avatarId].nickname + " joined";
          setTimeout(() => {
            document.getElementById("join-leave-updates").innerHTML = "";
          }, 2000);
        } else if (players[item].id == myClientId) {
          let avatarName =
            "avatar" + players[item].invaderAvatarType + "animated";
          this.avatars[avatarId] = this.physics.add
            .sprite(players[item].x, players[item].y, avatarName)
            .setOrigin(0.5, 0.5);
          this.avatars[avatarId].play(
            "animate" + players[item].invaderAvatarType
          );
          this.avatars[avatarId].setCollideWorldBounds(true);
          amIalive = true;
        }
      } else if (this.avatars[avatarId] && !players[item].isAlive) {
        this.explodeAndKill(avatarId);
      }
    }

    // check for user input
    this.publishMyInput();
  }

  // play the explosion animation and destroy the avatar
  explodeAndKill(deadPlayerId) {
    this.avatars[deadPlayerId].disableBody(true, true);
    if (deadPlayerId == myClientId) {
      if (audioControlChkbox.checked === true) {
        this.myDeathSound.play();
      }
    } else {
      if (audioControlChkbox.checked === true) {
        this.opponentDeathSound.play();
      }
    }
    let explosion = new Explosion(
      this,
      this.avatars[deadPlayerId].x,
      this.avatars[deadPlayerId].y
    );
    delete this.avatars[deadPlayerId];
    document.getElementById("join-leave-updates").innerHTML =
      players[deadPlayerId].nickname + " died";
    setTimeout(() => {
      document.getElementById("join-leave-updates").innerHTML = "";
    }, 2000);
  }

  // publish user input to the game server
  publishMyInput() {
    if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.left) && amIalive) {
      myChannel.publish("pos", {
        keyPressed: "left",
      });
    } else if (
      Phaser.Input.Keyboard.JustDown(this.cursorKeys.right) &&
      amIalive
    ) {
      myChannel.publish("pos", {
        keyPressed: "right",
      });
    }
  }

  // create a new bullet sprite
  createBullet(bulletObject) {
    let bulletId = bulletObject.id;
    this.visibleBullets[bulletId].bulletSprite = this.physics.add
      .sprite(this.ship.x + 23, bulletObject.y, "bullet")
      .setOrigin(0.5, 0.5);
    if (audioControlChkbox.checked === true) {
      this.shootSound.play();
    }
    // add an overlap callback if the current player is still alive
    if (amIalive) {
      if (
        this.physics.add.overlap(
          this.visibleBullets[bulletId].bulletSprite,
          this.avatars[myClientId],
          this.publishMyDeathNews,
          null,
          this
        )
      ) {
        bulletThatShotMe = bulletId;
      }
    }
  }

  // publish an eventto the server if the current player is hit
  publishMyDeathNews(bullet, avatar) {
    if (amIalive) {
      myChannel.publish("dead-notif", {
        killerBulletId: bulletThatShotMe,
        deadPlayerId: myClientId,
      });
    }
    amIalive = false;
  }
}

//game configuration
const config = {
  type: Phaser.AUTO,
  backgroundColor: "#FFFFF",
  scale: {
    parent: "gameContainer",
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1400,
    height: 700,
  },
  //canvasStyle: "border:1px solid #ffffff;",
  scene: [GameScene],
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },

};
