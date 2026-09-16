import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  subscribeUpstreamStatus,
  reportUpstreamRecovered,
} from "@/lib/upstream-status";

export function UpstreamErrorBanner() {
  const [degraded, setDegraded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsub = subscribeUpstreamStatus((isDegraded) => {
      setDegraded(isDegraded);
      if (isDegraded) setDismissed(false);
    });
    return unsub;
  }, []);

  if (!degraded || dismissed) return null;

  return (
    <View
      style={[
        styles.container,
        Platform.OS === "web" ? styles.containerWeb : styles.containerNative,
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.banner}>
        <Ionicons name="cloud-offline-outline" size={18} color="#fff" />
        <Text style={styles.text} numberOfLines={2}>
          Service temporairement indisponible. Certaines données peuvent être
          incomplètes.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer la notification"
          onPress={() => {
            setDismissed(true);
            reportUpstreamRecovered();
          }}
          style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
          hitSlop={10}
        >
          <Ionicons name="close" size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  containerWeb: { top: 0 },
  containerNative: { top: 44 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#B45309",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 6,
    maxWidth: 560,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Exo2_500Medium",
    flex: 1,
  },
  close: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
});
