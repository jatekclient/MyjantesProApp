import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Linking } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { FloatingSupport } from "@/components/FloatingSupport";

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  iconColor?: string;
  danger?: boolean;
  theme: ThemeColors;
  styles: any;
}

function MenuItem({ icon, title, subtitle, onPress, iconColor, danger, theme, styles }: MenuItemProps) {
  const color = danger ? "#EF4444" : (iconColor || theme.primary);
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={[styles.menuTitle, danger && { color: "#EF4444" }]}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user } = useAuth();
  const ip = { theme, styles };

  const displayName = user?.firstName || user?.lastName
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
    : (user?.email?.split("@")[0] || "Client");

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Mon espace</Text>

        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Ionicons name="person" size={24} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{displayName}</Text>
            {!!user?.email && (
              <Text style={styles.profileEmail}>{user.email}</Text>
            )}
            {!!user?.role && (
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>{user.role.replace(/_/g, " ")}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Mon activité</Text>
          <MenuItem
            {...ip}
            icon="time-outline"
            title="Historique des demandes"
            subtitle="Devis, factures et rendez-vous"
            onPress={() => router.push("/(main)/history")}
            iconColor="#3B82F6"
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Aide & Support</Text>
          <MenuItem
            {...ip}
            icon="chatbubbles-outline"
            title="Nous contacter"
            subtitle="Envoyer un message à l'équipe MyJantes"
            onPress={() => router.push("/support")}
            iconColor={theme.primary}
          />
          <MenuItem
            {...ip}
            icon="folder-open-outline"
            title="Historique des tickets"
            subtitle="Suivre vos demandes de support"
            onPress={() => router.push("/(main)/support-history")}
            iconColor="#8B5CF6"
          />
          <MenuItem
            {...ip}
            icon="mail-outline"
            title="Nous écrire par email"
            subtitle="contact@myjantes.fr"
            onPress={() => Linking.openURL("mailto:contact@myjantes.fr")}
            iconColor="#22C55E"
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Informations légales</Text>
          <MenuItem
            {...ip}
            icon="document-text-outline"
            title="Mentions légales"
            onPress={() => router.push("/legal")}
            iconColor="#818CF8"
          />
          <MenuItem
            {...ip}
            icon="shield-checkmark-outline"
            title="Politique de confidentialité"
            onPress={() => router.push("/privacy")}
            iconColor="#A78BFA"
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Application</Text>
          <MenuItem
            {...ip}
            icon="book-outline"
            title="Guide de l'application"
            subtitle="Découvrir toutes les fonctionnalités"
            onPress={() => router.push("/onboarding")}
            iconColor="#F59E0B"
          />
          <View style={[styles.menuItem, { opacity: 0.5 }]}>
            <View style={[styles.menuIconContainer, { backgroundColor: theme.border }]}>
              <Ionicons name="information-circle-outline" size={20} color={theme.textTertiary} />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Version</Text>
              <Text style={styles.menuSubtitle}>3.0.0 — MyJantes Client</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Image source={require("@/assets/images/logo_new.png")} style={styles.footerLogo} contentFit="contain" />
          <Text style={styles.footerBrand}>MYJANTES</Text>
          <Text style={styles.footerSubtext}>Built for Performance</Text>
        </View>
      </ScrollView>
      <FloatingSupport />
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollContent: { paddingHorizontal: 20 },
  headerTitle: {
    fontSize: 24, fontFamily: "Exo2_800ExtraBold",
    color: theme.text, letterSpacing: 1, marginBottom: 16,
  },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: theme.card, borderRadius: 16, borderWidth: 1,
    borderColor: theme.primary + "30", padding: 16, marginBottom: 24,
  },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: theme.primary + "15",
    justifyContent: "center", alignItems: "center",
  },
  profileName: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text },
  profileEmail: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 2 },
  rolePill: {
    alignSelf: "flex-start",
    backgroundColor: theme.primary + "18",
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4,
  },
  roleText: { fontSize: 10, fontFamily: "Exo2_500Medium", color: theme.primary, textTransform: "capitalize" },
  menuSection: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary,
    textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8, marginLeft: 4,
  },
  menuItem: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: theme.card, borderRadius: 14, padding: 14,
    marginBottom: 6, borderWidth: 1, borderColor: theme.border,
  },
  menuItemPressed: { backgroundColor: theme.surfaceSecondary },
  menuIconContainer: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  menuTextContainer: { flex: 1 },
  menuTitle: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  menuSubtitle: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 1 },
  footer: { alignItems: "center", marginTop: 12, paddingVertical: 24 },
  footerLogo: { width: 80, height: 80, marginBottom: 8 },
  footerBrand: {
    fontSize: 13, fontFamily: "Exo2_800ExtraBold",
    color: theme.textTertiary, letterSpacing: 5, marginBottom: 4,
  },
  footerSubtext: { fontSize: 11, fontFamily: "Exo2_400Regular", color: theme.textTertiary, opacity: 0.6 },
});
