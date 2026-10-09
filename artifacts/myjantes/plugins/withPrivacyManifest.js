const { withDangerousMod, withXcodeProject, IOSConfig } = require("expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Copies the source manifest into the native project. Archive inclusion and
 * declarations still need verification; a manifest does not guarantee approval.
 */
const withPrivacyManifest = (config) => {
  config = withXcodeProject(config, (cfg) => {
    const appName = cfg.modRequest.projectName ||
      IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath: `${appName}/PrivacyInfo.xcprivacy`,
      groupName: appName,
      project: cfg.modResults,
      isBuildFile: true,
    });
    return cfg;
  });
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
        throw new Error("[withPrivacyManifest] Required source not found: " + src);
      }
      return cfg;
    },
  ]);
};

module.exports = withPrivacyManifest;
