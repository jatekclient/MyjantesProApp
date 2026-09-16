import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Calendar from "expo-calendar";
import { reservationsApi, servicesApi, Reservation } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

function getReservationStatusInfo(status: string) {
  const s = status?.toLowerCase() || "";
  if (s === "confirmed" || s === "confirmée" || s === "confirmé")
    return { label: "Confirmée", color: "#16A34A", bg: "#DCFCE7", icon: "checkmark-circle-outline" as const };
  if (s === "pending" || s === "en_attente" || s === "pending_client")
    return { label: "En attente", color: "#D97706", bg: "#FEF3C7", icon: "time-outline" as const };
  if (s === "cancelled" || s === "annulée")
    return { label: "Annulée", color: "#DC2626", bg: "#FEE2E2", icon: "close-circle-outline" as const };
  if (s === "completed" || s === "terminée" || s === "terminé")
    return { label: "Terminée", color: "#16A34A", bg: "#DCFCE7", icon: "checkmark-done-outline" as const };
  if (s === "in_progress" || s === "en_cours")
    return { label: "En cours", color: "#3B82F6", bg: "#DBEAFE", icon: "hourglass-outline" as const };
  return { label: status || "Inconnu", color: "#888", bg: "#F0F0F0", icon: "help-outline" as const };
}

function parseVehicleInfo(vehicleInfo: any) {
  if (!vehicleInfo) return null;
  if (typeof vehicleInfo === "string") {
    try { return JSON.parse(vehicleInfo); } catch { return null; }
  }
  if (typeof vehicleInfo === "object") return vehicleInfo;
  return null;
}

function formatDateTime(dateStr: string | null | undefined, includeTime = true) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "short",
      year: "numeric",
    };
    if (includeTime) {
      options.hour = "2-digit";
      options.minute = "2-digit";
    }
    return d.toLocaleDateString("fr-FR", options);
  } catch {
    return null;
  }
}

function formatTimeOnly(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

function InfoRow({ icon, label, value, theme, styles }: { icon: string; label: string; value: string; theme: ThemeColors; styles: any }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabel}>
        <Ionicons name={icon as any} size={16} color={theme.textSecondary} />
        <Text style={styles.infoLabelText}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ReservationDetailScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showAlert, AlertComponent } = useCustomAlert();
  const [confirming, setConfirming] = useState(false);

  const { data: allReservationsRaw = [], isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: reservationsApi.getAll,
  });

  const { data: allServicesRaw = [] } = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.getAll,
    retry: 1,
  });

  const allReservations = Array.isArray(allReservationsRaw) ? allReservationsRaw : [];
  const allServices = Array.isArray(allServicesRaw) ? allServicesRaw : [];
  const reservation = allReservations.find((r) => r.id === id);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!reservation) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.textTertiary} />
        <Text style={styles.errorText}>Réservation introuvable</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const statusInfo = getReservationStatusInfo(reservation.status);
  const displayRef = (reservation as any).reference || reservation.id;
  const vehicleInfo = parseVehicleInfo(reservation.vehicleInfo);

  const startDate = (reservation as any).scheduledDate || reservation.date;
  const endDate = (reservation as any).estimatedEndDate;

  const formattedStart = formatDateTime(startDate);
  const formattedEnd = formatDateTime(endDate);
  const endTime = formatTimeOnly(endDate);
  const startDateOnly = formatDateTime(startDate, false);

  const isSameDay = startDate && endDate &&
    new Date(startDate).toDateString() === new Date(endDate).toDateString();

  const serviceId = (reservation as any).serviceId;
  const linkedService = serviceId ? allServices.find((s) => s.id === serviceId) : null;

  const wheelCount = (reservation as any).wheelCount;
  const diameter = (reservation as any).diameter;
  const priceHT = (reservation as any).priceExcludingTax || (reservation as any).totalExcludingTax;
  const totalTTC_Raw = (reservation as any).totalIncludingTax;
  const taxRate = (reservation as any).taxRate || "20";
  const taxAmount = (reservation as any).taxAmount;
  const productDetails = (reservation as any).productDetails;
  const notes = reservation.notes;
  const timeSlot = reservation.timeSlot;

  const createdDate = formatDateTime(reservation.createdAt);

  const priceHTNum = priceHT ? parseFloat(priceHT) : 0;
  const taxAmountNum = taxAmount ? parseFloat(taxAmount) : priceHTNum * (parseFloat(taxRate) / 100);
  const totalTTC = totalTTC_Raw ? parseFloat(totalTTC_Raw) : (priceHTNum + taxAmountNum);

  const statusLower = reservation.status?.toLowerCase() || "";
  const isPendingClientAction = statusLower === "pending" || statusLower === "en_attente" || statusLower === "pending_client";
  const isConfirmed = statusLower === "confirmed" || statusLower === "confirmée" || statusLower === "confirmé";
  const isCancelled = statusLower === "cancelled" || statusLower === "annulée";
  const isCompleted = statusLower === "completed" || statusLower === "terminée" || statusLower === "terminé";

  const isActiveReservation = !isCancelled && !isCompleted;

  const handleAddToCalendar = async () => {
    if (Platform.OS === "web") {
      showAlert({
        type: "info",
        title: "Calendrier",
        message: "L'ajout au calendrier n'est pas disponible sur navigateur. Notez la date de votre rendez-vous manuellement.",
        buttons: [{ text: "OK" }],
      });
      return;
    }
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        showAlert({
          type: "warning",
          title: "Permission refusée",
          message: "Veuillez autoriser l'accès au calendrier dans les paramètres de votre application.",
          buttons: [{ text: "OK" }],
        });
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find((c) => c.allowsModifications) || calendars[0];
      if (!defaultCalendar) {
        showAlert({ type: "error", title: "Erreur", message: "Aucun calendrier disponible.", buttons: [{ text: "OK" }] });
        return;
      }
      const eventStart = startDate ? new Date(startDate) : new Date();
      const eventEnd = endDate ? new Date(endDate) : new Date(eventStart.getTime() + 2 * 60 * 60 * 1000);
      const title = linkedService?.name
        ? `MyJantes — ${linkedService.name}`
        : `MyJantes — Réservation ${displayRef}`;
      const notes = [
        linkedService?.name ? `Service : ${linkedService.name}` : null,
        vehicleInfo && typeof vehicleInfo === "object"
          ? `Véhicule : ${vehicleInfo.marque || vehicleInfo.brand || ""} ${vehicleInfo.modele || vehicleInfo.model || ""}`.trim()
          : null,
        reservation.notes ? `Notes : ${reservation.notes}` : null,
      ].filter(Boolean).join("\n");
      await Calendar.createEventAsync(defaultCalendar.id, {
        title,
        startDate: eventStart,
        endDate: eventEnd,
        notes: notes || undefined,
        alarms: [{ relativeOffset: -60 }, { relativeOffset: -1440 }],
      });
      showAlert({
        type: "success",
        title: "Ajouté au calendrier",
        message: "Votre rendez-vous a été ajouté à votre calendrier avec un rappel la veille et 1h avant.",
        buttons: [{ text: "OK" }],
      });
    } catch (err: any) {
      console.error("[CALENDAR] error:", err.message);
      showAlert({ type: "error", title: "Erreur", message: "Impossible d'ajouter au calendrier.", buttons: [{ text: "OK" }] });
    }
  };

  const [cancelling, setCancelling] = useState(false);

  const handleCancel = () => {
    showAlert({
      type: "warning",
      title: "Annuler la réservation",
      message: "Êtes-vous sûr de vouloir annuler cette réservation ?",
      buttons: [
        { text: "Retour" },
        {
          text: "Annuler",
          style: "primary",
          onPress: async () => {
            setCancelling(true);
            try {
              await reservationsApi.update(id!, { status: "cancelled" });
              queryClient.invalidateQueries({ queryKey: ["reservations"] });
              showAlert({ type: "success", title: "Réservation annulée", message: "La réservation a bien été annulée.", buttons: [{ text: "OK", style: "primary" }] });
            } catch (err: any) {
              console.error("[RESERVATION] cancel error:", err?.message);
              showAlert({ type: "error", title: "Erreur", message: err?.message || "Impossible d'annuler.", buttons: [{ text: "OK", style: "primary" }] });
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    });
  };

  const handleConfirm = () => {
    showAlert({
      type: "info",
      title: "Confirmer la réservation",
      message: "Souhaitez-vous confirmer cette réservation ?",
      buttons: [
        { text: "Annuler" },
        {
          text: "Confirmer",
          style: "primary",
          onPress: async () => {
            setConfirming(true);
            try {
              await reservationsApi.update(id!, { status: "confirmed" });
              queryClient.invalidateQueries({ queryKey: ["reservations"] });
              showAlert({ type: "success", title: "Réservation confirmée", message: "La réservation a bien été confirmée.", buttons: [{ text: "OK", style: "primary" }] });
            } catch (err: any) {
              console.error("[RESERVATION] confirm error:", err?.message);
              showAlert({ type: "error", title: "Erreur", message: err?.message || "Impossible de confirmer.", buttons: [{ text: "OK", style: "primary" }] });
            } finally {
              setConfirming(false);
            }
          },
        },
      ],
    });
  };


  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Détail réservation</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 34 + 40 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusCard}>
          <View style={[styles.statusBadgeLarge, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon} size={20} color={statusInfo.color} />
            <Text style={[styles.statusTextLarge, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
          <Text style={styles.referenceText}>{displayRef}</Text>
          {createdDate && (
            <Text style={styles.createdDate}>Créée le {createdDate}</Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={18} color={theme.primary} />
            <Text style={styles.sectionTitle}>Dates et horaires</Text>
          </View>
          <View style={styles.dateCard}>
            <View style={styles.dateBlock}>
              <View style={styles.dateIconRow}>
                <View style={[styles.dateIconCircle, { backgroundColor: theme.acceptedBg }]}>
                  <Ionicons name="play" size={14} color={theme.accepted} />
                </View>
                <Text style={styles.dateBlockLabel}>Début</Text>
              </View>
              <Text style={styles.dateBlockValue}>
                {formattedStart || startDateOnly || "Non défini"}
              </Text>
              {timeSlot && !formattedStart && (
                <Text style={styles.timeSlotText}>Créneau : {timeSlot}</Text>
              )}
            </View>

            {(endDate || formattedEnd) && (
              <>
                <View style={styles.dateSeparator}>
                  <Ionicons name="arrow-down" size={16} color={theme.textTertiary} />
                </View>
                <View style={styles.dateBlock}>
                  <View style={styles.dateIconRow}>
                    <View style={[styles.dateIconCircle, { backgroundColor: theme.pendingBg }]}>
                      <Ionicons name="stop" size={14} color={theme.pending} />
                    </View>
                    <Text style={styles.dateBlockLabel}>Fin estimée</Text>
                  </View>
                  <Text style={styles.dateBlockValue}>
                    {isSameDay ? (endTime || "Non défini") : (formattedEnd || "Non défini")}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {linkedService && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="construct-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Service</Text>
            </View>
            <View style={styles.serviceCard}>
              <View style={styles.serviceIconCircle}>
                <Ionicons name="build-outline" size={20} color={theme.primary} />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{linkedService.name}</Text>
                {linkedService.description ? (
                  <Text style={styles.serviceDesc} numberOfLines={3}>{linkedService.description}</Text>
                ) : null}
                {linkedService.estimatedDuration && (
                  <View style={styles.serviceMeta}>
                    <Ionicons name="time-outline" size={13} color={theme.textTertiary} />
                    <Text style={styles.serviceMetaText}>Durée estimée : {linkedService.estimatedDuration}</Text>
                  </View>
                )}
                {linkedService.basePrice && parseFloat(linkedService.basePrice) > 0 && (
                  <View style={styles.serviceMeta}>
                    <Ionicons name="pricetag-outline" size={13} color={theme.textTertiary} />
                    <Text style={styles.serviceMetaText}>À partir de {parseFloat(linkedService.basePrice).toFixed(2)} €</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {(wheelCount || diameter || productDetails) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="settings-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Détails prestation</Text>
            </View>
            {wheelCount && <InfoRow theme={theme} styles={styles} icon="apps-outline" label="Nombre de jantes" value={`${wheelCount}`} />}
            {diameter && <InfoRow theme={theme} styles={styles} icon="resize-outline" label="Diamètre" value={`${diameter}"`} />}
            {productDetails && (
              <View style={styles.productDetailsCard}>
                <Text style={styles.productDetailsText}>{productDetails}</Text>
              </View>
            )}
          </View>
        )}

        {priceHTNum > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="receipt-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Tarification</Text>
            </View>
            <View style={styles.priceCard}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Prix HT</Text>
                <Text style={styles.priceValue}>{priceHTNum.toFixed(2)} €</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>TVA ({parseFloat(taxRate)}%)</Text>
                <Text style={styles.priceValue}>{taxAmountNum.toFixed(2)} €</Text>
              </View>
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total TTC</Text>
                <Text style={styles.totalValue}>{totalTTC.toFixed(2)} €</Text>
              </View>
            </View>
          </View>
        )}

        {vehicleInfo && typeof vehicleInfo === "object" && Object.keys(vehicleInfo).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="car-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Véhicule</Text>
            </View>
            {(vehicleInfo.marque || vehicleInfo.brand || vehicleInfo.make) && (
              <InfoRow theme={theme} styles={styles} icon="car-outline" label="Marque" value={vehicleInfo.marque || vehicleInfo.brand || vehicleInfo.make} />
            )}
            {(vehicleInfo.modele || vehicleInfo.model) && (
              <InfoRow theme={theme} styles={styles} icon="car-sport-outline" label="Modèle" value={vehicleInfo.modele || vehicleInfo.model} />
            )}
            {(vehicleInfo.immatriculation || vehicleInfo.plate || vehicleInfo.registration) && (
              <InfoRow theme={theme} styles={styles} icon="card-outline" label="Immatriculation" value={vehicleInfo.immatriculation || vehicleInfo.plate || vehicleInfo.registration} />
            )}
            {vehicleInfo.annee && <InfoRow theme={theme} styles={styles} icon="calendar-outline" label="Année" value={vehicleInfo.annee} />}
            {vehicleInfo.vin && <InfoRow theme={theme} styles={styles} icon="barcode-outline" label="VIN" value={vehicleInfo.vin} />}
            {vehicleInfo.couleur && <InfoRow theme={theme} styles={styles} icon="color-palette-outline" label="Couleur" value={vehicleInfo.couleur} />}
          </View>
        )}

        {notes ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubble-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Notes</Text>
            </View>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

        {isPendingClientAction && (
          <View style={styles.actionsSection}>
            <View style={styles.actionsBanner}>
              <Ionicons name="information-circle" size={18} color="#F59E0B" />
              <Text style={styles.actionsBannerText}>
                Cette réservation est en attente de votre confirmation.
              </Text>
            </View>
            <View style={styles.actionsRow}>
              <Pressable
                style={({ pressed }) => [styles.actionBtnPrimary, { flex: 1 }, pressed && { opacity: 0.7 }]}
                onPress={handleConfirm}
                disabled={confirming}
              >
                {confirming
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.actionBtnPrimaryText}>Confirmer</Text>
                }
              </Pressable>
            </View>
            {isActiveReservation && (
              <View style={[styles.actionsRow, { marginTop: 10 }]}>
                <Pressable
                  style={({ pressed }) => [styles.actionBtnSecondary, { flex: 1 }, pressed && { opacity: 0.7 }]}
                  onPress={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling
                    ? <ActivityIndicator size="small" color={theme.rejected} />
                    : <Text style={styles.actionBtnSecondaryText}>Annuler la réservation</Text>
                  }
                </Pressable>
              </View>
            )}
          </View>
        )}

        {isActiveReservation && !isPendingClientAction && (
          <View style={styles.actionsSection}>
            <View style={styles.actionsRow}>
              <Pressable
                style={({ pressed }) => [styles.actionBtnSecondary, { flex: 1 }, pressed && { opacity: 0.7 }]}
                onPress={handleCancel}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color={theme.rejected} />
                  : <Text style={styles.actionBtnSecondaryText}>Annuler la réservation</Text>
                }
              </Pressable>
            </View>
          </View>
        )}


        {isActiveReservation && startDate && (
          <Pressable
            style={({ pressed }) => [styles.calendarBtn, pressed && { opacity: 0.8 }]}
            onPress={handleAddToCalendar}
          >
            <Ionicons name="calendar-outline" size={18} color={theme.primary} />
            <Text style={styles.calendarBtnText}>Ajouter au calendrier</Text>
          </Pressable>
        )}
      </ScrollView>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  statusCard: { alignItems: "center", marginBottom: 24, gap: 8 },
  statusBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
  },
  statusTextLarge: { fontSize: 15, fontFamily: "Exo2_600SemiBold" },
  referenceText: { fontSize: 18, fontFamily: "Exo2_700Bold", color: theme.text },
  createdDate: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text },
  dateCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 4,
  },
  dateBlock: { gap: 6 },
  dateIconRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  dateBlockLabel: { fontSize: 13, fontFamily: "Exo2_600SemiBold", color: theme.textSecondary },
  dateBlockValue: {
    fontSize: 15,
    fontFamily: "Exo2_500Medium",
    color: theme.text,
    paddingLeft: 36,
    textTransform: "capitalize" as const,
  },
  timeSlotText: {
    fontSize: 13,
    fontFamily: "Exo2_400Regular",
    color: theme.textTertiary,
    paddingLeft: 36,
  },
  dateSeparator: { alignItems: "center", paddingVertical: 6 },
  serviceCard: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 14,
  },
  serviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  serviceInfo: { flex: 1, gap: 4 },
  serviceName: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  serviceDesc: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, lineHeight: 19 },
  serviceMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  serviceMetaText: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  infoLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabelText: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.textSecondary },
  infoValue: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
  productDetailsCard: {
    marginTop: 8,
    backgroundColor: theme.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  productDetailsText: {
    fontSize: 14,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    lineHeight: 22,
  },
  priceCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  priceLabel: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  priceValue: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  totalRow: { paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.borderLight },
  totalLabel: { fontSize: 16, fontFamily: "Exo2_700Bold", color: theme.text },
  totalValue: { fontSize: 22, fontFamily: "Exo2_700Bold", color: theme.primary },
  notesText: {
    fontSize: 14,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    lineHeight: 22,
    backgroundColor: theme.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  errorText: { fontSize: 16, fontFamily: "Exo2_500Medium", color: theme.textSecondary, marginTop: 12 },
  backLink: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: theme.primary, borderRadius: 10 },
  backLinkText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  actionsSection: {
    marginTop: 24,
    marginBottom: 12,
    gap: 12,
  },
  actionsBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  actionsBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Exo2_400Regular",
    color: "#92400E",
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnPrimaryText: {
    fontSize: 15,
    fontFamily: "Exo2_600SemiBold",
    color: "#fff",
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  actionBtnSecondaryText: {
    fontSize: 15,
    fontFamily: "Exo2_600SemiBold",
    color: theme.rejected,
  },
  calendarBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  calendarBtnText: {
    fontSize: 15,
    fontFamily: "Exo2_600SemiBold",
    color: theme.primary,
  },
});
