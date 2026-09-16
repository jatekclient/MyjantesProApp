import React, { useEffect, useMemo } from "react";
import { View, ActivityIndicator, StyleSheet, Text, Platform } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isLoading) {
      (async () => {
        const consent = await AsyncStorage.getItem("consent_given");
        if (!consent) {
          router.replace("/consent");
          return;
        }
        if (isAuthenticated) {
          router.replace("/(main)" as any);
        } else {
          router.replace("/(auth)/login");
        }
      })();
    }
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        <Image
          source={require("@/assets/images/logo_new.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </View>
      <ActivityIndicator size="small" color={theme.primary} style={styles.loader} />
      <Text style={styles.versionText}>v3.0.0</Text>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: theme.background,
  },
  logoWrapper: {
    width: 180, height: 180, marginBottom: 32,
    justifyContent: "center", alignItems: "center",
  },
  logo: { width: "100%", height: "100%" },
  loader: { marginBottom: 40 },
  versionText: {
    position: "absolute", bottom: 40,
    fontSize: 11, fontFamily: "Exo2_800ExtraBold",
    color: theme.textTertiary, opacity: 0.5, letterSpacing: 2,
  },
});
