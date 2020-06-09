let winner = localStorage.getItem("winner");
let firstRunnerUp = localStorage.getItem("firstRunnerUp");
let secondRunnerUp = localStorage.getItem("secondRunnerUp");
let totalPlayers = localStorage.getItem("totalPlayers");

document.getElementById("winner-announcement").innerHTML =
  winner + " won the game!";

if (firstRunnerUp) {
  document.getElementById("first-runnerup").innerHTML =
    firstRunnerUp + " is the first runner up";
}
if (secondRunnerUp) {
  document.getElementById("second-runnerup").innerHTML =
    secondRunnerUp + " is the second runner up";
}
