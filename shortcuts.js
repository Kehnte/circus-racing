document.addEventListener("keydown", (event) => {
  if (event.target.tagName === "INPUT" || event.target.tagName === "SELECT") {
    return;
  }

  switch (event.key) {
    case "s":
    case "S":
      startRace();
      break;
    case "p":
    case "P":
      pauseRace();
      break;
    case "f":
    case "F":
      endRaceManually();
      break;
    case "r":
    case "R":
      resetRace();
      break;
    case "Escape":
      break;
  }
});
