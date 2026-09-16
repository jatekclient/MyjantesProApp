import React, { useMemo, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, RefreshControl, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { adminAnalytics, adminNotifications, adminQuotes, adminInvoices, adminClients, adminReservations } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { FloatingSupport } from "@/components/FloatingSupport";

function formatCurrency(val: number | undefined | null) {
  if (val === undefined || val === null) return "0 €";
  return Number(val).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const all = await adminNotifications.getAll();
        const arr = Array.isArray(all) ? all : [];
        setUnreadCount(arr.filter((n: any) => !n.isRead && !n.read).length);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: rawDashboard, isLoading: dashLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: adminAnalytics.get,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const { data: quotesData } = useQuery({
    queryKey: ["admin-quotes"],
    queryFn: adminQuotes.getAll,
    staleTime: 60000,
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: adminInvoices.getAll,
    staleTime: 60000,
  });

  const { data: clientsData } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: adminClients.getAll,
    staleTime: 60000,
  });

  const { data: reservationsData } = useQuery({
    queryKey: ["admin-reservations"],
    queryFn: adminReservations.getAll,
    staleTime: 60000,
  });

  const data = useMemo(() => {
    const dash = rawDashboard as any;
    if (dash && dash.currentMonth && (dash.currentMonth.revenue > 0 || dash.totalQuotes > 0 || dash.totalInvoices > 0)) {
      return dash;
    }
    const allQuotes = Array.isArray(quotesData) ? quotesData : [];
    const allInvoices = Array.isArray(invoicesData) ? invoicesData : [];
    const allClients = Array.isArray(clientsData) ? clientsData : [];
    const allReservations = Array.isArray(reservationsData) ? reservationsData : [];

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    let monthlyRevenue = 0;
    let pendingRevenue = 0;
    let globalRevenue = 0;
    let paidCount = 0;
    let pendingInvCount = 0;
    let overdueCount = 0;
    let cancelledInvCount = 0;

    for (const inv of allInvoices) {
      const status = (inv.status || "").toLowerCase();
      const total = parseFloat(inv.totalTTC || inv.total_ttc || inv.totalAmount || inv.total || inv.amount || "0") || 0;
      if (status === "paid" || status === "payée" || status === "payee") {
        globalRevenue += total;
        paidCount++;
        const paidDate = inv.paidAt || inv.paid_at || inv.updatedAt || inv.updated_at;
        if (paidDate) {
          const d = new Date(paidDate);
          if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) monthlyRevenue += total;
        }
      } else if (status === "pending" || status === "en_attente") {
        pendingRevenue += total;
        pendingInvCount++;
      } else if (status === "overdue" || status === "en_retard") {
        pendingRevenue += total;
        overdueCount++;
      } else if (status === "cancelled" || status === "annulée" || status === "annulee") {
        cancelledInvCount++;
      }
    }

    let pendingQuotes = 0;
    let approvedQuotes = 0;
    let rejectedQuotes = 0;
    let completedQuotes = 0;

    for (const q of allQuotes) {
      const status = (q.status || "").toLowerCase();
      if (status === "pending" || status === "en_attente") pendingQuotes++;
      else if (status === "approved" || status === "accepté" || status === "accepted") approvedQuotes++;
      else if (status === "rejected" || status === "refusé" || status === "refused") rejectedQuotes++;
      else if (status === "completed" || status === "converted" || status === "terminé") completedQuotes++;
    }

    const converted = allQuotes.filter((q: any) => {
      const s = (q.status || "").toLowerCase();
      return s === "completed" || s === "converted" || s === "terminé";
    }).length;
    const conversionRate = allQuotes.length > 0 ? (converted / allQuotes.length * 100) : 0;
    const avgInvoiceAmount = allInvoices.length > 0 ? globalRevenue / Math.max(paidCount, 1) : 0;

    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    const monthlyRevenueArr: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const mIdx = d.getMonth();
      const mYear = d.getFullYear();
      let total = 0;
      for (const inv of allInvoices) {
        const st = (inv.status || "").toLowerCase();
        if (st !== "paid" && st !== "payée" && st !== "payee") continue;
        const paidDate = inv.paidAt || inv.paid_at || inv.updatedAt || inv.updated_at || inv.createdAt || inv.created_at;
        if (!paidDate) continue;
        const pd = new Date(paidDate);
        if (pd.getMonth() === mIdx && pd.getFullYear() === mYear) {
          total += parseFloat(inv.totalTTC || inv.total_ttc || inv.totalAmount || inv.total || inv.amount || "0") || 0;
        }
      }
      monthlyRevenueArr.push({ name: monthNames[mIdx], total });
    }

    return {
      ...(dash || {}),
      currentMonth: {
        ...(dash?.currentMonth || {}),
        revenue: dash?.currentMonth?.revenue ?? monthlyRevenue,
        monthName: dash?.currentMonth?.monthName ?? monthNames[thisMonth],
      },
      pendingRevenue: dash?.pendingRevenue ?? pendingRevenue,
      globalRevenue: dash?.globalRevenue ?? globalRevenue,
      totalClients: dash?.totalClients ?? allClients.length,
      clients: dash?.clients ?? allClients,
      totalReservations: dash?.totalReservations ?? allReservations.length,
      totalInvoices: dash?.totalInvoices ?? allInvoices.length,
      totalQuotes: dash?.totalQuotes ?? allQuotes.length,
      conversionRate: dash?.conversionRate ?? conversionRate,
      avgInvoiceAmount: dash?.avgInvoiceAmount ?? avgInvoiceAmount,
      quoteStatusStats: dash?.quoteStatusStats || {
        pending: pendingQuotes,
        approved: approvedQuotes,
        rejected: rejectedQuotes,
        completed: completedQuotes,
      },
      invoiceStatusStats: dash?.invoiceStatusStats || {
        paid: paidCount,
        pending: pendingInvCount,
        overdue: overdueCount,
        cancelled: cancelledInvCount,
      },
      monthlyRevenue: (dash?.monthlyRevenue && dash.monthlyRevenue.length > 0) ? dash.monthlyRevenue : monthlyRevenueArr,
    };
  }, [rawDashboard, quotesData, invoicesData, clientsData, reservationsData]);

  const isLoading = dashLoading;

  const userRole = (user?.role || "").toLowerCase();
  const isRootAdmin = userRole === "root_admin" || userRole === "root";

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 100 : insets.bottom + 100;

  const cm = (data as any)?.currentMonth || {};
  const qStats = (data as any)?.quoteStatusStats || {};
  const invStats = (data as any)?.invoiceStatusStats || {};

  const kpis = {
    monthlyRevenue: Number(cm.revenue) ?? 0,
    pendingRevenue: Number((data as any)?.pendingRevenue) ?? 0,
    globalRevenue: Number((data as any)?.globalRevenue) ?? 0,
    // Prioritise the dedicated totalClients field; fall back to clients array length
    totalClients: Number((data as any)?.totalClients) || (Array.isArray((data as any)?.clients) ? (data as any).clients.length : 0),
    pendingQuotes: (Number(qStats.pending) || 0) + (Number(qStats.approved) || 0),
    pendingInvoices: (Number(invStats.pending) || 0) + (Number(invStats.overdue) || 0),
    overdueInvoices: Number(invStats.overdue) || 0,
    totalReservations: Number((data as any)?.totalReservations) ?? 0,
    totalInvoices: Number((data as any)?.totalInvoices) ?? 0,
    totalQuotes: Number((data as any)?.totalQuotes) ?? 0,
    conversionRate: parseFloat(String((data as any)?.conversionRate ?? "0")),
    avgInvoice: Number((data as any)?.avgInvoiceAmount) ?? 0,
    paidInvoices: Number(invStats.paid) || 0,
    cancelledInvoices: Number(invStats.cancelled) || 0,
  };

  const rawChart: any[] = Array.isArray((data as any)?.monthlyRevenue)
    ? (data as any).monthlyRevenue.slice(-6)
    : [];
  const revenueChart = rawChart.map((m: any) => ({
    revenue: Number(m.total) || 0,
    label: String(m.name || "").split(".")[0],
  }));
  const maxRevenue = Math.max(...revenueChart.map(r => r.revenue), 1);

  const serviceStats: any[] = Array.isArray((data as any)?.revenueByService)
    ? (data as any).revenueByService.filter((s: any) => (s.count || 0) > 0)
    : [];

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
      >
        <View style={styles.headerRow}>
          <Image source={require("@/assets/images/logo_new.png")} style={styles.headerLogo} contentFit="contain" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.greeting}>Bonjour,</Text>
            <Text style={styles.userName}>{user?.firstName || "Admin"}</Text>
          </View>
          <Pressable
            style={[styles.headerBtn, { backgroundColor: theme.primary + "10" }]}
            onPress={() => router.push("/(admin)/notifications" as any)}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color={theme.primary} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? "99+" : String(unreadCount)}</Text>
              </View>
            )}
          </Pressable>
          {isRootAdmin && (
            <Pressable style={[styles.headerBtn, { backgroundColor: theme.primary + "10" }]} onPress={() => router.push("/(admin)/logs" as any)} accessibilityLabel="Logs serveur">
              <Ionicons name="terminal-outline" size={20} color={theme.primary} />
            </Pressable>
          )}
        </View>

        <Text style={styles.sectionLabel}>Ce mois — {cm.monthName || ""}</Text>
        <View style={styles.kpiGrid}>
          <Pressable style={styles.kpiCardContainer} onPress={() => router.push({ pathname: "/(admin)/(tabs)/invoices", params: { filter: "paid" } } as any)}>
            <KPICard theme={theme} icon="cash-outline" color="#22C55E" label="CA encaissé" value={formatCurrency(kpis.monthlyRevenue)} />
          </Pressable>
          <Pressable style={styles.kpiCardContainer} onPress={() => router.push({ pathname: "/(admin)/(tabs)/invoices", params: { filter: "pending" } } as any)}>
            <KPICard theme={theme} icon="time-outline" color="#F59E0B" label="CA en attente" value={formatCurrency(kpis.pendingRevenue)} />
          </Pressable>
          <Pressable style={styles.kpiCardContainer} onPress={() => router.push({ pathname: "/(admin)/(tabs)/quotes", params: { filter: "pending" } } as any)}>
            <KPICard theme={theme} icon="document-text-outline" color="#8B5CF6" label="Devis actifs" value={String(kpis.pendingQuotes)} />
          </Pressable>
          <Pressable style={styles.kpiCardContainer} onPress={() => router.push({ pathname: "/(admin)/(tabs)/invoices", params: { filter: "pending" } } as any)}>
            <KPICard theme={theme} icon="alert-circle-outline" color="#EF4444" label="Factures impayées" value={String(kpis.pendingInvoices)} />
          </Pressable>
          <Pressable style={styles.kpiCardContainer} onPress={() => router.push("/(admin)/(tabs)/clients" as any)}>
            <KPICard theme={theme} icon="people-outline" color="#3B82F6" label="Clients" value={String(kpis.totalClients)} />
          </Pressable>
          <Pressable style={styles.kpiCardContainer} onPress={() => router.push("/(admin)/(tabs)/reservations" as any)}>
            <KPICard theme={theme} icon="calendar-outline" color="#06B6D4" label="Rendez-vous" value={String(kpis.totalReservations)} />
          </Pressable>
          <Pressable style={styles.kpiCardContainer} onPress={() => router.push({ pathname: "/(admin)/(tabs)/invoices", params: { filter: "paid" } } as any)}>
            <KPICard theme={theme} icon="trending-up-outline" color="#8B5CF6" label="Panier moyen" value={kpis.avgInvoice > 0 ? formatCurrency(kpis.avgInvoice) : "—"} />
          </Pressable>
          <Pressable style={styles.kpiCardContainer} onPress={() => router.push({ pathname: "/(admin)/(tabs)/invoices", params: { filter: "overdue" } } as any)}>
            <KPICard theme={theme} icon="warning-outline" color="#F97316" label="En retard" value={String(kpis.overdueInvoices)} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeVal}>{kpis.totalQuotes}</Text>
            <Text style={styles.statBadgeLabel}>Devis total</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeVal}>{kpis.totalInvoices}</Text>
            <Text style={styles.statBadgeLabel}>Factures</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeVal}>{kpis.conversionRate.toFixed(0)}%</Text>
            <Text style={styles.statBadgeLabel}>Conversion</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statBadgeVal}>{formatCurrency(kpis.globalRevenue)}</Text>
            <Text style={styles.statBadgeLabel}>CA total</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Chiffre d'affaires — 6 derniers mois</Text>
        <View style={styles.chartCard}>
          {revenueChart.length === 0 ? (
            <View style={styles.chartEmpty}>
              <Ionicons name="bar-chart-outline" size={32} color={theme.textTertiary} />
              <Text style={{ color: theme.textTertiary, marginTop: 8, fontSize: 13 }}>Aucune donnée disponible</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              {revenueChart.map((item, i) => {
                const barH = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 4;
                const hasValue = item.revenue > 0;
                return (
                  <View key={i} style={styles.chartBarCol}>
                    {hasValue && (
                      <Text style={styles.chartBarValue}>
                        {item.revenue >= 1000 ? Math.round(item.revenue / 1000) + "k" : String(Math.round(item.revenue))}
                      </Text>
                    )}
                    <View style={[styles.chartBar, { height: Math.max(barH, 4), backgroundColor: hasValue ? theme.primary : theme.border }]} />
                    <Text style={styles.chartBarLabel}>{item.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {invStats && (
          <>
            <Text style={styles.sectionLabel}>Statut des factures</Text>
            <View style={styles.statusCard}>
              <StatusRow theme={theme} label="Payées" count={invStats.paid || 0} color={theme.success} />
              <StatusRow theme={theme} label="En attente" count={invStats.pending || 0} color={theme.warning} />
              <StatusRow theme={theme} label="En retard" count={invStats.overdue || 0} color={theme.error} />
              <StatusRow theme={theme} label="Annulées" count={invStats.cancelled || 0} color={theme.textTertiary} last />
            </View>
          </>
        )}

        {qStats && (
          <>
            <Text style={styles.sectionLabel}>Statut des devis</Text>
            <View style={styles.statusCard}>
              <StatusRow theme={theme} label="En attente" count={qStats.pending || 0} color={theme.warning} />
              <StatusRow theme={theme} label="Approuvés" count={qStats.approved || 0} color={theme.success} />
              <StatusRow theme={theme} label="Rejetés" count={qStats.rejected || 0} color={theme.error} />
              <StatusRow theme={theme} label="Convertis" count={qStats.completed || 0} color={theme.primary} last />
            </View>
          </>
        )}

        {serviceStats.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Services</Text>
            <View style={styles.statusCard}>
              {serviceStats.map((s: any, i: number) => (
                <StatusRow
                  key={s.name}
                  theme={theme}
                  label={s.name}
                  count={s.count || 0}
                  color={theme.primary}
                  last={i === serviceStats.length - 1}
                  suffix="RDV"
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <FloatingSupport />
    </View>
  );
}

function StatusRow({ label, count, color, last = false, suffix = "", theme }: { label: string; count: number; color: string; last?: boolean; suffix?: string; theme: ThemeColors }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 }, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 14, fontFamily: "Exo2_600SemiBold", color }}>{count}{suffix ? " " + suffix : ""}</Text>
    </View>
  );
}

function KPICard({ theme, icon, color, label, value }: { theme: ThemeColors; icon: any; color: string; label: string; value: string }) {
  const styles = useMemo(() => getStyles(theme), [theme]);
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scroll: { paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  headerLogo: { width: 38, height: 38, borderRadius: 10 },
  greeting: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  userName: { fontSize: 22, fontFamily: "Exo2_700Bold", color: theme.text },
  headerBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginLeft: 8 },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.error,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  bellBadgeText: { fontSize: 10, fontFamily: "Exo2_700Bold", color: "#fff" },
  sectionLabel: { fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginTop: 8, marginLeft: 2 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  kpiCardContainer: { width: "48%", flexGrow: 1 },
  kpiCard: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 6 },
  kpiIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  kpiValue: { fontSize: 20, fontFamily: "Exo2_700Bold", color: theme.text, minHeight: 28 },
  kpiLabel: { fontSize: 11, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statBadge: { flex: 1, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 10, alignItems: "center", gap: 2 },
  statBadgeVal: { fontSize: 14, fontFamily: "Exo2_700Bold", color: theme.text },
  statBadgeLabel: { fontSize: 10, fontFamily: "Exo2_400Regular", color: theme.textSecondary, textAlign: "center" },
  chartCard: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 16, marginBottom: 16 },
  chartContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 140, gap: 4 },
  chartBarCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  chartBar: { width: "100%", maxWidth: 32, borderRadius: 6, minHeight: 4 },
  chartBarValue: { fontSize: 9, fontFamily: "Exo2_500Medium", color: theme.textTertiary },
  chartBarLabel: { fontSize: 9, fontFamily: "Exo2_400Regular", color: theme.textTertiary, textAlign: "center" },
  chartEmpty: { height: 100, justifyContent: "center", alignItems: "center" },
  statusCard: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: "hidden", marginBottom: 16 },
});
