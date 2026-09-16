// Development-only: inject Firebase config from DEV_SECRETS_KEYS if individual
// EXPO_PUBLIC_* vars are not already present. In production native builds these
// values must be supplied as EAS environment variables at build time — Metro
// replaces process.env.EXPO_PUBLIC_* at bundle time and runtime assignment has
// no effect on a production binary.
try {
  const secretsJson = process.env.DEV_SECRETS_KEYS || "{}";
  const secrets = JSON.parse(secretsJson);
  const apiKey = secrets.EXPO_PUBLIC_FIREBASE_API_KEY || secrets.GOOGLE_API_KEY_2;
  const appId = secrets.EXPO_PUBLIC_FIREBASE_APP_ID;
  const clientId = secrets.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (apiKey) process.env.EXPO_PUBLIC_FIREBASE_API_KEY = apiKey;
  if (appId) process.env.EXPO_PUBLIC_FIREBASE_APP_ID = appId;
  if (clientId) process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = clientId;
} catch {}

console.log("[STARTUP] _layout.tsx module loading...");

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UpstreamErrorBanner } from "@/components/UpstreamErrorBanner";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider, useTheme } from "@/lib/theme";

let GestureHandlerRootView: React.ComponentType<any>;
try {
  GestureHandlerRootView = require("react-native-gesture-handler").GestureHandlerRootView;
  console.log("[STARTUP] GestureHandler loaded");
} catch (e) {
  console.warn("[STARTUP] GestureHandler failed, using View fallback");
  GestureHandlerRootView = View;
}

let KeyboardProvider: React.ComponentType<any>;
try {
  KeyboardProvider = require("react-native-keyboard-controller").KeyboardProvider;
  console.log("[STARTUP] KeyboardProvider loaded");
} catch (e) {
  console.warn("[STARTUP] KeyboardProvider failed, using passthrough");
  KeyboardProvider = ({ children }: any) => <>{children}</>;
}

let useFontsHook: any;
let Exo2_400Regular: any, Exo2_500Medium: any, Exo2_600SemiBold: any, Exo2_700Bold: any, Exo2_800ExtraBold: any;
try {
  const exo2Module = require("@expo-google-fonts/exo-2");
  useFontsHook = exo2Module.useFonts;
  Exo2_400Regular = exo2Module.Exo2_400Regular;
  Exo2_500Medium = exo2Module.Exo2_500Medium;
  Exo2_600SemiBold = exo2Module.Exo2_600SemiBold;
  Exo2_700Bold = exo2Module.Exo2_700Bold;
  Exo2_800ExtraBold = exo2Module.Exo2_800ExtraBold;
  console.log("[STARTUP] Fonts modules loaded");
} catch (e) {
  console.warn("[STARTUP] Font modules failed:", e);
  useFontsHook = null;
}

const safeFontHook: (fonts: Record<string, any>) => [boolean, Error | null] =
  useFontsHook ?? (() => [true, null]);

try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  console.warn("[STARTUP] preventAutoHideAsync failed:", e);
}

if (typeof window !== "undefined") {
  try {
    window.addEventListener("unhandledrejection", (event) => {
      const msg = event?.reason?.message || "";
      if (msg.includes("timeout exceeded") || msg.includes("FontFace") || msg.includes("font")) {
        event.preventDefault();
      }
    });
  } catch {}
}

import { initApiConfig } from "@/lib/config";
initApiConfig().catch(() => {});
console.log("[STARTUP] Module-level init complete");

function RootLayoutNav() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        headerStyle: { backgroundColor: theme.headerBg },
        headerTintColor: theme.text,
        headerTitleStyle: { fontFamily: theme.fontSemiBold, color: theme.text },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="legal" options={{ presentation: "modal", headerShown: true, title: "Mentions Légales" }} />
      <Stack.Screen name="privacy" options={{ presentation: "modal", headerShown: true, title: "Politique de Confidentialité" }} />
      <Stack.Screen name="onboarding" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="support" options={{ presentation: "formSheet", sheetAllowedDetents: [0.75], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="consent" options={{ headerShown: false, animation: "fade", gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  let fontsLoaded = false;
  let fontError: Error | null = null;

  try {
    const result = safeFontHook({
      Exo2_400Regular,
      Exo2_500Medium,
      Exo2_600SemiBold,
      Exo2_700Bold,
      Exo2_800ExtraBold,
      ...Ionicons.font,
    });
    fontsLoaded = result[0];
    fontError = result[1] ?? null;
  } catch (e) {
    console.warn("[STARTUP] useFonts hook failed:", e);
    fontError = e as Error;
  }

  useEffect(() => {
    console.log("[STARTUP] RootLayout mounted, fontsLoaded:", fontsLoaded, "fontError:", !!fontError);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      console.log("[STARTUP] Fonts resolved — fontsLoaded:", fontsLoaded, "fontError:", fontError?.message);
      const timer = setTimeout(() => {
        setAppReady(true);
        SplashScreen.hideAsync().catch(() => {});
        console.log("[STARTUP] App ready (fonts resolved)");
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const fallback = setTimeout(() => {
      console.log("[STARTUP] Fallback timer fired — forcing app ready");
      setAppReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 2500);
    return () => clearTimeout(fallback);
  }, []);

  if (!appReady && !fontsLoaded && !fontError) {
    return null;
  }

  console.log("[STARTUP] Rendering main app tree");

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <ThemeProvider>
              <AuthProvider>
                <RootLayoutNav />
                <UpstreamErrorBanner />
              </AuthProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
