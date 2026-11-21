const { getDefaultConfig } = require('expo/metro-config');
const { withRorkMetro } = require('@rork-ai/toolkit-sdk/metro');
const config = getDefaultConfig(__dirname);
config.watcher.watchman = { ...config.watcher.watchman, enabled: false };
module.exports = withRorkMetro(config);
