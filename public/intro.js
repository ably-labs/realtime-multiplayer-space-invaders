//const BASE_SERVER = "https://space-invaders-multiplayer.herokuapp.com";
let nickname = "";
let nicknameInput = document.getElementById("nickname");
let roomCode = "";

function hostNewGame() {
  localStorage.clear();
  roomCode = getRandomRoomId();
  nickname = nicknameInput.value;
  localStorage.setItem("isHost", true);
  localStorage.setItem("nickname", nickname);
  localStorage.setItem("roomCode", roomCode);
  window.location.replace("/gameplay?roomCode=" + roomCode + "&isHost=true");
}

function joinRoom() {
  localStorage.clear();
  nickname = nicknameInput.value;
  roomCode = document.getElementById("room-code").value;
  localStorage.setItem("isHost", false);
  localStorage.setItem("nickname", nickname);
  localStorage.setItem("roomCode", roomCode);
  window.location.replace("/gameplay?roomCode=" + roomCode + "&isHost=false");
}

function getRandomRoomId() {
  return "room-" + Math.random().toString(36).substr(2, 8);
}
