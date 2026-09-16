import React, { useMemo } from "react";
import { Pressable, Text, StyleSheet, Modal, View, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

interface StatusDropdownProps {
  label: string;
  options: Array<{ key: string; label: string; color?: string }>;
  selected: string;
  onSelect: (key: string) => void;
}

export function StatusDropdown({ label, options, selected, onSelect }: StatusDropdownProps) {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find(o => o.key === selected);
  const selectedColor = selectedOption?.color || theme.primary;

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { borderColor: selectedColor + "50" },
          pressed && { opacity: 0.9 }
        ]}
        onPress={() => setOpen(true)}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[styles.dot, { backgroundColor: selectedColor }]} />
          <Text style={[styles.buttonText, { color: selectedColor }]} numberOfLines={1}>
            {selectedOption?.label || label}
          </Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={selectedColor} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { backgroundColor: theme.surface }]}>
            <FlatList
              data={options}
              keyExtractor={item => item.key}
              scrollEnabled={options.length > 5}
              renderItem={({ item }) => {
                const isSelected = item.key === selected;
                const itemColor = item.color || theme.primary;
                return (
                  <Pressable
                    style={[
                      styles.menuItem,
                      isSelected && { backgroundColor: theme.primary + "10" },
                      { borderBottomColor: theme.border }
                    ]}
                    onPress={() => {
                      onSelect(item.key);
                      setOpen(false);
                    }}
                  >
                    <View style={[styles.menuDot, { backgroundColor: itemColor }]} />
                    <Text style={[
                      styles.menuItemText,
                      { color: isSelected ? itemColor : theme.text },
                      isSelected && { fontFamily: "Exo2_700Bold" }
                    ]}>
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color={itemColor} style={{ marginLeft: "auto" }} />
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  buttonText: {
    fontSize: 13,
    fontFamily: "Exo2_600SemiBold",
  },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  menu: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    maxHeight: 300,
    width: "85%",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  menuDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  menuItemText: {
    fontSize: 14,
    fontFamily: "Exo2_500Medium",
    flex: 1,
  },
});
