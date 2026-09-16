import React, { useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, RefreshControl, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminNotifications } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { FloatingSupport } from "@/components/FloatingSupport";

function getRelativeDate(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `il y a ${diffD}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function getTypeIcon(type: string): any {
  switch (type?.toLowerCase()) {
    case "quote": return "document-text-outline";
    case "invoice": return "receipt-outline";
    case "reservation": return "calendar-outline";
    default: return "notifications-outline";
  }
}

function getTypeColor(type: string, theme: ThemeColors): string {
  switch (type?.toLowerCase()) {
    case "quote": return "#8B5CF6";
    case "invoice": return "#22C55E";
    case "reservation": return "#06B6D4";
    default: return theme.primary;
  }
}

export default function AdminNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();

  const { data: notificationsRaw = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: adminNotifications.getAll,
  });

  const notifications = Array.isArray(notificationsRaw) ? notificationsRaw : [];
  const sorted = [...notifications].sort((a: any, b: any) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const hasUnread = notifications.some((n: any) => !n.isRead && !n.read);

  const handleMarkAllRead = async () => {
    try {
      await adminNotifications.markAllRead();
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    } catch {}
  };

  const handleNotificationPress = useCallback(async (notification: any) => {
    if (!notification.isRead && !notification.read) {
      try {
        await adminNotifications.markRead(notification.id);
        queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      } catch {}
    }
    if (notification.relatedId) {
      const type = (notification.type || "").toLowerCase();
      if (type === "quote") {
        router.push({ pathname: "/(admin)/quote-detail", params: { id: notification.relatedId } } as any);
      } else if (type === "invoice") {
        router.push({ pathname: "/(admin)/invoice-detail", params: { id: notification.relatedId } } as any);
      } else if (type === "reservation") {
        router.push({ pathname: "/(admin)/reservation-detail", params: { id: notification.relatedId } } as any);
      }
    }
  }, [queryClient]);

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;

  const renderItem = useCallback(({ item }: { item: any }) => {
    const isRead = item.isRead || item.read;
    const iconName = getTypeIcon(item.type);
    const iconColor = getTypeColor(item.type, theme);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          !isRead && styles.cardUnread,
          pressed && { opacity: 0.9 },
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconColor + "15" }]}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, !isRead && { fontFamily: "Exo2_700Bold" }]} numberOfLines={1}>
              {item.title || "Notification"}
            </Text>
            <View style={styles.cardMeta}>
              {!isRead && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
              <Text style={styles.cardDate}>{getRelativeDate(item.createdAt)}</Text>
            </View>
          </View>
          <Text style={styles.cardMessage} numberOfLines={2}>{item.message || ""}</Text>
        </View>
      </Pressable>
    );
  }, [theme, handleNotificationPress]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasUnread && (
          <Pressable style={styles.markAllBtn} onPress={handleMarkAllRead}>
            <Text style={[styles.markAllText, { color: theme.primary }]}>Tout lire</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 34 + 24 : insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Aucune notification</Text>
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
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Exo2_700Bold", color: theme.text },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  markAllText: { fontSize: 13, fontFamily: "Exo2_600SemiBold" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    alignItems: "flex-start",
  },
  cardUnread: { backgroundColor: theme.primary + "08", borderColor: theme.primary + "30" },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: { flex: 1, gap: 4 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text, flex: 1, marginRight: 8 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardDate: { fontSize: 11, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  cardMessage: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, lineHeight: 18 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
});
