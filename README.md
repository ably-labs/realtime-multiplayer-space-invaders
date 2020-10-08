# Realtime multiplayer game of Space Invaders

This project runs a realtime multiplayer version of the classic retro game, Space Invaders.

![Preview of the game](https://user-images.githubusercontent.com/5900152/84092843-7ea1ce80-a9f0-11ea-809d-41cd20fb8e59.gif)

## Services/ libraries used in the game

- [Phaser 3](https://phaser.io)
- [Ably Realtime](https://www.ably.io)
- [p2 NPM library](https://www.npmjs.com/package/p2)

# How to run this game

1. Create a free account with [Ably Realtime](https://www.ably.io) and obtain an API Key
2. Clone this repo locally
3. Navigate to the project folder and run `npm install` to install the dependencies
4. In the `server.js` file, update the `ABLY_API_KEY` variable with your own API Key, preferably via a .env file
5. Again in the `server.js` file, update `process.env.PORT` to use a port number of your choice directly or add a `PORT` variable in your .env file
6. You can also update the `MIN_PLAYERS_TO_START_GAME` if you'd like to have more than three people play the game

Please [reach out to me on Twitter](https://www.twitter.com/Srushtika) for any questions.
