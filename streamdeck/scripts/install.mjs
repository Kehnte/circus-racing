// install.mjs — Copies the .sdPlugin folder to the Elgato plugins directory.
// Run with: node scripts/install.mjs

import { cpSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const PLUGIN_NAME = "com.circusracing.streamdeck.sdPlugin";
const ROOT  = fileURLToPath(new URL("..", import.meta.url));
const SRC   = join(ROOT, PLUGIN_NAME);
const DEST  = join(homedir(), "AppData", "Roaming", "Elgato", "StreamDeck", "Plugins", PLUGIN_NAME);
const NMODS = join(ROOT, "node_modules");
const NDEST = join(DEST, "node_modules");

// Copy plugin folder
cpSync(SRC, DEST, { recursive: true, force: true });

// Copy node_modules so the plugin can resolve its dependencies at runtime
cpSync(NMODS, NDEST, { recursive: true, force: true });

console.log(`Installed to: ${DEST}`);
console.log("Restart the Stream Deck app to load the plugin.");
