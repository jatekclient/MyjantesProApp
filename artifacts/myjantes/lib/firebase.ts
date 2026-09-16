import { initializeApp, getApps } from "firebase/app";
import { Platform } from "react-native";

let firebaseApp: any = null;
let firebaseAuth: any = null;
let initAttempted = false;

const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
}

export function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;
  firebaseApp = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
  return firebaseApp;
}

export function getFirebaseAuth() {
  if (initAttempted) return firebaseAuth;
  initAttempted = true;

  try {
    const app = getFirebaseApp();
    if (!app) return null;

    if (Platform.OS === "web") {
      const { getAuth, browserLocalPersistence, setPersistence } = require("firebase/auth");
      firebaseAuth = getAuth(app);
      setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {});
    } else {
      try {
        const { initializeAuth, getReactNativePersistence } = require("firebase/auth");
        const ReactNativeAsyncStorage = require("@react-native-async-storage/async-storage").default;
        firebaseAuth = initializeAuth(app, {
          persistence: getReactNativePersistence(ReactNativeAsyncStorage),
        });
      } catch {
        const { getAuth } = require("firebase/auth");
        firebaseAuth = getAuth(app);
      }
    }

    return firebaseAuth;
  } catch (err: any) {
    console.error("[Firebase] Init failed:", err?.message);
    firebaseApp = null;
    firebaseAuth = null;
    initAttempted = false;
    return null;
  }
}
