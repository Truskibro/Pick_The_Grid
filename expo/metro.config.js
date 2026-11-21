const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// Watchman segfaults in this sandbox; fall back to Metro's node watcher.
config.watcher.watchman = { ...config.watcher.watchman, enabled: false };

module.exports = withRorkMetro(config);
