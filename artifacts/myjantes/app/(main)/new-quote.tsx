import React, { useState, useMemo } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Platform, Modal, FlatList,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { useQuery } from "@tanstack/react-query";
import { servicesApi, quotesApi, Service, getPublishedServices, getServiceId, createIdempotencyKey } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import { useCustomAlert } from "@/components/CustomAlert";

interface UploadedPhoto { uri: string; key: string; }

const WHEEL_COUNTS = ["1", "2", "3", "4", "5", "6", "7", "8", "12", "16", "20+"];
const WHEEL_SIZES = [
  "13 pouces", "14 pouces", "15 pouces", "16 pouces", "17 pouces",
  "18 pouces", "19 pouces", "20 pouces", "21 pouces", "22 pouces",
  "23 pouces", "24 pouces", "Autre",
];

function PickerModal({
  visible, options, selected, onSelect, onClose, title, theme,
}: {
  visible: boolean; options: string[]; selected: string; title: string;
  onSelect: (v: string) => void; onClose: () => void; theme: any;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "#00000060" }} onPress={onClose} />
      <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <Text style={{ fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text }}>{title}</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={theme.textSecondary} /></Pressable>
        </View>
        <FlatList
          data={options}
          keyExtractor={(i) => i}
          style={{ maxHeight: 320 }}
          renderItem={({ item }) => (
            <Pressable
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border + "50" }}
              onPress={() => { onSelect(item); onClose(); }}
            >
              <Text style={{ fontSize: 15, fontFamily: selected === item ? "Exo2_600SemiBold" : "Exo2_400Regular", color: selected === item ? theme.primary : theme.text }}>{item}</Text>
              {selected === item && <Ionicons name="checkmark" size={18} color={theme.primary} />}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

export default function NewQuoteScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ serviceId?: string }>();
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  // Services
  const [selectedServices, setSelectedServices] = useState<string[]>(params.serviceId ? [params.serviceId] : []);

  // Vehicle info — mirrors the website form
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [wheelCount, setWheelCount] = useState("");
  const [wheelSize, setWheelSize] = useState("");
  const [showWheelCountPicker, setShowWheelCountPicker] = useState(false);
  const [showWheelSizePicker, setShowWheelSizePicker] = useState(false);

  // Notes & photos
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    data: services = [],
    isLoading: loadingServices,
    isError: servicesError,
    refetch: refetchServices,
  } = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.getAll,
    retry: 2,
    staleTime: 10 * 60 * 1000, // 10 min — services changent rarement
  });

  const MAX_PHOTOS = 5;
  const MIN_PHOTOS = 1;

  const toggleService = (id: string) => {
    setSelectedServices((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pickImages = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showAlert({ type: "warning", title: "Permission requise", message: "Veuillez autoriser l'accès à votre galerie.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      const remaining = MAX_PHOTOS - photos.length;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: remaining > 1,
        quality: 0.7,
        selectionLimit: remaining,
      });
      if (!result.canceled && result.assets.length > 0) {
        const newPhotos: UploadedPhoto[] = result.assets.map((asset) => ({
          uri: asset.uri,
          key: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        }));
        setPhotos((prev) => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));
      }
    } catch {
      showAlert({ type: "error", title: "Erreur", message: "Impossible d'accéder à la galerie. Réessayez.", buttons: [{ text: "OK", style: "primary" }] });
    }
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        showAlert({ type: "warning", title: "Permission requise", message: "Veuillez autoriser l'accès à la caméra.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      if (!result.canceled && result.assets.length > 0) {
        const photo: UploadedPhoto = { uri: result.assets[0].uri, key: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
        setPhotos((prev) => [...prev, photo].slice(0, MAX_PHOTOS));
      }
    } catch {
      showAlert({ type: "error", title: "Erreur", message: "Impossible d'accéder à la caméra. Réessayez.", buttons: [{ text: "OK", style: "primary" }] });
    }
  };

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    const validServiceIds = selectedServices.filter((id) =>
      safeServices.some((service) => getServiceId(service) === id),
    );
    if (validServiceIds.length === 0) {
      showAlert({ type: "error", title: "Service requis", message: "Veuillez sélectionner au moins un service.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (!vehicleBrand.trim()) {
      showAlert({ type: "error", title: "Marque requise", message: "Veuillez indiquer la marque de votre véhicule.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (photos.length < MIN_PHOTOS) {
      showAlert({ type: "warning", title: "Photo requise", message: "Veuillez ajouter au moins une photo de vos jantes.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }

    setSubmitting(true);
    try {
      const vehicleInfo = {
        brand: vehicleBrand.trim(),
        model: vehicleModel.trim(),
        year: vehicleYear.trim(),
        wheelCount: wheelCount || "",
        wheelSize: wheelSize || "",
        notes: notes.trim(),
      };

      const vehicleSummary = [
        vehicleBrand.trim(),
        vehicleModel.trim(),
        vehicleYear.trim() ? `(${vehicleYear.trim()})` : "",
        wheelCount ? `— ${wheelCount} jante${parseInt(wheelCount) > 1 ? "s" : ""}` : "",
        wheelSize ? `${wheelSize}` : "",
      ].filter(Boolean).join(" ");

      const requestDetails = [vehicleSummary, notes.trim()].filter(Boolean).join("\n\n") || "Demande via application mobile";

      // The remote API contract requires the photos and quote fields in one
      // multipart request. Creating a JSON quote first would make the server
      // reject it because `images` is mandatory.
      const formData = new FormData();
      for (const [index, photo] of photos.entries()) {
        const fileName = `jante_${Date.now()}_${index}.jpg`;
        if (Platform.OS === "web") {
          // Browser FormData needs a Blob; native Expo uses the File object
          // below so the local URI is uploaded without a second storage hop.
          const response = await globalThis.fetch(photo.uri);
          if (!response.ok) throw new Error(`Impossible de lire la photo (${response.status}).`);
          const blob = await response.blob();
          if (!blob || blob.size === 0) throw new Error("Photo invalide ou vide.");
          formData.append("images", blob, fileName);
        } else {
          const file = new File(photo.uri);
          formData.append("images", file, fileName);
        }
      }
      formData.append("serviceId", validServiceIds[0]);
      formData.append("paymentMethod", "wire_transfer");
      formData.append("requestDetails", JSON.stringify({
        vehicleInfo,
        additionalServiceIds: validServiceIds.slice(1),
        text: requestDetails,
        source: "application_mobile",
      }));
      formData.append("vehicleMake", vehicleBrand.trim());
      if (vehicleModel.trim()) formData.append("vehicleModel", vehicleModel.trim());
      if (vehicleYear.trim()) formData.append("vehicleFirstRegDate", vehicleYear.trim());

      await quotesApi.createWithPhotos(formData, createIdempotencyKey("quote"));

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      showAlert({
        type: "success",
        title: "Demande envoyée !",
        message: "Votre demande de devis a été transmise. Nous vous recontacterons rapidement.",
        buttons: [{ text: "Voir mes demandes", onPress: () => router.push("/(main)/(tabs)/quotes"), style: "primary" }],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Impossible d'envoyer la demande. Vérifiez votre connexion et réessayez.";
      showAlert({ type: "error", title: "Erreur d'envoi", message: msg, buttons: [{ text: "OK", style: "primary" }] });
    } finally {
      setSubmitting(false);
    }
  };

  const safeServices = getPublishedServices(Array.isArray(services) ? services : []);
  const validSelectedServices = selectedServices.filter((id) =>
    safeServices.some((service) => getServiceId(service) === id),
  );
  const canSubmit = validSelectedServices.length > 0
    && vehicleBrand.trim().length > 0
    && photos.length >= MIN_PHOTOS
    && !submitting;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Demande de devis</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "web" ? 34 + 130 : insets.bottom + 130 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Services ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="construct-outline" size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>Service souhaité <Text style={styles.required}>*</Text></Text>
          </View>
          {loadingServices ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 12 }} />
          ) : servicesError ? (
            <View style={styles.serviceErrorCard}>
              <Ionicons name="cloud-offline-outline" size={28} color={theme.textSecondary} />
              <Text style={styles.serviceErrorText}>Impossible de charger les services.{"\n"}Vérifiez votre connexion.</Text>
              <Pressable style={styles.retryBtn} onPress={() => refetchServices()}>
                <Ionicons name="refresh-outline" size={16} color="#fff" />
                <Text style={styles.retryBtnText}>Réessayer</Text>
              </Pressable>
            </View>
          ) : safeServices.length === 0 ? (
            <View style={styles.serviceErrorCard}>
              <Ionicons name="construct-outline" size={28} color={theme.textSecondary} />
              <Text style={styles.serviceErrorText}>Aucun service disponible pour le moment.</Text>
              <Pressable style={styles.retryBtn} onPress={() => refetchServices()}>
                <Ionicons name="refresh-outline" size={16} color="#fff" />
                <Text style={styles.retryBtnText}>Actualiser</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.servicesContainer}>
              {safeServices.map((service: Service) => {
                const serviceId = getServiceId(service);
                const isSelected = selectedServices.includes(serviceId);
                const price = parseFloat(service.basePrice || "0");
                return (
                  <Pressable
                    key={serviceId}
                    style={[styles.serviceItem, isSelected && styles.serviceItemSelected]}
                    onPress={() => toggleService(serviceId)}
                  >
                    <View style={styles.serviceCheck}>
                      {isSelected
                        ? <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                        : <Ionicons name="ellipse-outline" size={22} color={theme.textTertiary} />}
                    </View>
                    <View style={styles.serviceInfo}>
                      <Text style={[styles.serviceItemName, isSelected && styles.serviceItemNameSelected]}>
                        {(service.name || "").trim()}
                      </Text>
                      {price > 0 && (
                        <Text style={styles.serviceItemPrice}>À partir de {price.toFixed(0)} € HT</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Véhicule ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="car-outline" size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>Votre véhicule</Text>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Marque <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={vehicleBrand}
                onChangeText={setVehicleBrand}
                placeholder="Ex: Peugeot"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="words"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Modèle</Text>
              <TextInput
                style={styles.input}
                value={vehicleModel}
                onChangeText={setVehicleModel}
                placeholder="Ex: 308"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Année</Text>
              <TextInput
                style={styles.input}
                value={vehicleYear}
                onChangeText={(t) => setVehicleYear(t.replace(/\D/g, "").slice(0, 4))}
                placeholder="Ex: 2020"
                placeholderTextColor={theme.textTertiary}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Nb de jantes</Text>
              <Pressable style={styles.pickerBtn} onPress={() => setShowWheelCountPicker(true)}>
                <Text style={[styles.pickerBtnText, !wheelCount && { color: theme.textTertiary }]}>
                  {wheelCount ? `${wheelCount} jante${parseInt(wheelCount) > 1 ? "s" : ""}` : "Sélectionner"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Taille des jantes</Text>
          <Pressable style={styles.pickerBtn} onPress={() => setShowWheelSizePicker(true)}>
            <Text style={[styles.pickerBtnText, !wheelSize && { color: theme.textTertiary }]}>
              {wheelSize || "Sélectionner la taille"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
          </Pressable>
        </View>

        {/* ── Photos ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="camera-outline" size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>
              Photos des jantes <Text style={styles.required}>*</Text>
              <Text style={styles.photoCount}> ({photos.length}/{MAX_PHOTOS})</Text>
            </Text>
          </View>
          <Text style={styles.photoHintPre}>
            Photographiez chaque jante sous différents angles. Les photos permettent un diagnostic précis.
          </Text>
          <View style={styles.photosGrid}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoItem}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                <Pressable style={styles.photoRemoveBtn} onPress={() => removePhoto(index)}>
                  <Ionicons name="close-circle" size={22} color={theme.primary} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <>
                <Pressable style={({ pressed }) => [styles.addPhotoBtn, pressed && styles.addPhotoBtnPressed]} onPress={pickImages}>
                  <Ionicons name="images-outline" size={24} color={theme.primary} />
                  <Text style={styles.addPhotoText}>Galerie</Text>
                </Pressable>
                {Platform.OS !== "web" && (
                  <Pressable style={({ pressed }) => [styles.addPhotoBtn, pressed && styles.addPhotoBtnPressed]} onPress={takePhoto}>
                    <Ionicons name="camera-outline" size={24} color={theme.primary} />
                    <Text style={styles.addPhotoText}>Photo</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
          <Text style={[styles.photoHint, photos.length >= MIN_PHOTOS && styles.photoHintOk]}>
            {photos.length === 0
              ? "Au moins 1 photo requise"
              : photos.length >= MAX_PHOTOS
                ? `✓ ${photos.length} photos ajoutées`
                : `${photos.length} photo${photos.length > 1 ? "s" : ""} ajoutée${photos.length > 1 ? "s" : ""} — vous pouvez en ajouter ${MAX_PHOTOS - photos.length} de plus`}
          </Text>
        </View>

        {/* ── Message ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>Informations complémentaires</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Décrivez l'état de vos jantes, rayures, déformations, couleur souhaitée, questions particulières..."
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* ── Contact (pré-rempli) ──────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>Vos coordonnées</Text>
          </View>
          <View style={styles.userInfoCard}>
            {user?.firstName && (
              <View style={styles.userInfoRow}>
                <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
                <Text style={styles.userInfoText}>{user.firstName} {user.lastName}</Text>
              </View>
            )}
            <View style={styles.userInfoRow}>
              <Ionicons name="mail-outline" size={14} color={theme.textSecondary} />
              <Text style={styles.userInfoText}>{user?.email}</Text>
            </View>
            {user?.phone && (
              <View style={styles.userInfoRow}>
                <Ionicons name="call-outline" size={14} color={theme.textSecondary} />
                <Text style={styles.userInfoText}>{user.phone}</Text>
              </View>
            )}
            <Text style={styles.userInfoNote}>
              Ces informations seront transmises avec votre demande.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 10 }]}>
        <Pressable
          style={({ pressed }) => [styles.submitBtn, pressed && canSubmit && { opacity: 0.9 }, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : (<>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Envoyer ma demande de devis</Text>
              </>)
          }
        </Pressable>
      </View>

      <PickerModal
        visible={showWheelCountPicker}
        options={WHEEL_COUNTS}
        selected={wheelCount}
        onSelect={setWheelCount}
        onClose={() => setShowWheelCountPicker(false)}
        title="Nombre de jantes"
        theme={theme}
      />
      <PickerModal
        visible={showWheelSizePicker}
        options={WHEEL_SIZES}
        selected={wheelSize}
        onSelect={setWheelSize}
        onClose={() => setShowWheelSizePicker(false)}
        title="Taille des jantes"
        theme={theme}
      />
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.surface,
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Exo2_600SemiBold", color: theme.text },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text },
  required: { fontSize: 13, color: theme.primary, fontFamily: "Exo2_500Medium" },
  photoCount: { fontSize: 13, color: theme.textSecondary, fontFamily: "Exo2_400Regular" },
  servicesContainer: { gap: 6 },
  serviceItem: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: theme.surface, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: theme.border,
  },
  serviceItemSelected: { borderColor: theme.primary, backgroundColor: theme.primary + "12" },
  serviceCheck: { marginRight: 12 },
  serviceInfo: { flex: 1 },
  serviceItemName: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.text },
  serviceItemNameSelected: { fontFamily: "Exo2_600SemiBold", color: theme.primary },
  serviceItemPrice: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 2 },
  row: { flexDirection: "row", gap: 10, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: theme.text, fontFamily: "Exo2_400Regular",
  },
  pickerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
  },
  pickerBtnText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
  photoHintPre: { fontSize: 12, color: theme.textSecondary, fontFamily: "Exo2_400Regular", marginBottom: 12, lineHeight: 18 },
  photosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoItem: { width: 100, height: 100, borderRadius: 10, overflow: "hidden" },
  photoImage: { width: "100%", height: "100%" },
  photoRemoveBtn: { position: "absolute", top: 2, right: 2, backgroundColor: theme.background, borderRadius: 11 },
  addPhotoBtn: {
    width: 100, height: 100, borderRadius: 10,
    backgroundColor: theme.surface, justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: theme.border, borderStyle: "dashed" as any, gap: 4,
  },
  addPhotoBtnPressed: { backgroundColor: theme.surfaceSecondary },
  addPhotoText: { fontSize: 11, fontFamily: "Exo2_500Medium", color: theme.primary },
  photoHint: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 8 },
  photoHintOk: { color: "#22C55E" },
  notesInput: {
    backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1,
    borderColor: theme.border, padding: 14, fontSize: 14,
    fontFamily: "Exo2_400Regular", color: theme.text, minHeight: 110,
  },
  userInfoCard: { backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 8 },
  userInfoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userInfoText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
  userInfoNote: { fontSize: 11, color: theme.textTertiary, fontFamily: "Exo2_400Regular", marginTop: 4 },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border,
    paddingHorizontal: 20, paddingTop: 12,
  },
  submitBtn: {
    backgroundColor: theme.primary, borderRadius: 12, height: 52,
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: "#fff", fontSize: 15, fontFamily: "Exo2_600SemiBold" },
  serviceErrorCard: {
    alignItems: "center" as const, padding: 20, gap: 10,
    backgroundColor: theme.surface, borderRadius: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  serviceErrorText: {
    fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary,
    textAlign: "center" as const, lineHeight: 20,
  },
  retryBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    backgroundColor: theme.primary, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 9, marginTop: 4,
  },
  retryBtnText: { color: "#fff", fontSize: 13, fontFamily: "Exo2_600SemiBold" },
});
