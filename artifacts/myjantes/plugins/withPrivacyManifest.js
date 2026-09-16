const { withDangerousMod } = require("expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Copies PrivacyInfo.xcprivacy into the iOS app bundle root so Apple
 * review accepts it (required since May 2024).
 */
const withPrivacyManifest = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const src = path.resolve(__dirname, "../assets/PrivacyInfo.xcprivacy");
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const appName = cfg.modRequest.projectName || "MyJantes";
      const dest = path.join(iosRoot, appName, "PrivacyInfo.xcprivacy");
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log("[withPrivacyManifest] Copied PrivacyInfo.xcprivacy →", dest);
      } else {
        console.warn("[withPrivacyManifest] Source not found:", src);
      }
      return cfg;
    },
  ]);
};

module.exports = withPrivacyManifest;
