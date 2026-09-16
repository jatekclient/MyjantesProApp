import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ScrollView, Pressable, Platform, RefreshControl, TextInput, ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminInvoices, adminClients } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
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

const STATUSES = ["all", "pending", "paid", "cancelled"] as const;
const STATUS_LABELS: Record<string, string> = { all: "Tous", pending: "En attente", paid: "Payée", cancelled: "Annulée", overdue: "En retard" };
const STATUS_COLORS: Record<string, string> = { pending: "#F59E0B", paid: "#22C55E", cancelled: "#EF4444", overdue: "#EF4444" };

export default function AdminInvoicesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { isAdmin, user } = useAuth();
  const loggedRole = (user?.role || "").toLowerCase();
  const loggedGarageId = (user as any)?.garageId || null;
  const { showAlert, AlertComponent } = useCustomAlert();
  const queryClient = useQueryClient();
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

  const { data: invoices = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: adminInvoices.getAll,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: adminClients.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const clientMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const c of (Array.isArray(clients) ? clients : [])) {
      if (c?.id) map[String(c.id)] = c;
    }
    return map;
  }, [clients]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminInvoices.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => adminInvoices.updateStatus(id, "paid"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const confirmDelete = (id: string, label: string) => {
    showAlert({
      type: "warning",
      title: "Supprimer cette facture ?",
      message: `La facture ${label} sera supprimée définitivement.`,
      buttons: [
        { text: "Annuler" },
        { text: "Supprimer", style: "primary", onPress: () => deleteMutation.mutate(id) },
      ],
    });
  };

  const arr = Array.isArray(invoices) ? invoices : [];
  const filtered = arr.filter((inv: any) => {
    if (loggedRole === "admin" && loggedGarageId && inv.garageId && inv.garageId !== loggedGarageId) return false;
    if (filter !== "all" && inv.status?.toLowerCase() !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      const { name } = resolveClient(inv, clientMap);
      return name.toLowerCase().includes(s) || (inv.invoiceNumber || "").toLowerCase().includes(s) || (inv.clientEmail || "").toLowerCase().includes(s);
    }
    return true;
  });

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;

  const renderItem = useCallback(({ item }: { item: any }) => {
    const statusKey = (item.status || "").toLowerCase();
    const color = STATUS_COLORS[statusKey] || theme.textTertiary;
    const { name, email, phone } = resolveClient(item, clientMap);
    const totalTTC = item.amount ?? item.totalTTC ?? item.total ?? item.total_including_tax ?? item.totalAmount ?? null;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push({ pathname: "/(admin)/invoice-detail", params: { id: item.id } } as any)}
      >
        <View style={[styles.cardAccent, { backgroundColor: color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardTitle} numberOfLines={1}>{name || "Client inconnu"}</Text>
              {item.invoiceNumber || item.reference ? <Text style={styles.cardRef}>{item.invoiceNumber || item.reference}</Text> : null}
            </View>
            <View style={[styles.badge, { backgroundColor: color + "20" }]}>
              <Text style={[styles.badgeText, { color }]}>{STATUS_LABELS[statusKey] || item.status}</Text>
            </View>
          </View>
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
          <View style={styles.cardBottom}>
            <Text style={styles.cardAmount}>
              {totalTTC != null ? parseFloat(String(totalTTC)).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : "—"}
            </Text>
            <Text style={styles.cardDate}>
              {item.dueDate ? `Échéance: ${new Date(item.dueDate).toLocaleDateString("fr-FR")}` : item.createdAt ? new Date(item.createdAt).toLocaleDateString("fr-FR") : ""}
            </Text>
          </View>
          {isAdmin && (statusKey === "pending" || statusKey === "overdue") && (
            <View style={styles.cardActions}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: "#22C55E20" }]}
                onPress={() => {
                  showAlert({
                    type: "warning",
                    title: "Marquer comme payée ?",
                    message: `Confirmer le paiement de la facture ${item.invoiceNumber || item.reference || ""}?`,
                    buttons: [
                      { text: "Annuler" },
                      { text: "Confirmer", style: "primary", onPress: () => markPaidMutation.mutate(String(item.id)) },
                    ],
                  });
                }}
                accessibilityLabel="Marquer payée"
              >
                <Ionicons name="checkmark" size={16} color="#22C55E" />
              </Pressable>
            </View>
          )}
        </View>
      </Pressable>
    );
  }, [theme, isAdmin, clientMap]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Image
          source={require("@/assets/images/logo_new.png")}
          style={styles.headerLogo}
          contentFit="contain"
        />
        <Text style={styles.screenTitle}>Factures</Text>
        {isAdmin ? (
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push("/(admin)/invoice-create" as any)}
            accessibilityLabel="Nouvelle facture"
          >
            <Ionicons name="add" size={22} color={theme.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

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
            returnKeyType="search"
          />
        </View>
      </View>

      <StatusDropdown
        label="Filtre"
        selected={filter}
        onSelect={setFilter}
        options={STATUSES.map(s => ({
          key: s,
          label: STATUS_LABELS[s],
          color: STATUS_COLORS[s]
        }))}
      />

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Aucune facture trouvée</Text>
            </View>
          }
        />
      )}
      {AlertComponent}
      <FloatingSupport />
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  headerLogo: { width: 34, height: 34, borderRadius: 8 },
  screenTitle: { flex: 1, fontSize: 22, fontFamily: "Exo2_800ExtraBold", color: theme.text, letterSpacing: 0.5 },
  addBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: theme.primary + "15" },
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
  searchRow: { paddingHorizontal: 16, marginBottom: 12 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12, flexDirection: "row" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { flexDirection: "row", backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 10, overflow: "hidden" },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardLeft: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  cardRef: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.primary, marginTop: 2 },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  contactItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  contactText: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Exo2_600SemiBold" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardAmount: { fontSize: 16, fontFamily: "Exo2_700Bold", color: theme.text },
  cardDate: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  cardActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  actionBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
});
