import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, Text, Pressable, Modal, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { useTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

function CreateModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  const options = [
    {
      icon: "document-text-outline" as const,
      label: "Nouveau devis",
      sub: "Créer un devis",
      color: "#8B5CF6",
      route: "/(admin)/quote-create",
    },
    {
      icon: "receipt-outline" as const,
      label: "Nouvelle facture",
      sub: "Créer une facture",
      color: "#3B82F6",
      route: "/(admin)/invoice-create",
    },
    {
      icon: "calendar-outline" as const,
      label: "Nouveau RDV",
      sub: "Planifier un rendez-vous",
      color: "#22C55E",
      route: "/(admin)/reservation-create",
    },
    {
      icon: "construct-outline" as const,
      label: "Nouveau service",
      sub: "Ajouter une prestation",
      color: "#F59E0B",
      route: "/(admin)/service-create",
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Créer</Text>
        <View style={styles.sheetOptions}>
          {options.map((opt) => (
            <Pressable
              key={opt.label}
              style={({ pressed }) => [styles.optionRow, pressed && { opacity: 0.7 }]}
              onPress={() => {
                Haptics.selectionAsync();
                onClose();
                setTimeout(() => router.push(opt.route as any), 150);
              }}
            >
              <View style={[styles.optionIcon, { backgroundColor: opt.color + "22" }]}>
                <Ionicons name={opt.icon} size={22} color={opt.color} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Text style={styles.optionSub}>{opt.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

export default function AdminTabLayout() {
  const theme = useTheme();
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textTertiary,
          tabBarLabelStyle: {
            fontFamily: "Exo2_500Medium",
            fontSize: 10,
          },
          tabBarStyle: {
            position: "absolute" as const,
            backgroundColor: isIOS ? "transparent" : theme.surface,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            elevation: 0,
            ...(isWeb ? { height: 84 } : {}),
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView intensity={100} tint={theme.isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            ) : isWeb ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.surface }]} />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Accueil",
            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="quotes"
          options={{
            title: "Devis",
            tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="invoices"
          options={{
            title: "Factures",
            tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="create"
          options={{
            title: "",
            tabBarButton: () => (
              <View style={styles.plusWrapper}>
                <Pressable
                  style={({ pressed }) => [styles.plusBtn, pressed && { transform: [{ scale: 0.9 }], opacity: 0.85 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setCreateOpen(true);
                  }}
                >
                  <Ionicons name="add" size={34} color="#fff" />
                </Pressable>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: "Plus",
            tabBarIcon: ({ color, size }) => <Ionicons name="apps-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="reservations"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: "Clients",
            tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Réglages",
            tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
      <CreateModal visible={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  plusWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -14,
  },
  plusBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    backgroundColor: "#48484A",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Exo2_700Bold",
    color: "#fff",
    marginBottom: 14,
  },
  sheetOptions: {
    gap: 8,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#2C2C2E",
    borderRadius: 14,
    padding: 12,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { flex: 1 },
  optionLabel: {
    fontSize: 14,
    fontFamily: "Exo2_600SemiBold",
    color: "#fff",
  },
  optionSub: {
    fontSize: 11,
    fontFamily: "Exo2_400Regular",
    color: "#9CA3AF",
    marginTop: 2,
  },
});
