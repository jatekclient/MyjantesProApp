import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, Share, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { adminLogs } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

const LEVEL_COLORS: Record<string, string> = {
  info: "#3B82F6",
  warn: "#F59E0B",
  error: "#EF4444",
};

const POLL_INTERVAL = 5000;

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

export default function LogsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user } = useAuth();
  const userRole = (user?.role || "").toLowerCase();

  useEffect(() => {
    if (userRole !== "root_admin" && userRole !== "root") {
      router.back();
    }
  }, [userRole]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTimestampRef = useRef<string>("");

  const fetchLogs = useCallback(async (initial = false) => {
    try {
      const since = initial ? undefined : lastTimestampRef.current || undefined;
      const result = await adminLogs.get(since);
      const newLogs = Array.isArray(result?.logs) ? result.logs : [];
      if (initial) {
        setLogs(newLogs);
      } else if (newLogs.length > 0) {
        setLogs(prev => {
          const combined = [...prev, ...newLogs];
          return combined.slice(-500);
        });
      }
      if (newLogs.length > 0) {
        lastTimestampRef.current = newLogs[newLogs.length - 1].timestamp;
      }
    } catch {}
    if (initial) setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs(true);
    pollingRef.current = setInterval(() => fetchLogs(false), POLL_INTERVAL);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter(l => l.level === filter);
  }, [logs, filter]);

  const handleCopy = async () => {
    const text = filteredLogs
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
      .join("\n");
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleShare = async () => {
    const text = filteredLogs
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`)
      .join("\n");
    try {
      await Share.share({ message: text, title: "Server Logs" });
    } catch {}
  };

  const handleClear = async () => {
    try {
      await adminLogs.clear();
      setLogs([]);
      lastTimestampRef.current = "";
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 16 : insets.bottom + 16;

  const renderLog = useCallback(({ item }: { item: LogEntry }) => {
    const color = LEVEL_COLORS[item.level] || theme.textTertiary;
    const time = item.timestamp.split("T")[1]?.substring(0, 8) || "";
    return (
      <View style={[styles.logRow, { borderLeftColor: color }]}>
        <View style={styles.logHeader}>
          <Text style={[styles.logLevel, { color }]}>{item.level.toUpperCase()}</Text>
          <Text style={styles.logTime}>{time}</Text>
        </View>
        <Text style={styles.logMsg} numberOfLines={4}>{item.message}</Text>
      </View>
    );
  }, [theme]);

  const counts = useMemo(() => {
    const c = { info: 0, warn: 0, error: 0 };
    logs.forEach(l => {
      if (l.level in c) c[l.level as keyof typeof c]++;
    });
    return c;
  }, [logs]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Logs serveur</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={handleCopy} accessibilityLabel="Copier">
            <Ionicons name="copy-outline" size={20} color={theme.primary} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={handleShare} accessibilityLabel="Partager">
            <Ionicons name="share-outline" size={20} color={theme.primary} />
          </Pressable>
          <Pressable style={[styles.iconBtn, { backgroundColor: "#EF444410", borderColor: "#EF444430" }]} onPress={handleClear} accessibilityLabel="Vider les logs">
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statBadge, { backgroundColor: "#3B82F610" }]}>
          <Text style={[styles.statVal, { color: "#3B82F6" }]}>{counts.info}</Text>
          <Text style={styles.statLabel}>Info</Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: "#F59E0B10" }]}>
          <Text style={[styles.statVal, { color: "#F59E0B" }]}>{counts.warn}</Text>
          <Text style={styles.statLabel}>Warn</Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: "#EF444410" }]}>
          <Text style={[styles.statVal, { color: "#EF4444" }]}>{counts.error}</Text>
          <Text style={styles.statLabel}>Error</Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: theme.surface }]}>
          <Text style={[styles.statVal, { color: theme.text }]}>{logs.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(["all", "info", "warn", "error"] as const).map(f => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && { backgroundColor: theme.primary }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && { color: "#fff" }]}>
              {f === "all" ? "Tous" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredLogs}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderLog}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (autoScroll && filteredLogs.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onScrollBeginDrag={() => setAutoScroll(false)}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="terminal-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Aucun log disponible</Text>
            </View>
          }
        />
      )}

      {!autoScroll && (
        <Pressable
          style={[styles.scrollBtn, { bottom: bottomPad + 8 }]}
          onPress={() => {
            setAutoScroll(true);
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
        >
          <Ionicons name="arrow-down" size={18} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.text },
  headerActions: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  statBadge: { flex: 1, borderRadius: 10, padding: 8, alignItems: "center", gap: 2, borderWidth: 1, borderColor: theme.border },
  statVal: { fontSize: 16, fontFamily: "Exo2_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  filterRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  filterText: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textSecondary },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  logRow: { backgroundColor: theme.surface, borderRadius: 8, borderWidth: 1, borderColor: theme.border, borderLeftWidth: 3, padding: 10, marginBottom: 6 },
  logHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  logLevel: { fontSize: 10, fontFamily: "Exo2_700Bold", letterSpacing: 0.5 },
  logTime: { fontSize: 10, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  logMsg: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.text, lineHeight: 18 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  scrollBtn: { position: "absolute", right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
});
