let nickname = "";
let nicknameInput = document.getElementById("nickname");

function setNickname() {
  localStorage.clear()
  nickname = nicknameInput.value;
  localStorage.setItem("nickname", nickname);
}

if(nicknameInput){
  nicknameInput.addEventListener("keyup", function(event) {
    event.preventDefault();
    if (event.keyCode === 13) {
      document.getElementById("go-span").click();
    }
  });
}


