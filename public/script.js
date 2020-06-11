let gameRoom;
let deadPlayerCh;
let myClientId;
let myChannel;
let gameOn = false;
let players = {};
let totalPlayers = 0;
let latestShipPosition;
let bulletThatShotMe;
let bulletThatShotSomeone;
let bulletOutOfBounds = "";
let amIalive = false;
let game;

const BASE_SERVER_URL = "http://localhost:5000";
const myNickname = localStorage.getItem("nickname");

// connect to Ably
const realtime = Ably.Realtime({
  authUrl: BASE_SERVER_URL + "/auth",
});

// once connected to Ably, instantiate channels and launch the game
realtime.connection.once("connected", () => {
  myClientId = realtime.auth.clientId;
  gameRoom = realtime.channels.get("game-room");
  deadPlayerCh = realtime.channels.get("dead-player");
  myChannel = realtime.channels.get("clientChannel-" + myClientId);
  gameRoom.presence.enter(myNickname);
  game = new Phaser.Game(config);
});

// primary game scene
class GameScene extends Phaser.Scene {
  constructor() {
    super("gameScene");
  }

  preload() {
    this.load.spritesheet(
      "avatarA",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FInvaderA_00%402x.png?v=1589228669385",
      {
        frameWidth: 48,
        frameHeight: 32,
      }
    );
    this.load.spritesheet(
      "avatarB",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FInvaderB_00%402x.png?v=1589228660870",
      {
        frameWidth: 48,
        frameHeight: 32,
      }
    );
    this.load.spritesheet(
      "avatarC",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FInvaderC_00%402x.png?v=1589228654058",
      {
        frameWidth: 48,
        frameHeight: 32,
      }
    );
    this.load.spritesheet(
      "avatarAgreen",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderAgreen.png?v=1589839188589",
      {
        frameWidth: 48,
        frameHeight: 48,
      }
    );
    this.load.spritesheet(
      "avatarAcyan",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderAcyan.png?v=1589839190850",
      {
        frameWidth: 48,
        frameHeight: 48,
      }
    );
    this.load.spritesheet(
      "avatarAyellow",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderAyellow.png?v=1589839197191",
      {
        frameWidth: 48,
        frameHeight: 48,
      }
    );
    this.load.spritesheet(
      "avatarBgreen",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderBgreen.png?v=1589839187283",
      {
        frameWidth: 48,
        frameHeight: 48,
      }
    );
    this.load.spritesheet(
      "avatarBcyan",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderBcyan.png?v=1589839193162",
      {
        frameWidth: 48,
        frameHeight: 48,
      }
    );
    this.load.spritesheet(
      "avatarByellow",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderByellow.png?v=1589839195096",
      {
        frameWidth: 48,
        frameHeight: 48,
      }
    );
    this.load.spritesheet(
      "avatarCgreen",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderCgreen.png?v=1589839203129",
      {
        frameWidth: 48,
        frameHeight: 48,
      }
    );
    this.load.spritesheet(
      "avatarCcyan",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderCcyan.png?v=1589839200959",
      {
        frameWidth: 48,
        frameHeight: 48,
      }
    );
    this.load.spritesheet(
      "avatarCyellow",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderCyellow.png?v=1589839198988",
      {
        frameWidth: 48,
        frameHeight: 48,
      }
    );
    //
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
        frameWidth: 32,
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

    // subscribe to the game tick
    gameRoom.subscribe("game-state", (msg) => {
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
    gameRoom.subscribe("game-over", (msg) => {
      gameOn = false;
      localStorage.setItem("totalPlayers", msg.data.totalPlayers);
      localStorage.setItem("winner", msg.data.winner);
      localStorage.setItem("firstRunnerUp", msg.data.firstRunnerUp);
      localStorage.setItem("secondRunnerUp", msg.data.secondRunnerUp);
      gameRoom.detach();
      deadPlayerCh.detach();
      myChannel.detach();
      if (msg.data.winner == "Nobody") {
        window.location.replace(BASE_SERVER_URL + "/gameover");
      } else {
        window.location.replace(BASE_SERVER_URL + "/winner");
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
          .sprite(latestShipPosition, config.height - 32, "ship")
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
            "avatar" +
            players[item].invaderAvatarType +
            players[item].invaderAvatarColor;
          this.avatars[avatarId] = this.physics.add
            .sprite(players[item].x, players[item].y, avatarName)
            .setOrigin(0.5, 0.5);
          this.avatars[avatarId].setCollideWorldBounds(true);
          document.getElementById("join-leave-updates").innerHTML =
            players[avatarId].nickname + " joined";
          setTimeout(() => {
            document.getElementById("join-leave-updates").innerHTML = "";
          }, 2000);
        } else if (players[item].id == myClientId) {
          let avatarName = "avatar" + players[item].invaderAvatarType;
          this.avatars[avatarId] = this.physics.add
            .sprite(players[item].x, players[item].y, avatarName)
            .setOrigin(0.5, 0.5);
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
      .sprite(this.ship.x - 8, bulletObject.y, "bullet")
      .setOrigin(0.5, 0.5);

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
      deadPlayerCh.publish("dead-notif", {
        killerBulletId: bulletThatShotMe,
        deadPlayerId: myClientId,
      });
    }
    amIalive = false;
  }
}

//game configuration
const config = {
  width: 1400,
  height: 750,
  backgroundColor: "#FFFFF",
  canvasStyle: "border:1px solid #ffffff;",
  parent: "gameContainer",
  scene: [GameScene],
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
};
