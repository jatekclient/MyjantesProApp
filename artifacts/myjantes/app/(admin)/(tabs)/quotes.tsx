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
import { adminQuotes, adminClients } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { StatusDropdown } from "@/components/StatusDropdown";
import { FloatingSupport } from "@/components/FloatingSupport";

function buildClientMap(clients: any[]): Record<string, any> {
  const map: Record<string, any> = {};
  for (const c of (Array.isArray(clients) ? clients : [])) {
    if (c?.id) map[String(c.id)] = c;
  }
  return map;
}

function resolveClient(item: any, clientMap: Record<string, any>): { name: string; email: string; phone: string } {
  const c = item.client || (item.clientId && clientMap[String(item.clientId)]) || null;

  let name = "";
  if (c?.firstName || c?.lastName) name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
  else if (c?.name) name = c.name;
  else if (item.clientFirstName || item.clientLastName) name = `${item.clientFirstName || ""} ${item.clientLastName || ""}`.trim();
  else if (item.clientName) name = item.clientName;
  else if (item.client_first_name || item.client_last_name) name = `${item.client_first_name || ""} ${item.client_last_name || ""}`.trim();
  else if (item.firstName || item.lastName) name = `${item.firstName || ""} ${item.lastName || ""}`.trim();

  const email = c?.email || item.clientEmail || item.client_email || "";
  const phone = c?.phone || c?.phoneNumber || item.clientPhone || item.client_phone || "";

  return { name, email, phone };
}

const STATUSES = ["all", "pro", "mobile", "pending", "approved", "rejected", "converted"] as const;
const STATUS_LABELS: Record<string, string> = {
  all: "Tous", pro: "Clients Pro", mobile: "App Mobile",
  pending: "En attente", approved: "Approuvé", rejected: "Rejeté",
  converted: "Converti", accepted: "Accepté", sent: "Envoyé", cancelled: "Annulé",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", approved: "#22C55E", rejected: "#EF4444",
  converted: "#3B82F6", accepted: "#22C55E", sent: "#8B5CF6", cancelled: "#6B7280",
};

export default function AdminQuotesScreen() {
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

  const { data: quotes = [], isLoading: quotesLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-quotes"],
    queryFn: adminQuotes.getAll,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: adminClients.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const clientMap = useMemo(() => buildClientMap(clients as any[]), [clients]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminQuotes.updateStatus(id, status),
    onSuccess: (_, vars) => {
      queryClient.setQueryData<any[]>(["admin-quotes"], (old = []) =>
        old.map(q => q.id === vars.id ? { ...q, status: vars.status } : q)
      );
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const cancelQuote = (id: string, name: string) => {
    showAlert({
      type: "warning",
      title: "Annuler ce devis ?",
      message: `Le devis de ${name || "ce client"} sera marqué comme annulé.`,
      buttons: [
        { text: "Non" },
        { text: "Annuler le devis", style: "primary", onPress: () => statusMutation.mutate({ id, status: "cancelled" }) },
      ],
    });
  };

  const arr = Array.isArray(quotes) ? quotes : [];
  const filtered = arr.filter((q: any) => {
    if (loggedRole === "admin" && loggedGarageId && q.garageId && q.garageId !== loggedGarageId) return false;
    if (filter === "pro") {
      const client = clientMap.get(q.clientId || q.userId || q.client?.id);
      const isPro = client?.role === "client_professionnel" || (q.channel === "application_mobile") || (q.source === "application_mobile");
      if (!isPro) return false;
    } else if (filter === "mobile") {
      if (q.channel !== "application_mobile" && q.source !== "application_mobile") return false;
    } else if (filter !== "all" && q.status?.toLowerCase() !== filter) {
      return false;
    }
    if (search) {
      const s = search.toLowerCase();
      const { name, email } = resolveClient(q, clientMap);
      const ref = (q.quoteNumber || q.reference || "").toLowerCase();
      return name.toLowerCase().includes(s) || email.toLowerCase().includes(s) || ref.includes(s);
    }
    return true;
  });

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;

  const renderItem = useCallback(({ item }: { item: any }) => {
    const statusKey = (item.status || "").toLowerCase();
    const color = STATUS_COLORS[statusKey] || theme.textTertiary;
    const { name, email, phone } = resolveClient(item, clientMap);
    const ref = item.quoteNumber || item.reference || "";
    const lineItems: any[] = item.items || item.lineItems || item.lines || [];
    const serviceSummary = lineItems.length > 0
      ? lineItems.slice(0, 2).map((it: any) => it.description || it.name || "").filter(Boolean).join(" · ")
      : "";
    const directAmount = item.quoteAmount ?? item.amount ?? item.totalTTC ?? item.total ?? item.total_including_tax ?? item.totalAmount ?? item.pricingTotals?.totalTTC ?? null;
    const computedFromItems = lineItems.length > 0
      ? lineItems.reduce((sum: number, it: any) => {
          const price = parseFloat(String(
            it.unit_price ??
            it.unit_price_excluding_tax ??
            it.unitPrice ?? 
            it.price ?? 
            it.unitPriceExcludingTax ?? 
            it.priceExcludingTax ?? 
            it.basePrice ?? 
            it.hourlyRate ?? 
            0
          )) || 0;
          const qty = parseFloat(String(it.quantity ?? 1)) || 1;
          const tax = parseFloat(String(it.tax_rate ?? it.taxRate ?? it.tvaRate ?? it.taxAmount ?? 0)) || 0;
          
          let lineTotal = it.total_including_tax ?? it.totalIncludingTax ?? it.totalPrice ?? it.total ?? null;
          if (!lineTotal) {
            lineTotal = qty * price * (1 + tax / 100);
          }
          
          return sum + (parseFloat(String(lineTotal)) || 0);
        }, 0)
      : null;
    const totalTTC = directAmount ? parseFloat(String(directAmount)) : (computedFromItems && computedFromItems > 0 ? computedFromItems : null);

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push({ pathname: "/(admin)/quote-detail", params: { id: item.id } } as any)}
      >
        <View style={[styles.cardAccent, { backgroundColor: color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {name || "Client inconnu"}
              </Text>
              {ref ? (
                <Text style={styles.cardRef}>{ref}</Text>
              ) : null}
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

          {serviceSummary ? (
            <Text style={styles.cardServices} numberOfLines={1}>
              <Ionicons name="construct-outline" size={11} color={theme.textTertiary} /> {serviceSummary}
            </Text>
          ) : null}

          {(item.channel === "application_mobile" || item.source === "application_mobile") ? (
            <View style={styles.channelBadge}>
              <Ionicons name="phone-portrait-outline" size={11} color="#3B82F6" />
              <Text style={styles.channelBadgeText}>Application mobile</Text>
            </View>
          ) : null}

          <View style={styles.cardBottom}>
            <Text style={styles.cardAmount}>
              {totalTTC != null
                ? parseFloat(String(totalTTC)).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
                : "—"}
            </Text>
            <Text style={styles.cardDate}>
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString("fr-FR") : ""}
            </Text>
          </View>

          {isAdmin ? (
            <View style={styles.cardActions}>
              {statusKey === "pending" && (
                <>
                  <ActionBtn
                    icon="checkmark" color="#22C55E"
                    label="Approuver"
                    onPress={() => statusMutation.mutate({ id: item.id, status: "approved" })}
                  />
                  <ActionBtn
                    icon="close" color="#EF4444"
                    label="Rejeter"
                    onPress={() => statusMutation.mutate({ id: item.id, status: "rejected" })}
                  />
                </>
              )}
              {(statusKey === "approved" || statusKey === "accepted") && (
                <ActionBtn
                  icon="arrow-undo" color="#F59E0B"
                  label="En attente"
                  onPress={() => statusMutation.mutate({ id: item.id, status: "pending" })}
                />
              )}
              {statusKey === "rejected" && (
                <ActionBtn
                  icon="refresh" color="#F59E0B"
                  label="Remettre en attente"
                  onPress={() => statusMutation.mutate({ id: item.id, status: "pending" })}
                />
              )}
              {statusKey !== "cancelled" && statusKey !== "converted" && (
                <ActionBtn
                  icon="ban-outline" color="#6B7280"
                  label="Annuler"
                  onPress={() => cancelQuote(item.id, name)}
                />
              )}
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }, [theme, isAdmin, clientMap, statusMutation]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Image source={require("@/assets/images/logo_new.png")} style={styles.headerLogo} contentFit="contain" />
        <Text style={styles.screenTitle}>Devis</Text>
        {isAdmin ? (
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push("/(admin)/quote-create" as any)}
            accessibilityLabel="Nouveau devis"
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
            placeholder="Nom, email, référence..."
            placeholderTextColor={theme.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
            </Pressable>
          ) : null}
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

      {quotesLoading ? (
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
              <Ionicons name="document-text-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Aucun devis trouvé</Text>
            </View>
          }
        />
      )}
      {AlertComponent}
      <FloatingSupport />
    </View>
  );
}

function ActionBtn({ icon, color, label, onPress }: { icon: any; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      style={[{ width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", backgroundColor: color + "20" }]}
      onPress={onPress}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={color} />
    </Pressable>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  headerLogo: { width: 34, height: 34, borderRadius: 8 },
  screenTitle: { flex: 1, fontSize: 22, fontFamily: "Exo2_800ExtraBold", color: theme.text, letterSpacing: 0.5 },
  addBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: theme.primary + "15" },
  searchRow: { paddingHorizontal: 16, marginBottom: 12 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12, flexDirection: "row" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { flexDirection: "row", backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 10, overflow: "hidden" },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardLeft: { flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  cardRef: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.primary, marginTop: 2 },
  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  contactItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  contactText: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  cardServices: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
 channelBadge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4, marginTop: 4, alignSelf: "flex-start" as const, backgroundColor: "#3B82F615", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
 channelBadgeText: { fontSize: 11, fontFamily: "Exo2_500Medium", color: "#3B82F6" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Exo2_600SemiBold" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardAmount: { fontSize: 16, fontFamily: "Exo2_700Bold", color: theme.text },
  cardDate: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  cardActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end", borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 8, marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
});
