import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  RefreshControl, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { reservationsApi, Reservation } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { FloatingSupport } from "@/components/FloatingSupport";

function getReservationStatusInfo(status: string, isDark: boolean) {
  const s = status?.toLowerCase() || "";
  if (s === "confirmed" || s === "confirmée" || s === "confirmé")
    return { label: "Confirmée", color: "#22C55E", bg: isDark ? "rgba(34,197,94,0.15)" : "#DCFCE7", icon: "checkmark-circle-outline" as const };
  if (s === "pending" || s === "en_attente" || s === "pending_client")
    return { label: "En attente", color: "#F59E0B", bg: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7", icon: "time-outline" as const };
  if (s === "cancelled" || s === "annulée")
    return { label: "Annulée", color: "#EF4444", bg: isDark ? "rgba(239,68,68,0.15)" : "#FEE2E2", icon: "close-circle-outline" as const };
  if (s === "completed" || s === "terminée" || s === "terminé")
    return { label: "Terminée", color: "#22C55E", bg: isDark ? "rgba(34,197,94,0.15)" : "#DCFCE7", icon: "checkmark-done-outline" as const };
  if (s === "in_progress" || s === "en_cours")
    return { label: "En cours", color: "#3B82F6", bg: isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE", icon: "hourglass-outline" as const };
  return { label: status || "Inconnu", color: "#888", bg: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", icon: "help-outline" as const };
}

function ReservationCard({ reservation, theme, styles }: { reservation: Reservation; theme: ThemeColors; styles: any }) {
  const statusInfo = getReservationStatusInfo(reservation.status, theme.isDark);
  const dateStr = reservation.date || reservation.createdAt;
  let formattedDate = "Date inconnue";
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      formattedDate = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }
  } catch {}

  let vehicleInfo = reservation.vehicleInfo;
  if (typeof vehicleInfo === "string") {
    try { vehicleInfo = JSON.parse(vehicleInfo); } catch {}
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: "/(main)/reservation-detail", params: { id: reservation.id } })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.idRow}>
          <Ionicons name="calendar" size={16} color={theme.primary} />
          <Text style={styles.cardDate}>{formattedDate}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
          <Ionicons name={statusInfo.icon} size={13} color={statusInfo.color} />
          <Text style={[styles.badgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        {reservation.timeSlot && (
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={theme.textTertiary} />
            <Text style={styles.detailText}>Créneau : {reservation.timeSlot}</Text>
          </View>
        )}
        {vehicleInfo && typeof vehicleInfo === "object" && (vehicleInfo.marque || vehicleInfo.brand || vehicleInfo.make) && (
          <View style={styles.detailRow}>
            <Ionicons name="car-outline" size={14} color={theme.textTertiary} />
            <Text style={styles.detailText}>
              {vehicleInfo.marque || vehicleInfo.brand || vehicleInfo.make}{" "}
              {vehicleInfo.modele || vehicleInfo.model || ""}
            </Text>
          </View>
        )}
        {vehicleInfo && typeof vehicleInfo === "object" && (vehicleInfo.immatriculation || vehicleInfo.plate || vehicleInfo.registration) && (
          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={14} color={theme.textTertiary} />
            <Text style={styles.detailText}>{vehicleInfo.immatriculation || vehicleInfo.plate || vehicleInfo.registration}</Text>
          </View>
        )}
        {reservation.notes && (
          <View style={styles.detailRow}>
            <Ionicons name="chatbubble-outline" size={14} color={theme.textTertiary} />
            <Text style={styles.detailText} numberOfLines={2}>{reservation.notes}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.viewLink}>Voir détails</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.primary} />
      </View>
    </Pressable>
  );
}

export default function ReservationsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);

  const { data: reservationsRaw, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["reservations"],
    queryFn: reservationsApi.getAll,
    retry: 1,
    refetchInterval: 60000,
  });

  const reservations = Array.isArray(reservationsRaw) ? reservationsRaw : [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Mes Réservations</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.error} />
          <Text style={styles.errorTitle}>Erreur de chargement</Text>
          <Text style={styles.errorText}>{(error as Error)?.message || "Impossible de charger les réservations."}</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Ionicons name="refresh-outline" size={18} color="#fff" />
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={[...reservations].sort((a, b) => {
            const dateA = a.date || a.createdAt || "";
            const dateB = b.date || b.createdAt || "";
            return (new Date(dateB).getTime() || 0) - (new Date(dateA).getTime() || 0);
          })}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReservationCard reservation={item} theme={theme} styles={styles} />}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyTitle}>Aucune réservation</Text>
              <Text style={styles.emptyText}>Vos réservations apparaîtront ici une fois programmées par notre équipe.</Text>
            </View>
          }
        />
      )}
      <FloatingSupport />
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Exo2_800ExtraBold",
    color: theme.text,
    letterSpacing: 1,
  },
  loader: { flex: 1, justifyContent: "center" },
  list: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  cardPressed: { backgroundColor: theme.surfaceSecondary },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  idRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  cardDate: {
    fontSize: 13, fontFamily: "Exo2_600SemiBold", color: theme.text,
    textTransform: "capitalize" as const, flex: 1,
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontFamily: "Exo2_600SemiBold" },
  cardBody: { gap: 6 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, flex: 1 },
  cardFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.borderLight,
  },
  viewLink: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.primary },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Exo2_600SemiBold", color: theme.text, marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 8 },
  errorTitle: { fontSize: 18, fontFamily: "Exo2_600SemiBold", color: theme.text, marginTop: 8 },
  errorText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary, textAlign: "center" },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 12,
  },
  retryBtnText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: "#fff" },
});
