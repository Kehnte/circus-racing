//shortcuts.js

// Add an event listener for keydown events on the document
document.addEventListener("keydown", (event) => {
  // Check if the target element is an input or select field, and return early if it is
  if (event.target.tagName === "INPUT" || event.target.tagName === "SELECT") {
    return;
  }

  // Switch statement to handle different key presses
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
