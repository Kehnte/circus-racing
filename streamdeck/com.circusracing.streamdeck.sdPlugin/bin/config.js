// config.ts — Runtime connection settings, updated from Stream Deck global settings.
export const config = {
    serverUrl: "http://localhost:3000",
    apiToken: "",
    pollIntervalMs: 1000,
};
export function applyGlobalSettings(settings) {
    if (typeof settings.serverUrl === "string" && settings.serverUrl)
        config.serverUrl = settings.serverUrl.replace(/\/$/, "");
    if (typeof settings.apiToken === "string")
        config.apiToken = settings.apiToken;
}
