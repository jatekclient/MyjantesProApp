import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, TextInput,
  ActivityIndicator, Share, RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { adminApiCall, adminApiBase, getAdminAccessToken } from "@/lib/admin-api";

type LogLevel = "all" | "error" | "warn" | "info";
type LogEntry = { timestamp: string; level: string; message: string; source: string };

const LEVEL_COLORS: Record<string, string> = {
  error: "#EF4444",
  warn: "#F59E0B",
  info: "#3B82F6",
};

const LEVEL_ICONS: Record<string, string> = {
  error: "alert-circle",
  warn: "warning",
  info: "information-circle",
};

const LEVEL_LABELS: Record<string, string> = {
  all: "Tous",
  error: "Erreurs",
  warn: "Alertes",
  info: "Info",
};

export default function AdminLogsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { showAlert, AlertComponent } = useCustomAlert();
  const queryClient = useQueryClient();

  const [levelFilter, setLevelFilter] = useState<LogLevel>("all");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (levelFilter !== "all") params.set("level", levelFilter);
    if (search.trim()) params.set("search", search.trim());
    params.set("limit", "500");
    const qs = params.toString();
    const data = await adminApiCall(`/api/admin/logs${qs ? `?${qs}` : ""}`);
    return data as { logs: LogEntry[]; total: number; filtered: number };
  }, [levelFilter, search]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-logs", levelFilter, search],
    queryFn: fetchLogs,
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 2000,
  });

  const logs = data?.logs || [];
  const totalCount = data?.total || 0;
  const filteredCount = data?.filtered || 0;

  const errorCount = useMemo(() => logs.filter(l => l.level === "error").length, [logs]);
  const warnCount = useMemo(() => logs.filter(l => l.level === "warn").length, [logs]);

  const handleExport = async (format: "json" | "csv") => {
    try {
      const token = getAdminAccessToken();
      const params = new URLSearchParams();
      params.set("format", format);
      if (levelFilter !== "all") params.set("level", levelFilter);
      const url = `${adminApiBase()}/api/admin/logs/export?${params.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
      });
      if (!res.ok) throw new Error("Export échoué");
      const text = await res.text();

      if (Platform.OS === "web") {
        const blob = new Blob([text], { type: format === "csv" ? "text/csv" : "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `logs-${new Date().toISOString().slice(0, 10)}.${format}`;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        await Share.share({
          message: text.length > 50000 ? text.slice(0, 50000) + "\n... (tronqué)" : text,
          title: `Logs MyJantes (${format.toUpperCase()})`,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      showAlert({ type: "error", title: "Export échoué", message: err.message, buttons: [{ text: "OK", style: "primary" }] });
    }
  };

  const handleClearLogs = () => {
    showAlert({
      type: "warning",
      title: "Vider les logs ?",
      message: "Tous les logs serveur seront supprimés définitivement.",
      buttons: [
        { text: "Annuler" },
        {
          text: "Vider", style: "primary", onPress: async () => {
            try {
              await adminApiCall("/api/admin/logs", { method: "DELETE" });
              queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              showAlert({ type: "error", title: "Erreur", message: err.message, buttons: [{ text: "OK", style: "primary" }] });
            }
          },
        },
      ],
    });
  };

  const handleCopyLog = async (log: LogEntry) => {
    const text = `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
    await Clipboard.setStringAsync(text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  };

  const renderLogItem = useCallback(({ item }: { item: LogEntry }) => {
    const color = LEVEL_COLORS[item.level] || "#888";
    const icon = LEVEL_ICONS[item.level] || "ellipse";
    return (
      <Pressable
        style={({ pressed }) => [styles.logItem, pressed && { opacity: 0.7 }]}
        onLongPress={() => handleCopyLog(item)}
      >
        <View style={styles.logHeader}>
          <Ionicons name={icon as any} size={14} color={color} />
          <Text style={[styles.logLevel, { color }]}>{item.level.toUpperCase()}</Text>
          <Text style={styles.logTime}>{formatTime(item.timestamp)}</Text>
        </View>
        <Text style={styles.logMessage} numberOfLines={6}>{item.message}</Text>
      </Pressable>
    );
  }, [theme]);

  const LEVELS: LogLevel[] = ["all", "error", "warn", "info"];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Logs système</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.headerIconBtn, autoRefresh && { backgroundColor: "#22C55E20" }]}
            onPress={() => setAutoRefresh(!autoRefresh)}
          >
            <Ionicons name={autoRefresh ? "sync" : "sync-outline"} size={18} color={autoRefresh ? "#22C55E" : theme.textTertiary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totalCount}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statBox, { borderColor: "#EF444440" }]}>
          <Text style={[styles.statValue, { color: "#EF4444" }]}>{errorCount}</Text>
          <Text style={styles.statLabel}>Erreurs</Text>
        </View>
        <View style={[styles.statBox, { borderColor: "#F59E0B40" }]}>
          <Text style={[styles.statValue, { color: "#F59E0B" }]}>{warnCount}</Text>
          <Text style={styles.statLabel}>Alertes</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{filteredCount}</Text>
          <Text style={styles.statLabel}>Affichés</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {LEVELS.map(lv => (
          <Pressable
            key={lv}
            style={[styles.filterChip, levelFilter === lv && { backgroundColor: (LEVEL_COLORS[lv] || theme.primary) + "25", borderColor: LEVEL_COLORS[lv] || theme.primary }]}
            onPress={() => { setLevelFilter(lv); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.filterChipText, levelFilter === lv && { color: LEVEL_COLORS[lv] || theme.primary }]}>
              {LEVEL_LABELS[lv]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={theme.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher dans les logs..."
            placeholderTextColor={theme.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.actionBtn} onPress={() => handleExport("json")}>
          <Ionicons name="download-outline" size={16} color={theme.primary} />
          <Text style={[styles.actionBtnText, { color: theme.primary }]}>JSON</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => handleExport("csv")}>
          <Ionicons name="document-text-outline" size={16} color={theme.primary} />
          <Text style={[styles.actionBtnText, { color: theme.primary }]}>CSV</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => { refetch(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
          <Ionicons name="refresh" size={16} color="#22C55E" />
          <Text style={[styles.actionBtnText, { color: "#22C55E" }]}>Rafraîchir</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={handleClearLogs}>
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
          <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Vider</Text>
        </Pressable>
      </View>

      {autoRefresh && (
        <View style={styles.refreshIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.refreshText}>Rafraîchissement auto ({refreshInterval / 1000}s)</Text>
          <Pressable onPress={() => setRefreshInterval(prev => prev === 5000 ? 10000 : prev === 10000 ? 30000 : 5000)}>
            <Text style={[styles.refreshText, { color: theme.primary }]}>
              {refreshInterval === 5000 ? "5s" : refreshInterval === 10000 ? "10s" : "30s"}
            </Text>
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item, index) => `${item.timestamp}-${index}`}
          renderItem={renderLogItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="terminal-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Aucun log trouvé</Text>
              <Text style={styles.emptyHint}>Les logs serveur apparaîtront ici en temps réel</Text>
            </View>
          }
        />
      )}
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Exo2_700Bold", color: theme.text },
  headerActions: { flexDirection: "row", gap: 8 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: theme.border },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  statBox: {
    flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 10,
    alignItems: "center", borderWidth: 1, borderColor: theme.border,
  },
  statValue: { fontSize: 18, fontFamily: "Exo2_700Bold", color: theme.text },
  statLabel: { fontSize: 10, fontFamily: "Exo2_400Regular", color: theme.textTertiary, marginTop: 2 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
  },
  filterChipText: { fontSize: 12, fontFamily: "Exo2_600SemiBold", color: theme.textSecondary },
  searchRow: { paddingHorizontal: 16, marginBottom: 8 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.surface, borderRadius: 10, borderWidth: 1,
    borderColor: theme.border, paddingHorizontal: 12, height: 38,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.text },
  actionRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
  },
  actionBtnText: { fontSize: 11, fontFamily: "Exo2_600SemiBold" },
  refreshIndicator: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 20, marginBottom: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" },
  refreshText: { fontSize: 11, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  logItem: {
    backgroundColor: theme.surface, borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: theme.border,
  },
  logHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  logLevel: { fontSize: 10, fontFamily: "Exo2_700Bold", letterSpacing: 0.5 },
  logTime: { fontSize: 10, fontFamily: "Exo2_400Regular", color: theme.textTertiary, marginLeft: "auto" as const },
  logMessage: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, lineHeight: 18 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary },
  emptyHint: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
});
