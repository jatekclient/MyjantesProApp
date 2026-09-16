import React from "react";
import { Pressable, StyleSheet, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Colors from "@/constants/colors";

export function FloatingSupport() {
  const insets = useSafeAreaInsets();
  const baseBottom = Platform.OS === "web" ? 34 + 70 : insets.bottom + 70;

  return (
    <View style={styles.fabGroup} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: baseBottom,
          },
          pressed && styles.fabPressed,
        ]}
        onPress={() => router.push("/support")}
      >
        <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: { boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.2)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
    zIndex: 100,
  },
  fabPressed: {
    backgroundColor: Colors.primaryDark,
    transform: [{ scale: 0.95 }],
  },
  fabGroup: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
});
