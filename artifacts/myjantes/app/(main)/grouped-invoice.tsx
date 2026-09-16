import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Platform, ActivityIndicator, KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { useCustomAlert } from "@/components/CustomAlert";
import { supportApi } from "@/lib/api";

const PERIOD_OPTIONS = [
  { key: "last_month",    label: "Mois dernier",       icon: "calendar-outline" as const },
  { key: "last_quarter",  label: "Trimestre écoulé",   icon: "stats-chart-outline" as const },
  { key: "last_semester", label: "Semestre écoulé",    icon: "albums-outline" as const },
  { key: "custom",        label: "Période personnalisée", icon: "options-outline" as const },
];

export default function GroupedInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();

  const [period, setPeriod] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [notes, setNotes] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => {
      const periodLabel = PERIOD_OPTIONS.find((p) => p.key === period)?.label || period;
      const description = [
        `PÉRIODE: ${periodLabel}`,
        period === "custom" && dateFrom ? `DU: ${dateFrom}` : null,
        period === "custom" && dateTo ? `AU: ${dateTo}` : null,
        `ENTREPRISE: ${user?.companyName || "—"}`,
        `SIRET: ${user?.siret || "—"}`,
        notes ? `NOTES: ${notes}` : null,
      ].filter(Boolean).join("\n");

      return supportApi.contact({
        name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Client professionnel",
        email: user?.email || "",
        category: "facturation_groupee",
        subject: "Demande de facturation groupée",
        message: `DEMANDE FACTURE GROUPÉE PRO\n${description}`,
      });
    },
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({
        type: "success",
        title: "Demande envoyée !",
        message: "Votre demande de facturation groupée a été transmise. Notre équipe comptable vous recontactera sous 48h.",
        buttons: [{ text: "OK", style: "primary", onPress: () => router.back() }],
      });
    },
    onError: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert({
        type: "error",
        title: "Envoi impossible",
        message:
          "Votre demande n'a pas pu être transmise automatiquement.\n\n" +
          "Contactez directement votre équipe MyJantes :\n" +
          "📞 03 21 40 80 53\n" +
          "✉ contact@myjantes.fr\n\n" +
          "Horaires : Lun – Ven 8h00 – 18h00",
        buttons: [{ text: "OK" }],
      });
    },
  });

  const canSubmit = !!period && (period !== "custom" || (dateFrom.trim() && dateTo.trim()));

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12 }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Facturation groupée</Text>
            <Text style={styles.headerSub}>Service professionnel</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Platform.OS === "web" ? 34 + 40 : insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banner */}
          <View style={styles.banner}>
            <View style={[styles.bannerIcon, { backgroundColor: "#8B5CF620" }]}>
              <Ionicons name="layers-outline" size={28} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.bannerTitle}>Regrouper vos prestations</Text>
              <Text style={styles.bannerText}>
                Demandez une facturation globale de toutes vos prestations sur une période. Idéal pour votre comptabilité mensuelle ou trimestrielle.
              </Text>
            </View>
          </View>

          {/* Période */}
          <Text style={styles.sectionLabel}>Période de facturation *</Text>
          <View style={styles.periodGrid}>
            {PERIOD_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.periodCard, period === opt.key && styles.periodCardSelected]}
                onPress={() => {
                  setPeriod(opt.key);
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                }}
              >
                <Ionicons
                  name={opt.icon}
                  size={22}
                  color={period === opt.key ? "#fff" : theme.textSecondary}
                />
                <Text style={[styles.periodLabel, period === opt.key && styles.periodLabelSelected]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Custom dates */}
          {period === "custom" && (
            <View style={{ gap: 12 }}>
              <Text style={styles.sectionLabel}>Dates de la période *</Text>
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Du</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    <TextInput
                      style={styles.input}
                      value={dateFrom}
                      onChangeText={setDateFrom}
                      placeholder="JJ/MM/AAAA"
                      placeholderTextColor={theme.textTertiary}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Au</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    <TextInput
                      style={styles.input}
                      value={dateTo}
                      onChangeText={setDateTo}
                      placeholder="JJ/MM/AAAA"
                      placeholderTextColor={theme.textTertiary}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Compte pro */}
          {(user?.companyName || user?.siret) && (
            <>
              <Text style={styles.sectionLabel}>Informations société</Text>
              <View style={styles.infoCard}>
                {user.companyName && (
                  <View style={styles.infoRow}>
                    <Ionicons name="business-outline" size={15} color={theme.textSecondary} />
                    <Text style={styles.infoText}>{user.companyName}</Text>
                  </View>
                )}
                {user.siret && (
                  <View style={styles.infoRow}>
                    <Ionicons name="document-text-outline" size={15} color={theme.textSecondary} />
                    <Text style={styles.infoText}>SIRET : {user.siret}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Notes */}
          <Text style={styles.sectionLabel}>Informations complémentaires</Text>
          <View style={[styles.inputWrap, { alignItems: "flex-start", minHeight: 90 }]}>
            <Ionicons name="chatbubble-outline" size={16} color={theme.textTertiary} style={{ marginTop: 2 }} />
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Précisions sur les prestations à regrouper, références à inclure..."
              placeholderTextColor={theme.textTertiary}
              multiline
            />
          </View>

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [styles.submitBtn, !canSubmit && styles.submitBtnDisabled, pressed && canSubmit && { opacity: 0.88 }]}
            onPress={() => submitMutation.mutate()}
            disabled={!canSubmit || submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={styles.submitText}>Envoyer la demande</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.footNote}>
            * Champs obligatoires. Notre équipe vous recontactera sous 48h avec le récapitulatif.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.surfaceSecondary, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Exo2_800ExtraBold", color: theme.text, letterSpacing: 0.4 },
  headerSub: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 2 },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  banner: {
    flexDirection: "row", gap: 14, backgroundColor: theme.surface,
    borderRadius: 16, borderWidth: 1, borderColor: theme.border,
    padding: 16, marginBottom: 24, alignItems: "flex-start",
  },
  bannerIcon: { width: 50, height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  bannerTitle: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
  bannerText: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, lineHeight: 18 },
  sectionLabel: {
    fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginLeft: 2, marginTop: 4,
  },
  periodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  periodCard: {
    width: "48%", flexGrow: 1, backgroundColor: theme.surface,
    borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    padding: 14, alignItems: "center", gap: 8,
  },
  periodCardSelected: { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
  periodLabel: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textSecondary, textAlign: "center" },
  periodLabelSelected: { color: "#fff" },
  dateRow: { flexDirection: "row", gap: 12 },
  fieldLabel: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textSecondary, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.inputBg || theme.surface, borderRadius: 12,
    borderWidth: 1, borderColor: theme.inputBorder || theme.border,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  input: { flex: 1, fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
  infoCard: {
    backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border,
    padding: 14, gap: 8, marginBottom: 20,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: theme.primary, borderRadius: 14, height: 52, marginTop: 8, marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  footNote: {
    fontSize: 11, fontFamily: "Exo2_400Regular", color: theme.textTertiary,
    textAlign: "center", marginBottom: 8, lineHeight: 16,
  },
});
