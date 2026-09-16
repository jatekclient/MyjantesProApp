import React, { useState, useEffect, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Switch, Linking, TextInput, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { router, Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { adminApiCall } from "@/lib/admin-api";

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  iconColor?: string;
  theme: ThemeColors;
  styles: any;
  danger?: boolean;
}

function MenuItem({ icon, title, subtitle, onPress, iconColor, theme, styles, danger }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: `${danger ? "#EF4444" : iconColor || theme.primary}20` }]}>
        <Ionicons name={icon} size={20} color={danger ? "#EF4444" : iconColor || theme.primary} />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={[styles.menuTitle, danger && { color: "#EF4444" }]}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
    </Pressable>
  );
}

function ApiConfigSection({ theme, styles }: { theme: ThemeColors; styles: any }) {
  const { showAlert, AlertComponent } = useCustomAlert();
  const queryClient = useQueryClient();
  const [apiUrl, setApiUrl] = useState("");
  const [editing, setEditing] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["admin-api-config"],
    queryFn: () => adminApiCall<any>("/api/admin/config", { method: "GET" }),
    retry: 1,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (config && !editing) {
      setApiUrl(config.api_url || "");
    }
  }, [config, editing]);

  const saveMutation = useMutation({
    mutationFn: (body: { api_url: string }) =>
      adminApiCall<any>("/api/admin/config", { method: "PUT", body }),
    onSuccess: (data) => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["admin-api-config"] });
      showAlert({ type: "success", title: "Sauvegardé", message: data?.message || "Configuration mise à jour.", buttons: [{ text: "OK" }] });
    },
    onError: (err: any) => {
      showAlert({ type: "error", title: "Erreur", message: err?.message || "Impossible de sauvegarder.", buttons: [{ text: "OK" }] });
    },
  });

  const handleSave = () => {
    if (!apiUrl.trim()) return;
    try {
      new URL(apiUrl.trim());
    } catch {
      showAlert({ type: "error", title: "URL invalide", message: "L'URL principale n'est pas valide.", buttons: [{ text: "OK" }] });
      return;
    }
    saveMutation.mutate({ api_url: apiUrl.trim() });
  };

  const handleReset = () => {
    if (config) {
      setApiUrl(config.default_api_url || "");
      setEditing(true);
    }
  };

  return (
    <View style={styles.menuSection}>
      <Text style={styles.sectionTitle}>Configuration API</Text>
      <View style={[styles.apiCard, { borderColor: theme.border }]}>
        <View style={styles.apiCardHeader}>
          <View style={[styles.menuIconContainer, { backgroundColor: "#DC262620" }]}>
            <Ionicons name="server-outline" size={20} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>URL de l'API externe</Text>
            <Text style={styles.menuSubtitle}>Sans redéploiement</Text>
          </View>
          {!editing ? (
            <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
              <Ionicons name="pencil-outline" size={16} color={theme.primary} />
            </Pressable>
          ) : (
            <Pressable onPress={() => { setEditing(false); if (config) { setApiUrl(config.api_url); } }} style={styles.editBtn}>
              <Ionicons name="close-outline" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        {configLoading ? (
          <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 12 }} />
        ) : (
          <>
            <Text style={styles.apiLabel}>URL de l'API</Text>
            <TextInput
              style={[styles.apiInput, { borderColor: editing ? theme.primary : theme.border, color: theme.text }]}
              value={apiUrl}
              onChangeText={(v) => { setApiUrl(v); setEditing(true); }}
              placeholder={`${process.env.EXPO_PUBLIC_EXTERNAL_API_URL || ""}/api`}
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={editing}
            />

            <View style={styles.apiActions}>
              <Pressable onPress={handleReset} style={styles.resetBtn}>
                <Ionicons name="refresh-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.resetBtnText, { color: theme.textSecondary }]}>Défaut</Text>
              </Pressable>
              {editing && (
                <Pressable
                  onPress={handleSave}
                  disabled={saveMutation.isPending}
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                >
                  {saveMutation.isPending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.saveBtnText}>Appliquer</Text>
                  }
                </Pressable>
              )}
            </View>
          </>
        )}
      </View>
      {AlertComponent}
    </View>
  );
}

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user, logout } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();

  const [notifConsent, setNotifConsent] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("consent_notifications").then(v => {
      setNotifConsent(v === "true");
    }).catch(() => {});
  }, []);

  const toggleNotifConsent = async (val: boolean) => {
    setNotifConsent(val);
    try {
      await AsyncStorage.setItem("consent_notifications", val ? "true" : "false");
    } catch {}
  };

  const handleLogout = () => {
    showAlert({
      type: "warning",
      title: "Se déconnecter",
      message: "Êtes-vous sûr de vouloir vous déconnecter ?",
      buttons: [
        { text: "Annuler" },
        {
          text: "Déconnexion",
          style: "primary",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/login");
          },
        },
      ],
    });
  };

  const handleDeleteAccount = () => {
    showAlert({
      type: "warning",
      title: "Supprimer le compte",
      message: "Cette action est irréversible. Toutes vos données seront supprimées définitivement.",
      buttons: [
        { text: "Annuler" },
        { text: "Continuer", style: "primary", onPress: () => router.push("/(admin)/delete-account" as Href) },
      ],
    });
  };

  const itemProps = { theme, styles };
  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 100 : insets.bottom + 100;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Image source={require("@/assets/images/logo_new.png")} style={styles.headerLogo} contentFit="contain" />
          <Text style={styles.headerTitle}>Paramètres</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Ionicons name="person" size={28} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>
              {user?.firstName || user?.lastName ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "Administrateur"}
            </Text>
            <Text style={styles.profileEmail}>{user?.email || ""}</Text>
            <Text style={styles.profileRole}>{(user?.role || "admin").replace(/_/g, " ")}</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.toggleRow}>
            <View style={[styles.menuIconContainer, { backgroundColor: `${theme.primary}20` }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Notifications push</Text>
              <Text style={styles.menuSubtitle}>Devis, factures et rendez-vous</Text>
            </View>
            <Switch
              value={notifConsent}
              onValueChange={toggleNotifConsent}
              trackColor={{ false: theme.border, true: theme.primary + "80" }}
              thumbColor={notifConsent ? theme.primary : "#ccc"}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Support</Text>
          <MenuItem {...itemProps} icon="chatbubbles-outline" title="Nous contacter" subtitle="Envoyer un message à l'équipe" onPress={() => router.push("/support" as Href)} />
          <MenuItem {...itemProps} icon="time-outline" title="Historique des demandes" subtitle="Voir vos demandes support" onPress={() => router.push("/(admin)/support-history" as Href)} iconColor="#8B5CF6" />
          <MenuItem {...itemProps} icon="mail-outline" title="Email" subtitle="contact@mytoolsgroup.eu" onPress={() => Linking.openURL("mailto:contact@mytoolsgroup.eu")} iconColor="#22C55E" />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Informations légales</Text>
          <MenuItem {...itemProps} icon="document-text-outline" title="Mentions légales" onPress={() => router.push("/legal" as Href)} iconColor="#818CF8" />
          <MenuItem {...itemProps} icon="shield-checkmark-outline" title="Politique de confidentialité" onPress={() => router.push("/privacy" as Href)} iconColor="#A78BFA" />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Application</Text>
          <MenuItem {...itemProps} icon="book-outline" title="Guide de l'application" subtitle="Découvrir les fonctionnalités" onPress={() => router.push("/(admin)/guide" as Href)} iconColor="#F59E0B" />
          <MenuItem {...itemProps} icon="information-circle-outline" title="Version" subtitle="2.0" onPress={() => {}} iconColor={theme.textSecondary} />
        </View>

        {(user?.role === "root_admin" || user?.role === "root") && (
          <ApiConfigSection theme={theme} styles={styles} />
        )}

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Compte</Text>
          <MenuItem {...itemProps} icon="trash-outline" title="Supprimer mon compte" subtitle="Suppression définitive et irréversible" onPress={handleDeleteAccount} danger />
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Se déconnecter</Text>
        </Pressable>

        <View style={styles.footer}>
          <Image source={require("@/assets/images/logo_new.png")} style={styles.footerLogo} contentFit="contain" />
          <Text style={styles.footerBrand}>MYJANTES</Text>
          <Text style={styles.footerSubtext}>Built for Performance</Text>
        </View>
      </ScrollView>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollContent: { paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 },
  headerLogo: { width: 34, height: 34, borderRadius: 8 },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: "Exo2_800ExtraBold", color: theme.text, letterSpacing: 0.5 },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1,
    borderColor: theme.border, padding: 16, marginBottom: 24,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: theme.primary + "15", justifyContent: "center", alignItems: "center",
  },
  profileName: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text },
  profileEmail: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 2 },
  profileRole: { fontSize: 11, fontFamily: "Exo2_500Medium", color: theme.primary, marginTop: 2, textTransform: "capitalize" },
  menuSection: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary,
    textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8, marginLeft: 4,
  },
  menuItem: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: theme.surface, borderRadius: 14, padding: 14,
    marginBottom: 6, borderWidth: 1, borderColor: theme.border,
  },
  menuItemPressed: { opacity: 0.85 },
  menuIconContainer: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  menuTextContainer: { flex: 1 },
  menuTitle: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  menuSubtitle: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 1 },
  toggleRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: theme.surface, borderRadius: 14, padding: 14,
    marginBottom: 6, borderWidth: 1, borderColor: theme.border,
  },
  apiCard: {
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1,
    padding: 16,
  },
  apiCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  apiLabel: { fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 6 },
  apiInput: {
    backgroundColor: theme.background, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, fontFamily: "Exo2_400Regular",
  },
  apiActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  editBtn: { padding: 8 },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  resetBtnText: { fontSize: 12, fontFamily: "Exo2_500Medium" },
  saveBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  saveBtnText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#EF444410", borderRadius: 14, borderWidth: 1,
    borderColor: "#EF444430", height: 52, marginBottom: 24,
  },
  logoutBtnText: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: "#EF4444" },
  footer: { alignItems: "center", marginTop: 8, paddingVertical: 24 },
  footerLogo: { width: 80, height: 80, marginBottom: 8 },
  footerBrand: {
    fontSize: 14, fontFamily: "Exo2_800ExtraBold", color: theme.textTertiary,
    letterSpacing: 5, marginBottom: 4,
  },
  footerSubtext: { fontSize: 11, fontFamily: "Exo2_400Regular", color: theme.textTertiary, opacity: 0.6 },
});
