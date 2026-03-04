// shortcuts.js

document.addEventListener("keydown", (event) => {
    const tag = event.target.tagName.toUpperCase();

    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

    if (tag.startsWith("MD-")) return;

    const active = document.activeElement;
    if (active && active.tagName && active.tagName.toUpperCase().startsWith("MD-")) return;

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