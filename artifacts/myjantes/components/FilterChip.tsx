import React from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import { useTheme } from "@/lib/theme";

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
  count?: number;
}

export function FilterChip({ label, active, onPress, color, count }: FilterChipProps) {
  const theme = useTheme();
  const accentColor = color || theme.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        active
          ? { backgroundColor: accentColor + "18", borderColor: accentColor + "50" }
          : { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
      ]}
      onPress={onPress}
    >
      <View style={[styles.dot, { backgroundColor: active ? accentColor : theme.textTertiary + "60" }]} />
      <Text
        style={[
          styles.label,
          { color: active ? accentColor : theme.textSecondary },
          active && { fontFamily: "Exo2_700Bold" },
        ]}
      >
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.countBadge, { backgroundColor: active ? accentColor + "25" : theme.border }]}>
          <Text style={[styles.countText, { color: active ? accentColor : theme.textSecondary }]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
    fontFamily: "Exo2_600SemiBold",
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  countText: {
    fontSize: 10,
    fontFamily: "Exo2_700Bold",
  },
});
