import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminQuotes, adminClients, getAdminAccessToken } from "@/lib/admin-api";
import { getSessionCookie } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { viewPdf } from "@/lib/pdf-download";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", approved: "Approuvé", rejected: "Rejeté",
  converted: "Converti", accepted: "Accepté", sent: "Envoyé", cancelled: "Annulé",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", approved: "#22C55E", rejected: "#EF4444",
  converted: "#3B82F6", accepted: "#22C55E", sent: "#8B5CF6", cancelled: "#6B7280",
};

function resolveClientFromMap(q: any, clientMap: Record<string, any>) {
  const c = q?.client || (q?.clientId && clientMap[String(q.clientId)]) || null;
  let name = "";
  if (c?.firstName || c?.lastName) name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
  else if (c?.name) name = c.name;
  else if (q?.clientFirstName || q?.clientLastName) name = `${q.clientFirstName || ""} ${q.clientLastName || ""}`.trim();
  else if (q?.clientName) name = q.clientName;
  const email = c?.email || q?.clientEmail || "";
  const phone = c?.phone || c?.phoneNumber || q?.clientPhone || "";
  return { name, email, phone };
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtEur(val: any): string {
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function QuoteDetailScreen() {
  const params = useLocalSearchParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : (typeof rawId === "string" ? rawId : "");
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { showAlert, AlertComponent } = useCustomAlert();
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: q, isLoading, error } = useQuery({
    queryKey: ["admin-quote", id],
    queryFn: () => adminQuotes.getById(id),
    enabled: !!id,
    retry: 1,
  });

  const { data: fetchedItems = [] } = useQuery({
    queryKey: ["admin-quote-items", id],
    queryFn: () => adminQuotes.getItems(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });

  const { data: fetchedMedia = [] } = useQuery({
    queryKey: ["admin-quote-media", id],
    queryFn: () => adminQuotes.getMedia(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: adminClients.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const clientMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const c of (Array.isArray(clients) ? clients : [])) {
      if (c?.id) map[String(c.id)] = c;
    }
    return map;
  }, [clients]);

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: string }) => adminQuotes.updateStatus(id, status),
    onSuccess: (_, vars) => {
      queryClient.setQueryData(["admin-quote", id], (old: any) => old ? { ...old, status: vars.status } : old);
      queryClient.setQueryData<any[]>(["admin-quotes"], (old = []) =>
        old.map(item => item.id === id ? { ...item, status: vars.status } : item)
      );
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => adminQuotes.convertToInvoice(id),
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-quote", id], (old: any) => old ? { ...old, status: "converted" } : old);
      queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const invoiceId = data?.invoice?.id || data?.id || null;
      showAlert({
        type: "success",
        title: "Facture créée",
        message: "Le devis a été converti en facture avec succès.",
        buttons: [
          invoiceId ? {
            text: "Voir la facture",
            style: "primary",
            onPress: () => router.push({ pathname: "/(admin)/invoice-detail", params: { id: String(invoiceId) } } as any),
          } : { text: "OK" },
        ],
      });
    },
    onError: (err: any) => {
      showAlert({
        type: "error",
        title: "Erreur",
        message: err?.message || "Impossible de convertir le devis en facture.",
        buttons: [{ text: "OK" }],
      });
    },
  });

  const handleConvertToInvoice = () => {
    showAlert({
      type: "warning",
      title: "Convertir en facture",
      message: "Créer une facture à partir de ce devis ?",
      buttons: [
        { text: "Annuler" },
        {
          text: "Convertir",
          style: "primary",
          onPress: () => convertMutation.mutate(),
        },
      ],
    });
  };

  const handleCreateReservation = () => {
    showAlert({
      type: "warning",
      title: "Créer un rendez-vous",
      message: "Créer un rendez-vous depuis ce devis ?",
      buttons: [
        { text: "Annuler" },
        {
          text: "Continuer",
          style: "primary",
          onPress: () => router.push({
            pathname: "/(admin)/reservation-create",
            params: { clientId: q?.clientId, quoteId: id, quoteName: q?.quoteNumber || q?.reference || "" },
          } as any),
        },
      ],
    });
  };

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  const handleCancel = () => {
    showAlert({
      type: "warning",
      title: "Annuler ce devis ?",
      message: "Le devis sera marqué comme annulé.",
      buttons: [
        { text: "Non" },
        { text: "Annuler le devis", style: "primary", onPress: () => statusMutation.mutate({ status: "cancelled" }) },
      ],
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (error || !q) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", gap: 16 }]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
        <Text style={{ fontSize: 15, color: theme.text, textAlign: "center", paddingHorizontal: 32 }}>
          Impossible de charger ce devis.
        </Text>
        <Pressable style={[styles.backChip]} onPress={() => router.back()}>
          <Text style={{ color: theme.primary, fontFamily: "Exo2_600SemiBold" }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const statusKey = (q.status || "").toLowerCase();
  const statusColor = STATUS_COLORS[statusKey] || theme.textTertiary;
  const statusLabel = STATUS_LABELS[statusKey] || q.status;

  const { name, email, phone } = resolveClientFromMap(q, clientMap);

  const embeddedItems: any[] = q.items || q.lineItems || q.lines || q.quote_items || [];
  const items: any[] = embeddedItems.length > 0 ? embeddedItems : (Array.isArray(fetchedItems) ? fetchedItems : []);

  const computedTotals = items.reduce((acc: { ht: number; ttc: number }, it: any) => {
    const price = parseFloat(String(
      it.unit_price ??
      it.unit_price_excluding_tax ??
      it.unitPrice ?? 
      it.price ?? 
      it.unitPriceExcludingTax ?? 
      it.priceExcludingTax ?? 
      it.basePrice ?? 
      it.hourlyRate ?? 
      0
    )) || 0;
    const qty = parseFloat(String(it.quantity ?? 1)) || 1;
    const tax = parseFloat(String(it.tax_rate ?? it.taxRate ?? it.tvaRate ?? it.taxAmount ?? 0)) || 0;
    
    const lineHT = it.total_excluding_tax ?? it.totalExcludingTax ?? (qty * price);
    let lineTTC = it.total_including_tax ?? it.totalIncludingTax ?? it.totalPrice ?? it.total ?? null;
    if (!lineTTC) {
      lineTTC = qty * price * (1 + tax / 100);
    }
    
    return { ht: acc.ht + (parseFloat(String(lineHT)) || 0), ttc: acc.ttc + (parseFloat(String(lineTTC)) || 0) };
  }, { ht: 0, ttc: 0 });

  const rawTotalHT = q.total_excluding_tax || q.priceExcludingTax || q.totalHT || q.totalExcludingTax || q.subtotal || q.pricingTotals?.totalHT;
  const rawTotalTTC = q.total_including_tax || q.quoteAmount || q.totalTTC || q.total || q.totalIncludingTax || q.amount || q.totalAmount || q.pricingTotals?.totalTTC;

  const totalHT = parseFloat(String(rawTotalHT)) || computedTotals.ht;
  const totalTTC = parseFloat(String(rawTotalTTC)) || computedTotals.ttc;
  const rawTotalTVA = q.taxAmount || q.tvaAmount || q.taxTotal || q.pricingTotals?.totalTVA;
  const totalTVA = parseFloat(String(rawTotalTVA)) || (totalTTC - totalHT);
  // Resolve photos: prefer fetched media, then embedded fields
  const fetchedMediaUrls: string[] = Array.isArray(fetchedMedia)
    ? fetchedMedia.map((m: any) => m.url || m.fileUrl || m.uri || m.path || m.mediaUrl).filter(Boolean)
    : [];
  const embeddedMediaUrls: string[] = q.requestDetails?.mediaUrls || q.photos || q.mediaUrls || [];
  const photos: string[] = fetchedMediaUrls.length > 0 ? fetchedMediaUrls : embeddedMediaUrls;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {q.quoteNumber || q.reference || "Devis"}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Client */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          {name ? <Text style={styles.valueMain}>{name}</Text> : <Text style={styles.valueSub}>—</Text>}
          {email ? (
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={15} color={theme.textTertiary} />
              <Text style={styles.valueSub}>{email}</Text>
            </View>
          ) : null}
          {phone ? (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={15} color={theme.textTertiary} />
              <Text style={styles.valueSub}>{phone}</Text>
            </View>
          ) : null}
        </View>

        {/* Informations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          {q.quoteNumber || q.reference ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Référence</Text>
              <Text style={[styles.value, { color: theme.primary }]}>{q.quoteNumber || q.reference}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Date de création</Text>
            <Text style={styles.value}>{fmtDate(q.createdAt)}</Text>
          </View>
          {q.expiryDate || q.validUntil ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Validité</Text>
              <Text style={styles.value}>{fmtDate(q.expiryDate || q.validUntil)}</Text>
            </View>
          ) : null}
          {(q.vehicleInfo?.brand || q.vehicleInfo?.model || q.vehicleInfo?.plate) ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Véhicule</Text>
              <Text style={styles.value}>
                {[q.vehicleInfo?.brand, q.vehicleInfo?.model, q.vehicleInfo?.plate].filter(Boolean).join(" · ")}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Description / Notes */}
        {q.description || q.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description / Notes</Text>
            {q.description ? <Text style={styles.prose}>{q.description}</Text> : null}
            {q.notes && q.notes !== q.description ? <Text style={styles.prose}>{q.notes}</Text> : null}
          </View>
        ) : null}

        {/* Line Items */}
        {items.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prestations ({items.length})</Text>
            {items.map((it: any, i: number) => {
              const qty = it.quantity ?? 1;
              const unitHT = it.unit_price_excluding_tax ?? it.unit_price ?? it.unitPriceExcludingTax ?? it.unitPrice ?? it.price ?? it.basePrice ?? it.hourlyRate ?? 0;
              const tva = it.tax_rate ?? it.taxRate ?? it.tvaRate ?? 0;
              const lineTotal = it.total_including_tax ?? it.totalIncludingTax ?? it.totalPrice ?? it.total ?? (parseFloat(String(unitHT)) * parseFloat(String(qty)) * (1 + parseFloat(String(tva)) / 100));
              return (
                <View key={i} style={[styles.lineItem, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <Text style={styles.lineDesc}>{it.description || it.name || `Ligne ${i + 1}`}</Text>
                  <View style={styles.lineRow}>
                    <Text style={styles.lineDetail}>{qty} × {fmtEur(unitHT)} HT</Text>
                    {parseFloat(String(tva)) > 0 ? (
                      <Text style={styles.lineDetail}>TVA {tva}%</Text>
                    ) : null}
                    <Text style={styles.lineTotal}>{fmtEur(lineTotal)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Totaux */}
        <View style={[styles.section, { gap: 6 }]}>
          <Text style={styles.sectionTitle}>Totaux</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{fmtEur(totalHT)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA</Text>
            <Text style={styles.totalValue}>{fmtEur(totalTVA)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowMain]}>
            <Text style={[styles.totalLabel, { fontFamily: "Exo2_700Bold", color: theme.text }]}>Total TTC</Text>
            <Text style={[styles.totalValue, { fontFamily: "Exo2_700Bold", fontSize: 18, color: theme.primary }]}>{fmtEur(totalTTC)}</Text>
          </View>
        </View>

        {/* Photos */}
        {photos.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              {photos.map((uri: string, i: number) => (
                <Image
                  key={i}
                  source={{
                    uri,
                    headers: {
                      ...(getAdminAccessToken() ? { Authorization: `Bearer ${getAdminAccessToken()}` } : {}),
                      ...(getSessionCookie() ? { Cookie: getSessionCookie() as string } : {}),
                    },
                  }}
                  style={styles.photo}
                  contentFit="cover"
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Status Actions */}
        {statusKey !== "cancelled" && statusKey !== "converted" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Modifier le statut</Text>
            <View style={styles.statusActions}>
              {statusKey !== "pending" && (
                <Pressable style={[styles.statusBtn, { borderColor: "#F59E0B" }]} onPress={() => statusMutation.mutate({ status: "pending" })}>
                  <Ionicons name="time-outline" size={16} color="#F59E0B" />
                  <Text style={[styles.statusBtnText, { color: "#F59E0B" }]}>En attente</Text>
                </Pressable>
              )}
              {statusKey !== "approved" && statusKey !== "accepted" && (
                <Pressable style={[styles.statusBtn, { borderColor: "#22C55E" }]} onPress={() => statusMutation.mutate({ status: "approved" })}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#22C55E" />
                  <Text style={[styles.statusBtnText, { color: "#22C55E" }]}>Approuver</Text>
                </Pressable>
              )}
              {statusKey !== "rejected" && (
                <Pressable style={[styles.statusBtn, { borderColor: "#EF4444" }]} onPress={() => statusMutation.mutate({ status: "rejected" })}>
                  <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                  <Text style={[styles.statusBtnText, { color: "#EF4444" }]}>Rejeter</Text>
                </Pressable>
              )}
              <Pressable style={[styles.statusBtn, { borderColor: "#6B7280" }]} onPress={handleCancel}>
                <Ionicons name="ban-outline" size={16} color="#6B7280" />
                <Text style={[styles.statusBtnText, { color: "#6B7280" }]}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        ) : null}


        {/* Actions */}
        {statusKey !== "cancelled" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            {statusKey !== "converted" && statusKey !== "completed" && statusKey !== "paid" ? (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: theme.primary, marginBottom: 8 }]}
                onPress={() => router.push({ pathname: "/(admin)/quote-create", params: { editId: id } } as any)}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Modifier le devis</Text>
              </Pressable>
            ) : null}
            {statusKey !== "converted" ? (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: "#2563EB", marginBottom: 8, opacity: convertMutation.isPending ? 0.6 : 1 }]}
                onPress={handleConvertToInvoice}
                disabled={convertMutation.isPending}
              >
                {convertMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="document-text-outline" size={18} color="#fff" />
                }
                <Text style={styles.actionBtnText}>Générer une facture</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.actionBtn, { backgroundColor: "#8B5CF6" }]}
              onPress={handleCreateReservation}
            >
              <Ionicons name="calendar-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Créer un rendez-vous</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtnSecondary, { marginTop: 4, opacity: pdfLoading ? 0.6 : 1 }]}
              disabled={pdfLoading}
              onPress={async () => {
                setPdfLoading(true);
                try {
                  const ref = q?.quoteNumber || q?.reference || id;
                  const vt = q?.viewToken || q?.pdfToken || q?.token || q?.publicToken || q?.shareToken || q?.publicId;
                  await viewPdf("quotes", id, `devis-${ref}.pdf`, vt);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (err: any) {
                  showAlert({
                    type: "error",
                    title: "Erreur",
                    message: err?.message || "Impossible d'ouvrir le PDF.",
                    buttons: [{ text: "OK", style: "primary" }],
                  });
                } finally {
                  setPdfLoading(false);
                }
              }}
            >
              {pdfLoading
                ? <ActivityIndicator size="small" color={theme.primary} />
                : <Ionicons name="eye-outline" size={18} color={theme.primary} />
              }
              <Text style={styles.actionBtnSecondaryText}>{pdfLoading ? "Chargement…" : "Visualiser le PDF"}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      {AlertComponent}
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
  backChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.primary },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 12, fontFamily: "Exo2_600SemiBold" },
  section: {
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1,
    borderColor: theme.border, padding: 14, gap: 8,
  },
  sectionTitle: { fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  valueMain: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text },
  valueSub: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary, flex: 1 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textTertiary, width: 110 },
  value: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.text, flex: 1 },
  prose: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text, lineHeight: 20 },
  lineItem: { paddingVertical: 8, gap: 4 },
  lineDesc: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.text },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  lineDetail: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  lineTotal: { fontSize: 13, fontFamily: "Exo2_600SemiBold", color: theme.text, marginLeft: "auto" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalRowMain: { paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border, marginTop: 4 },
  totalLabel: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.textSecondary },
  totalValue: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
  photo: { width: 120, height: 90, borderRadius: 10, marginRight: 8 },
  statusActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  statusBtnText: { fontSize: 13, fontFamily: "Exo2_500Medium" },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12, paddingVertical: 13 },
  actionBtnText: { fontSize: 13, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  actionBtnSecondary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12, paddingVertical: 11, borderWidth: 1, borderColor: theme.primary + "50" },
  actionBtnSecondaryText: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.primary },
});
