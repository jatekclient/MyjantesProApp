import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  RefreshControl, Platform, ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createAudioPlayer } from "expo-audio";
import { notificationsApi, Notification } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { FloatingSupport } from "@/components/FloatingSupport";

function getTypeIcon(type: Notification["type"]): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "quote": return "document-text";
    case "invoice": return "receipt";
    case "reservation": return "calendar";
    case "service": return "construct";
    case "chat": return "chatbubble";
    default: return "notifications";
  }
}

function getTypeColor(type: Notification["type"]): string {
  switch (type) {
    case "quote": return "#3B82F6";
    case "invoice": return "#F59E0B";
    case "reservation": return "#22C55E";
    case "service": return "#DC2626";
    case "chat": return "#8B5CF6";
    default: return "#888";
  }
}

function getRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  if (!isFinite(date.getTime())) return "";
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin}min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays}j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function navigateToDetail(type: Notification["type"], relatedId: string | null) {
  if (!relatedId) return;
  switch (type) {
    case "quote": router.push({ pathname: "/(main)/quote-detail", params: { id: relatedId } }); break;
    case "invoice": router.push({ pathname: "/(main)/invoice-detail", params: { id: relatedId } }); break;
    case "reservation": router.push({ pathname: "/(main)/reservation-detail", params: { id: relatedId } }); break;
    case "chat": router.push({ pathname: "/(main)/chat-detail", params: { id: relatedId } }); break;
  }
}

function NotificationCard({ notification, onPress, theme, styles }: { notification: Notification; onPress: () => void; theme: ThemeColors; styles: any }) {
  const iconName = getTypeIcon(notification.type);
  const iconColor = getTypeColor(notification.type);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        !notification.isRead && styles.cardUnread,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconColor + "20" }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{notification.title}</Text>
          <View style={styles.cardMeta}>
            {!notification.isRead && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
            <Text style={styles.cardDate}>{getRelativeDate(notification.createdAt)}</Text>
          </View>
        </View>
        <Text style={styles.cardMessage} numberOfLines={2}>{notification.message}</Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);

  const { data: notificationsRaw = [], isLoading, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.getAll,
    refetchInterval: 30000,
  });

  useFocusEffect(
    useCallback(() => {
      notificationsApi.markAllRead().then(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }).catch(() => {});
    }, [])
  );

  const playNotificationSound = useCallback(() => {
    try {
      const player = createAudioPlayer(require("@/assets/sounds/notification.mp3"));
      player.play();
      setTimeout(() => {
        try { player.remove(); } catch {}
      }, 5000);
    } catch {}
  }, []);

  function safeTs(dateStr: string | null | undefined): number {
    if (!dateStr) return 0;
    const t = new Date(dateStr).getTime();
    return isFinite(t) ? t : 0;
  }

  const notifications = (Array.isArray(notificationsRaw) ? notificationsRaw : [])
    .filter((n: any) => n && (n.id || (n as any)._id));

  React.useEffect(() => {
    if (notifications.length > 0) {
      const latest = [...notifications].sort((a, b) => safeTs(b.createdAt) - safeTs(a.createdAt))[0];
      if (lastNotificationId && latest.id !== lastNotificationId && !latest.isRead) playNotificationSound();
      setLastNotificationId(latest.id);
    }
  }, [notifications, lastNotificationId, playNotificationSound]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  const handleMarkAllRead = useCallback(async () => {
    try { await notificationsApi.markAllRead(); queryClient.invalidateQueries({ queryKey: ["notifications"] }); } catch {}
  }, []);

  const handleNotificationPress = useCallback(async (notification: Notification) => {
    if (!notification.isRead) {
      try { await notificationsApi.markRead(notification.id); queryClient.invalidateQueries({ queryKey: ["notifications"] }); } catch {}
    }
    navigateToDetail(notification.type, notification.relatedId);
  }, []);

  const sorted = [...notifications].sort((a, b) => safeTs(b.createdAt) - safeTs(a.createdAt));
  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasUnread && (
          <Pressable style={({ pressed }) => [pressed && { opacity: 0.6 }]} onPress={handleMarkAllRead}>
            <Ionicons name="checkmark-done-outline" size={24} color={theme.primary} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationCard notification={item} onPress={() => handleNotificationPress(item)} theme={theme} styles={styles} />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyTitle}>Aucune notification</Text>
              <Text style={styles.emptyText}>Vous n'avez aucune notification pour le moment.</Text>
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
  loader: { flex: 1, justifyContent: "center" },
  list: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  card: {
    flexDirection: "row",
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 12,
    alignItems: "flex-start",
  },
  cardUnread: {
    backgroundColor: theme.surfaceSecondary,
    borderColor: theme.primary + "30",
  },
  cardPressed: { opacity: 0.8 },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: { flex: 1, gap: 4 },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text, flex: 1 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardDate: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  cardMessage: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, lineHeight: 18 },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Exo2_600SemiBold", color: theme.text, marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary, textAlign: "center", paddingHorizontal: 40 },
});
