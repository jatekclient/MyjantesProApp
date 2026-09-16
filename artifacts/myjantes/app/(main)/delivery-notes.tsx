import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl,
  Platform, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { deliveryNotesApi } from "@/lib/api";
import { viewDocumentPdf } from "@/lib/pdf-download";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

const BL_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: "En attente",  color: "#F59E0B", bg: "#F59E0B20" },
  en_attente:  { label: "En attente",  color: "#F59E0B", bg: "#F59E0B20" },
  validated:   { label: "Validé",      color: "#22C55E", bg: "#22C55E20" },
  validé:      { label: "Validé",      color: "#22C55E", bg: "#22C55E20" },
  delivered:   { label: "Livré",       color: "#3B82F6", bg: "#3B82F620" },
  livré:       { label: "Livré",       color: "#3B82F6", bg: "#3B82F620" },
  cancelled:   { label: "Annulé",      color: "#9CA3AF", bg: "#9CA3AF20" },
  annulé:      { label: "Annulé",      color: "#9CA3AF", bg: "#9CA3AF20" },
  draft:       { label: "Brouillon",   color: "#A78BFA", bg: "#A78BFA20" },
};

function getStatusInfo(status: string) {
  const key = (status || "").toLowerCase().replace(/[éèê]/g, "e");
  return BL_STATUS_MAP[key] || BL_STATUS_MAP[(status || "").toLowerCase()]
    || { label: status || "Inconnu", color: "#9CA3AF", bg: "#9CA3AF20" };
}

interface DeliveryNote {
  id: string;
  number?: string;
  reference?: string;
  blNumber?: string;
  date?: string;
  createdAt?: string;
  status?: string;
  amount?: number | string;
  totalTTC?: string;
  total_ttc?: string;
  bl_number?: string;
  created_at?: string;
  pdfUrl?: string;
  pdf_url?: string;
  notes?: string;
}

function BLCard({ item, theme, styles }: { item: DeliveryNote; theme: any; styles: any }) {
  const statusInfo = getStatusInfo(item.status || "");
  const ref = item.blNumber || item.bl_number || item.number || item.reference || item.id;
  const dateStr = item.date || item.createdAt || item.created_at;
  const formattedDate = dateStr
    ? new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—";
  const amount = parseFloat(String(item.amount || item.totalTTC || item.total_ttc || "0")) || null;
  const pdfUrl = item.pdfUrl || item.pdf_url;

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardRef}>BL {ref}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>
        <Text style={styles.cardDate}>{formattedDate}</Text>
        {item.notes ? (
          <Text style={styles.cardNotes} numberOfLines={1}>{item.notes}</Text>
        ) : null}
        <View style={styles.cardBottom}>
          {amount && amount > 0 ? (
            <Text style={styles.cardAmount}>
              {amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
            </Text>
          ) : <View />}
          {pdfUrl ? (
            <Pressable
              style={({ pressed }) => [styles.pdfBtn, pressed && { opacity: 0.7 }]}
              onPress={() => void viewDocumentPdf(
                pdfUrl,
                `bon-livraison-${ref}.pdf`,
              )}
            >
              <Ionicons name="document-outline" size={14} color={theme.primary} />
              <Text style={styles.pdfBtnText}>PDF</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function DeliveryNotesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [refreshing, setRefreshing] = useState(false);

  const { data: rawData, isLoading, isError, refetch, error } = useQuery({
    queryKey: ["delivery-notes"],
    queryFn: deliveryNotesApi.getAll,
    retry: 1,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Normalize response — backend may return { available, data } or a direct array
  const available = (rawData as any)?.available !== false;
  const notes: DeliveryNote[] = useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    const nested = (rawData as any)?.data || (rawData as any)?.items || (rawData as any)?.bon_livraisons || [];
    return Array.isArray(nested) ? nested : [];
  }, [rawData]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 10 : insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Bons de livraison</Text>
          {!isLoading && available && notes.length > 0 && (
            <Text style={styles.headerSub}>{notes.length} document{notes.length > 1 ? "s" : ""}</Text>
          )}
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => refetch()}>
          <Ionicons name="refresh-outline" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
        <Text style={styles.infoBannerText}>
          Bons de livraison de vos prestations. Téléchargez les PDFs pour votre comptabilité.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Chargement des bons de livraison…</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={52} color={theme.textTertiary} />
          <Text style={styles.errorTitle}>Données indisponibles</Text>
          <Text style={styles.errorSub}>Impossible de charger les bons de livraison.</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : !available ? (
        <View style={styles.center}>
          <Ionicons name="documents-outline" size={52} color={theme.textTertiary} />
          <Text style={styles.errorTitle}>Service non disponible</Text>
          <Text style={styles.errorSub}>
            Les bons de livraison ne sont pas encore disponibles pour votre compte.{"\n"}
            Contactez votre interlocuteur MyJantes.
          </Text>
        </View>
      ) : notes.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-outline" size={52} color={theme.textTertiary} />
          <Text style={styles.errorTitle}>Aucun bon de livraison</Text>
          <Text style={styles.errorSub}>
            Vos bons de livraison apparaîtront ici une fois vos prestations validées.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BLCard item={item} theme={theme} styles={styles} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Platform.OS === "web" ? 34 + 40 : insets.bottom + 40 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.surfaceSecondary, justifyContent: "center", alignItems: "center",
  },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.surfaceSecondary, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Exo2_800ExtraBold", color: theme.text, letterSpacing: 0.4 },
  headerSub: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 1 },
  infoBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#3B82F610", borderBottomWidth: 1, borderBottomColor: "#3B82F620",
    paddingHorizontal: 16, paddingVertical: 10,
  },
  infoBannerText: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, flex: 1, lineHeight: 18 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 32 },
  loadingText: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textTertiary, marginTop: 8 },
  errorTitle: { fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.textSecondary, textAlign: "center" },
  errorSub: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textTertiary, textAlign: "center", lineHeight: 20 },
  retryBtn: {
    marginTop: 8, backgroundColor: theme.primary, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  retryBtnText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  card: {
    flexDirection: "row", backgroundColor: theme.surface,
    borderRadius: 14, borderWidth: 1, borderColor: theme.border,
    marginBottom: 10, overflow: "hidden",
  },
  cardLeft: { width: 4 },
  statusDot: { flex: 1 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  cardRef: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: "Exo2_500Medium" },
  cardDate: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginBottom: 2 },
  cardNotes: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary, marginBottom: 4 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  cardAmount: { fontSize: 15, fontFamily: "Exo2_700Bold", color: theme.text },
  pdfBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: theme.primary + "15", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  pdfBtnText: { fontSize: 12, fontFamily: "Exo2_600SemiBold", color: theme.primary },
});
