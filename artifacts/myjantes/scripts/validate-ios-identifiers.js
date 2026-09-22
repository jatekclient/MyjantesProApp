#!/usr/bin/env node
/**
 * Verify that every checked-in mobile release configuration targets the same
 * Apple application before creating or submitting a production build.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ARTIFACT_ROOT = path.resolve(__dirname, '..');
const APP_CONFIG_PATH = path.join(ARTIFACT_ROOT, 'app.json');
const EAS_CONFIG_PATH = path.join(ARTIFACT_ROOT, 'eas.json');
const CREDENTIAL_HELPER_PATH = path.join(__dirname, 'create-ios-creds.js');

const EXPECTED = {
  appName: 'MyJantes Pro',
  bundleIdentifier: 'com.myjantes.pro',
  androidPackage: 'com.myjantes.pro',
  appleTeamId: 'GP593F562X',
  ascAppId: '6812158864',
};

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`Could not read ${path.relative(ARTIFACT_ROOT, filePath)}: ${error.message}`);
  }
}

function readHelperConstant(source, name) {
  const match = source.match(
    new RegExp(`(?:const|let)\\s+${name}\\s*=\\s*(['"])([^'"]+)\\1`),
  );
  return match ? match[2] : undefined;
}

function fail(message) {
  console.error(`\n Mobile identity preflight failed: ${message}`);
  process.exitCode = 1;
}

const appConfig = readJson(APP_CONFIG_PATH);
const easConfig = readJson(EAS_CONFIG_PATH);
const submitIos = easConfig.submit?.production?.ios;
const helperSource = fs.existsSync(CREDENTIAL_HELPER_PATH)
  ? fs.readFileSync(CREDENTIAL_HELPER_PATH, 'utf8')
  : null;

const values = [
  {
    label: 'Expected app name',
    actual: EXPECTED.appName,
    expected: EXPECTED.appName,
  },
  {
    label: 'Expo app.json → expo.name',
    actual: appConfig.expo?.name,
    expected: EXPECTED.appName,
  },
  {
    label: 'Expected Apple bundle ID',
    actual: EXPECTED.bundleIdentifier,
    expected: EXPECTED.bundleIdentifier,
  },
  {
    label: 'Expo app.json → expo.ios.bundleIdentifier',
    actual: appConfig.expo?.ios?.bundleIdentifier,
    expected: EXPECTED.bundleIdentifier,
  },
  {
    label: 'Expo app.json → expo.android.package',
    actual: appConfig.expo?.android?.package,
    expected: EXPECTED.androidPackage,
  },
  {
    label: 'EAS production submit → ios.bundleIdentifier',
    actual: submitIos?.bundleIdentifier,
    expected: EXPECTED.bundleIdentifier,
  },
  {
    label: 'Expo app.json → expo.ios.appleTeamId',
    actual: appConfig.expo?.ios?.appleTeamId,
    expected: EXPECTED.appleTeamId,
  },
  {
    label: 'EAS production submit → ios.appleTeamId',
    actual: submitIos?.appleTeamId,
    expected: EXPECTED.appleTeamId,
  },
  {
    label: 'EAS production submit → ios.ascAppId',
    actual: submitIos?.ascAppId,
    expected: EXPECTED.ascAppId,
  },
];

if (helperSource) {
  values.push(
    {
      label: 'create-ios-creds.js → BUNDLE_ID',
      actual: readHelperConstant(helperSource, 'BUNDLE_ID'),
      expected: EXPECTED.bundleIdentifier,
    },
    {
      label: 'create-ios-creds.js → TEAM_ID',
      actual: readHelperConstant(helperSource, 'TEAM_ID'),
      expected: EXPECTED.appleTeamId,
    },
    {
      label: 'create-ios-creds.js → APP_STORE_ID',
      actual: readHelperConstant(helperSource, 'APP_STORE_ID'),
      expected: EXPECTED.ascAppId,
    },
  );
}

const failures = values.filter(({ actual, expected }) => actual !== expected);

if (failures.length > 0) {
  console.error('\n Mobile identity preflight failed. Do not build or submit until these values match:');
  for (const { label, actual, expected } of failures) {
    console.error(` - ${label}: expected "${expected}", found "${actual ?? '<missing>'}"`);
  }
  process.exitCode = 1;
} else {
  console.log('Mobile identity preflight passed.');
  console.log(` - Bundle ID: ${EXPECTED.bundleIdentifier}`);
  console.log(` - Apple Team ID: ${EXPECTED.appleTeamId}`);
  console.log(` - App Store ID: ${EXPECTED.ascAppId}`);
}