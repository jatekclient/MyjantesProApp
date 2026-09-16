import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { getGaragePlan, adminAnalytics } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth-context";

const ROOT_ROLES = ["root", "root_admin"];
const SUPER_ROLES = ["super_admin", "superadmin"];

interface FeatureCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  color: string;
  onPress: () => void;
  loading?: boolean;
  theme: ThemeColors;
  styles: any;
}

function FeatureCard({ icon, label, sub, color, onPress, loading, theme, styles }: FeatureCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.featureCard, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
    >
      <View style={[styles.featureIcon, { backgroundColor: color + "18" }]}>
        {loading
          ? <ActivityIndicator size="small" color={color} />
          : <Ionicons name={icon} size={22} color={color} />}
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureLabel}>{label}</Text>
        <Text style={styles.featureSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { user } = useAuth();
  const loggedRole = (user?.role || "").toLowerCase();
  const isRootAdmin = ROOT_ROLES.includes(loggedRole);
  const isSuperOrRoot = isRootAdmin || SUPER_ROLES.includes(loggedRole);
  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 90;

  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiType, setAiType] = useState<string>("");

  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ["garage-plan"],
    queryFn: getGaragePlan,
    staleTime: 10 * 60 * 1000,
  });

  const features = planData?.features || ["reservations"];
  const hasAI = features.includes("ai_analytics");

  const handleAIAnalysis = async (type: string) => {
    setAiLoading(type);
    setAiResult(null);
    setAiType(type);
    try {
      const data = await adminAnalytics.getAdvanced();
      setAiResult(data);
    } catch (err: any) {
      setAiResult({ error: err?.message || "Erreur lors de l'analyse" });
    } finally {
      setAiLoading(null);
    }
  };

  const fp = { theme, styles };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={styles.headerTitle}>Outils</Text>
        {planData?.plan && planData.plan !== "free" ? (
          <View style={styles.planBadge}>
            <Ionicons name="diamond-outline" size={11} color={theme.primary} />
            <Text style={styles.planText}>{planData.plan.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {planLoading ? (
          <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.sectionLabel}>Gestion</Text>
            <FeatureCard {...fp}
              icon="calendar-outline"
              label="Rendez-vous"
              sub="Gérer et planifier les RDV clients"
              color="#22C55E"
              onPress={() => router.push("/(admin)/(tabs)/reservations" as any)}
            />
            <FeatureCard {...fp}
              icon="construct-outline"
              label="Services"
              sub="Prestations et tarifs du garage"
              color="#F59E0B"
              onPress={() => router.push("/(admin)/services-list" as any)}
            />
            {isSuperOrRoot && (
              <FeatureCard {...fp}
                icon="people-outline"
                label="Utilisateurs"
                sub="Gérer les comptes administrateurs"
                color="#06B6D4"
                onPress={() => router.push("/(admin)/users" as any)}
              />
            )}

            {hasAI && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Analyses IA</Text>
                <FeatureCard {...fp}
                  icon="analytics-outline"
                  label="Analyse globale"
                  sub="Vue d'ensemble de votre activité"
                  color="#F59E0B"
                  loading={aiLoading === "ai_global"}
                  onPress={() => handleAIAnalysis("ai_global")}
                />
                <FeatureCard {...fp}
                  icon="trending-up-outline"
                  label="Analyse commerciale"
                  sub="Performance et chiffre d'affaires"
                  color="#10B981"
                  loading={aiLoading === "ai_commercial"}
                  onPress={() => handleAIAnalysis("ai_commercial")}
                />
                <FeatureCard {...fp}
                  icon="rocket-outline"
                  label="Analyse croissance"
                  sub="Tendances et prévisions"
                  color="#EC4899"
                  loading={aiLoading === "ai_growth"}
                  onPress={() => handleAIAnalysis("ai_growth")}
                />
              </>
            )}

            {!hasAI && (
              <View style={styles.proBanner}>
                <View style={styles.proBannerIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.proTitle}>Analyses IA — Plan Pro</Text>
                  <Text style={styles.proSub}>Accédez aux analyses avancées en passant au plan Pro</Text>
                </View>
              </View>
            )}

            {isRootAdmin && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Administration</Text>
                <FeatureCard {...fp}
                  icon="terminal-outline"
                  label="Logs système"
                  sub="Erreurs, alertes et traces serveur"
                  color="#EF4444"
                  onPress={() => router.push("/(admin)/admin-logs" as any)}
                />
              </>
            )}

            {aiResult && !aiResult.error ? (
              <View style={styles.aiResultCard}>
                <View style={styles.aiResultHeader}>
                  <Ionicons name="sparkles" size={18} color={theme.primary} />
                  <Text style={styles.aiResultTitle}>
                    {aiType === "ai_global" ? "Analyse globale" : aiType === "ai_commercial" ? "Analyse commerciale" : "Analyse croissance"}
                  </Text>
                  <Pressable onPress={() => setAiResult(null)} style={{ marginLeft: "auto" }}>
                    <Ionicons name="close" size={18} color={theme.textTertiary} />
                  </Pressable>
                </View>
                <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
                  {aiResult.summary ? <Text style={styles.aiText}>{aiResult.summary}</Text> : null}
                  {aiResult.insights && Array.isArray(aiResult.insights) ? (
                    aiResult.insights.map((insight: string, i: number) => (
                      <Text key={i} style={styles.aiText}>• {insight}</Text>
                    ))
                  ) : null}
                  {typeof aiResult === "object" && !aiResult.summary && !aiResult.insights ? (
                    <Text style={styles.aiText}>{JSON.stringify(aiResult, null, 2)}</Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : aiResult?.error ? (
              <View style={[styles.aiResultCard, { borderColor: "#EF444440" }]}>
                <View style={styles.aiResultHeader}>
                  <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                  <Text style={[styles.aiResultTitle, { color: "#EF4444" }]}>Erreur</Text>
                  <Pressable onPress={() => setAiResult(null)} style={{ marginLeft: "auto" }}>
                    <Ionicons name="close" size={18} color={theme.textTertiary} />
                  </Pressable>
                </View>
                <Text style={[styles.aiText, { color: "#EF4444" }]}>{aiResult.error}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 28, fontFamily: "Exo2_800ExtraBold",
      color: theme.text, letterSpacing: 1,
    },
    planBadge: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: theme.primary + "18", paddingHorizontal: 10,
      paddingVertical: 5, borderRadius: 8,
    },
    planText: { fontSize: 11, fontFamily: "Exo2_700Bold", color: theme.primary },
    scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
    sectionLabel: {
      fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary,
      textTransform: "uppercase", letterSpacing: 1, marginBottom: 2, marginLeft: 2,
    },
    featureCard: {
      flexDirection: "row", alignItems: "center", gap: 14,
      backgroundColor: theme.surface, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: theme.border,
    },
    featureIcon: {
      width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center",
    },
    featureText: { flex: 1 },
    featureLabel: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
    featureSub: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 2 },
    proBanner: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: theme.surface, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: theme.border, marginTop: 4,
    },
    proBannerIcon: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: theme.border, justifyContent: "center", alignItems: "center",
    },
    proTitle: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.textSecondary },
    proSub: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary, marginTop: 2 },
    aiResultCard: {
      backgroundColor: theme.surface, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: theme.primary + "40", marginTop: 8,
    },
    aiResultHeader: {
      flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
    },
    aiResultTitle: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
    aiText: {
      fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary,
      lineHeight: 20, marginBottom: 4,
    },
  });
}
