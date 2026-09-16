import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { quotesApi, reservationsApi, getBackendUrl, getApiAccessToken, getSessionCookie, Quote } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { viewPdf } from "@/lib/pdf-download";

const EXTERNAL_API_BASE = getBackendUrl();

function getStatusInfo(status: string, isDark: boolean) {
  const s = status?.toLowerCase() || "";
  if (s === "pending" || s === "en_attente")
    return { label: "En attente", color: "#F59E0B", bg: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7", icon: "time-outline" as const };
  if (s === "sent" || s === "envoyé")
    return { label: "Envoyé", color: "#3B82F6", bg: isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE", icon: "send-outline" as const };
  if (s === "approved" || s === "approuvé")
    return { label: "Approuvé", color: "#8B5CF6", bg: isDark ? "rgba(139,92,246,0.15)" : "#EDE9FE", icon: "eye-outline" as const };
  if (s === "accepted" || s === "accepté")
    return { label: "Accepté", color: "#22C55E", bg: isDark ? "rgba(34,197,94,0.15)" : "#DCFCE7", icon: "checkmark-circle-outline" as const };
  if (s === "confirmed" || s === "confirmé")
    return { label: "Confirmé", color: "#22C55E", bg: isDark ? "rgba(34,197,94,0.15)" : "#DCFCE7", icon: "checkmark-circle-outline" as const };
  if (s === "rejected" || s === "refusé" || s === "refused")
    return { label: "Refusé", color: "#F87171", bg: isDark ? "rgba(239,68,68,0.15)" : "#FEE2E2", icon: "close-circle-outline" as const };
  if (s === "completed" || s === "terminé")
    return { label: "Terminé", color: "#22C55E", bg: isDark ? "rgba(34,197,94,0.15)" : "#DCFCE7", icon: "checkmark-done-outline" as const };
  if (s === "in_progress" || s === "en_cours")
    return { label: "En cours", color: "#3B82F6", bg: isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE", icon: "hourglass-outline" as const };
  return { label: status || "Inconnu", color: isDark ? "#888" : "#666", bg: isDark ? "rgba(255,255,255,0.06)" : "#F0F0F0", icon: "help-outline" as const };
}

function parseVehicleInfo(vehicleInfo: any) {
  if (!vehicleInfo) return null;
  if (typeof vehicleInfo === "string") {
    try { return JSON.parse(vehicleInfo); } catch { return null; }
  }
  if (typeof vehicleInfo === "object") return vehicleInfo;
  return null;
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

export default function QuoteDetailScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { showAlert, AlertComponent } = useCustomAlert();
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      try {
        const detail = await quotesApi.getById(id!);
        if (detail && (detail.id || (detail as any)._id)) return detail;
      } catch {}
      try {
        const all = await quotesApi.getAll();
        const list = Array.isArray(all) ? all : [];
        const found = list.find((q) => String(q.id || (q as any)._id) === id);
        if (found) return found;
      } catch {}
      const cached = queryClient.getQueryData<Quote[]>(["quotes"]);
      if (cached) {
        const found = cached.find((q) => String(q.id || (q as any)._id) === id);
        if (found) return found;
      }
      return null;
    },
    enabled: !!id,
  });

  const { data: mediaItems = [] } = useQuery({
    queryKey: ["quote-media", id],
    queryFn: () => quotesApi.getMedia(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: allReservations = [] } = useQuery({
    queryKey: ["reservations"],
    queryFn: reservationsApi.getAll,
    retry: 1,
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.textTertiary} />
        <Text style={styles.errorText}>Devis introuvable</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const statusInfo = getStatusInfo(quote.status, theme.isDark);
  const _d = quote.createdAt ? new Date(quote.createdAt) : null;
  const formattedDate = (_d && isFinite(_d.getTime()))
    ? _d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  const vehicleInfo = parseVehicleInfo((quote as any).vehicleInfo);
  const quoteItems = parseItems((quote as any).items || (quote as any).lignes || (quote as any).lines || (quote as any).prestations);
  const quoteServices = Array.isArray((quote as any).services) ? (quote as any).services : [];
  const mediaItemUrls = Array.isArray(mediaItems)
    ? (mediaItems as any[]).map((m) => m?.url || m?.uri || m?.fileUrl || "").filter(Boolean)
    : [];
  const embeddedPhotos = Array.isArray((quote as any).photos) ? (quote as any).photos : [];
  const quotePhotos = mediaItemUrls.length > 0 ? mediaItemUrls : embeddedPhotos;
  const quoteNotes = (quote as any).notes || "";

  const totalAmount =
    (quote as any).quoteAmount ||
    (quote as any).totalIncludingTax ||
    (quote as any).total_including_tax ||
    (quote as any).totalTTC ||
    (quote as any).total_ttc ||
    (quote as any).totalAmount ||
    (quote as any).total_amount ||
    (quote as any).amount ||
    (quote as any).total ||
    "0";
  const totalHT =
    (quote as any).totalHT ||
    (quote as any).total_ht ||
    (quote as any).totalExcludingTax ||
    (quote as any).total_excluding_tax ||
    (quote as any).amountHT ||
    (quote as any).amount_ht ||
    (quote as any).amountExcludingTax ||
    (quote as any).priceExcludingTax ||
    (quote as any).price_excluding_tax;
  const tvaRate = (quote as any).tvaRate || (quote as any).tva_rate || (quote as any).taxRate || (quote as any).tax_rate || "20";
  const tvaAmount =
    (quote as any).tvaAmount ||
    (quote as any).tva_amount ||
    (quote as any).taxAmount ||
    (quote as any).tax_amount ||
    (quote as any).vatAmount ||
    (quote as any).vat_amount;
  const viewToken = ((quote as any).viewToken || (quote as any).pdfToken || (quote as any).token || (quote as any).publicToken || (quote as any).shareToken || (quote as any).accessToken || (quote as any).publicId) as string | undefined;
  const expiryDate = (quote as any).expiryDate || (quote as any).validUntil;
  const displayRef = (quote as any).reference || (quote as any).quoteNumber || quote.id;
  const rawRequestDetails = (quote as any).requestDetails || (quote as any).description || "";
  function extractRequestText(raw: any): string {
    if (!raw) return "";
    if (typeof raw === "string") {
      // Peut être une chaîne JSON — tenter de parser
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return extractRequestText(parsed);
      } catch {}
      return raw;
    }
    if (typeof raw === "object") {
      // Champs texte explicites en priorité
      const text = raw.text || raw.message || raw.details || raw.notes || raw.description || raw.comment || "";
      if (text) return String(text);
      // Pas de champ texte → ignorer les champs non lisibles et ne pas afficher du JSON brut
      return "";
    }
    return String(raw);
  }
  const requestDetails = extractRequestText(rawRequestDetails);
  const serviceName = (quote as any).service?.name || (quote as any).serviceName || "";
  const clientInfo = (quote as any).client || null;
  const quoteServiceId = (quote as any).serviceId || (quote as any).service?.id;

  const totalHTNum = totalHT ? parseFloat(totalHT) : 0;
  const tvaAmountNum = tvaAmount ? parseFloat(tvaAmount) : (totalHTNum * parseFloat(tvaRate) / 100);
  const totalTTCNum = parseFloat(totalAmount) || (totalHTNum + tvaAmountNum) || 0;

  const statusLower = quote.status?.toLowerCase() || "";
  const isPending = statusLower === "pending" || statusLower === "en_attente";
  const isSent = statusLower === "sent" || statusLower === "envoyé" || statusLower === "envoyee";
  const isAccepted = statusLower === "accepted" || statusLower === "accepté" || statusLower === "confirmed" || statusLower === "confirmé";
  const hasNoContent = quoteItems.length === 0 && totalTTCNum === 0;

  const finalStatuses = new Set(["accepted", "accepté", "accepte", "rejected", "refusé", "refuse", "refused", "completed", "terminé", "termine", "cancelled", "annulé", "annule", "annulée", "annulee"]);
  // Le client peut répondre dès que le devis n'est pas dans un état final :
  // "pending" (en attente de réponse) ET "sent" (envoyé) sont tous deux valides.
  const canRespond = !finalStatuses.has(statusLower);

  const _reservationList = Array.isArray(allReservations) ? (allReservations as any[]) : [];
  const existingReservation = _reservationList.find(
    (r) => r.quoteId === id || r.quoteId === quote?.id
  );
  const hasExistingReservation = !!existingReservation;
  const existingReservationStatus = existingReservation?.status?.toLowerCase() || "";

  const formattedExpiry = expiryDate
    ? new Date(expiryDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const handleViewPdf = async () => {
    setDownloading(true);
    try {
      await viewPdf("quotes", String(id), `devis-${displayRef || id}.pdf`, viewToken);
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "Erreur",
        message: err?.message || "Impossible d'ouvrir le devis.",
        buttons: [{ text: "OK", style: "primary" }],
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleAccept = async () => {
    showAlert({
      type: "info",
      title: "Accepter le devis",
      message: "Êtes-vous sûr de vouloir accepter ce devis ?",
      buttons: [
        { text: "Annuler" },
        {
          text: "Accepter",
          style: "primary",
          onPress: async () => {
            setAccepting(true);
            try {
              await quotesApi.accept(id!);
              queryClient.invalidateQueries({ queryKey: ["quotes"] });
              queryClient.invalidateQueries({ queryKey: ["quote", id] });
              showAlert({ type: "success", title: "Devis accepté", message: "Le devis a bien été accepté.", buttons: [{ text: "OK", style: "primary" }] });
              // Refresh immediately
              setTimeout(() => {
                queryClient.refetchQueries({ queryKey: ["quote", id] });
                queryClient.refetchQueries({ queryKey: ["quotes"] });
              }, 500);
            } catch (err: any) {
              console.error("[QUOTE] accept error:", err?.message);
              showAlert({ type: "error", title: "Erreur", message: err?.message || "Impossible d'accepter le devis.", buttons: [{ text: "OK", style: "primary" }] });
            } finally {
              setAccepting(false);
            }
          },
        },
      ],
    });
  };

  const handleReject = async () => {
    showAlert({
      type: "warning",
      title: "Refuser le devis",
      message: "Êtes-vous sûr de vouloir refuser ce devis ?",
      buttons: [
        { text: "Annuler" },
        {
          text: "Refuser",
          style: "primary",
          onPress: async () => {
            setRejecting(true);
            try {
              await quotesApi.reject(id!);
              queryClient.invalidateQueries({ queryKey: ["quotes"] });
              queryClient.invalidateQueries({ queryKey: ["quote", id] });
              showAlert({ type: "success", title: "Devis refusé", message: "Le devis a bien été refusé.", buttons: [{ text: "OK", style: "primary" }] });
              // Refresh immediately
              setTimeout(() => {
                queryClient.refetchQueries({ queryKey: ["quote", id] });
                queryClient.refetchQueries({ queryKey: ["quotes"] });
              }, 500);
            } catch (err: any) {
              console.error("[QUOTE] reject error:", err?.message);
              showAlert({ type: "error", title: "Erreur", message: err?.message || "Impossible de refuser le devis.", buttons: [{ text: "OK", style: "primary" }] });
            } finally {
              setRejecting(false);
            }
          },
        },
      ],
    });
  };

  const handleRequestReservation = () => {
    router.push({
      pathname: "/(main)/request-reservation",
      params: {
        quoteId: id,
        serviceId: quoteServiceId || "",
        quoteName: displayRef,
      },
    });
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
        <Text style={styles.headerTitle}>Détail du devis</Text>
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
          <Text style={styles.quoteNumber}>{displayRef}</Text>
          <Text style={styles.quoteDate}>{formattedDate}</Text>
          {formattedExpiry && (
            <Text style={styles.expiryText}>Valide jusqu'au {formattedExpiry}</Text>
          )}
          {totalTTCNum > 0 && (
            <View style={styles.totalBadgeTop}>
              <Text style={styles.totalBadgeTopText}>{totalTTCNum.toFixed(2)} € TTC</Text>
            </View>
          )}
        </View>

        {isPending && hasNoContent && (
          <View style={styles.processingCard}>
            <View style={styles.processingIcon}>
              <Ionicons name="hourglass-outline" size={24} color={theme.primary} />
            </View>
            <Text style={styles.processingTitle}>Demande en cours de traitement</Text>
            <Text style={styles.processingText}>
              Votre demande est en cours de traitement par notre équipe. Vous recevrez un devis détaillé prochainement.
            </Text>
          </View>
        )}

        {(serviceName && quoteServices.length === 0) ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="construct-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Service demandé</Text>
            </View>
            <View style={styles.sectionContent}>
              <View style={styles.serviceRow}>
                <View style={styles.serviceIcon}>
                  <Ionicons name="checkmark" size={14} color={theme.primary} />
                </View>
                <Text style={styles.serviceName}>{serviceName}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {quoteServices.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="construct-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Services inclus</Text>
            </View>
            <View style={styles.sectionContent}>
              {quoteServices.map((service: any, idx: number) => {
                const sName = typeof service === "string" ? service : service?.name || service?.id || `Service ${idx + 1}`;
                const sPrice = service?.basePrice || service?.price;
                return (
                  <View key={idx} style={styles.serviceRow}>
                    <View style={styles.serviceIcon}>
                      <Ionicons name="checkmark" size={14} color={theme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.serviceName}>{sName}</Text>
                      {sPrice && parseFloat(sPrice) > 0 && (
                        <Text style={styles.servicePrice}>{parseFloat(sPrice).toFixed(2)} € HT</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {requestDetails ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Détails de la demande</Text>
            </View>
            <View style={styles.sectionContent}>
              <Text style={styles.notesText}>{requestDetails}</Text>
            </View>
          </View>
        ) : null}

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
            </View>
          </View>
        )}

        {vehicleInfo && typeof vehicleInfo === "object" && Object.keys(vehicleInfo).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="car-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Véhicule</Text>
            </View>
            <View style={styles.sectionContent}>
              {vehicleInfo.marque && <InfoRow theme={theme} styles={styles} icon="car-outline" label="Marque" value={vehicleInfo.marque} />}
              {vehicleInfo.modele && <InfoRow theme={theme} styles={styles} icon="car-sport-outline" label="Modèle" value={vehicleInfo.modele} />}
              {vehicleInfo.immatriculation && <InfoRow theme={theme} styles={styles} icon="card-outline" label="Immatriculation" value={vehicleInfo.immatriculation} />}
              {vehicleInfo.annee && <InfoRow theme={theme} styles={styles} icon="calendar-outline" label="Année" value={vehicleInfo.annee} />}
            </View>
          </View>
        )}

        {quoteItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Lignes du devis ({quoteItems.length})</Text>
            </View>
            {quoteItems.map((item: any, idx: number) => {
              const qty = item.quantity ? parseFloat(item.quantity) : 1;
              const unitPrice = item.unitPrice || item.price || item.priceHT || null;
              const lineTotal = item.total || item.totalHT || (unitPrice ? (parseFloat(unitPrice) * qty).toString() : null);
              const desc = item.description || item.name || item.label || `Prestation ${idx + 1}`;
              const details = item.details || item.serviceDetails || item.notes || "";
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

        {(totalHTNum > 0 || totalTTCNum > 0) && (
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
                <Text style={styles.amountLabel}>TVA ({parseFloat(tvaRate)}%)</Text>
                <Text style={styles.amountTVA}>{tvaAmountNum.toFixed(2)} €</Text>
              </View>
            )}
            <View style={[styles.amountRow, (totalHTNum > 0 || tvaAmountNum > 0) ? styles.totalRow : undefined]}>
              <Text style={styles.totalLabel}>Total TTC</Text>
              <Text style={styles.totalValue}>{totalTTCNum.toFixed(2)} €</Text>
            </View>
          </View>
        )}

        {quotePhotos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="images-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Photos ({quotePhotos.length})</Text>
            </View>
            <View style={styles.photosGrid}>
              {quotePhotos.map((photo: any, idx: number) => {
                const photoUri = typeof photo === "string" ? photo : photo?.url || photo?.uri || "";
                const fullUri = photoUri.startsWith("http") ? photoUri : `${EXTERNAL_API_BASE}${photoUri}`;
                return (
                  <View key={idx} style={styles.photoThumb}>
                    <Image
                      source={{
                        uri: fullUri,
                        headers: {
                          ...(getApiAccessToken() ? { Authorization: `Bearer ${getApiAccessToken()}` } : {}),
                          ...(getSessionCookie() ? { Cookie: getSessionCookie() as string } : {}),
                        },
                      }}
                      style={styles.photoImage}
                      contentFit="cover"
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {quoteNotes ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubble-outline" size={18} color={theme.primary} />
              <Text style={styles.sectionTitle}>Notes</Text>
            </View>
            <View style={styles.sectionContent}>
              <Text style={styles.notesText}>{quoteNotes}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.footerActions}>
          <Pressable
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnSecondaryPressed, downloading && { opacity: 0.6 }]}
            onPress={handleViewPdf}
            disabled={downloading}
          >
            {downloading
              ? <ActivityIndicator size="small" color={theme.primary} />
              : <Ionicons name="document-text-outline" size={18} color={theme.primary} />
            }
            <Text style={styles.btnSecondaryText}>{downloading ? "Chargement…" : "Visualiser / Télécharger le PDF"}</Text>
          </Pressable>

          {canRespond && (
            <View style={styles.responseRow}>
              <Pressable
                style={[styles.btnAccept, (accepting || rejecting) && styles.btnDisabled]}
                onPress={handleAccept}
                disabled={accepting || rejecting}
              >
                {accepting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.btnAcceptText}>Accepter</Text>
              </Pressable>

              <Pressable
                style={[styles.btnReject, (accepting || rejecting) && styles.btnDisabled]}
                onPress={handleReject}
                disabled={accepting || rejecting}
              >
                {rejecting ? (
                  <ActivityIndicator size="small" color={theme.rejected} />
                ) : (
                  <Ionicons name="close-circle-outline" size={18} color={theme.rejected} />
                )}
                <Text style={styles.btnRejectText}>Refuser</Text>
              </Pressable>
            </View>
          )}

          {isAccepted && hasExistingReservation && (
            <Pressable
              style={({ pressed }) => [styles.btnReservation, { backgroundColor: "#F59E0B" }, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({ pathname: "/(main)/reservation-detail", params: { id: existingReservation.id } })}
            >
              <Ionicons name="time-outline" size={18} color="#FFFFFF" />
              <Text style={styles.btnReservationText}>
                {existingReservationStatus === "confirmed" || existingReservationStatus === "confirmée" || existingReservationStatus === "confirmé"
                  ? "Réservation confirmée — voir"
                  : existingReservationStatus === "cancelled" || existingReservationStatus === "annulée"
                  ? "Réservation annulée — voir"
                  : "Réservation en attente de traitement"}
              </Text>
            </Pressable>
          )}

          {isAccepted && !hasExistingReservation && (
            <Pressable
              style={({ pressed }) => [styles.btnReservation, pressed && styles.btnReservationPressed]}
              onPress={handleRequestReservation}
            >
              <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
              <Text style={styles.btnReservationText}>Demander une réservation</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statusCard: {
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  statusBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
  },
  statusTextLarge: {
    fontSize: 15,
    fontFamily: "Exo2_600SemiBold",
  },
  quoteNumber: {
    fontSize: 18,
    fontFamily: "Exo2_700Bold",
    color: theme.text,
  },
  quoteDate: {
    fontSize: 13,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
  },
  expiryText: {
    fontSize: 12,
    fontFamily: "Exo2_400Regular",
    color: theme.textTertiary,
  },
  totalBadgeTop: {
    backgroundColor: theme.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  totalBadgeTopText: {
    fontSize: 18,
    fontFamily: "Exo2_700Bold",
    color: theme.primary,
  },
  processingCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  processingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  processingTitle: {
    fontSize: 16,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
    textAlign: "center",
  },
  processingText: {
    fontSize: 14,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
  },
  sectionContent: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  serviceIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  serviceName: {
    fontSize: 14,
    fontFamily: "Exo2_500Medium",
    color: theme.text,
    flex: 1,
  },
  servicePrice: {
    fontSize: 12,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    marginTop: 2,
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
    marginBottom: 20,
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
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoThumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.border,
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  notesText: {
    fontSize: 14,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    lineHeight: 22,
  },
  footerActions: {
    gap: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  responseRow: {
    flexDirection: "row",
    gap: 12,
  },
  btnAccept: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.accepted,
    borderRadius: 12,
    paddingVertical: 14,
  },
  btnAcceptText: {
    fontSize: 15,
    fontFamily: "Exo2_600SemiBold",
    color: "#FFFFFF",
  },
  btnReject: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.rejected,
  },
  btnRejectText: {
    fontSize: 15,
    fontFamily: "Exo2_600SemiBold",
    color: theme.rejected,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnSecondary: {
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
  btnSecondaryPressed: {
    backgroundColor: theme.surfaceSecondary,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontFamily: "Exo2_600SemiBold",
    color: theme.primary,
  },
  btnReservation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  btnReservationPressed: {
    backgroundColor: theme.primaryDark,
  },
  btnReservationText: {
    fontSize: 15,
    fontFamily: "Exo2_600SemiBold",
    color: "#FFFFFF",
  },
  errorText: { fontSize: 16, fontFamily: "Exo2_500Medium", color: theme.textSecondary, marginTop: 12 },
  backLink: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: theme.primary, borderRadius: 10 },
  backLinkText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: "#fff" },
});
