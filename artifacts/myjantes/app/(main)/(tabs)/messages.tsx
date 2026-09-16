import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  RefreshControl, Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { chatApi, ChatConversation } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { FloatingSupport } from "@/components/FloatingSupport";

function safeTs(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const t = new Date(dateStr).getTime();
  return isFinite(t) ? t : 0;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (!isFinite(date.getTime())) return "";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return date.toLocaleDateString("fr-FR", { weekday: "short" });
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function ConversationCard({ conversation, theme, styles }: { conversation: ChatConversation; theme: ThemeColors; styles: any }) {
  const hasUnread = (conversation.unreadCount ?? 0) > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: "/(main)/chat-detail", params: { id: conversation.id } })}
    >
      <View style={styles.avatarContainer}>
        <Ionicons name="chatbubbles" size={22} color={theme.primary} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardTitle, hasUnread && styles.cardTitleUnread]} numberOfLines={1}>
            {conversation.title}
          </Text>
          <Text style={[styles.cardDate, hasUnread && styles.cardDateUnread]}>
            {formatDate(conversation.lastMessageAt)}
          </Text>
        </View>
        <View style={styles.cardBottomRow}>
          <Text style={styles.cardPreview} numberOfLines={1}>
            {conversation.lastMessage?.content || "Aucun message"}
          </Text>
          {hasUnread && (
            <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.unreadText}>{conversation.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);

  const { data: conversationsRaw = [], isLoading, refetch } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: chatApi.getConversations,
    refetchInterval: 15000,
  });

  const conversations = (Array.isArray(conversationsRaw) ? conversationsRaw : [])
    .filter((c) => c && (c.id || (c as any)._id))
    .sort((a, b) => safeTs(b.lastMessageAt) - safeTs(a.lastMessageAt));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationCard conversation={item} theme={theme} styles={styles} />}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyTitle}>Aucun message</Text>
              <Text style={styles.emptyText}>Vos conversations apparaîtront ici.</Text>
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
  list: { paddingHorizontal: 16, paddingTop: 8, gap: 2 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 12,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 6,
  },
  cardPressed: { backgroundColor: theme.surfaceSecondary },
  avatarContainer: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: theme.surface,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: theme.border,
  },
  cardContent: { flex: 1, gap: 4 },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontFamily: "Exo2_500Medium", color: theme.text, flex: 1, marginRight: 8 },
  cardTitleUnread: { fontFamily: "Exo2_600SemiBold" },
  cardDate: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  cardDateUnread: { color: theme.primary, fontFamily: "Exo2_500Medium" },
  cardBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardPreview: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, flex: 1, marginRight: 8 },
  unreadBadge: {
    borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: "center", alignItems: "center", paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Exo2_600SemiBold", color: theme.text, marginTop: 8 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary, textAlign: "center", paddingHorizontal: 40 },
});
