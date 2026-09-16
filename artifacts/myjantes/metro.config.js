const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude server-only packages (google-cloud, etc.) from Metro's watcher
// These are installed for the api-server and must not be bundled in the mobile app.
const blockList = [
  /node_modules\/.pnpm\/@google-cloud\+storage.*/,
  /node_modules\/.pnpm\/google-auth-library.*/,
  /node_modules\/.pnpm\/@google-cloud\+.*/,
  /node_modules\/.pnpm\/gaxios.*/,
  /node_modules\/.pnpm\/gcp-metadata.*/,
  /node_modules\/.pnpm\/googleapis-common.*/,
];

config.resolver = config.resolver || {};
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  ...blockList,
];

module.exports = config;
