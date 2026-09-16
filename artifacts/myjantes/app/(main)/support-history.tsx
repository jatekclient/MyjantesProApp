import React, { useCallback, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  RefreshControl, Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { supportApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

const CATEGORY_ICONS: Record<string, any> = {
  "réservation": "calendar-outline",
  "devis": "document-text-outline",
  "facturation": "receipt-outline",
  "problème technique": "bug-outline",
  "question générale": "help-circle-outline",
  "autre": "chatbubble-outline",
};

function getStatusInfo(status: string, isDark: boolean) {
  const s = (status || "").toLowerCase();
  if (s === "resolved" || s === "résolu") return { label: "Résolu", color: "#22C55E", bg: isDark ? "rgba(34,197,94,0.15)" : "#DCFCE7", icon: "checkmark-circle-outline" as const };
  if (s === "open" || s === "ouvert" || s === "new" || s === "nouveau") return { label: "Ouvert", color: "#F59E0B", bg: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7", icon: "time-outline" as const };
  if (s === "in_progress" || s === "en_cours") return { label: "En traitement", color: "#3B82F6", bg: isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE", icon: "hourglass-outline" as const };
  if (s === "closed" || s === "fermé") return { label: "Fermé", color: "#888", bg: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", icon: "lock-closed-outline" as const };
  return { label: status || "Envoyé", color: "#DC2626", bg: isDark ? "rgba(220,38,38,0.15)" : "#FEE2E2", icon: "send-outline" as const };
}

function TicketCard({ ticket, theme, styles }: { ticket: any; theme: ThemeColors; styles: any }) {
  const status = getStatusInfo(ticket.status, theme.isDark);
  const category = (ticket.category || "").toLowerCase();
  const categoryIcon = CATEGORY_ICONS[category] || "chatbubble-outline";
  const createdDate = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.categoryRow}>
          <View style={styles.categoryIconBg}>
            <Ionicons name={categoryIcon} size={16} color={theme.primary} />
          </View>
          <Text style={styles.categoryText}>{ticket.category || "Support"}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon} size={13} color={status.color} />
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      {ticket.subject && <Text style={styles.subject} numberOfLines={2}>{ticket.subject}</Text>}
      {ticket.message && <Text style={styles.preview} numberOfLines={2}>{ticket.message}</Text>}
      {createdDate && (
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={13} color={theme.textTertiary} />
          <Text style={styles.dateText}>{createdDate}</Text>
        </View>
      )}
    </View>
  );
}

export default function SupportHistoryScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ["support-history"],
    queryFn: supportApi.getHistory,
    retry: 1,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Historique support</Text>
        <View style={styles.headerBtn} />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={Array.isArray(tickets) ? [...tickets].sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          }) : []}
          keyExtractor={(item, idx) => item.id || String(idx)}
          renderItem={({ item }) => <TicketCard ticket={item} theme={theme} styles={styles} />}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 34 + 40 : insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={56} color={theme.textTertiary} />
              <Text style={styles.emptyTitle}>Aucun ticket support</Text>
              <Text style={styles.emptyText}>Vos demandes de support apparaîtront ici. Utilisez le formulaire de contact pour envoyer un message à notre équipe.</Text>
              <Pressable style={styles.contactBtn} onPress={() => router.push("/support")}>
                <Ionicons name="send-outline" size={16} color="#fff" />
                <Text style={styles.contactBtnText}>Contacter le support</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.text },
  loader: { flex: 1, justifyContent: "center" },
  list: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  card: {
    backgroundColor: theme.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: theme.border, gap: 8,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  categoryIconBg: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.primary + "15",
    justifyContent: "center", alignItems: "center",
  },
  categoryText: { fontSize: 13, fontFamily: "Exo2_600SemiBold", color: theme.text },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontFamily: "Exo2_600SemiBold" },
  subject: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
  preview: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, lineHeight: 19 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Exo2_600SemiBold", color: theme.text, marginTop: 12 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  contactBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  contactBtnText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: "#fff" },
});
