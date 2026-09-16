import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { servicesApi, quotesApi, invoicesApi, reservationsApi, notificationsApi, accountApi, Service, getPublishedServices, getServiceId } from "@/lib/api";
import { FloatingSupport } from "@/components/FloatingSupport";

function ProBalanceCard({ theme, styles }: { theme: any; styles: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ["account-summary"],
    queryFn: accountApi.getSummary,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
  const available = (data as any)?.available !== false && !!data;
  const balance: number | null = available ? ((data as any)?.balance ?? null) : null;
  const discountRate: number | null = available ? ((data as any)?.discountRate ?? null) : null;

  if (isLoading) {
    return (
      <View style={styles.proBalanceCard}>
        <ActivityIndicator size="small" color="#9CA3AF" />
      </View>
    );
  }
  return (
    <View style={styles.proBalanceCard}>
      <View style={styles.proBalanceItem}>
        <Text style={styles.proBalanceLabel}>Solde dû</Text>
        {balance !== null
          ? <Text style={[styles.proBalanceValue, balance > 0 && { color: "#F59E0B" }]}>
              {balance.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
            </Text>
          : <Text style={styles.proBalanceNA}>N/A</Text>
        }
      </View>
      <View style={styles.proBalanceSep} />
      <View style={styles.proBalanceItem}>
        <Text style={styles.proBalanceLabel}>Remise négociée</Text>
        {discountRate !== null
          ? <Text style={[styles.proBalanceValue, { color: "#22C55E" }]}>{discountRate}%</Text>
          : <Text style={styles.proBalanceNA}>N/A</Text>
        }
      </View>
    </View>
  );
}

function parseMoney(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusKey(value: unknown): string {
  return String(value || "").toLowerCase().trim();
}

function isPaidInvoice(status: unknown): boolean {
  return ["paid", "payee", "payé", "paid_out"].includes(statusKey(status));
}

function AnalyticsBar({
  label,
  value,
  total,
  color,
  theme,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  theme: ThemeColors;
}) {
  const width = total > 0 ? `${Math.max(5, Math.round((value / total) * 100))}%` as `${number}%` : "5%";
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 12, fontFamily: theme.fontMedium, color: theme.textSecondary }}>{label}</Text>
        <Text style={{ fontSize: 12, fontFamily: theme.fontBold, color: theme.text }}>{value}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 8, backgroundColor: theme.surfaceSecondary, overflow: "hidden" }}>
        <View style={{ width, height: "100%", borderRadius: 8, backgroundColor: color }} />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);

  const { data: servicesRaw, isLoading: loadingServices, refetch: refetchServices } = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.getAll,
  });

  const services = getPublishedServices(Array.isArray(servicesRaw) ? servicesRaw : []);

  const { data: quotesRaw, refetch: refetchQuotes } = useQuery({
    queryKey: ["quotes"],
    queryFn: quotesApi.getAll,
    refetchInterval: 30000,
  });

  const quotes = Array.isArray(quotesRaw) ? quotesRaw : [];

  const { data: invoicesRaw = [], refetch: refetchInvoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: invoicesApi.getAll,
    retry: 1,
    refetchInterval: 60000,
  });

  const { data: reservationsRaw = [], refetch: refetchReservations } = useQuery({
    queryKey: ["reservations"],
    queryFn: reservationsApi.getAll,
    retry: 1,
    refetchInterval: 60000,
  });

  const invoices = Array.isArray(invoicesRaw) ? invoicesRaw : [];
  const reservations = Array.isArray(reservationsRaw) ? reservationsRaw : [];

  const analytics = useMemo(() => {
    const accepted = quotes.filter((quote) => ["accepted", "accepté", "accepte", "approved"].includes(statusKey(quote.status))).length;
    const pending = quotes.filter((quote) => ["pending", "en_attente", "en attente", "draft", "brouillon"].includes(statusKey(quote.status))).length;
    const closed = Math.max(0, quotes.length - accepted - pending);
    const totalInvoiced = invoices.reduce((sum, invoice) => (
      sum + parseMoney((invoice as any).totalTTC ?? (invoice as any).totalAmount ?? (invoice as any).amount)
    ), 0);
    const paid = invoices
      .filter((invoice) => isPaidInvoice(invoice.status))
      .reduce((sum, invoice) => sum + parseMoney((invoice as any).totalTTC ?? (invoice as any).totalAmount ?? (invoice as any).amount), 0);
    const outstanding = Math.max(0, totalInvoiced - paid);
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const value = invoices.reduce((sum, invoice) => {
        const rawDate = (invoice as any).createdAt || (invoice as any).issuedAt || (invoice as any).date;
        if (!rawDate || !String(rawDate).startsWith(monthKey)) return sum;
        return sum + parseMoney((invoice as any).totalTTC ?? (invoice as any).totalAmount ?? (invoice as any).amount);
      }, 0);
      return {
        label: date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
        value,
      };
    });
    return {
      accepted,
      pending,
      closed,
      totalInvoiced,
      paid,
      outstanding,
      acceptanceRate: quotes.length ? Math.round((accepted / quotes.length) * 100) : 0,
      months,
      maxMonth: Math.max(1, ...months.map((month) => month.value)),
      hasData: quotes.length > 0 || invoices.length > 0,
    };
  }, [invoices, quotes]);

  const { data: notificationsRaw = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.getAll,
    refetchInterval: 30000,
  });
  const notifList = Array.isArray(notificationsRaw) ? notificationsRaw : [];
  const unreadCount = notifList.filter((n: any) => !n.isRead).length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([refetchServices(), refetchQuotes(), refetchInvoices(), refetchReservations()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchServices, refetchQuotes, refetchInvoices, refetchReservations]);

  const pendingQuotes = quotes.filter((q) => q && (q.status === "pending" || q.status === "en_attente"));
  const acceptedQuotes = quotes.filter((q) => q && (q.status === "accepted" || q.status === "accepté"));
  const unpaidInvoices = invoices.filter((i) => {
    const s = i.status?.toLowerCase();
    return s === "pending" || s === "en_attente" || s === "sent" || s === "envoyée" || s === "overdue" || s === "en_retard";
  });
  const upcomingReservations = reservations.filter((r) => {
    const s = r.status?.toLowerCase();
    const dateStr = (r as any).scheduledDate || r.date;
    return (s === "confirmed" || s === "confirmée" || s === "confirmé" || s === "pending" || s === "en_attente") && (!dateStr || new Date(dateStr) >= new Date());
  });
  const isPro = user?.role === "client_professionnel";
  const greeting = user?.firstName ? `Bonjour, ${user.firstName}` : "Bonjour";

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/logo_new.png")}
            style={styles.headerLogo}
            contentFit="contain"
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.welcomeText}>
              {isPro ? (user?.companyName || "Client Professionnel") : "Bienvenue chez MyJantes"}
            </Text>
          </View>
          <Pressable
            style={styles.notifBtn}
            onPress={() => router.push("/(main)/(tabs)/notifications")}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.textSecondary} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Badge pro + solde & remise */}
        {isPro && (
          <>
            <View style={styles.proBanner}>
              <View style={styles.proBadge}>
                <Ionicons name="briefcase-outline" size={14} color={theme.primary} />
                <Text style={styles.proBadgeText}>PROFESSIONNEL</Text>
              </View>
              <Text style={styles.proSubText}>{user?.companyName || "Accès aux services exclusifs"}</Text>
            </View>
            <ProBalanceCard theme={theme} styles={styles} />
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.ctaCard, pressed && { opacity: 0.9 }]}
          onPress={() => router.push("/(main)/new-quote")}
        >
          <View style={styles.ctaContent}>
            <View style={styles.ctaIconContainer}>
              <Ionicons name="add-circle-outline" size={28} color="#fff" />
            </View>
            <View style={styles.ctaTextContainer}>
              <Text style={styles.ctaTitle}>Demander un devis</Text>
              <Text style={styles.ctaSubtitle}>Gratuit et sans engagement</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>

        {/* Actions rapides pro — 5 boutons */}
        {isPro && (
          <>
            <Text style={styles.sectionTitle}>Espace Pro</Text>
            <View style={styles.proActionsGrid}>
              <Pressable
                style={({ pressed }) => [styles.proActionCard, pressed && { opacity: 0.88 }]}
                onPress={() => router.push("/(main)/delivery-notes" as any)}
              >
                <View style={[styles.proActionIcon, { backgroundColor: "#3B82F620" }]}>
                  <Ionicons name="document-attach-outline" size={22} color="#3B82F6" />
                </View>
                <Text style={styles.proActionLabel} numberOfLines={2}>Bons de livraison</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.proActionCard, pressed && { opacity: 0.88 }]}
                onPress={() => router.push("/(main)/grouped-invoice" as any)}
              >
                <View style={[styles.proActionIcon, { backgroundColor: "#8B5CF620" }]}>
                  <Ionicons name="layers-outline" size={22} color="#8B5CF6" />
                </View>
                <Text style={styles.proActionLabel} numberOfLines={2}>Facture groupée</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.proActionCard, pressed && { opacity: 0.88 }]}
                onPress={() => router.push("/(main)/removal-request" as any)}
              >
                <View style={[styles.proActionIcon, { backgroundColor: theme.primary + "20" }]}>
                  <Ionicons name="car-sport-outline" size={22} color={theme.primary} />
                </View>
                <Text style={styles.proActionLabel} numberOfLines={2}>Demande d'enlèvement</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.proActionCard, pressed && { opacity: 0.88 }]}
                onPress={() => router.push("/(main)/history" as any)}
              >
                <View style={[styles.proActionIcon, { backgroundColor: "#22C55E20" }]}>
                  <Ionicons name="time-outline" size={22} color="#22C55E" />
                </View>
                <Text style={styles.proActionLabel} numberOfLines={2}>Historique complet</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.proActionCard, pressed && { opacity: 0.88 }]}
                onPress={() => router.push("/(main)/account-contact" as any)}
              >
                <View style={[styles.proActionIcon, { backgroundColor: "#F59E0B20" }]}>
                  <Ionicons name="person-circle-outline" size={22} color="#F59E0B" />
                </View>
                <Text style={styles.proActionLabel} numberOfLines={2}>Mon interlocuteur</Text>
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Vue d'ensemble</Text>

        <View style={styles.statsRow}>
          <Pressable
            style={[styles.statCard, { backgroundColor: theme.pendingBg }]}
            onPress={() => router.push("/(main)/(tabs)/quotes")}
          >
            <Ionicons name="time-outline" size={20} color={theme.pending} />
            <Text style={[styles.statNumber, { color: theme.pending }]}>{pendingQuotes.length}</Text>
            <Text style={styles.statLabel}>En attente</Text>
          </Pressable>
          <Pressable
            style={[styles.statCard, { backgroundColor: theme.acceptedBg }]}
            onPress={() => router.push("/(main)/(tabs)/quotes")}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={theme.accepted} />
            <Text style={[styles.statNumber, { color: theme.accepted }]}>{acceptedQuotes.length}</Text>
            <Text style={styles.statLabel}>Acceptés</Text>
          </Pressable>
          <Pressable
            style={[styles.statCard, { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => router.push("/(main)/(tabs)/quotes")}
          >
            <Ionicons name="documents-outline" size={20} color={theme.primary} />
            <Text style={[styles.statNumber, { color: theme.primary }]}>{quotes.length}</Text>
            <Text style={styles.statLabel}>Devis</Text>
          </Pressable>
        </View>

        {(invoices.length > 0 || upcomingReservations.length > 0) && (
          <View style={styles.statsRow}>
            <Pressable
              style={[styles.statCard, { backgroundColor: unpaidInvoices.length > 0 ? theme.pendingBg : theme.surfaceSecondary }]}
              onPress={() => router.push("/(main)/(tabs)/invoices")}
            >
              <Ionicons name="receipt-outline" size={20} color={unpaidInvoices.length > 0 ? theme.pending : theme.textSecondary} />
              <Text style={[styles.statNumber, { color: unpaidInvoices.length > 0 ? theme.pending : theme.textSecondary }]}>{unpaidInvoices.length}</Text>
              <Text style={styles.statLabel}>Impayées</Text>
            </Pressable>
            <Pressable
              style={[styles.statCard, { backgroundColor: theme.surfaceSecondary }]}
              onPress={() => router.push("/(main)/(tabs)/invoices")}
            >
              <Ionicons name="document-text-outline" size={20} color={theme.textSecondary} />
              <Text style={[styles.statNumber, { color: theme.textSecondary }]}>{invoices.length}</Text>
              <Text style={styles.statLabel}>Factures</Text>
            </Pressable>
            <Pressable
              style={[styles.statCard, { backgroundColor: upcomingReservations.length > 0 ? theme.acceptedBg : theme.surfaceSecondary }]}
              onPress={() => router.push("/(main)/(tabs)/reservations")}
            >
              <Ionicons name="calendar-outline" size={20} color={upcomingReservations.length > 0 ? theme.accepted : theme.textSecondary} />
              <Text style={[styles.statNumber, { color: upcomingReservations.length > 0 ? theme.accepted : theme.textSecondary }]}>{upcomingReservations.length}</Text>
              <Text style={styles.statLabel}>RDV</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.analyticsHeader}>
          <View>
            <Text style={styles.sectionTitle}>Analytics</Text>
            <Text style={styles.analyticsSubtitle}>
              {isPro ? "Suivi de votre activité professionnelle" : "Suivi de votre activité"}
            </Text>
          </View>
          <Ionicons name="stats-chart-outline" size={22} color={theme.primary} />
        </View>

        {!analytics.hasData ? (
          <View style={styles.analyticsEmpty}>
            <Ionicons name="analytics-outline" size={28} color={theme.textTertiary} />
            <Text style={styles.analyticsEmptyTitle}>Pas encore de données</Text>
            <Text style={styles.analyticsEmptyText}>
              Vos graphiques apparaîtront après votre première demande ou facture.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.analyticsKpiRow}>
              <View style={styles.analyticsKpi}>
                <Text style={styles.analyticsKpiLabel}>CA facturé</Text>
                <Text style={styles.analyticsKpiValue}>
                  {analytics.totalInvoiced.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                </Text>
              </View>
              <View style={styles.analyticsKpi}>
                <Text style={styles.analyticsKpiLabel}>À encaisser</Text>
                <Text style={[styles.analyticsKpiValue, { color: analytics.outstanding > 0 ? theme.pending : theme.accepted }]}>
                  {analytics.outstanding.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                </Text>
              </View>
              <View style={styles.analyticsKpi}>
                <Text style={styles.analyticsKpiLabel}>Acceptation</Text>
                <Text style={[styles.analyticsKpiValue, { color: theme.accepted }]}>{analytics.acceptanceRate}%</Text>
              </View>
            </View>

            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsCardTitle}>État des demandes de devis</Text>
              <View style={styles.analyticsBars}>
                <AnalyticsBar label="Acceptés" value={analytics.accepted} total={quotes.length} color={theme.accepted} theme={theme} />
                <AnalyticsBar label="En attente" value={analytics.pending} total={quotes.length} color={theme.pending} theme={theme} />
                <AnalyticsBar label="Autres statuts" value={analytics.closed} total={quotes.length} color={theme.primary} theme={theme} />
              </View>
            </View>

            <View style={styles.analyticsCard}>
              <View style={styles.analyticsCardHeader}>
                <Text style={styles.analyticsCardTitle}>Facturation sur 6 mois</Text>
                <Text style={styles.analyticsLegend}>TTC</Text>
              </View>
              <View style={styles.monthChart}>
                {analytics.months.map((month) => (
                  <View key={month.label} style={styles.monthColumn}>
                    <Text style={styles.monthValue}>
                      {month.value > 0 ? `${Math.round(month.value)}€` : "—"}
                    </Text>
                    <View style={styles.monthTrack}>
                      <View
                        style={[
                          styles.monthBar,
                          { height: `${Math.max(5, Math.round((month.value / analytics.maxMonth) * 100))}%`, backgroundColor: theme.primary },
                        ]}
                      />
                    </View>
                    <Text style={styles.monthLabel}>{month.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Nos services</Text>

        {loadingServices ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
        ) : services.length === 0 ? (
          <View style={styles.emptyServices}>
            <Ionicons name="construct-outline" size={36} color={theme.textTertiary} />
            <Text style={styles.emptyText}>Aucun service disponible</Text>
          </View>
        ) : (
          <View style={styles.servicesGrid}>
            {services.map((service: Service) => (
              <Pressable
                key={service.id}
                style={({ pressed }) => [styles.serviceCard, pressed && styles.serviceCardPressed]}
                onPress={() => router.push({ pathname: "/(main)/new-quote", params: { serviceId: getServiceId(service) } })}
              >
                <View style={styles.serviceIconContainer}>
                  <Ionicons name="construct" size={22} color={theme.primary} />
                </View>
                <Text style={styles.serviceName} numberOfLines={2}>
                  {service.name}
                </Text>
                {(service.basePrice || (service as any).price) && parseFloat(service.basePrice || (service as any).price) > 0 && (
                  <Text style={styles.servicePrice}>
                    à partir de {parseFloat(service.basePrice || (service as any).price).toFixed(2)}€
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <FloatingSupport />
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },
  greeting: {
    fontSize: 20,
    fontFamily: "Exo2_800ExtraBold",
    color: theme.text,
    letterSpacing: 0.5,
  },
  welcomeText: {
    fontSize: 13,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    marginTop: 3,
  },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  notifBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: theme.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Exo2_700Bold",
  },
  headerLogo: {
    width: 46,
    height: 46,
  },
  ctaCard: {
    backgroundColor: theme.primary,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  ctaContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 14,
  },
  ctaIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  ctaTextContainer: { flex: 1 },
  ctaTitle: {
    fontSize: 16,
    fontFamily: "Exo2_800ExtraBold",
    color: "#fff",
    letterSpacing: 0.3,
  },
  ctaSubtitle: {
    fontSize: 12,
    fontFamily: "Exo2_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Exo2_800ExtraBold",
    color: theme.text,
    marginBottom: 14,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 5,
  },
  statNumber: {
    fontSize: 22,
    fontFamily: "Exo2_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Exo2_500Medium",
    color: theme.textSecondary,
    textAlign: "center",
  },
  analyticsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  analyticsSubtitle: {
    fontSize: 12,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    marginTop: -8,
    marginBottom: 12,
  },
  analyticsEmpty: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 22,
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  analyticsEmptyTitle: {
    fontSize: 14,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
  },
  analyticsEmptyText: {
    fontSize: 12,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  analyticsKpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  analyticsKpi: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    minHeight: 76,
    justifyContent: "space-between",
  },
  analyticsKpiLabel: {
    fontSize: 10,
    fontFamily: "Exo2_500Medium",
    color: theme.textSecondary,
  },
  analyticsKpiValue: {
    fontSize: 15,
    fontFamily: "Exo2_700Bold",
    color: theme.text,
  },
  analyticsCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 10,
  },
  analyticsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  analyticsCardTitle: {
    fontSize: 14,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
  },
  analyticsLegend: {
    fontSize: 10,
    fontFamily: "Exo2_600SemiBold",
    color: theme.textTertiary,
    textTransform: "uppercase",
  },
  analyticsBars: {
    gap: 14,
    marginTop: 16,
  },
  monthChart: {
    height: 150,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 16,
  },
  monthColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 5,
  },
  monthValue: {
    fontSize: 9,
    fontFamily: "Exo2_500Medium",
    color: theme.textTertiary,
  },
  monthTrack: {
    width: "100%",
    maxWidth: 28,
    flex: 1,
    borderRadius: 7,
    justifyContent: "flex-end",
    backgroundColor: theme.surfaceSecondary,
    overflow: "hidden",
  },
  monthBar: {
    width: "100%",
    borderRadius: 7,
    minHeight: 5,
  },
  monthLabel: {
    fontSize: 10,
    fontFamily: "Exo2_500Medium",
    color: theme.textSecondary,
    textTransform: "capitalize",
  },
  emptyServices: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Exo2_400Regular",
    color: theme.textTertiary,
  },
  proBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: theme.primary + "15",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.primary + "40",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  proBadgeText: {
    fontSize: 10,
    fontFamily: "Exo2_700Bold",
    color: theme.primary,
    letterSpacing: 1,
  },
  proSubText: {
    fontSize: 12,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
  },
  proActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  proActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  proBalanceCard: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 16,
    gap: 0,
  },
  proBalanceItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  proBalanceSep: {
    width: 1,
    backgroundColor: theme.border,
    marginVertical: 4,
  },
  proBalanceLabel: {
    fontSize: 10,
    fontFamily: "Exo2_500Medium",
    color: theme.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  proBalanceValue: {
    fontSize: 18,
    fontFamily: "Exo2_700Bold",
    color: theme.text,
  },
  proBalanceNA: {
    fontSize: 14,
    fontFamily: "Exo2_400Regular",
    color: theme.textTertiary,
  },
  proActionCard: {
    width: "31.8%",
    minHeight: 112,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  proActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  proActionLabel: {
    fontSize: 11,
    fontFamily: "Exo2_500Medium",
    color: theme.text,
    textAlign: "center",
    lineHeight: 15,
    minHeight: 30,
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  serviceCard: {
    width: "48%",
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 8,
  },
  serviceCardPressed: {
    backgroundColor: theme.surfaceSecondary,
  },
  serviceIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  serviceName: {
    fontSize: 14,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
  },
  servicePrice: {
    fontSize: 12,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
  },
});
