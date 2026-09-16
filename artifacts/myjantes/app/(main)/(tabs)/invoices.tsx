import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  RefreshControl, Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { invoicesApi, Invoice } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { FloatingSupport } from "@/components/FloatingSupport";

function getInvoiceStatusInfo(status: string, isDark: boolean) {
  const s = status?.toLowerCase() || "";
  if (s === "paid" || s === "payée" || s === "payé")
    return { label: "Payée", color: "#22C55E", bg: isDark ? "rgba(34,197,94,0.15)" : "#DCFCE7", icon: "checkmark-circle-outline" as const };
  if (s === "pending" || s === "en_attente")
    return { label: "En attente", color: "#F59E0B", bg: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7", icon: "time-outline" as const };
  if (s === "overdue" || s === "en_retard")
    return { label: "En retard", color: "#EF4444", bg: isDark ? "rgba(239,68,68,0.15)" : "#FEE2E2", icon: "alert-circle-outline" as const };
  if (s === "cancelled" || s === "annulée")
    return { label: "Annulée", color: "#888", bg: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", icon: "close-circle-outline" as const };
  if (s === "draft" || s === "brouillon")
    return { label: "Brouillon", color: "#888", bg: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", icon: "create-outline" as const };
  if (s === "sent" || s === "envoyée")
    return { label: "Envoyée", color: "#3B82F6", bg: isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE", icon: "send-outline" as const };
  return { label: status || "Inconnu", color: "#888", bg: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", icon: "help-outline" as const };
}

function InvoiceCard({ invoice, theme, styles }: { invoice: Invoice; theme: ThemeColors; styles: any }) {
  const statusInfo = getInvoiceStatusInfo(invoice.status, theme.isDark);
  const formattedDate = new Date(invoice.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });
  const inv = invoice as any;
  const totalTTC = invoice.totalTTC || inv.total_ttc || inv.totalIncludingTax || inv.total_including_tax || inv.totalAmountIncludingTax || inv.totalWithTax || inv.montantTTC || inv.montant_ttc || inv.amount || inv.totalAmount || inv.total_amount || inv.total || "0";

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: "/(main)/invoice-detail", params: { id: invoice.id } })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.idRow}>
          <Ionicons name="receipt-outline" size={16} color={theme.primary} />
          <Text style={styles.idText}>{invoice.invoiceNumber || invoice.id}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
          <Ionicons name={statusInfo.icon} size={13} color={statusInfo.color} />
          <Text style={[styles.badgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.textTertiary} />
          <Text style={styles.detailText}>{formattedDate}</Text>
        </View>
        {invoice.dueDate && (
          <View style={styles.detailRow}>
            <Ionicons name="hourglass-outline" size={14} color={theme.textTertiary} />
            <Text style={styles.detailText}>
              Échéance : {new Date(invoice.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
        )}
        {invoice.notes && (
          <View style={styles.detailRow}>
            <Ionicons name="chatbubble-outline" size={14} color={theme.textTertiary} />
            <Text style={styles.detailText} numberOfLines={1}>{invoice.notes}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.amountLabel}>Montant TTC</Text>
          <Text style={styles.amountValue}>{parseFloat(totalTTC).toFixed(2)} €</Text>
        </View>
        <View style={styles.viewRow}>
          <Text style={styles.viewLink}>Voir détails</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.primary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);

  const { data: invoicesRaw, isLoading, isError, refetch } = useQuery({
    queryKey: ["invoices"],
    queryFn: invoicesApi.getAll,
    retry: 1,
    refetchInterval: 60000,
  });

  const invoices = (Array.isArray(invoicesRaw) ? invoicesRaw : []).filter((i) => i && (i.id || (i as any)._id));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Mes Factures</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={[...invoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <InvoiceCard invoice={item} theme={theme} styles={styles} />}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          ListEmptyComponent={
            isError ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={48} color={theme.textTertiary} />
                <Text style={styles.emptyTitle}>Connexion impossible</Text>
                <Text style={styles.emptyText}>Impossible de charger vos factures. Vérifiez votre connexion puis réessayez.</Text>
                <Pressable style={styles.emptyRetry} onPress={() => refetch()}>
                  <Text style={styles.emptyRetryText}>Réessayer</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={48} color={theme.textTertiary} />
                <Text style={styles.emptyTitle}>Aucune facture</Text>
                <Text style={styles.emptyText}>Vos factures apparaîtront ici une fois vos devis acceptés et traités.</Text>
              </View>
            )
          }
        />
      )}
      <FloatingSupport />
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
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
  idRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  idText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontFamily: "Exo2_600SemiBold" },
  cardBody: { gap: 5 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  detailText: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  cardFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.borderLight,
  },
  amountLabel: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textSecondary },
  amountValue: { fontSize: 18, fontFamily: "Exo2_700Bold", color: theme.primary },
  viewRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewLink: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.primary },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyRetry: { backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 12 },
  emptyRetryText: { color: "#fff", fontSize: 14, fontFamily: "Exo2_600SemiBold" },
  emptyTitle: { fontSize: 18, fontFamily: "Exo2_600SemiBold", color: theme.text, marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary, textAlign: "center", paddingHorizontal: 40 },
});
