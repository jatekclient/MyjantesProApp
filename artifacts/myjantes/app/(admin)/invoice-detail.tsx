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
import { adminInvoices, adminClients, getAdminAccessToken } from "@/lib/admin-api";
import { getSessionCookie } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { viewPdf } from "@/lib/pdf-download";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", paid: "Payée", cancelled: "Annulée",
  overdue: "En retard", sent: "Envoyée", draft: "Brouillon",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", paid: "#22C55E", cancelled: "#EF4444",
  overdue: "#EF4444", sent: "#8B5CF6", draft: "#6B7280",
};

const PAYMENT_METHODS: Record<string, string> = {
  wire_transfer: "Virement bancaire",
  credit_card: "Carte de crédit",
  bank_transfer: "Virement",
  check: "Chèque",
  cash: "Espèces",
  debit_card: "Carte de débit",
};

function resolveClient(inv: any, clientMap: Record<string, any>): { name: string; email: string; phone: string } {
  const c = inv?.client || (inv?.clientId && clientMap[String(inv.clientId)]) || null;
  let name = "";
  if (c?.firstName || c?.lastName) name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
  else if (c?.name) name = c.name;
  else if (inv?.clientFirstName || inv?.clientLastName) name = `${inv.clientFirstName || ""} ${inv.clientLastName || ""}`.trim();
  else if (inv?.clientName) name = inv.clientName;
  const email = c?.email || inv?.clientEmail || "";
  const phone = c?.phone || c?.phoneNumber || inv?.clientPhone || "";
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

export default function InvoiceDetailScreen() {
  const params = useLocalSearchParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : (typeof rawId === "string" ? rawId : "");
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { showAlert, AlertComponent } = useCustomAlert();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data: inv, isLoading, error } = useQuery({
    queryKey: ["admin-invoice", id],
    queryFn: () => adminInvoices.getById(id),
    enabled: !!id,
    retry: 1,
  });

  const { data: fetchedItems = [] } = useQuery({
    queryKey: ["admin-invoice-items", id],
    queryFn: () => adminInvoices.getItems(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });

  const { data: fetchedMedia = [] } = useQuery({
    queryKey: ["admin-invoice-media", id],
    queryFn: () => adminInvoices.getMedia(id),
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
    mutationFn: ({ status }: { status: string }) => adminInvoices.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (error || !inv) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", gap: 16 }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={{ fontSize: 15, color: theme.text, textAlign: "center", paddingHorizontal: 32 }}>
          Impossible de charger cette facture.
        </Text>
        <Pressable style={styles.backChip} onPress={() => router.back()}>
          <Text style={{ color: theme.primary, fontFamily: "Exo2_600SemiBold" }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const statusKey = (inv.status || "").toLowerCase();
  const statusColor = STATUS_COLORS[statusKey] || theme.textTertiary;
  const statusLabel = STATUS_LABELS[statusKey] || inv.status;

  const embeddedItems: any[] = inv.items || inv.lineItems || inv.lines || inv.invoice_lines || [];
  const items: any[] = embeddedItems.length > 0 ? embeddedItems : (Array.isArray(fetchedItems) ? fetchedItems : []);

  const computedTotals = items.reduce((acc: { ht: number; ttc: number }, it: any) => {
    const price = parseFloat(String(
      it.unit_price ??
      it.unit_price_excluding_tax ??
      it.unitPrice ?? 
      it.price ?? 
      it.unitPriceExcludingTax ?? 
      it.priceExcludingTax ?? 
      0
    )) || 0;
    const qty = parseFloat(String(it.quantity ?? 1)) || 1;
    const tax = parseFloat(String(it.tax_rate ?? it.taxRate ?? it.tvaRate ?? 0)) || 0;
    
    const lineHT = it.total_excluding_tax ?? it.totalExcludingTax ?? (qty * price);
    let lineTTC = it.total_including_tax ?? it.totalIncludingTax ?? it.totalPrice ?? it.total ?? null;
    if (!lineTTC) {
      lineTTC = qty * price * (1 + tax / 100);
    }
    
    return { ht: acc.ht + (parseFloat(String(lineHT)) || 0), ttc: acc.ttc + (parseFloat(String(lineTTC)) || 0) };
  }, { ht: 0, ttc: 0 });

  const rawTotalHT = inv.total_excluding_tax || inv.priceExcludingTax || inv.totalHT || inv.totalExcludingTax || inv.subtotal;
  const rawTotalTTC = inv.total_including_tax || inv.amount || inv.totalTTC || inv.total || inv.totalIncludingTax;
  const totalHT = parseFloat(String(rawTotalHT)) || computedTotals.ht;
  const totalTVA_raw = inv.taxAmount || inv.vat_amount || inv.tvaAmount || inv.taxTotal;
  const totalTTC = parseFloat(String(rawTotalTTC)) || computedTotals.ttc;
  const totalTVA = parseFloat(String(totalTVA_raw)) || (totalTTC - totalHT);
  const { name, email, phone } = resolveClient(inv, clientMap);
  const fetchedPhotoUrls: string[] = Array.isArray(fetchedMedia)
    ? fetchedMedia.map((item: any) => item?.url || item?.fileUrl || item?.uri || item?.path || item?.mediaUrl).filter(Boolean)
    : [];
  const embeddedPhotoUrls: string[] = inv.requestDetails?.mediaUrls || inv.photos || inv.mediaUrls || [];
  const photos: string[] = fetchedPhotoUrls.length > 0 ? fetchedPhotoUrls : embeddedPhotoUrls;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {inv.invoiceNumber || inv.reference || "Facture"}
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
          {name ? <Text style={styles.valueMain}>{name}</Text> : null}
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
          {!name && !email && !phone && (
            <Text style={styles.valueSub}>—</Text>
          )}
        </View>

        {/* Informations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          {inv.invoiceNumber || inv.reference ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Numéro</Text>
              <Text style={styles.value}>{inv.invoiceNumber || inv.reference}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Date d'émission</Text>
            <Text style={styles.value}>{fmtDate(inv.createdAt || inv.issuedAt)}</Text>
          </View>
          {inv.dueDate ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Échéance</Text>
              <Text style={styles.value}>{fmtDate(inv.dueDate)}</Text>
            </View>
          ) : null}
          {inv.paidAt ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Payée le</Text>
              <Text style={styles.value}>{fmtDate(inv.paidAt)}</Text>
            </View>
          ) : null}
          {inv.paymentMethod ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Mode de paiement</Text>
              <Text style={styles.value}>{PAYMENT_METHODS[inv.paymentMethod] || inv.paymentMethod}</Text>
            </View>
          ) : null}
        </View>

        {/* Description / Notes */}
        {inv.description || inv.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description / Notes</Text>
            {inv.description ? <Text style={styles.prose}>{inv.description}</Text> : null}
            {inv.notes && inv.notes !== inv.description ? <Text style={styles.prose}>{inv.notes}</Text> : null}
          </View>
        ) : null}

        {/* Line Items */}
        {items.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prestations</Text>
            {items.map((it: any, i: number) => {
              const qty = it.quantity ?? 1;
              const unitHT = it.unit_price_excluding_tax ?? it.unit_price ?? it.unitPriceExcludingTax ?? it.unitPrice ?? it.price ?? 0;
              const tva = it.tax_rate ?? it.taxRate ?? it.tvaRate ?? 0;
              const lineTotal = it.total_including_tax ?? it.totalIncludingTax ?? it.totalPrice ?? (parseFloat(String(unitHT)) * parseFloat(String(qty)) * (1 + parseFloat(String(tva)) / 100));
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
        {(totalHT || totalTTC) ? (
          <View style={[styles.section, { gap: 6 }]}>
            <Text style={styles.sectionTitle}>Totaux</Text>
            {totalHT ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total HT</Text>
                <Text style={styles.totalValue}>{fmtEur(totalHT)}</Text>
              </View>
            ) : null}
            {totalTVA ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TVA</Text>
                <Text style={styles.totalValue}>{fmtEur(totalTVA)}</Text>
              </View>
            ) : null}
            {totalTTC ? (
              <View style={[styles.totalRow, styles.totalRowMain]}>
                <Text style={[styles.totalLabel, { fontFamily: "Exo2_700Bold", color: theme.text }]}>Total TTC</Text>
                <Text style={[styles.totalValue, { fontFamily: "Exo2_700Bold", fontSize: 18, color: theme.primary }]}>{fmtEur(totalTTC)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

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

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          {statusKey !== "paid" && statusKey !== "cancelled" ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: theme.primary, marginBottom: 8 }]}
              onPress={() => router.push({ pathname: "/(admin)/invoice-create", params: { editId: id } } as any)}
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
              <Text style={[styles.actionBtnText, { color: "#fff" }]}>Modifier la facture</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.actionBtn, { borderColor: theme.primary + "50", opacity: downloadingPdf ? 0.6 : 1 }]}
            disabled={downloadingPdf}
            onPress={async () => {
              setDownloadingPdf(true);
              try {
                const ref = inv?.invoiceNumber || inv?.reference || id;
                const vt = inv?.viewToken || inv?.pdfToken || inv?.token || inv?.publicToken || inv?.shareToken || inv?.publicId;
                await viewPdf("invoices", id, `facture-${ref}.pdf`, vt);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (err: any) {
                showAlert({
                  type: "error",
                  title: "Erreur",
                  message: err?.message || "Impossible d'ouvrir le PDF.",
                  buttons: [{ text: "OK", style: "primary" }],
                });
              } finally {
                setDownloadingPdf(false);
              }
            }}
          >
            {downloadingPdf
              ? <ActivityIndicator size="small" color={theme.primary} />
              : <Ionicons name="eye-outline" size={18} color={theme.primary} />
            }
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>{downloadingPdf ? "Chargement…" : "Visualiser le PDF"}</Text>
          </Pressable>
        </View>

        {/* Status Actions */}
        {statusKey !== "paid" && (
          <View style={[styles.section, { gap: 8 }]}>
            <Text style={styles.sectionTitle}>Modifier le statut</Text>
            <Pressable
              style={[styles.actionBtn, statusKey === "pending" && { backgroundColor: theme.primary + "20" }]}
              onPress={() => showAlert({
                type: "warning",
                title: "Marquer payée",
                message: "Confirmer le paiement de cette facture ?",
                buttons: [
                  { text: "Annuler" },
                  { text: "Marquer payée", style: "primary", onPress: () => statusMutation.mutate({ status: "paid" }) },
                ],
              })}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.success} />
              <Text style={[styles.actionBtnText, { color: theme.success }]}>Marquer comme payée</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, statusKey === "cancelled" && { backgroundColor: theme.error + "20" }]}
              onPress={() => showAlert({
                type: "warning",
                title: "Annuler cette facture",
                message: "Cette action est irréversible.",
                buttons: [
                  { text: "Annuler" },
                  { text: "Annuler la facture", style: "primary", onPress: () => statusMutation.mutate({ status: "cancelled" }) },
                ],
              })}
            >
              <Ionicons name="close-circle-outline" size={18} color={theme.error} />
              <Text style={[styles.actionBtnText, { color: theme.error }]}>Annuler la facture</Text>
            </Pressable>
          </View>
        )}
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
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
  actionBtnText: { fontSize: 14, fontFamily: "Exo2_600SemiBold" },
  photo: { width: 100, height: 100, borderRadius: 10, marginRight: 8 },
});
