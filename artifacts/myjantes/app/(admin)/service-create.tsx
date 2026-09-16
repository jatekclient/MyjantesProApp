import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  TextInput, ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminServices } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

const CATEGORIES = [
  "Entretien", "Réparation", "Diagnostic", "Pneumatiques",
  "Carrosserie", "Électronique", "Climatisation", "Autre",
];

const DURATIONS = [
  { label: "30 min", value: 30 },
  { label: "1h", value: 60 },
  { label: "1h30", value: 90 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
  { label: "4h", value: 240 },
  { label: "1 jour", value: 480 },
];

export default function ServiceCreateScreen() {
  const params = useLocalSearchParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : (typeof rawId === "string" ? rawId : "");
  const isEdit = id.length > 0;

  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { showAlert, AlertComponent } = useCustomAlert();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [category, setCategory] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const [showDurations, setShowDurations] = useState(false);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["admin-service", id],
    queryFn: () => adminServices.getById(id),
    enabled: isEdit,
    retry: 1,
  });

  useEffect(() => {
    if (existing && isEdit) {
      setName(existing.name || "");
      setDescription(existing.description || "");
      const price = existing.basePrice || existing.price || existing.unit_price || existing.priceExcludingTax || "";
      setBasePrice(String(price));
      setDuration(existing.duration || 60);
      setCategory(existing.category || "");
    }
  }, [existing]);

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  const mutation = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error("Le nom du service est obligatoire.");
      const priceVal = basePrice ? parseFloat(basePrice.replace(",", ".")).toFixed(2) : "0.00";
      const payload: any = {
        name: name.trim(),
        description: description.trim(),
        basePrice: priceVal,
        price: priceVal,
        unit_price: priceVal,
        priceExcludingTax: priceVal,
        duration,
        category: category || "Autre",
      };
      if (isEdit) {
        return adminServices.update(id, payload);
      }
      return adminServices.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["admin-service", id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({
        type: "success",
        title: isEdit ? "Service modifié" : "Service créé",
        message: isEdit ? `Le service "${name}" a été mis à jour.` : `Le service "${name}" a été ajouté avec succès.`,
        buttons: [{ text: "OK", onPress: () => router.back() }],
      });
    },
    onError: (err: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert({
        type: "error",
        title: "Erreur",
        message: err?.message || "Impossible de sauvegarder le service.",
        buttons: [{ text: "OK" }],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminServices.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (err: any) => {
      showAlert({
        type: "error",
        title: "Erreur",
        message: err?.message || "Impossible de supprimer le service.",
        buttons: [{ text: "OK" }],
      });
    },
  });

  const handleDelete = () => {
    showAlert({
      type: "warning",
      title: "Supprimer le service",
      message: `Voulez-vous vraiment supprimer "${name}" ? Cette action est irréversible.`,
      buttons: [
        { text: "Annuler" },
        { text: "Supprimer", style: "default", onPress: () => deleteMutation.mutate() },
      ],
    });
  };

  const selectedDurationLabel = DURATIONS.find(d => d.value === duration)?.label || `${duration} min`;

  if (isEdit && loadingExisting) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {AlertComponent}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? "Modifier le service" : "Nouveau service"}</Text>
        <Pressable
          style={[styles.saveBtn, mutation.isPending && { opacity: 0.5 }]}
          onPress={() => { Haptics.selectionAsync(); mutation.mutate(); }}
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>{isEdit ? "Enregistrer" : "Créer"}</Text>}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, gap: 14 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nom du service *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex : Vidange + filtres"
            placeholderTextColor={theme.textTertiary}
            autoFocus={!isEdit}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Détails de la prestation..."
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prix de base (€ HT)</Text>
          <TextInput
            style={styles.input}
            value={basePrice}
            onChangeText={setBasePrice}
            placeholder="0,00"
            placeholderTextColor={theme.textTertiary}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Durée estimée</Text>
          <Pressable
            style={styles.picker}
            onPress={() => { setShowDurations(v => !v); setShowCategories(false); }}
          >
            <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
            <Text style={styles.pickerText}>{selectedDurationLabel}</Text>
            <Ionicons name={showDurations ? "chevron-up" : "chevron-down"} size={16} color={theme.textTertiary} />
          </Pressable>
          {showDurations && (
            <View style={styles.dropdownList}>
              {DURATIONS.map(d => (
                <Pressable
                  key={d.value}
                  style={[styles.dropdownItem, d.value === duration && styles.dropdownItemActive]}
                  onPress={() => { setDuration(d.value); setShowDurations(false); }}
                >
                  <Text style={[styles.dropdownItemText, d.value === duration && { color: theme.primary }]}>{d.label}</Text>
                  {d.value === duration && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catégorie</Text>
          <Pressable
            style={styles.picker}
            onPress={() => { setShowCategories(v => !v); setShowDurations(false); }}
          >
            <Ionicons name="folder-outline" size={18} color={theme.textSecondary} />
            <Text style={styles.pickerText}>{category || "Sélectionner une catégorie"}</Text>
            <Ionicons name={showCategories ? "chevron-up" : "chevron-down"} size={16} color={theme.textTertiary} />
          </Pressable>
          {showCategories && (
            <View style={styles.dropdownList}>
              {CATEGORIES.map(cat => (
                <Pressable
                  key={cat}
                  style={[styles.dropdownItem, cat === category && styles.dropdownItemActive]}
                  onPress={() => { setCategory(cat); setShowCategories(false); }}
                >
                  <Text style={[styles.dropdownItemText, cat === category && { color: theme.primary }]}>{cat}</Text>
                  {cat === category && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {name ? (
          <View style={[styles.section, { borderColor: theme.primary + "40", borderWidth: 1 }]}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>Résumé</Text>
            <Text style={styles.summaryName}>{name}</Text>
            {description ? <Text style={styles.summaryDesc}>{description}</Text> : null}
            <View style={styles.summaryRow}>
              <View style={styles.summaryChip}>
                <Ionicons name="pricetag-outline" size={14} color={theme.textTertiary} />
                <Text style={styles.summaryChipText}>
                  {basePrice ? parseFloat(basePrice.replace(",", ".")).toFixed(2) + " € HT" : "Prix non défini"}
                </Text>
              </View>
              <View style={styles.summaryChip}>
                <Ionicons name="time-outline" size={14} color={theme.textTertiary} />
                <Text style={styles.summaryChipText}>{selectedDurationLabel}</Text>
              </View>
              {category ? (
                <View style={styles.summaryChip}>
                  <Ionicons name="folder-outline" size={14} color={theme.textTertiary} />
                  <Text style={styles.summaryChipText}>{category}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {isEdit && (
          <Pressable
            style={[styles.section, { borderColor: "#EF444440", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending
              ? <ActivityIndicator size="small" color="#EF4444" />
              : <Ionicons name="trash-outline" size={18} color="#EF4444" />
            }
            <Text style={{ fontSize: 15, fontFamily: "Exo2_600SemiBold", color: "#EF4444" }}>Supprimer le service</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.text },
  saveBtn: {
    backgroundColor: "#F59E0B", paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 10, minWidth: 70, alignItems: "center",
  },
  saveBtnText: { fontSize: 14, fontFamily: "Exo2_700Bold", color: "#fff" },
  section: {
    backgroundColor: theme.surface, borderRadius: 14,
    borderWidth: 1, borderColor: theme.border, padding: 14, gap: 10,
  },
  sectionTitle: {
    fontSize: 11, fontFamily: "Exo2_600SemiBold",
    color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.8,
  },
  input: {
    fontSize: 15, fontFamily: "Exo2_400Regular", color: theme.text,
    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.background,
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  picker: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: theme.background,
  },
  pickerText: { flex: 1, fontSize: 15, fontFamily: "Exo2_400Regular", color: theme.text },
  dropdownList: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    backgroundColor: theme.background, overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  dropdownItemActive: { backgroundColor: theme.primary + "15" },
  dropdownItemText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
  summaryName: { fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.text },
  summaryDesc: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  summaryChipText: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textSecondary },
});
