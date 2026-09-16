import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { quotesApi, invoicesApi, reservationsApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

type FilterType = "all" | "quotes" | "invoices" | "reservations";

interface HistoryItem {
  id: string;
  type: "quote" | "invoice" | "reservation";
  reference: string;
  date: string;
  status: string;
  amount?: number;
  raw: any;
}

function getQuoteStatusInfo(status: string) {
  const s = status?.toLowerCase() || "";
  if (s === "pending" || s === "en_attente") return { label: "En attente", color: "#9CA3AF", bg: "#9CA3AF20" };
  if (s === "approved" || s === "approuvé" || s === "approuve") return { label: "Approuvé", color: "#4ADE80", bg: "#4ADE8020" };
  if (s === "accepted" || s === "accepté" || s === "accepte") return { label: "Accepté", color: "#60A5FA", bg: "#60A5FA20" };
  if (s === "rejected" || s === "refusé" || s === "refuse") return { label: "Refusé", color: "#F87171", bg: "#F8717120" };
  if (s === "completed" || s === "terminé" || s === "termine") return { label: "Terminé", color: "#C084FC", bg: "#C084FC20" };
  if (s === "sent" || s === "envoyé" || s === "envoye") return { label: "Envoyé", color: "#22D3EE", bg: "#22D3EE20" };
  return { label: status || "Inconnu", color: "#9CA3AF", bg: "#9CA3AF18" };
}

function getInvoiceStatusInfo(status: string) {
  const s = status?.toLowerCase() || "";
  if (s === "pending" || s === "en_attente") return { label: "En attente", color: "#FCD34D", bg: "#FCD34D20" };
  if (s === "paid" || s === "payée" || s === "payé") return { label: "Payée", color: "#4ADE80", bg: "#4ADE8020" };
  if (s === "overdue" || s === "en_retard") return { label: "En retard", color: "#F87171", bg: "#F8717120" };
  if (s === "cancelled" || s === "annulée") return { label: "Annulée", color: "#9CA3AF", bg: "#9CA3AF20" };
  return { label: status || "Inconnu", color: "#9CA3AF", bg: "#9CA3AF18" };
}

function getReservationStatusInfo(status: string) {
  const s = status?.toLowerCase() || "";
  if (s === "pending" || s === "en_attente") return { label: "En attente", color: "#9CA3AF", bg: "#9CA3AF20" };
  if (s === "confirmed" || s === "confirmée" || s === "confirmé") return { label: "Confirmé", color: "#60A5FA", bg: "#60A5FA20" };
  if (s === "completed" || s === "terminée" || s === "terminé") return { label: "Terminé", color: "#4ADE80", bg: "#4ADE8020" };
  if (s === "cancelled" || s === "annulée" || s === "annulé") return { label: "Annulé", color: "#F87171", bg: "#F8717120" };
  return { label: status || "Inconnu", color: "#9CA3AF", bg: "#9CA3AF18" };
}

function getTypeBadge(type: "quote" | "invoice" | "reservation") {
  if (type === "quote") return { label: "Devis", color: "#C084FC", bg: "#C084FC20", icon: "document-text-outline" as const };
  if (type === "invoice") return { label: "Facture", color: "#22D3EE", bg: "#22D3EE20", icon: "receipt-outline" as const };
  return { label: "Réservation", color: "#FCD34D", bg: "#FCD34D20", icon: "calendar-outline" as const };
}

const FILTERS: { id: FilterType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "all", label: "Tout", icon: "layers-outline" },
  { id: "quotes", label: "Devis", icon: "document-text-outline" },
  { id: "invoices", label: "Factures", icon: "receipt-outline" },
  { id: "reservations", label: "RDV", icon: "calendar-outline" },
];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: quotes = [], refetch: refetchQuotes, isLoading: loadingQuotes } = useQuery({
    queryKey: ["quotes"],
    queryFn: quotesApi.getAll,
  });

  const { data: invoices = [], refetch: refetchInvoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: invoicesApi.getAll,
  });

  const { data: reservations = [], refetch: refetchReservations, isLoading: loadingReservations } = useQuery({
    queryKey: ["reservations"],
    queryFn: reservationsApi.getAll,
  });

  const isLoading = loadingQuotes || loadingInvoices || loadingReservations;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchQuotes(), refetchInvoices(), refetchReservations()]);
    setRefreshing(false);
  }, [refetchQuotes, refetchInvoices, refetchReservations]);

  const allItems: HistoryItem[] = useMemo(() => [
    ...(Array.isArray(quotes) ? quotes : []).map((q: any) => ({
      id: q.id,
      type: "quote" as const,
      reference: q.quoteNumber || q.reference || q.id,
      date: q.createdAt || q.date || "",
      status: q.status || "",
      amount: parseFloat(q.totalTTC || q.total_ttc || q.totalHT || q.total_ht || "0") || undefined,
      raw: q,
    })),
    ...(Array.isArray(invoices) ? invoices : []).map((inv: any) => ({
      id: inv.id,
      type: "invoice" as const,
      reference: inv.invoiceNumber || inv.reference || inv.id,
      date: inv.createdAt || inv.date || "",
      status: inv.status || "",
      amount: parseFloat(inv.totalTTC || inv.total_ttc || inv.totalHT || inv.total_ht || "0") || undefined,
      raw: inv,
    })),
    ...(Array.isArray(reservations) ? reservations : []).map((r: any) => ({
      id: r.id,
      type: "reservation" as const,
      reference: r.reservationNumber || r.reference || r.id,
      date: r.createdAt || r.scheduledDate || r.date || "",
      status: r.status || "",
      raw: r,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [quotes, invoices, reservations]);

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      const matchType = filter === "all"
        || (filter === "quotes" && item.type === "quote")
        || (filter === "invoices" && item.type === "invoice")
        || (filter === "reservations" && item.type === "reservation");
      if (!matchType) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return item.reference.toLowerCase().includes(q)
        || item.status.toLowerCase().includes(q)
        || (item.raw?.clientName || item.raw?.client?.name || "").toLowerCase().includes(q);
    });
  }, [allItems, filter, search]);

  const handlePress = (item: HistoryItem) => {
    if (item.type === "quote") router.push({ pathname: "/(main)/quote-detail", params: { id: item.id } });
    else if (item.type === "invoice") router.push({ pathname: "/(main)/invoice-detail", params: { id: item.id } });
    else router.push({ pathname: "/(main)/reservation-detail", params: { id: item.id } });
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const typeBadge = getTypeBadge(item.type);
    const statusInfo = item.type === "quote"
      ? getQuoteStatusInfo(item.status)
      : item.type === "invoice"
      ? getInvoiceStatusInfo(item.status)
      : getReservationStatusInfo(item.status);

    const formattedDate = item.date
      ? new Date(item.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
      : "—";

    const shortRef = item.reference?.length > 18
      ? `${item.reference.substring(0, 15)}…`
      : item.reference;

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => handlePress(item)}
      >
        <View style={[styles.typeIconWrapper, { backgroundColor: typeBadge.bg }]}>
          <Ionicons name={typeBadge.icon} size={20} color={typeBadge.color} />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <View style={[styles.typeBadge, { backgroundColor: typeBadge.bg }]}>
              <Text style={[styles.typeBadgeText, { color: typeBadge.color }]}>{typeBadge.label}</Text>
            </View>
            <Text style={styles.cardDate}>{formattedDate}</Text>
          </View>

          <Text style={styles.cardRef} numberOfLines={1}>{shortRef}</Text>

          <View style={styles.cardBottomRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
            {item.amount !== undefined && item.amount > 0 && (
              <Text style={styles.cardAmount}>{item.amount.toFixed(2)} €</Text>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
      </Pressable>
    );
  };

  const counts = {
    all: allItems.length,
    quotes: allItems.filter(i => i.type === "quote").length,
    invoices: allItems.filter(i => i.type === "invoice").length,
    reservations: allItems.filter(i => i.type === "reservation").length,
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mes demandes</Text>
          <Text style={styles.headerSub}>{allItems.length} document{allItems.length !== 1 ? "s" : ""} au total</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={theme.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par référence, statut…"
          placeholderTextColor={theme.textTertiary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(f => {
          const count = counts[f.id];
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f.id)}
            >
              <Ionicons name={f.icon} size={13} color={active ? "#fff" : theme.textSecondary} />
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {f.label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => `${item.type}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 40 : insets.bottom + 40 },
            filtered.length === 0 && styles.listContentEmpty,
          ]}
          scrollEnabled={filtered.length > 0}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={52} color={theme.textTertiary} />
              <Text style={styles.emptyTitle}>
                {search ? "Aucun résultat" : "Aucune activité"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search ? `Aucun document ne correspond à "${search}"` : "Votre historique apparaîtra ici"}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: theme.background,
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Exo2_700Bold", color: theme.text },
  headerSub: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary, marginTop: 1 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Exo2_400Regular",
    color: theme.text,
    padding: 0,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: "Exo2_500Medium",
    color: theme.textSecondary,
  },
  filterChipTextActive: { color: "#fff" },
  filterCount: {
    backgroundColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
  },
  filterCountActive: { backgroundColor: "#ffffff30" },
  filterCountText: { fontSize: 10, fontFamily: "Exo2_600SemiBold", color: theme.textSecondary },
  filterCountTextActive: { color: "#fff" },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  listContentEmpty: { flex: 1, justifyContent: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
  },
  cardPressed: { opacity: 0.75 },
  typeIconWrapper: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
    flexShrink: 0,
  },
  cardContent: { flex: 1, gap: 5 },
  cardTopRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontFamily: "Exo2_600SemiBold" },
  cardDate: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  cardRef: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
  cardBottomRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: "Exo2_500Medium" },
  cardAmount: { fontSize: 13, fontFamily: "Exo2_600SemiBold", color: theme.text },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", gap: 10, paddingVertical: 60 },
  emptyTitle: { fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.textSecondary },
  emptySubtitle: {
    fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textTertiary,
    textAlign: "center", paddingHorizontal: 40,
  },
});
