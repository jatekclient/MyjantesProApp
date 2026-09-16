const fs = require("fs");
const path = require("path");

const appJsonPath = path.resolve(__dirname, "..", "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

const oldBuildNumber = parseInt(appJson.expo.ios.buildNumber || "1", 10);
const oldVersionCode = parseInt(appJson.expo.android.versionCode || 1, 10);

const newBuildNumber = oldBuildNumber + 1;
const newVersionCode = oldVersionCode + 1;

appJson.expo.ios.buildNumber = String(newBuildNumber);
appJson.expo.android.versionCode = newVersionCode;

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");

console.log(`Build incrémenté:`);
console.log(`  iOS buildNumber: ${oldBuildNumber} → ${newBuildNumber}`);
console.log(`  Android versionCode: ${oldVersionCode} → ${newVersionCode}`);
console.log(`  Version: ${appJson.expo.version}`);
