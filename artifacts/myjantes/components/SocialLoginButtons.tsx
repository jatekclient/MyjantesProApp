import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { Ionicons } from "@expo/vector-icons";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useTheme } from "@/lib/theme";
import Constants from "expo-constants";

WebBrowser.maybeCompleteAuthSession();

const IOS_CLIENT_ID = "129808585113-q81uhog8n2eivfpgg924tdfrh3s3ifau.apps.googleusercontent.com";
const ANDROID_CLIENT_ID = "129808585113-fs2ovorj3vl39g4sgvehi61k3jprhood.apps.googleusercontent.com";
const WEB_CLIENT_ID = "129808585113-atcn4gnb3jund8ttee1nubc1gr3kt2ln.apps.googleusercontent.com";

const isExpoGo = Constants.appOwnership === "expo";

export interface SocialLoginButtonsProps {
  onIdToken: (idToken: string, provider: string) => Promise<void>;
  onError: (message: string) => void;
}

function buildNativeRedirectUri() {
  if (isExpoGo) {
    return makeRedirectUri({ scheme: "myjantes", path: "auth/callback" });
  }
  if (Platform.OS === "ios") {
    return makeRedirectUri({
      native: `com.googleusercontent.apps.${IOS_CLIENT_ID.split(".apps.")[0]}:/oauthredirect`,
    });
  }
  if (Platform.OS === "android") {
    return makeRedirectUri({
      native: `com.googleusercontent.apps.${ANDROID_CLIENT_ID.split(".apps.")[0]}:/oauthredirect`,
    });
  }
  return makeRedirectUri({});
}

function SocialLoginButtonsInner({ onIdToken, onError }: SocialLoginButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
    if (Platform.OS === "web") {
      import("firebase/auth").catch(() => {});
    }
  }, []);

  const Google = require("expo-auth-session/providers/google");

  const redirectUri = Platform.OS === "web" ? makeRedirectUri({}) : buildNativeRedirectUri();

  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || ANDROID_CLIENT_ID,
    redirectUri,
  });

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (googleResponse?.type === "success") {
      handleGoogleCredential(
        googleResponse.authentication?.idToken ?? null,
        googleResponse.authentication?.accessToken ?? null
      );
    } else if (
      googleResponse?.type === "error" ||
      googleResponse?.type === "dismiss"
    ) {
      setLoading(null);
    }
  }, [googleResponse]);

  const handleGoogleCredential = async (
    googleIdToken?: string | null,
    accessToken?: string | null
  ) => {
    if (!googleIdToken && !accessToken) {
      console.warn("[Google] No idToken or accessToken in OAuth response");
      onError("Aucun token reçu de Google. Veuillez réessayer.");
      setLoading(null);
      return;
    }
    if (!googleIdToken) {
      console.warn("[Google] idToken absent — only accessToken available. Firebase may reject this.");
    }
    try {
      const { getFirebaseAuth } = require("@/lib/firebase");
      const { signInWithCredential, GoogleAuthProvider } = await import("firebase/auth");
      const fbAuth = getFirebaseAuth();
      if (!fbAuth) throw new Error("Firebase non configuré");
      const credential = GoogleAuthProvider.credential(googleIdToken ?? null, accessToken ?? null);
      const result = await signInWithCredential(fbAuth, credential);
      const firebaseIdToken = await result.user.getIdToken();
      await onIdToken(firebaseIdToken, "google");
    } catch (err: any) {
      const msg = err?.message || "Erreur Google Sign-In";
      console.error("[Google] signInWithCredential failed:", msg);
      onError(msg);
    } finally {
      setLoading(null);
    }
  };

  const handleGoogle = async () => {
    setLoading("google");
    try {
      if (Platform.OS === "web") {
        const { getFirebaseAuth } = require("@/lib/firebase");
        const { signInWithPopup, GoogleAuthProvider } = await import("firebase/auth");
        const fbAuth = getFirebaseAuth();
        if (!fbAuth) throw new Error("Firebase non configuré");
        const provider = new GoogleAuthProvider();
        provider.addScope("email");
        provider.addScope("profile");
        const result = await signInWithPopup(fbAuth, provider);
        await onIdToken(await result.user.getIdToken(), "google");
        setLoading(null);
      } else {
        await googlePromptAsync();
      }
    } catch (err: any) {
      const code = err?.code || "";
      if (
        code !== "auth/popup-closed-by-user" &&
        code !== "auth/cancelled-popup-request"
      ) {
        onError(err?.message || "Erreur Google");
      }
      setLoading(null);
    }
  };

  const isFirebaseReady = isFirebaseConfigured();

  const buttons = isFirebaseReady
    ? [
        {
          key: "google",
          label: "Google",
          icon: "logo-google" as const,
          color: "#4285F4",
          onPress: handleGoogle,
        },
      ]
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou continuer avec</Text>
        <View style={styles.dividerLine} />
      </View>
      <View style={styles.buttonsGrid}>
        {buttons.map((btn) => (
          <Pressable
            key={btn.key}
            testID={`social-btn-${btn.key}`}
            style={({ pressed }) => [
              styles.socialBtn,
              pressed && styles.socialBtnPressed,
              loading === btn.key && styles.socialBtnLoading,
            ]}
            onPress={btn.onPress}
            disabled={!!loading}
          >
            {loading === btn.key ? (
              <ActivityIndicator size="small" color={btn.color} />
            ) : (
              <Ionicons name={btn.icon} size={20} color={btn.color} />
            )}
            <Text style={[styles.socialBtnText, { color: btn.color }]}>
              {btn.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {isExpoGo && Platform.OS !== "web" && (
        <View style={styles.expoGoNotice}>
          <Ionicons name="information-circle-outline" size={13} color="#888" />
          <Text style={styles.expoGoNoticeText}>
            Google Sign-In fonctionne dans l'app installée (pas Expo Go)
          </Text>
        </View>
      )}
    </View>
  );
}

export function SocialLoginButtons(props: SocialLoginButtonsProps) {
  const isConfigured = isFirebaseConfigured();

  if (!isConfigured && Platform.OS !== "web") {
    return (
      <View style={styles.notConfigured}>
        <Ionicons name="information-circle-outline" size={14} color="#888" />
        <Text style={styles.notConfiguredText}>
          Connexion sociale non configurée (Firebase requis)
        </Text>
      </View>
    );
  }

  return <SocialLoginButtonsInner {...props} />;
}

const styles = StyleSheet.create({
  container: { marginTop: 4 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  dividerText: {
    fontSize: 11,
    color: "#666",
    fontFamily: "Exo2_400Regular",
    letterSpacing: 0.3,
  },
  buttonsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    minWidth: 130,
    flex: 1,
    justifyContent: "center",
  },
  socialBtnPressed: { opacity: 0.75, backgroundColor: "rgba(255,255,255,0.08)" },
  socialBtnLoading: { opacity: 0.6 },
  socialBtnText: { fontSize: 13, fontFamily: "Exo2_500Medium" },
  notConfigured: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    opacity: 0.5,
  },
  notConfiguredText: {
    fontSize: 11,
    color: "#888",
    fontFamily: "Exo2_400Regular",
    flex: 1,
  },
  expoGoNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    opacity: 0.45,
  },
  expoGoNoticeText: {
    fontSize: 10,
    color: "#888",
    fontFamily: "Exo2_400Regular",
    flex: 1,
  },
});
