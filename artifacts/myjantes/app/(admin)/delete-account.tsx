import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { showAlert, AlertComponent } = useCustomAlert();

  const [step, setStep] = useState<"confirm" | "final">("confirm");
  const [loading, setLoading] = useState(false);

  const handleDeleteAccount = async () => {
    if (step === "confirm") {
      setStep("final");
      return;
    }

    setLoading(true);
    try {
      const { apiCall } = await import("@/lib/api");
      await apiCall("/api/mobile/auth/account", { method: "DELETE" });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await logout();
      setTimeout(() => router.replace("/(auth)/login"), 100);
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "Erreur",
        message: err.message || "Impossible de supprimer le compte.",
        buttons: [{ text: "OK", style: "primary" }],
      });
      setLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Supprimer mon compte</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {step === "confirm" ? (
          <>
            <View style={styles.warningCard}>
              <View style={[styles.warningIcon, { backgroundColor: "#EF444420" }]}>
                <Ionicons name="warning-outline" size={32} color="#EF4444" />
              </View>
              <Text style={styles.warningTitle}>Attention !</Text>
              <Text style={styles.warningText}>
                La suppression de votre compte est définitive et irréversible. Toutes vos données seront supprimées de manière permanente :
              </Text>
            </View>

            <View style={styles.listCard}>
              <ListItem label="Devis" icon="document-text-outline" />
              <ListItem label="Factures" icon="receipt-outline" last />
              <ListItem label="Clients" icon="people-outline" />
              <ListItem label="Rendez-vous" icon="calendar-outline" />
              <ListItem label="Historique" icon="history-outline" last />
            </View>

            <Text style={styles.disclaimer}>
              Cette action ne peut pas être annulée. Nous vous recommandons de télécharger et archiver vos données avant de continuer.
            </Text>

            <Pressable
              style={[styles.cancelBtn, { marginTop: 32 }]}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </Pressable>

            <Pressable
              style={[styles.deleteBtn, { marginTop: 12 }]}
              onPress={handleDeleteAccount}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.deleteBtnText}>Je comprends, supprimer mon compte</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.finalCard}>
              <View style={[styles.finalIcon, { backgroundColor: "#EF444420" }]}>
                <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
              </View>
              <Text style={styles.finalTitle}>Confirmation finale</Text>
              <Text style={styles.finalText}>
                Êtes-vous absolument certain ? Votre compte administrateur et toutes les données associées seront supprimés définitivement.
              </Text>
              {user?.email && (
                <View style={styles.emailBox}>
                  <Text style={styles.emailLabel}>Compte</Text>
                  <Text style={styles.emailText}>{user.email}</Text>
                </View>
              )}
            </View>

            <Pressable
              style={[styles.cancelBtn, { marginTop: 32 }]}
              onPress={() => setStep("confirm")}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Retour</Text>
            </Pressable>

            <Pressable
              style={[styles.deleteBtn, loading && { opacity: 0.6 }, { marginTop: 12 }]}
              onPress={handleDeleteAccount}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.deleteBtnText}>Supprimer définitivement</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
      {AlertComponent}
    </View>
  );
}

function ListItem({ label, icon, last }: { label: string; icon: any; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.border + "30" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16 }}>
        <Ionicons name={icon} size={20} color="#EF4444" />
        <Text style={{ fontSize: 15, fontFamily: "Exo2_500Medium", color: theme.text }}>{label}</Text>
      </View>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.text },
  scroll: { paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  warningCard: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 20, alignItems: "center", gap: 12 },
  warningIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  warningTitle: { fontSize: 18, fontFamily: "Exo2_700Bold", color: "#EF4444" },
  warningText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary, textAlign: "center", lineHeight: 20 },
  listCard: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: "hidden" },
  disclaimer: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, textAlign: "center", lineHeight: 19, marginTop: 8 },
  cancelBtn: { backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, height: 52, justifyContent: "center", alignItems: "center" },
  cancelBtnText: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#EF4444", borderRadius: 12, height: 52 },
  deleteBtnText: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  finalCard: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 20, alignItems: "center", gap: 12 },
  finalIcon: { width: 64, height: 64, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  finalTitle: { fontSize: 20, fontFamily: "Exo2_700Bold", color: theme.text },
  finalText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary, textAlign: "center", lineHeight: 20 },
  emailBox: { backgroundColor: theme.background, borderRadius: 10, padding: 12, width: "100%", marginTop: 8 },
  emailLabel: { fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", marginBottom: 4 },
  emailText: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.text },
});
