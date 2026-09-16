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
import { removalApi, createIdempotencyKey } from "@/lib/api";

const REMOVAL_TYPES = [
  { key: "pneus_usages", label: "Pneus usagés", icon: "trash-outline" as const },
  { key: "jantes_abimees", label: "Jantes abîmées", icon: "construct-outline" as const },
  { key: "lot_complet", label: "Lot complet (jantes + pneus)", icon: "layers-outline" as const },
  { key: "stock_pro", label: "Stock professionnel", icon: "cube-outline" as const },
];

const QUANTITIES = ["1–4", "5–10", "11–20", "21–50", "50+"];

const WHEEL_COUNTS = ["1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "20+"];
const VEHICLE_COUNTS = ["1", "2", "3", "4", "5+"];
const PICKUP_METHODS = [
  { key: "enlevement", label: "Enlèvement MyJantes", icon: "car-outline" as const,
    desc: "Nous venons chez vous" },
  { key: "depot", label: "Dépôt atelier", icon: "business-outline" as const,
    desc: "Vous déposez à l'atelier" },
];

export default function RemovalRequestScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();

  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedQty, setSelectedQty] = useState<string>("");
  const [wheelCount, setWheelCount] = useState<string>("");
  const [vehicleCount, setVehicleCount] = useState<string>("");
  const [pickupMethod, setPickupMethod] = useState<string>("");
  const [address, setAddress] = useState(user?.city || "");
  const [notes, setNotes] = useState("");
  const [contactName, setContactName] = useState(
    [user?.firstName, user?.lastName].filter(Boolean).join(" ")
  );
  const [contactPhone, setContactPhone] = useState(user?.phone || "");

  const submitMutation = useMutation({
    mutationFn: async () => {
      return removalApi.create({
        materialType: selectedType,
        materialLabel: REMOVAL_TYPES.find((type) => type.key === selectedType)?.label,
        estimatedQuantity: selectedQty,
        wheelCount: wheelCount || undefined,
        vehicleCount: vehicleCount || undefined,
        pickupMode: pickupMethod === "depot" ? "depot" : "enlevement",
        pickupAddress: address.trim(),
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      }, createIdempotencyKey("removal"));
    },
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({
        type: "success",
        title: "Demande envoyée !",
        message: "Votre demande d'enlèvement a été transmise. Notre équipe vous contactera sous 24h.",
        buttons: [{ text: "OK", style: "primary", onPress: () => router.back() }],
      });
    },
    onError: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert({
        type: "error",
        title: "Erreur",
        message: "Impossible d'envoyer la demande. Veuillez réessayer.",
        buttons: [{ text: "OK" }],
      });
    },
  });

  const canSubmit = selectedType && selectedQty && pickupMethod && address.trim().length > 2;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12 }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Demande d'enlèvement</Text>
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
            <View style={[styles.bannerIcon, { backgroundColor: theme.primary + "20" }]}>
              <Ionicons name="car-sport-outline" size={28} color={theme.primary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.bannerTitle}>Enlèvement à domicile / garage</Text>
              <Text style={styles.bannerText}>
                Nous venons récupérer vos pneus et jantes usagés directement chez vous. Service réservé aux professionnels.
              </Text>
            </View>
          </View>

          {/* Type de matériel */}
          <Text style={styles.sectionLabel}>Type de matériel *</Text>
          <View style={styles.typeGrid}>
            {REMOVAL_TYPES.map((t) => (
              <Pressable
                key={t.key}
                style={[styles.typeCard, selectedType === t.key && styles.typeCardSelected]}
                onPress={() => { setSelectedType(t.key); Haptics.selectionAsync(); }}
              >
                <Ionicons
                  name={t.icon}
                  size={22}
                  color={selectedType === t.key ? "#fff" : theme.textSecondary}
                />
                <Text style={[styles.typeLabel, selectedType === t.key && styles.typeLabelSelected]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Quantité */}
          <Text style={styles.sectionLabel}>Quantité estimée *</Text>
          <View style={styles.qtyRow}>
            {QUANTITIES.map((q) => (
              <Pressable
                key={q}
                style={[styles.qtyChip, selectedQty === q && styles.qtyChipSelected]}
                onPress={() => { setSelectedQty(q); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.qtyText, selectedQty === q && styles.qtyTextSelected]}>{q}</Text>
              </Pressable>
            ))}
          </View>

          {/* Adresse */}
          <Text style={styles.sectionLabel}>Adresse d'enlèvement *</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="location-outline" size={18} color={theme.textTertiary} />
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Adresse complète, ville, code postal"
              placeholderTextColor={theme.textTertiary}
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Contact */}
          <Text style={styles.sectionLabel}>Contact sur place</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color={theme.textTertiary} />
            <TextInput
              style={styles.input}
              value={contactName}
              onChangeText={setContactName}
              placeholder="Nom du responsable"
              placeholderTextColor={theme.textTertiary}
              returnKeyType="next"
            />
          </View>
          <View style={[styles.inputWrap, { marginTop: 8 }]}>
            <Ionicons name="call-outline" size={18} color={theme.textTertiary} />
            <TextInput
              style={styles.input}
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="Numéro de téléphone"
              placeholderTextColor={theme.textTertiary}
              keyboardType="phone-pad"
              returnKeyType="next"
            />
          </View>

          {/* Nombre de jantes */}
          <Text style={styles.sectionLabel}>Nombre de jantes</Text>
          <View style={styles.qtyRow}>
            {WHEEL_COUNTS.map((q) => (
              <Pressable
                key={q}
                style={[styles.qtyChip, wheelCount === q && styles.qtyChipSelected]}
                onPress={() => { setWheelCount(q); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.qtyText, wheelCount === q && styles.qtyTextSelected]}>{q}</Text>
              </Pressable>
            ))}
          </View>

          {/* Nombre de véhicules */}
          <Text style={styles.sectionLabel}>Nombre de véhicules</Text>
          <View style={styles.qtyRow}>
            {VEHICLE_COUNTS.map((q) => (
              <Pressable
                key={q}
                style={[styles.qtyChip, vehicleCount === q && styles.qtyChipSelected]}
                onPress={() => { setVehicleCount(q); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.qtyText, vehicleCount === q && styles.qtyTextSelected]}>
                  {q} véhicule{q !== "1" ? "s" : ""}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Méthode d'enlèvement */}
          <Text style={styles.sectionLabel}>Méthode d'enlèvement *</Text>
          <View style={styles.typeGrid}>
            {PICKUP_METHODS.map((m) => (
              <Pressable
                key={m.key}
                style={[styles.typeCard, pickupMethod === m.key && styles.typeCardSelected]}
                onPress={() => { setPickupMethod(m.key); Haptics.selectionAsync(); }}
              >
                <Ionicons name={m.icon} size={22} color={pickupMethod === m.key ? "#fff" : theme.textSecondary} />
                <Text style={[styles.typeLabel, pickupMethod === m.key && styles.typeLabelSelected]}>{m.label}</Text>
                <Text style={[styles.typeDesc, pickupMethod === m.key && { color: "rgba(255,255,255,0.75)" }]}>{m.desc}</Text>
              </Pressable>
            ))}
          </View>

          {/* Notes */}
          <Text style={styles.sectionLabel}>Informations complémentaires</Text>
          <View style={[styles.inputWrap, { alignItems: "flex-start", minHeight: 100 }]}>
            <Ionicons name="chatbubble-outline" size={18} color={theme.textTertiary} style={{ marginTop: 2 }} />
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="État du matériel, accès, disponibilités..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              !canSubmit && styles.submitBtnDisabled,
              pressed && canSubmit && { opacity: 0.88 },
            ]}
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
            * Champs obligatoires. Notre équipe vous recontactera pour confirmer le créneau.
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
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.surface, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: theme.border,
  },
  headerTitle: { fontSize: 18, fontFamily: "Exo2_800ExtraBold", color: theme.text, letterSpacing: 0.4 },
  headerSub: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 2 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
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
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginLeft: 2,
  },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  typeCard: {
    width: "48%", flexGrow: 1, backgroundColor: theme.surface,
    borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    padding: 14, alignItems: "center", gap: 8,
  },
  typeCardSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  typeLabel: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textSecondary, textAlign: "center" },
  typeLabelSelected: { color: "#fff" },
  typeDesc: { fontSize: 10, fontFamily: "Exo2_400Regular", color: theme.textTertiary, textAlign: "center" },
  qtyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  qtyChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
  },
  qtyChipSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  qtyText: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.textSecondary },
  qtyTextSelected: { color: "#fff" },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.inputBg, borderRadius: 12,
    borderWidth: 1, borderColor: theme.inputBorder,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  input: { flex: 1, fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
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
