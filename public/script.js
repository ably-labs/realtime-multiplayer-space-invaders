const realtime = Ably.Realtime({
  authUrl: "https://realtime-space-invaders.glitch.me/auth"
});

const gameRoom = realtime.channels.get("game-room");
const deadPlayerCh = realtime.channels.get("dead-player");
const myNickname = localStorage.getItem("nickname");

let myClientId;
let myChannel;

gameRoom.presence.enter(myNickname);

realtime.connection.once("connected", () => {
  myClientId = realtime.auth.clientId;
  myChannel = realtime.channels.get("clientChannel-" + myClientId);
});


let hasGameStarted = false;
let addedPreviousPlayers = false;

/* players associative array structure
  "id-dummy": {
    id: "",
    x: 0,
    y: 0,
    invaderAvatarType: "A",
    invaderAvatarColor: "green",
    score: 0
  }
*/
let players = {};
let playerCount;
let currentShipPos;
let bulletThatShotMe;
let bulletThatShotSomeone;
let notifiedBullet = "";
let amIDead = false;
let isGameOver = false;

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
        frameHeight: 32
      }
    );
    this.load.spritesheet(
      "avatarB",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FInvaderB_00%402x.png?v=1589228660870",
      {
        frameWidth: 48,
        frameHeight: 32
      }
    );
    this.load.spritesheet(
      "avatarC",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FInvaderC_00%402x.png?v=1589228654058",
      {
        frameWidth: 48,
        frameHeight: 32
      }
    );
    this.load.spritesheet(
      "avatarAgreen",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderAgreen.png?v=1589839188589",
      {
        frameWidth: 48,
        frameHeight: 48
      }
    );
    this.load.spritesheet(
      "avatarAcyan",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderAcyan.png?v=1589839190850",
      {
        frameWidth: 48,
        frameHeight: 48
      }
    );
    this.load.spritesheet(
      "avatarAyellow",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderAyellow.png?v=1589839197191",
      {
        frameWidth: 48,
        frameHeight: 48
      }
    );
    this.load.spritesheet(
      "avatarBgreen",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderBgreen.png?v=1589839187283",
      {
        frameWidth: 48,
        frameHeight: 48
      }
    );
    this.load.spritesheet(
      "avatarBcyan",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderBcyan.png?v=1589839193162",
      {
        frameWidth: 48,
        frameHeight: 48
      }
    );
    this.load.spritesheet(
      "avatarByellow",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderByellow.png?v=1589839195096",
      {
        frameWidth: 48,
        frameHeight: 48
      }
    );
    this.load.spritesheet(
      "avatarCgreen",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderCgreen.png?v=1589839203129",
      {
        frameWidth: 48,
        frameHeight: 48
      }
    );
    this.load.spritesheet(
      "avatarCcyan",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderCcyan.png?v=1589839200959",
      {
        frameWidth: 48,
        frameHeight: 48
      }
    );
    this.load.spritesheet(
      "avatarCyellow",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FinvaderCyellow.png?v=1589839198988",
      {
        frameWidth: 48,
        frameHeight: 48
      }
    );
    //
    this.load.spritesheet(
      "ship",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2FShip%402x.png?v=1589228730678",
      {
        frameWidth: 60,
        frameHeight: 32
      }
    );
    this.load.spritesheet(
      "bullet",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2Fbullet.png?v=1589229887570",
      {
        frameWidth: 32,
        frameHeight: 48
      }
    );
    this.load.spritesheet(
      "explosion",
      "https://cdn.glitch.com/f66772e3-bbf6-4f6d-b5d5-94559e3c1c6f%2Fexplosion57%20(2).png?v=1589491279459",
      {
        frameWidth: 48,
        frameHeight: 48
      }
    );
  } // end of preload

  create() {
    this.avatars = {};
    this.bullets = {};
    this.shipBody;
    this.cursorKeys = this.input.keyboard.createCursorKeys();

    this.anims.create({
      key: "explode",
      frames: this.anims.generateFrameNumbers("explosion"),
      frameRate: 20,
      repeat: 0,
      hideOnComplete: true
    });

// ----- start Ably channel subscriptions
    
    //subscribe to constantly changing game state from the server
    gameRoom.subscribe("game-state", msg => {
      //add the ship when the game first starts
      if (!hasGameStarted) {
        hasGameStarted = true;
        this.shipBody = this.physics.add
          .sprite(msg.data.shipBody["0"], config.height - 32, "ship")
          .setOrigin(0.5, 0.5);
        this.shipBody.x = msg.data.shipBody["0"];
        currentShipPos = msg.data.shipBody["0"];
      }
      //save the position of the ship in a global variable on the client-side
      if (msg.data.shipBody["0"]) {
        currentShipPos = msg.data.shipBody["0"];
      }
      //save the players info in a global variable on the client-side
      players = msg.data.players;
      playerCount = msg.data.playerCount;
      
      //add avatars for existing players
      if (!addedPreviousPlayers) {
        this.addPreviousPlayers();
      }
      
      //shoot bullets if the server says so
      if (msg.data.bullet != "") {
        this.shootBullets(msg.data.bullet);
      }
      
      //display the updated score of the player
      if (msg.data.players[myClientId]) {
        document.getElementById("score").innerHTML =
          "Score: " + msg.data.players[myClientId].score;
      }
    });

    //subscribe to players joining the game after the current player has joined
    gameRoom.subscribe("player-join", msg => {
      let avatarName =
        "avatar" + msg.data.invaderAvatarType + msg.data.invaderAvatarColor;
      this.avatars[msg.data.id] = this.physics.add
        .sprite(msg.data.x, msg.data.y, avatarName)
        .setOrigin(0.5, 0.5);
      this.avatars[msg.data.id].setCollideWorldBounds(true);
      
      //flash an update about a player joining
      if (msg.data.nickname != myNickname) {
        document.getElementById("join-leave-updates").innerHTML =
          msg.data.nickname + " joined the game";
        setTimeout(() => {
          document.getElementById("join-leave-updates").innerHTML = "";
        }, 2000);
      }
    });
    
    //subscribe to players dropping off the game
    gameRoom.subscribe("player-leave", msg => {
      //flash an update about a player leaving
      document.getElementById("join-leave-updates").innerHTML =
        msg.data.nickname + " left the game";
      setTimeout(() => {
        document.getElementById("join-leave-updates").innerHTML = "";
      }, 2000);
      this.avatars[msg.data.id].destroy();
      delete players[msg.data.id];
    });

    //subscribe to someone finishing the game
    gameRoom.subscribe("game-over", msg => {
      isGameOver = true;
      if(msg.data.winner == "timeout"){
        localStorage.setItem("winner", "Nobody");
        //check the score of players still in the game and sort them
        let leftOverPlayers = new Array();
        for (let item in players) {
          let playerId = players[item].id;
          leftOverPlayers.push({
            nickname: players[playerId].nickname,
            score: players[playerId].score
          });
        }
        let totalPlayers = leftOverPlayers.length;
        localStorage.setItem("totalPlayers", totalPlayers);
        leftOverPlayers.sort((a, b) => {
          return b.score - a.score;
        });

        //set runner up info
        if (totalPlayers >= 3) {
          localStorage.setItem("firstRunnerUp", leftOverPlayers[0].nickname);
          localStorage.setItem("secondRunnerUp", leftOverPlayers[1].nickname);
        } else if (totalPlayers == 2) {
          localStorage.setItem("firstRunnerUp", leftOverPlayers[0].nickname);
        }
        //switch to the winner screen
        window.location.replace(
          "https://realtime-space-invaders.glitch.me/gameover"
        );
      }else{
        localStorage.setItem("winner", players[msg.data.winner].nickname);
        //check the score of players still in the game and sort them
        let leftOverPlayers = new Array();
        for (let item in players) {
          let playerId = players[item].id;
          leftOverPlayers.push({
            nickname: players[playerId].nickname,
            score: players[playerId].score
          });
        }
        let totalPlayers = leftOverPlayers.length;
        localStorage.setItem("totalPlayers", totalPlayers);
        leftOverPlayers.sort((a, b) => {
          return b.score - a.score;
        });

        //set runner up info
        if (totalPlayers >= 3) {
          localStorage.setItem("firstRunnerUp", leftOverPlayers[1].nickname);
          localStorage.setItem("secondRunnerUp", leftOverPlayers[2].nickname);
        } else if (totalPlayers == 2) {
          localStorage.setItem("firstRunnerUp", leftOverPlayers[1].nickname);
        }
        //switch to the winner screen
        window.location.replace(
          "https://realtime-space-invaders.glitch.me/winner"
        );
      }
 
    });

    //subscribe to any player dying
    deadPlayerCh.subscribe("dead-notif-fanout", msg => {
      bulletThatShotSomeone = msg.data.bulletId;
      if (msg.data.deadPlayerId == myClientId) {
        amIDead = true;
        document.getElementById("score").innerHTML += " | P.S. YOU ARE DEAD!";
      }
      
      //disable the dead players body and cause an explosion
      let deadPlayer = this.avatars[msg.data.deadPlayerId];
      deadPlayer.disableBody(true, true);
      let explosion = new Explosion(this, deadPlayer.x, deadPlayer.y);
    });
  // ----- end of Ably channel subscriptions
  }//end of create method
   
  //method to create a bullet avatar when the server says so
  shootBullets(bullet) {
    let newBulletId = JSON.stringify(bullet.id);
    this.bullets[newBulletId] = bullet;
    this.bullets[newBulletId].bulletSprite = this.physics.add
      .sprite(this.shipBody.x - 8, bullet.y, "bullet")
      .setOrigin(0.5, 0.5);

    //add an overlap callback if the current player is still alive
    if(this.avatars[myClientId]) {
      if (this.physics.add.overlap(this.bullets[newBulletId].bulletSprite, this.avatars[myClientId], this.bomber, null, this)) {
        bulletThatShotMe = newBulletId;
      }
    }
  }

  //method that will be called when there's an overlap between the current player's avatar and a bullet
  bomber(bullet, avatar) {
    if (notifiedBullet != bulletThatShotMe) {
      notifiedBullet = bulletThatShotMe;
      //let the server know that the current player died
      deadPlayerCh.publish("dead-notif", {
        bulletId: bulletThatShotMe,
        deadPlayerId: myClientId
      });
    }
  }

  //method to add previously existing players before the current player joined
  addPreviousPlayers() {
    for (let item in players) {
      let avatarId = players[item].id;
      if (!this.avatars[avatarId] && avatarId != myClientId) {
        let avatarName = "avatar" + players[avatarId].invaderAvatarType + players[avatarId].invaderAvatarColor;
        this.avatars[avatarId] = this.physics.add
          .sprite(players[item].x, players[item].y, avatarName)
          .setOrigin(0.5, 0.5);
        this.avatars[avatarId].setCollideWorldBounds(true);
      }
    }
    addedPreviousPlayers = true;
  }

  update() {
    //update the position of the ship as per server
    if (this.shipBody) {
      this.shipBody.x = currentShipPos;
    }
    
    //update the position of the avatars as per server
    for (let item in players) {
      let avatarId = players[item].id;
      if (this.avatars[avatarId]) {
        this.avatars[avatarId].x = players[item].x;
        this.avatars[avatarId].y = players[item].y;
      }
    }
    
    //update the position of the bullets
    let bulletsArr = this.bullets;
    for (let item in bulletsArr) {
      bulletsArr[item].bulletSprite.x = this.shipBody.x - 8;
      bulletsArr[item].bulletSprite.y -= 20;
      //destroy the bullet if it has crossed the top border
      if (bulletsArr[item].bulletSprite.y < 0 || !bulletsArr[item].bulletSprite) {
        bulletsArr[item].bulletSprite.destroy();
        let bulletToDelete = bulletsArr[item].id;
        let bulletIdStr = JSON.stringify(bulletToDelete);
        delete bulletsArr[bulletIdStr];
      }
    }
    //call a method to check for user input
    this.publishPlayerInput();
  } //end of update method

  //method to check if the user is pressing the arrow keys and publish that info to the server
  publishPlayerInput() {
    if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.left) && !isGameOver) {
      myChannel.publish("pos", {
        keyPressed: "left"
      });
    } else if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.right) && !isGameOver) {
      myChannel.publish("pos", {
        keyPressed: "right"
      });
    }
  }
}

//game configuration
const config = {
  width: 1400,
  height: 750,
  backgroundColor: "#FFFFF",
  parent: "gameContainer",
  scene: [GameScene],
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  }
};

let game = new Phaser.Game(config);
