import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, RefreshControl, TextInput, ActivityIndicator, ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminReservations, adminClients, adminQuotes } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { syncReservationsToCalendar } from "@/lib/calendar";
import { StatusDropdown } from "@/components/StatusDropdown";
import { FloatingSupport } from "@/components/FloatingSupport";

function resolveClient(item: any, clientMap: Record<string, any>): { name: string; email: string; phone: string } {
  const c = item.client || (item.clientId && clientMap[String(item.clientId)]) || null;
  let name = "";
  if (c?.firstName || c?.lastName) name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
  else if (c?.name) name = c.name;
  else if (item.clientFirstName || item.clientLastName) name = `${item.clientFirstName || ""} ${item.clientLastName || ""}`.trim();
  else if (item.clientName) name = item.clientName;
  const email = c?.email || item.clientEmail || "";
  const phone = c?.phone || c?.phoneNumber || item.clientPhone || "";
  return { name, email, phone };
}

function resolveQuoteRef(item: any, quoteMap: Record<string, any>): string | null {
  const qid = item.quoteId;
  if (!qid) return item.quoteReference || null;
  const quote = quoteMap[String(qid)];
  if (quote) return quote.quoteNumber || quote.reference || null;
  return item.quoteReference || null;
}

const STATUS_LABELS: Record<string, string> = {
  all: "Tous", pending: "En attente", confirmed: "Confirmé",
  cancelled: "Annulé", completed: "Terminé",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#22C55E", cancelled: "#EF4444", completed: "#3B82F6",
};

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAYS_FR = ["L", "M", "M", "J", "V", "S", "D"];

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Array<{ day: number | null; dateKey: string | null }> = [];
  for (let i = 0; i < offset; i++) days.push({ day: null, dateKey: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ day: d, dateKey });
  }
  return days;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminReservationsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { isAdmin, user } = useAuth();
  const loggedRole = (user?.role || "").toLowerCase();
  const loggedGarageId = (user as any)?.garageId || null;
  const { showAlert, AlertComponent } = useCustomAlert();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<"agenda" | "list">("list");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const params = useLocalSearchParams();
  const lastAppliedFilter = useRef<string | null>(null);
  useEffect(() => {
    if (params.filter && typeof params.filter === "string" && params.filter !== lastAppliedFilter.current) {
      setFilter(params.filter);
      lastAppliedFilter.current = params.filter;
    }
  }, [params.filter]);

  const { data: reservations = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-reservations"],
    queryFn: adminReservations.getAll,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: adminClients.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["admin-quotes"],
    queryFn: adminQuotes.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const clientMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const c of (Array.isArray(clients) ? clients : [])) {
      if (c?.id) map[String(c.id)] = c;
    }
    return map;
  }, [clients]);

  const quoteMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const q of (Array.isArray(quotes) ? quotes : [])) {
      if (q?.id) map[String(q.id)] = q;
    }
    return map;
  }, [quotes]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminReservations.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminReservations.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleCalendarSync = async () => {
    try {
      const result = await syncReservationsToCalendar(filteredList);
      if (result.success) {
        showAlert({
          type: "success",
          title: "Synchronisation réussie",
          message: result.message,
          buttons: [{ text: "OK", style: "primary" }],
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        showAlert({
          type: "error",
          title: "Erreur de synchronisation",
          message: result.message,
          buttons: [{ text: "OK", style: "primary" }],
        });
      }
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "Erreur",
        message: err.message || "Synchronisation échouée",
        buttons: [{ text: "OK", style: "primary" }],
      });
    }
  };

  const confirmDelete = (id: string, name: string) => {
    showAlert({
      type: "warning",
      title: "Supprimer ce rendez-vous ?",
      message: `Le rendez-vous de ${name} sera supprimé définitivement.`,
      buttons: [
        { text: "Annuler" },
        { text: "Supprimer", style: "primary", onPress: () => deleteMutation.mutate(id) },
      ],
    });
  };

  const arr = useMemo(() => Array.isArray(reservations) ? reservations : [], [reservations]);

  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    arr.forEach((r: any) => {
      if (r.scheduledDate) {
        const key = r.scheduledDate.split("T")[0];
        if (!map[key]) map[key] = [];
        map[key].push(r);
      }
    });
    return map;
  }, [arr]);

  const filteredList = useMemo(() => {
    return arr.filter((r: any) => {
      if (loggedRole === "admin" && loggedGarageId && r.garageId && r.garageId !== loggedGarageId) return false;
      if (filter !== "all" && r.status?.toLowerCase() !== filter) return false;
      if (search) {
        const s = search.toLowerCase();
        const { name } = resolveClient(r, clientMap);
        const vehicleBrand = r.vehicleInfo?.brand || r.vehicleMake || "";
        return name.toLowerCase().includes(s) || vehicleBrand.toLowerCase().includes(s) || (r.clientEmail || "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [arr, filter, search, loggedRole, loggedGarageId, clientMap]);

  const agendaItems = useMemo(() => {
    let items = byDate[selectedDate] || [];
    if (loggedRole === "admin" && loggedGarageId) {
      items = items.filter((r: any) => !r.garageId || r.garageId === loggedGarageId);
    }
    if (filter !== "all") {
      items = items.filter((r: any) => r.status?.toLowerCase() === filter);
    }
    return items;
  }, [byDate, selectedDate, loggedRole, loggedGarageId, filter]);

  const calYear = currentMonth.getFullYear();
  const calMonth = currentMonth.getMonth();
  const calDays = useMemo(() => buildCalendarDays(calYear, calMonth), [calYear, calMonth]);
  const today = todayKey();

  const prevMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;

  const renderReservationCard = useCallback(({ item }: { item: any }) => {
    const color = STATUS_COLORS[item.status?.toLowerCase()] || theme.textTertiary;
    const { name, email, phone } = resolveClient(item, clientMap);
    const clientName = name || "Client inconnu";
    const dateStr = item.scheduledDate
      ? new Date(item.scheduledDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "";
    const quoteRef = resolveQuoteRef(item, quoteMap);
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push({ pathname: "/(admin)/reservation-detail", params: { id: item.id } } as any)}
      >
        <View style={[styles.cardAccent, { backgroundColor: color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardTitle}>{clientName}</Text>
              {item.reference ? <Text style={styles.cardRef}>{item.reference}</Text> : null}
              {(email || phone) ? (
                <View style={styles.contactRow}>
                  {email ? (
                    <View style={styles.contactItem}>
                      <Ionicons name="mail-outline" size={12} color={theme.textTertiary} />
                      <Text style={styles.contactText} numberOfLines={1}>{email}</Text>
                    </View>
                  ) : null}
                  {phone ? (
                    <View style={styles.contactItem}>
                      <Ionicons name="call-outline" size={12} color={theme.textTertiary} />
                      <Text style={styles.contactText}>{phone}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.cardSub}>{dateStr}</Text>
              {quoteRef ? (
                <Text style={styles.cardService}>Devis: {quoteRef}</Text>
              ) : null}
              {item.serviceType ? (
                <Text style={styles.cardService}>{item.serviceType}</Text>
              ) : null}
              {(item.vehicleInfo?.brand || item.vehicleMake) ? (
                <Text style={styles.cardSub}>{item.vehicleInfo?.brand || item.vehicleMake} {item.vehicleInfo?.model || item.vehicleModel || ""}</Text>
              ) : null}
            </View>
            <View style={[styles.badge, { backgroundColor: color + "20" }]}>
              <Text style={[styles.badgeText, { color }]}>{STATUS_LABELS[item.status?.toLowerCase()] || item.status}</Text>
            </View>
          </View>
          {isAdmin && (
            <View style={styles.cardActions}>
              {item.status?.toLowerCase() === "pending" && (
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: "#22C55E20" }]}
                  onPress={() => statusMutation.mutate({ id: item.id, status: "confirmed" })}
                  accessibilityLabel="Confirmer"
                >
                  <Ionicons name="checkmark" size={16} color="#22C55E" />
                </Pressable>
              )}
              {item.status?.toLowerCase() === "confirmed" && (
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: "#3B82F620" }]}
                  onPress={() => statusMutation.mutate({ id: item.id, status: "completed" })}
                  accessibilityLabel="Terminer"
                >
                  <Ionicons name="checkmark-done" size={16} color="#3B82F6" />
                </Pressable>
              )}
              <Pressable
                style={[styles.actionBtn, { backgroundColor: "#EF444420" }]}
                onPress={() => confirmDelete(item.id, clientName)}
                accessibilityLabel="Supprimer"
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </Pressable>
            </View>
          )}
        </View>
      </Pressable>
    );
  }, [theme, isAdmin, clientMap, statusMutation, quoteMap]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Image source={require("@/assets/images/logo_new.png")} style={styles.headerLogo} contentFit="contain" />
        <Text style={styles.screenTitle}>Rendez-vous</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.modeToggle}>
        <Pressable
          style={[styles.modeBtn, viewMode === "agenda" && { backgroundColor: theme.primary }]}
          onPress={() => setViewMode("agenda")}
        >
          <Ionicons name="calendar" size={15} color={viewMode === "agenda" ? "#fff" : theme.textSecondary} />
          <Text style={[styles.modeBtnText, viewMode === "agenda" && { color: "#fff" }]}>Agenda</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, viewMode === "list" && { backgroundColor: theme.primary }]}
          onPress={() => setViewMode("list")}
        >
          <Ionicons name="list" size={15} color={viewMode === "list" ? "#fff" : theme.textSecondary} />
          <Text style={[styles.modeBtnText, viewMode === "list" && { color: "#fff" }]}>Liste</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : viewMode === "agenda" ? (
        <FlatList
          data={agendaItems}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={renderReservationCard}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
          ListHeaderComponent={
            <View>
              <View style={styles.calendarCard}>
                <View style={styles.calendarHeader}>
                  <Pressable onPress={prevMonth} style={styles.calNavBtn} accessibilityLabel="Mois précédent">
                    <Ionicons name="chevron-back" size={20} color={theme.text} />
                  </Pressable>
                  <Text style={styles.calMonthLabel}>{MONTHS_FR[calMonth]} {calYear}</Text>
                  <Pressable onPress={nextMonth} style={styles.calNavBtn} accessibilityLabel="Mois suivant">
                    <Ionicons name="chevron-forward" size={20} color={theme.text} />
                  </Pressable>
                </View>
                <View style={styles.calDayNames}>
                  {DAYS_FR.map((d, i) => (
                    <Text key={i} style={styles.calDayName}>{d}</Text>
                  ))}
                </View>
                <View style={styles.calGrid}>
                  {calDays.map((cell, idx) => {
                    if (!cell.dateKey) return <View key={idx} style={styles.calCell} />;
                    const isSelected = cell.dateKey === selectedDate;
                    const isToday = cell.dateKey === today;
                    const dayReservations = byDate[cell.dateKey] || [];
                    const dotColors = dayReservations
                      .slice(0, 3)
                      .map((r: any) => STATUS_COLORS[r.status?.toLowerCase()] || theme.primary);
                    return (
                      <Pressable
                        key={idx}
                        style={[styles.calCell, isSelected && { backgroundColor: theme.primary, borderRadius: 20 }]}
                        onPress={() => setSelectedDate(cell.dateKey!)}
                      >
                        <Text style={[
                          styles.calDayNum,
                          isToday && !isSelected && { color: theme.primary, fontFamily: "Exo2_700Bold" },
                          isSelected && { color: "#fff" },
                        ]}>
                          {cell.day}
                        </Text>
                        <View style={styles.calDots}>
                          {dotColors.map((c, di) => (
                            <View key={di} style={[styles.calDot, { backgroundColor: isSelected ? "#fff" : c }]} />
                          ))}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 12 }}>
                <StatusDropdown
                  label="Filtre"
                  selected={filter}
                  onSelect={setFilter}
                  options={["all", "pending", "confirmed", "completed", "cancelled"].map(s => ({
                    key: s,
                    label: STATUS_LABELS[s],
                    color: STATUS_COLORS[s]
                  }))}
                />
              </View>
            </View>
          }
          ListHeaderComponentStyle={{ marginBottom: 12 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color={theme.textTertiary} />
              <Text style={styles.emptyText}>
                Aucun rendez-vous le{" "}
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
              </Text>
            </View>
          }
        />
      ) : (
        <>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={theme.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher..."
                placeholderTextColor={theme.textTertiary}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
          <StatusDropdown
            label="Filtre"
            selected={filter}
            onSelect={setFilter}
            options={["all", "pending", "confirmed", "completed", "cancelled"].map(s => ({
              key: s,
              label: STATUS_LABELS[s],
              color: STATUS_COLORS[s]
            }))}
          />
          <FlatList
            data={filteredList}
            keyExtractor={(item: any) => String(item.id)}
            renderItem={renderReservationCard}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={48} color={theme.textTertiary} />
                <Text style={styles.emptyText}>Aucun rendez-vous trouvé</Text>
              </View>
            }
          />
        </>
      )}
      {AlertComponent}
      {isAdmin && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [
              styles.fab,
              { bottom: Platform.OS === "web" ? 34 + 130 : insets.bottom + 130 },
              pressed && styles.fabPressed,
            ]}
            onPress={() => router.push("/(admin)/reservation-create" as any)}
            accessibilityLabel="Nouveau rendez-vous"
          >
            <Ionicons name="add" size={26} color="#fff" />
          </Pressable>
        </View>
      )}
      <FloatingSupport />
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  headerLogo: { width: 34, height: 34, borderRadius: 8 },
  screenTitle: { flex: 1, fontSize: 22, fontFamily: "Exo2_800ExtraBold", color: theme.text, letterSpacing: 0.5 },
  fab: {
    position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.primary, justifyContent: "center", alignItems: "center",
    ...Platform.select({
      web: { boxShadow: "0px 6px 16px rgba(0,0,0,0.22)" } as any,
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 8 },
    }),
    zIndex: 100,
  },
  fabPressed: { backgroundColor: theme.primaryDark, transform: [{ scale: 0.93 }] },
  modeToggle: { flexDirection: "row", marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 3, gap: 3 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 10 },
  modeBtnText: { fontSize: 13, fontFamily: "Exo2_600SemiBold", color: theme.textSecondary },
  calendarCard: { backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 12, marginHorizontal: 16, marginTop: 4 },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  calNavBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center", borderRadius: 18, backgroundColor: theme.background },
  calMonthLabel: { fontSize: 16, fontFamily: "Exo2_700Bold", color: theme.text },
  calDayNames: { flexDirection: "row", marginBottom: 4 },
  calDayName: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, paddingVertical: 4 },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  calDayNum: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.text },
  calDots: { flexDirection: "row", gap: 2, marginTop: 2, height: 5 },
  calDot: { width: 4, height: 4, borderRadius: 2 },
  searchRow: { paddingHorizontal: 16, marginBottom: 10 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
  filterRow: { paddingHorizontal: 16, gap: 8, marginBottom: 10, flexDirection: "row" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { flexDirection: "row", backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 10, overflow: "hidden" },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 12, gap: 8 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardLeft: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  cardRef: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.primary, marginTop: 2 },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 },
  contactItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  contactText: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  cardSub: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  cardService: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.accent },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Exo2_600SemiBold" },
  cardActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  actionBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", paddingTop: 40, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textTertiary, textAlign: "center" },
});
