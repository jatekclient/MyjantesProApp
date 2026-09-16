import React, { useState, useMemo } from "react";
import {
  View, Text, Pressable, StyleSheet, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { apiCall } from "@/lib/api";
import { useCustomAlert } from "@/components/CustomAlert";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

async function clearAllStorage() {
  try { await AsyncStorage.clear(); } catch {}
  if (Platform.OS !== "web") {
    const keys = ["session_cookie", "biometric_enabled", "access_token", "refresh_token", "social_access_token"];
    for (const key of keys) {
      try { await SecureStore.deleteItemAsync(key); } catch {}
    }
  }
}

const DELETIONS = [
  "Votre compte et identifiants de connexion",
  "Toutes vos données personnelles (nom, email, téléphone, adresse)",
  "L'historique de vos devis et demandes",
  "L'historique de vos factures",
  "Vos réservations et rendez-vous",
  "Vos préférences et paramètres de l'application",
];

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { showAlert, AlertComponent } = useCustomAlert();
  const [step, setStep] = useState<1 | 2>(1);
  const [deleting, setDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiCall("/api/mobile/auth/account", { method: "DELETE" });
      await clearAllStorage();
      showAlert({
        type: "success",
        title: "Compte supprimé",
        message: "Votre compte et toutes vos données ont été définitivement supprimés conformément au RGPD.",
        buttons: [{ text: "OK", style: "primary", onPress: () => router.replace("/(auth)/login") }],
      });
    } catch (err: any) {
      setStep(1);
      showAlert({
        type: "error",
        title: "Erreur",
        message: err.message || "Impossible de supprimer le compte. Veuillez réessayer.",
        buttons: [{ text: "OK", style: "primary" }],
      });
    } finally {
      setDeleting(false);
    }
  };

  const topPadding = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPadding = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Supprimer mon compte</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <>
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={32} color="#EF4444" />
              <Text style={styles.warningTitle}>Action irréversible</Text>
              <Text style={styles.warningText}>
                La suppression de votre compte est définitive et irréversible. Conformément au RGPD (Règlement Général sur la Protection des Données), l'ensemble de vos données personnelles sera effacé de nos systèmes.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Ce qui sera supprimé définitivement :</Text>
            <View style={styles.listGroup}>
              {DELETIONS.map((item, i) => (
                <React.Fragment key={i}>
                  <View style={styles.listRow}>
                    <View style={styles.listIcon}>
                      <Ionicons name="close" size={14} color="#EF4444" />
                    </View>
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                  {i < DELETIONS.length - 1 && <View style={styles.listDivider} />}
                </React.Fragment>
              ))}
            </View>

            <View style={styles.rgpdBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#6366F1" />
              <Text style={styles.rgpdText}>
                Conformément à l'article 17 du RGPD, vous avez le droit à l'effacement de vos données. Cette suppression prend effet immédiatement et de manière permanente.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setStep(2)}
            >
              <Text style={styles.nextBtnText}>Continuer vers la confirmation</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </Pressable>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.confirmBanner}>
              <Ionicons name="alert-circle" size={28} color="#EF4444" />
              <Text style={styles.confirmTitle}>Confirmation finale</Text>
            </View>

            <Text style={styles.confirmText}>
              Vous êtes sur le point de supprimer définitivement votre compte et toutes les données associées. Cette action ne peut pas être annulée.
            </Text>

            <Pressable style={styles.checkRow} onPress={() => setConfirmed(v => !v)}>
              <View style={[styles.checkbox, confirmed && { backgroundColor: "#EF4444", borderColor: "#EF4444" }]}>
                {confirmed && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.checkLabel}>
                Je comprends que la suppression est définitive et irréversible, et que toutes mes données seront effacées conformément au RGPD.
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.deleteBtn,
                !confirmed && styles.deleteBtnDisabled,
                pressed && confirmed && { opacity: 0.85 },
              ]}
              onPress={handleDelete}
              disabled={!confirmed || deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="trash" size={18} color="#fff" />
                  <Text style={styles.deleteBtnText}>Supprimer définitivement mon compte</Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.cancelBtn} onPress={() => { setStep(1); setConfirmed(false); }}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.background,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.text },
  scroll: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },

  warningBanner: {
    backgroundColor: "#EF444415", borderRadius: 16, borderWidth: 1, borderColor: "#EF444430",
    padding: 20, alignItems: "center", gap: 10,
  },
  warningTitle: { fontSize: 18, fontFamily: "Exo2_700Bold", color: "#EF4444" },
  warningText: {
    fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary,
    textAlign: "center", lineHeight: 21,
  },

  sectionTitle: {
    fontSize: 13, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4,
  },
  listGroup: {
    backgroundColor: theme.surface, borderRadius: 14,
    borderWidth: 1, borderColor: theme.border, overflow: "hidden",
  },
  listRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  listIcon: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#EF444415",
    justifyContent: "center", alignItems: "center",
  },
  listText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text, flex: 1 },
  listDivider: { height: 1, backgroundColor: theme.border, marginLeft: 52 },

  rgpdBox: {
    flexDirection: "row", gap: 10, backgroundColor: "#6366F115",
    borderRadius: 12, borderWidth: 1, borderColor: "#6366F130", padding: 14, alignItems: "flex-start",
  },
  rgpdText: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, flex: 1, lineHeight: 20 },

  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.text, borderRadius: 14, height: 52,
  },
  nextBtnText: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.background },

  confirmBanner: { alignItems: "center", gap: 8, marginBottom: 4 },
  confirmTitle: { fontSize: 20, fontFamily: "Exo2_700Bold", color: "#EF4444" },
  confirmText: {
    fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary,
    textAlign: "center", lineHeight: 21,
  },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: theme.border,
    justifyContent: "center", alignItems: "center", marginTop: 1, backgroundColor: theme.surface,
  },
  checkLabel: { flex: 1, fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text, lineHeight: 21 },

  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#EF4444", borderRadius: 14, height: 52,
  },
  deleteBtnDisabled: { backgroundColor: theme.border },
  deleteBtnText: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: "#fff" },

  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelBtnText: { fontSize: 15, fontFamily: "Exo2_500Medium", color: theme.textSecondary },
});
