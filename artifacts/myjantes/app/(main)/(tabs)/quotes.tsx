import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  RefreshControl, Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { quotesApi, Quote } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { FloatingSupport } from "@/components/FloatingSupport";



function getStatusInfo(status: string, isDark: boolean) {
  const s = status?.toLowerCase() || "";
  if (s === "pending" || s === "en_attente")
    return { label: "En attente", color: "#F59E0B", bg: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7", icon: "time-outline" as const };
  if (s === "sent" || s === "envoyé")
    return { label: "Envoyé", color: "#3B82F6", bg: isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE", icon: "send-outline" as const };
  if (s === "approved" || s === "approuvé")
    return { label: "Approuvé", color: "#8B5CF6", bg: isDark ? "rgba(139,92,246,0.15)" : "#EDE9FE", icon: "eye-outline" as const };
  if (s === "accepted" || s === "accepté")
    return { label: "Accepté", color: "#22C55E", bg: isDark ? "rgba(34,197,94,0.15)" : "#DCFCE7", icon: "checkmark-circle-outline" as const };
  if (s === "confirmed" || s === "confirmé")
    return { label: "Confirmé", color: "#22C55E", bg: isDark ? "rgba(34,197,94,0.15)" : "#DCFCE7", icon: "checkmark-circle-outline" as const };
  if (s === "rejected" || s === "refusé" || s === "refused")
    return { label: "Refusé", color: "#EF4444", bg: isDark ? "rgba(239,68,68,0.15)" : "#FEE2E2", icon: "close-circle-outline" as const };
  if (s === "completed" || s === "terminé")
    return { label: "Terminé", color: "#22C55E", bg: isDark ? "rgba(34,197,94,0.15)" : "#DCFCE7", icon: "checkmark-done-outline" as const };
  if (s === "in_progress" || s === "en_cours")
    return { label: "En cours", color: "#3B82F6", bg: isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE", icon: "hourglass-outline" as const };
  return { label: status || "Inconnu", color: "#888", bg: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", icon: "help-outline" as const };
}

function QuoteCard({ quote, theme, styles }: { quote: Quote; theme: ThemeColors; styles: any }) {
  const statusInfo = getStatusInfo(quote.status, theme.isDark);
  const formattedDate = new Date(quote.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: "/(main)/quote-detail", params: { id: quote.id } })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.idRow}>
          <Ionicons name="document-text" size={16} color={theme.primary} />
          <Text style={styles.idText}>{(quote as any).reference || quote.quoteNumber || quote.id}</Text>
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
        {quote.totalAmount && parseFloat(quote.totalAmount) > 0 && (
          <View style={styles.detailRow}>
            <Ionicons name="pricetag-outline" size={14} color={theme.textTertiary} />
            <Text style={styles.detailText}>{parseFloat(quote.totalAmount).toFixed(2)} €</Text>
          </View>
        )}
        {quote.notes && (
          <View style={styles.detailRow}>
            <Ionicons name="chatbubble-outline" size={14} color={theme.textTertiary} />
            <Text style={styles.detailText} numberOfLines={1}>{quote.notes}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.viewLink}>Voir détail</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.primary} />
      </View>
    </Pressable>
  );
}

export default function QuotesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);

  const { data: quotesRaw, isLoading, isError, refetch } = useQuery({
    queryKey: ["quotes"],
    queryFn: quotesApi.getAll,
    refetchInterval: 30000,
  });

  const quotes = (Array.isArray(quotesRaw) ? quotesRaw : []).filter((q) => q && (q.id || (q as any)._id));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Mes Devis</Text>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
          onPress={() => router.push("/(main)/new-quote")}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={[...quotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <QuoteCard quote={item} theme={theme} styles={styles} />}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          ListEmptyComponent={
            isError ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={48} color={theme.textTertiary} />
                <Text style={styles.emptyTitle}>Connexion impossible</Text>
                <Text style={styles.emptyText}>Impossible de charger vos devis. Vérifiez votre connexion puis réessayez.</Text>
                <Pressable style={styles.emptyCta} onPress={() => refetch()}>
                  <Text style={styles.emptyCtaText}>Réessayer</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="document-text-outline" size={48} color={theme.textTertiary} />
                <Text style={styles.emptyTitle}>Aucun devis</Text>
                <Text style={styles.emptyText}>Vous n'avez pas encore de demande de devis.</Text>
                <Pressable style={styles.emptyCta} onPress={() => router.push("/(main)/new-quote")}>
                  <Text style={styles.emptyCtaText}>Demander un devis</Text>
                </Pressable>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Exo2_800ExtraBold",
    color: theme.text,
    letterSpacing: 1,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.primary,
    justifyContent: "center",
    alignItems: "center",
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
  detailText: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, flex: 1 },
  cardFooter: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.borderLight,
    justifyContent: "flex-end",
  },
  viewLink: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.primary },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Exo2_600SemiBold", color: theme.text, marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  emptyCta: { backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 12 },
  emptyCtaText: { color: "#fff", fontSize: 14, fontFamily: "Exo2_600SemiBold" },
});
