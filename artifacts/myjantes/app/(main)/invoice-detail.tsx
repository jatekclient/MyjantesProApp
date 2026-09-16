import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { invoicesApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { viewPdf } from "@/lib/pdf-download";



function getInvoiceStatusInfo(status: string, isDark: boolean) {
  const s = status?.toLowerCase() || "";
  if (s === "paid" || s === "payée" || s === "payé")
    return { label: "Payée", color: "#22C55E", bg: isDark ? "rgba(34,197,94,0.15)" : "#DCFCE7", icon: "checkmark-circle-outline" as const };
  if (s === "pending" || s === "en_attente")
    return { label: "En attente", color: "#F59E0B", bg: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7", icon: "time-outline" as const };
  if (s === "overdue" || s === "en_retard")
    return { label: "En retard", color: "#F87171", bg: isDark ? "rgba(239,68,68,0.15)" : "#FEE2E2", icon: "alert-circle-outline" as const };
  if (s === "sent" || s === "envoyée" || s === "envoyee")
    return { label: "Envoyée", color: "#3B82F6", bg: isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE", icon: "send-outline" as const };
  if (s === "cancelled" || s === "annulée" || s === "annulee")
    return { label: "Annulée", color: isDark ? "#888" : "#666", bg: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", icon: "close-circle-outline" as const };
  if (s === "draft" || s === "brouillon")
    return { label: "Brouillon", color: isDark ? "#888" : "#666", bg: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", icon: "create-outline" as const };
  return { label: status || "Inconnu", color: isDark ? "#888" : "#666", bg: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", icon: "help-outline" as const };
}

function parseItems(items: any): any[] {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (typeof items === "string") {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

function InfoRow({ icon, label, value, theme, styles }: { icon: string; label: string; value: string; theme: ThemeColors; styles: any }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabel}>
        <Ionicons name={icon as any} size={16} color={theme.textSecondary} />
        <Text style={styles.infoLabelText}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function InvoiceDetailScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showAlert, AlertComponent } = useCustomAlert();
  const [downloading, setDownloading] = React.useState(false);
  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      try {
        const detail = await invoicesApi.getById(id!);
        if (detail && (detail.id || (detail as any)._id)) return detail;
      } catch {}
      try {
        const all = await invoicesApi.getAll();
        const list = Array.isArray(all) ? all : [];
        const found = list.find((inv: any) => String(inv.id || inv._id) === id);
        if (found) return found;
      } catch {}
      return null;
    },
    enabled: !!id,
    retry: 1,
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.textTertiary} />
        <Text style={styles.errorText}>Facture introuvable</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const statusInfo = getInvoiceStatusInfo(invoice.status, theme.isDark);
  const _cd = invoice.createdAt ? new Date(invoice.createdAt) : null;
  const createdDate = (_cd && isFinite(_cd.getTime()))
    ? _cd.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  const inv_any = invoice as any;
  let rawItems = inv_any.items || inv_any.lineItems || inv_any.line_items || inv_any.lignes || inv_any.lines || inv_any.prestations || inv_any.invoiceLines || inv_any.invoice_lines || inv_any.details || inv_any.rows || inv_any.prestations_lignes || inv_any.items_details || inv_any.products || inv_any.entries || inv_any.services || null;
  if (!rawItems) {
    for (const key of Object.keys(inv_any)) {
      const val = inv_any[key];
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object" && val[0] !== null) {
        const sample = val[0];
        if (sample.description || sample.name || sample.label || sample.unitPrice || sample.price || sample.quantity || sample.total) {
          rawItems = val;
          break;
        }
      }
    }
  }
  const invoiceItems = parseItems(rawItems);
  const viewToken = ((invoice as any).viewToken || (invoice as any).pdfToken || (invoice as any).token || (invoice as any).publicToken || (invoice as any).shareToken || (invoice as any).accessToken || (invoice as any).publicId) as string | undefined;
  const displayRef = invoice.invoiceNumber || invoice.id;
  const clientInfo = (invoice as any).client || null;
  const quoteRef = (invoice as any).quoteNumber || (invoice as any).quoteReference || null;

  const inv = invoice as any;
  const totalHTRaw =
    invoice.totalHT ||
    inv.total_ht ||
    inv.totalExcludingTax ||
    inv.total_excluding_tax ||
    inv.amountHT ||
    inv.amount_ht ||
    inv.amountExcludingTax ||
    inv.amount_excluding_tax ||
    inv.montantHT ||
    inv.montant_ht ||
    inv.subtotal ||
    inv.sub_total ||
    inv.priceExcludingTax ||
    inv.price_excluding_tax ||
    "0";
  const totalHTNum = parseFloat(totalHTRaw) || 0;

  const tvaAmountRaw =
    invoice.tvaAmount ||
    inv.tva_amount ||
    inv.taxAmount ||
    inv.tax_amount ||
    inv.vatAmount ||
    inv.vat_amount ||
    inv.montantTVA ||
    inv.montant_tva ||
    "0";
  const tvaAmountNum = parseFloat(tvaAmountRaw) || 0;

  const totalTTCRaw =
    invoice.totalTTC ||
    inv.total_ttc ||
    inv.totalIncludingTax ||
    inv.total_including_tax ||
    inv.totalAmountIncludingTax ||
    inv.total_amount_including_tax ||
    inv.totalWithTax ||
    inv.total_with_tax ||
    inv.montantTTC ||
    inv.montant_ttc ||
    inv.amount ||
    inv.totalAmount ||
    inv.total_amount ||
    inv.total ||
    "0";

  let totalTTCNum = parseFloat(totalTTCRaw) || 0;
  if (totalTTCNum === 0 && totalHTNum > 0) {
    totalTTCNum = totalHTNum + tvaAmountNum;
  }
  if (totalTTCNum === 0 && invoiceItems.length > 0) {
    let itemsTotal = 0;
    for (const item of invoiceItems) {
      const qty = parseFloat(item.quantity || item.qty || "1") || 1;
      const up = parseFloat(item.unitPrice || item.unit_price || item.price || item.priceHT || item.price_ht || "0");
      const lt = parseFloat(item.total || item.totalHT || item.total_ht || item.lineTotal || item.line_total || "0");
      itemsTotal += lt > 0 ? lt : (up * qty);
    }
    if (itemsTotal > 0) {
      totalTTCNum = itemsTotal * (1 + (parseFloat(invoice.tvaRate || inv.tva_rate || inv.taxRate || inv.tax_rate || "20") / 100));
    }
  }

  const tvaRateNum = parseFloat(invoice.tvaRate || inv.tva_rate || inv.taxRate || inv.tax_rate || "20");

  const statusLower = invoice.status?.toLowerCase() || "";
  const isUnpaid = statusLower === "pending" || statusLower === "en_attente"
    || statusLower === "overdue" || statusLower === "en_retard"
    || statusLower === "sent" || statusLower === "envoyee" || statusLower === "envoyée";
  const handleViewPdf = async () => {
    setDownloading(true);
    try {
      await viewPdf("invoices", String(id), `facture-${displayRef || id}.pdf`, viewToken);
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "Erreur",
        message: err?.message || "Impossible d'ouvrir la facture.",
        buttons: [{ text: "OK", style: "primary" }],
      });
    } finally {
      setDownloading(false);
    }
  };


  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Détail facture</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 34 + 40 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusCard}>
          <View style={[styles.statusBadgeLarge, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon} size={20} color={statusInfo.color} />
            <Text style={[styles.statusTextLarge, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
          <Text style={styles.invoiceNumber}>{displayRef}</Text>
          <Text style={styles.invoiceDate}>{createdDate}</Text>
          {totalTTCNum > 0 && (
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{totalTTCNum.toFixed(2)} € TTC</Text>
            </View>
          )}
        </View>

        {quoteRef && (
          <View style={styles.refCard}>
            <Ionicons name="link-outline" size={16} color={theme.textSecondary} />
            <Text style={styles.refText}>Devis associé : {quoteRef}</Text>
          </View>
        )}

        {clientInfo && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Client</Text>
            </View>
            <View style={styles.sectionContent}>
              {(clientInfo.firstName || clientInfo.lastName) && (
                <InfoRow theme={theme} styles={styles} icon="person-outline" label="Nom" value={`${clientInfo.firstName || ''} ${clientInfo.lastName || ''}`.trim()} />
              )}
              {clientInfo.email && <InfoRow theme={theme} styles={styles} icon="mail-outline" label="Email" value={clientInfo.email} />}
              {clientInfo.phone && <InfoRow theme={theme} styles={styles} icon="call-outline" label="Téléphone" value={clientInfo.phone} />}
              {clientInfo.address && <InfoRow theme={theme} styles={styles} icon="location-outline" label="Adresse" value={`${clientInfo.address}${clientInfo.postalCode ? ', ' + clientInfo.postalCode : ''}${clientInfo.city ? ' ' + clientInfo.city : ''}`} />}
              {clientInfo.companyName && <InfoRow theme={theme} styles={styles} icon="business-outline" label="Société" value={clientInfo.companyName} />}
              {clientInfo.siret && <InfoRow theme={theme} styles={styles} icon="card-outline" label="SIRET" value={clientInfo.siret} />}
            </View>
          </View>
        )}

        {invoiceItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Lignes de la facture ({invoiceItems.length})</Text>
            </View>
            {invoiceItems.map((item: any, idx: number) => {
              const qty = item.quantity ? parseFloat(item.quantity) : 1;
              const unitPrice = item.unitPrice || item.price || item.priceHT || null;
              const lineTotal = item.total || item.totalHT || (unitPrice ? (parseFloat(unitPrice) * qty).toString() : null);
              const desc = item.description || item.name || item.label || `Ligne ${idx + 1}`;
              const details = item.serviceDetails || item.details || item.notes || "";
              return (
                <View key={idx} style={styles.lineItemCard}>
                  <Text style={styles.lineItemName}>{desc}</Text>
                  {details ? <Text style={styles.lineItemSubtext}>{details}</Text> : null}
                  <View style={styles.lineItemDetails}>
                    {unitPrice && (
                      <Text style={styles.lineItemMeta}>
                        {parseFloat(unitPrice).toFixed(2)} € x {qty}
                      </Text>
                    )}
                    {!unitPrice && qty > 1 && (
                      <Text style={styles.lineItemMeta}>Qté : {qty}</Text>
                    )}
                    {lineTotal && (
                      <Text style={styles.lineItemTotal}>
                        {parseFloat(lineTotal).toFixed(2)} € HT
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {(totalTTCNum > 0 || totalHTNum > 0 || invoiceItems.length > 0) && (
          <View style={styles.amountsCard}>
            <View style={styles.amountsHeader}>
              <Ionicons name="calculator-outline" size={18} color={theme.primary} />
              <Text style={styles.amountsTitle}>Récapitulatif</Text>
            </View>
            {totalHTNum > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Montant HT</Text>
                <Text style={styles.amountHT}>{totalHTNum.toFixed(2)} €</Text>
              </View>
            )}
            {tvaAmountNum > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>TVA ({tvaRateNum}%)</Text>
                <Text style={styles.amountTVA}>{tvaAmountNum.toFixed(2)} €</Text>
              </View>
            )}
            <View style={[styles.amountRow, (totalHTNum > 0 || tvaAmountNum > 0) ? styles.totalRow : undefined]}>
              <Text style={styles.totalLabel}>Total TTC</Text>
              <Text style={styles.totalValue}>{totalTTCNum.toFixed(2)} €</Text>
            </View>
          </View>
        )}

        {invoice.dueDate && (
          <View style={styles.dateCard}>
            <Ionicons name="hourglass-outline" size={18} color={isUnpaid ? theme.pending : theme.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dateCardLabel}>Date d'échéance</Text>
              <Text style={styles.dateCardValue}>
                {new Date(invoice.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </Text>
            </View>
          </View>
        )}

        {invoice.paidAt && (
          <View style={styles.dateCard}>
            <Ionicons name="checkmark-circle" size={18} color={theme.accepted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dateCardLabel}>Payée le</Text>
              <Text style={styles.dateCardValue}>
                {new Date(invoice.paidAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </Text>
            </View>
          </View>
        )}

        {invoice.notes ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubble-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Notes</Text>
            </View>
            <View style={styles.sectionContent}>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.footerActions}>
          <Pressable
            style={({ pressed }) => [styles.btnPdf, pressed && styles.btnPdfPressed, downloading && { opacity: 0.6 }]}
            onPress={handleViewPdf}
            disabled={downloading}
          >
            {downloading
              ? <ActivityIndicator size="small" color={theme.primary} />
              : <Ionicons name="document-text-outline" size={18} color={theme.primary} />
            }
            <Text style={styles.btnPdfText}>{downloading ? "Chargement…" : "Visualiser / Télécharger le PDF"}</Text>
          </Pressable>
        </View>
        
      </ScrollView>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  statusCard: { alignItems: "center", marginBottom: 20, gap: 8 },
  statusBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
  },
  statusTextLarge: { fontSize: 15, fontFamily: "Exo2_600SemiBold" },
  invoiceNumber: { fontSize: 18, fontFamily: "Exo2_700Bold", color: theme.text },
  invoiceDate: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  totalBadge: {
    backgroundColor: theme.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  totalBadgeText: {
    fontSize: 18,
    fontFamily: "Exo2_700Bold",
    color: theme.primary,
  },
  refCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  refText: {
    fontSize: 13,
    fontFamily: "Exo2_500Medium",
    color: theme.textSecondary,
  },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text },
  sectionContent: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  infoLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  infoLabelText: {
    fontSize: 13,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
    textAlign: "right",
    flex: 1,
  },
  lineItemCard: {
    backgroundColor: theme.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  lineItemName: {
    fontSize: 14,
    fontFamily: "Exo2_500Medium",
    color: theme.text,
    marginBottom: 2,
  },
  lineItemSubtext: {
    fontSize: 12,
    fontFamily: "Exo2_400Regular",
    color: theme.textTertiary,
    marginBottom: 8,
  },
  lineItemDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  lineItemMeta: {
    fontSize: 13,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
  },
  lineItemTotal: {
    fontSize: 14,
    fontFamily: "Exo2_600SemiBold",
    color: theme.primary,
  },
  amountsCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 10,
  },
  amountsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  amountsTitle: {
    fontSize: 16,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  amountHT: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  amountTVA: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  totalRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
  },
  totalLabel: { fontSize: 16, fontFamily: "Exo2_700Bold", color: theme.text },
  totalValue: { fontSize: 22, fontFamily: "Exo2_700Bold", color: theme.primary },
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  dateCardLabel: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  dateCardValue: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
  notesText: {
    fontSize: 14,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    lineHeight: 22,
  },
  errorText: { fontSize: 16, fontFamily: "Exo2_500Medium", color: theme.textSecondary, marginTop: 12 },
  backLink: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: theme.primary, borderRadius: 10 },
  backLinkText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  footerActions: {
    marginTop: 8,
    gap: 12,
    marginBottom: 20,
  },
  btnPdf: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  btnPdfPressed: {
    backgroundColor: theme.surfaceSecondary,
  },
  btnPdfText: {
    fontSize: 15,
    fontFamily: "Exo2_600SemiBold",
    color: theme.primary,
  },
});
