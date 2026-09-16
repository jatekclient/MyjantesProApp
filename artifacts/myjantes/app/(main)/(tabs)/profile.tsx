import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Platform, Switch, Linking,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { authApi, quotesApi, invoicesApi, reservationsApi, accountApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

const WEB_PORTAL_URL = "https://myjantes.fr";

async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
async function setStoredValue(key: string, value: string) {
  if (Platform.OS === "web") await AsyncStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

function SettingsRow({
  icon, iconBg, iconColor, label, sub, onPress, right, danger = false, showDivider = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  sub?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  showDivider?: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && onPress && { backgroundColor: theme.surfaceSecondary }]}
        onPress={onPress}
      >
        <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, danger && { color: "#EF4444" }]}>{label}</Text>
          {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
        </View>
        {right !== undefined ? right : (
          onPress ? <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} /> : null
        )}
      </Pressable>
      {showDivider && <View style={styles.inGroupDivider} />}
    </>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState("Biométrie");
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailNotifEnabled, setEmailNotifEnabled] = useState(true);

  const isPro = user?.role === "client_professionnel";
  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";
  const displayName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || "";

  const { data: quotes = [] } = useQuery({ queryKey: ["quotes"], queryFn: quotesApi.getAll });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: invoicesApi.getAll });
  const { data: reservations = [] } = useQuery({ queryKey: ["reservations"], queryFn: reservationsApi.getAll });
  const { data: accountSummary } = useQuery({
    queryKey: ["account-summary"],
    queryFn: accountApi.getSummary,
    enabled: isPro,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const quotesArr = Array.isArray(quotes) ? quotes : [];
  const invoicesArr = Array.isArray(invoices) ? invoices : [];
  const reservationsArr = Array.isArray(reservations) ? reservations : [];

  useEffect(() => { checkBiometrics(); loadNotificationPreferences(); }, []);

  const checkBiometrics = async () => {
    if (Platform.OS === "web") return;
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
      if (compatible) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) setBiometricType("Face ID");
        else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) setBiometricType("Empreinte digitale");
      }
      const stored = await getStoredValue("biometric_enabled");
      setBiometricEnabled(stored === "true");
    } catch {}
  };

  const loadNotificationPreferences = async () => {
    try {
      const prefs = await authApi.getNotificationPreferences();
      if (prefs && typeof prefs.push === "boolean") { setPushEnabled(prefs.push); setEmailNotifEnabled(prefs.email); }
    } catch {
      const stored = await getStoredValue("notif_push");
      if (stored !== null) setPushEnabled(stored === "true");
      const storedEmail = await getStoredValue("notif_email");
      if (storedEmail !== null) setEmailNotifEnabled(storedEmail === "true");
    }
  };

  const toggleBiometric = async (value: boolean) => {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: `Activer ${biometricType}`, cancelLabel: "Annuler", disableDeviceFallback: false });
      if (result.success) {
        setBiometricEnabled(true);
        await setStoredValue("biometric_enabled", "true");
      }
    } else {
      setBiometricEnabled(false);
      await setStoredValue("biometric_enabled", "false");
    }
  };

  const updateNotifPref = async (key: "push" | "email", value: boolean) => {
    const prev = { push: pushEnabled, email: emailNotifEnabled };
    if (key === "push") setPushEnabled(value);
    if (key === "email") setEmailNotifEnabled(value);
    await setStoredValue(`notif_${key}`, value ? "true" : "false");
    try { await authApi.updateNotificationPreferences({ ...prev, [key]: value }); } catch {}
  };

  const handleLogout = () => {
    showAlert({
      type: "warning",
      title: "Déconnexion",
      message: "Voulez-vous vous déconnecter ?",
      buttons: [
        { text: "Annuler" },
        { text: "Déconnexion", style: "primary", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
      ],
    });
  };

  const topPadding = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPadding = Platform.OS === "web" ? 34 + 100 : insets.bottom + 100;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.avatarName}>{displayName}</Text>
          <Text style={styles.avatarEmail}>{user?.email || ""}</Text>
          <View style={styles.rolePill}>
            <View style={[styles.roleDot, { backgroundColor: isPro ? "#F59E0B" : theme.primary }]} />
            <Text style={styles.roleText}>{isPro ? "Professionnel" : "Particulier"}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{quotesArr.length}</Text>
            <Text style={styles.statLbl}>Devis</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{invoicesArr.length}</Text>
            <Text style={styles.statLbl}>Factures</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{reservationsArr.length}</Text>
            <Text style={styles.statLbl}>RDV</Text>
          </View>
        </View>

        <Text style={styles.groupLabel}>Compte</Text>
        <View style={styles.group}>
          <SettingsRow icon="mail-outline" iconBg="#3B82F620" iconColor="#3B82F6" label="Email" sub={user?.email || "Non renseigné"} showDivider />
          <SettingsRow icon="person-outline" iconBg="#8B5CF620" iconColor="#8B5CF6" label="Nom complet" sub={displayName || "Non renseigné"} showDivider />
          <SettingsRow icon="call-outline" iconBg="#22C55E20" iconColor="#22C55E" label="Téléphone" sub={user?.phone || "Non renseigné"} showDivider />
          <SettingsRow icon="location-outline" iconBg="#F59E0B20" iconColor="#F59E0B" label="Ville" sub={[user?.city, user?.postalCode].filter(Boolean).join(", ") || "Non renseigné"} showDivider={false} />
        </View>

        {isPro && (
          <>
            <Text style={styles.groupLabel}>Société</Text>
            <View style={styles.group}>
              <SettingsRow icon="business-outline" iconBg="#EC489920" iconColor="#EC4899" label="Entreprise" sub={user?.companyName || "Non renseigné"} showDivider />
              <SettingsRow icon="document-text-outline" iconBg="#6366F120" iconColor="#6366F1" label="SIRET" sub={user?.siret || "Non renseigné"} showDivider />
              <SettingsRow icon="receipt-outline" iconBg="#14B8A620" iconColor="#14B8A6" label="N° TVA" sub={user?.tvaNumber || "Non renseigné"} showDivider={false} />
            </View>

            <Text style={styles.groupLabel}>Solde & remise</Text>
            <View style={styles.group}>
              <SettingsRow
                icon="wallet-outline"
                iconBg="#F59E0B20"
                iconColor="#F59E0B"
                label="Solde dû"
                sub={(accountSummary as any)?.balance != null
                  ? `${parseFloat(String((accountSummary as any).balance)).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`
                  : "Données indisponibles"}
                showDivider
              />
              <SettingsRow
                icon="pricetag-outline"
                iconBg="#22C55E20"
                iconColor="#22C55E"
                label="Remise négociée"
                sub={(accountSummary as any)?.discountRate != null
                  ? `${(accountSummary as any).discountRate}% sur toutes les prestations`
                  : "Données indisponibles"}
                showDivider={false}
              />
            </View>

            <Text style={styles.groupLabel}>Services professionnels</Text>
            <View style={styles.group}>
              <SettingsRow
                icon="document-attach-outline"
                iconBg="#3B82F620"
                iconColor="#3B82F6"
                label="Bons de livraison"
                sub="Consulter et télécharger vos BL"
                onPress={() => router.push("/(main)/delivery-notes" as any)}
                showDivider
              />
              <SettingsRow
                icon="person-circle-outline"
                iconBg="#F59E0B20"
                iconColor="#F59E0B"
                label="Mon interlocuteur"
                sub="Votre contact dédié chez MyJantes"
                onPress={() => router.push("/(main)/account-contact" as any)}
                showDivider
              />
              <SettingsRow
                icon="car-sport-outline"
                iconBg={theme.primary + "20"}
                iconColor={theme.primary}
                label="Demande d'enlèvement"
                sub="Collecte de pneus & jantes usagés"
                onPress={() => router.push("/(main)/removal-request" as any)}
                showDivider
              />
              <SettingsRow
                icon="layers-outline"
                iconBg="#8B5CF620"
                iconColor="#8B5CF6"
                label="Facture groupée"
                sub="Regrouper plusieurs prestations"
                onPress={() => router.push("/(main)/grouped-invoice" as any)}
                showDivider
              />
              <SettingsRow
                icon="calendar-number-outline"
                iconBg="#22C55E20"
                iconColor="#22C55E"
                label="Historique professionnel"
                sub="Devis, factures et RDV"
                onPress={() => router.push("/(main)/history" as any)}
                showDivider={false}
              />
            </View>
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.portalBtn, pressed && { opacity: 0.85 }]}
          onPress={() => Linking.openURL(WEB_PORTAL_URL)}
        >
          <Ionicons name="open-outline" size={16} color="#fff" />
          <Text style={styles.portalBtnText}>Modifier mes informations sur l'espace client</Text>
        </Pressable>

        <Text style={styles.groupLabel}>Sécurité</Text>
        <View style={styles.group}>
          {Platform.OS !== "web" && biometricAvailable && (
            <SettingsRow
              icon="finger-print" iconBg="#3B82F620" iconColor="#3B82F6"
              label={biometricType} sub="Connexion rapide et sécurisée"
              right={
                <Switch
                  value={biometricEnabled}
                  onValueChange={toggleBiometric}
                  trackColor={{ false: theme.border, true: theme.primary + "80" }}
                  thumbColor={biometricEnabled ? theme.primary : theme.textTertiary}
                  ios_backgroundColor={theme.border}
                />
              }
              showDivider
            />
          )}
          <SettingsRow
            icon="lock-closed-outline" iconBg="#EF444420" iconColor="#EF4444"
            label="Modifier le mot de passe"
            sub="Via votre espace client en ligne"
            onPress={() => Linking.openURL(WEB_PORTAL_URL)}
            showDivider={false}
          />
        </View>

        <Text style={styles.groupLabel}>Notifications</Text>
        <View style={styles.group}>
          <SettingsRow
            icon="notifications-outline" iconBg={theme.primary + "20"} iconColor={theme.primary}
            label="Notifications push" sub="Alertes en temps réel"
            right={
              <Switch
                value={pushEnabled}
                onValueChange={(v) => updateNotifPref("push", v)}
                trackColor={{ false: theme.border, true: theme.primary + "80" }}
                thumbColor={pushEnabled ? theme.primary : theme.textTertiary}
                ios_backgroundColor={theme.border}
              />
            }
            showDivider
          />
          <SettingsRow
            icon="mail-outline" iconBg="#10B98120" iconColor="#10B981"
            label="Notifications email" sub="Récapitulatifs par email"
            right={
              <Switch
                value={emailNotifEnabled}
                onValueChange={(v) => updateNotifPref("email", v)}
                trackColor={{ false: theme.border, true: "#10B98180" }}
                thumbColor={emailNotifEnabled ? "#10B981" : theme.textTertiary}
                ios_backgroundColor={theme.border}
              />
            }
            showDivider={false}
          />
        </View>

        <Text style={styles.groupLabel}>Informations légales</Text>
        <View style={styles.group}>
          <SettingsRow icon="document-text-outline" iconBg="#6366F120" iconColor="#6366F1" label="Mentions légales" onPress={() => router.push("/legal")} showDivider />
          <SettingsRow icon="shield-checkmark-outline" iconBg="#22C55E20" iconColor="#22C55E" label="Confidentialité" onPress={() => router.push("/privacy")} showDivider />
          <SettingsRow icon="settings-outline" iconBg="#F59E0B20" iconColor="#F59E0B" label="Paramètres" onPress={() => router.push("/(main)/(tabs)/more")} showDivider={false} />
        </View>

        <Text style={styles.groupLabel}>Zone critique</Text>
        <View style={styles.group}>
          <SettingsRow
            icon="trash-outline" iconBg="#EF444420" iconColor="#EF4444"
            label="Supprimer mon compte"
            sub="Action définitive et irréversible"
            danger
            onPress={() => router.push("/(main)/delete-account" as any)}
            showDivider={false}
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.85 }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>

        <Text style={styles.version}>MyJantes v3.0.0</Text>
      </ScrollView>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scroll: { paddingHorizontal: 16 },

  avatarSection: { alignItems: "center", marginBottom: 20 },
  avatarRing: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 3, borderColor: theme.primary + "50",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  avatar: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: theme.primary,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 30, fontFamily: "Exo2_700Bold", color: "#fff" },
  avatarName: { fontSize: 20, fontFamily: "Exo2_600SemiBold", color: theme.text, marginBottom: 3 },
  avatarEmail: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginBottom: 8 },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.surface, borderRadius: 20, borderWidth: 1, borderColor: theme.border,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  roleDot: { width: 7, height: 7, borderRadius: 4 },
  roleText: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textSecondary },

  statsRow: {
    flexDirection: "row", backgroundColor: theme.surface,
    borderRadius: 16, borderWidth: 1, borderColor: theme.border,
    marginBottom: 24, overflow: "hidden",
  },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 16 },
  statSep: { width: 1, height: "60%", alignSelf: "center", backgroundColor: theme.border },
  statNum: { fontSize: 22, fontFamily: "Exo2_700Bold", color: theme.text, marginBottom: 3 },
  statLbl: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textSecondary },

  groupLabel: {
    fontSize: 12, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.8,
    marginBottom: 8, marginLeft: 4,
  },
  group: {
    backgroundColor: theme.surface, borderRadius: 14,
    borderWidth: 1, borderColor: theme.border,
    marginBottom: 24, overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 13, gap: 12,
    minHeight: 52,
  },
  rowIcon: { width: 34, height: 34, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: "Exo2_500Medium", color: theme.text },
  rowSub: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 1 },
  inGroupDivider: { height: 1, backgroundColor: theme.border, marginLeft: 60 },

  portalBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.primary, borderRadius: 14, height: 48,
    marginBottom: 24,
  },
  portalBtnText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: "#fff" },

  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: "#EF444440",
    height: 50, marginBottom: 12,
  },
  logoutText: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: "#EF4444" },
  version: { fontSize: 11, fontFamily: "Exo2_800ExtraBold", color: theme.textTertiary, textAlign: "center", marginBottom: 8, opacity: 0.5 },
});
