// shortcuts.js

// Global keyboard shortcuts for the race manager. Ignored when focus is inside any text input, select, textarea or Material Web component
document.addEventListener("keydown", (event) => {
    const tag = event.target.tagName.toUpperCase();

    // Skip shortcuts when the user is typing in a native form field
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

    // Skip shortcuts when focus is inside a Material Web (md-*) component
    if (tag.startsWith("MD-")) return;

    const active = document.activeElement;
    if (active && active.tagName && active.tagName.toUpperCase().startsWith("MD-")) return;

    switch (event.key) {
        case "s":
        case "S":
            startRace();   // Start / resume the race
            break;
        case "p":
        case "P":
            pauseRace();   // Pause the race
            break;
        case "f":
        case "F":
            endRaceManually();  // Force-finish the race
            break;
        case "r":
        case "R":
            resetRace();   // Reset all lap counts and return to standby
            break;
        case "Escape":
            // Reserved for future use (e.g. closing modals)
            break;
    }
});
