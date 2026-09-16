import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminReservations, adminClients, adminQuotes, adminServices } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", confirmed: "Confirmé", cancelled: "Annulé",
  completed: "Terminé", in_progress: "En cours",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#22C55E", cancelled: "#EF4444",
  completed: "#3B82F6", in_progress: "#8B5CF6",
};

function resolveClient(r: any, clientMap: Record<string, any>): { name: string; email: string; phone: string } {
  const c = r?.client || (r?.clientId && clientMap[String(r.clientId)]) || null;
  let name = "";
  if (c?.firstName || c?.lastName) name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
  else if (c?.name) name = c.name;
  else if (r?.clientFirstName || r?.clientLastName) name = `${r.clientFirstName || ""} ${r.clientLastName || ""}`.trim();
  else if (r?.clientName) name = r.clientName;
  const email = c?.email || r?.clientEmail || "";
  const phone = c?.phone || c?.phoneNumber || r?.clientPhone || "";
  return { name, email, phone };
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
function fmtTime(val: string | null | undefined): string {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function ReservationDetailScreen() {
  const params = useLocalSearchParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : (typeof rawId === "string" ? rawId : "");
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();

  const { data: r, isLoading, error } = useQuery({
    queryKey: ["admin-reservation", id],
    queryFn: async () => {
      try {
        return await adminReservations.getById(id);
      } catch {
        const list = queryClient.getQueryData<any[]>(["admin-reservations"]) || [];
        const found = list.find((item: any) => item.id === id);
        if (found) return found;
        throw new Error("Rendez-vous introuvable");
      }
    },
    enabled: !!id,
    retry: 0,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: adminClients.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allQuotes = [] } = useQuery({
    queryKey: ["admin-quotes"],
    queryFn: adminQuotes.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allServices = [] } = useQuery({
    queryKey: ["admin-services"],
    queryFn: adminServices.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: reservationServices = [] } = useQuery({
    queryKey: ["admin-reservation-services", id],
    queryFn: () => adminReservations.getServices(id),
    enabled: !!id,
    retry: 0,
    staleTime: 5 * 60 * 1000,
  });

  const clientMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const c of (Array.isArray(clients) ? clients : [])) {
      if (c?.id) map[String(c.id)] = c;
    }
    return map;
  }, [clients]);

  const linkedQuote = useMemo(() => {
    if (!r?.quoteId) return null;
    const quotesArr = Array.isArray(allQuotes) ? allQuotes : [];
    return quotesArr.find((q: any) => String(q.id) === String(r.quoteId)) || null;
  }, [r?.quoteId, allQuotes]);

  const linkedService = useMemo(() => {
    const serviceId = r?.serviceId || r?.service_id;
    if (!serviceId) return null;
    const arr = Array.isArray(allServices) ? allServices : [];
    return arr.find((s: any) => String(s.id) === String(serviceId)) || null;
  }, [r?.serviceId, r?.service_id, allServices]);

  const reservationServicesArr = useMemo(() => {
    const arr = Array.isArray(reservationServices) ? reservationServices : [];
    return arr;
  }, [reservationServices]);

  const quoteDisplayRef = useMemo(() => {
    if (linkedQuote) return linkedQuote.quoteNumber || linkedQuote.reference || null;
    if (r?.quoteReference) return r.quoteReference;
    return null;
  }, [linkedQuote, r?.quoteReference]);

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (error || !r) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", gap: 16 }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={{ fontSize: 15, color: theme.text, textAlign: "center", paddingHorizontal: 32 }}>
          Impossible de charger ce rendez-vous.
        </Text>
        <Pressable style={styles.backChip} onPress={() => router.back()}>
          <Text style={{ color: theme.primary, fontFamily: "Exo2_600SemiBold" }}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const statusKey = (r.status || "").toLowerCase();
  const statusColor = STATUS_COLORS[statusKey] || theme.textTertiary;
  const statusLabel = STATUS_LABELS[statusKey] || r.status;

  const { name, email, phone } = resolveClient(r, clientMap);

  const dateStr = r.scheduledDate || r.reservationDate || r.date;
  const timeStr = r.timeSlot || fmtTime(dateStr);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {r.reference || "Rendez-vous"}
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

        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date & Heure</Text>
          <View style={styles.dateBlock}>
            <Ionicons name="calendar-outline" size={20} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.valueMain}>{fmtDate(dateStr)}</Text>
              {timeStr ? <Text style={styles.valueSub}>{timeStr}</Text> : null}
            </View>
          </View>
        </View>

        {/* Devis lié */}
        {quoteDisplayRef ? (
          <Pressable
            style={styles.section}
            onPress={() => {
              if (linkedQuote?.id) {
                router.push({ pathname: "/(admin)/quote-detail", params: { id: linkedQuote.id } } as any);
              }
            }}
          >
            <Text style={styles.sectionTitle}>Devis lié</Text>
            <View style={styles.quoteLink}>
              <Ionicons name="document-text-outline" size={18} color={theme.primary} />
              <Text style={[styles.valueMain, { color: theme.primary, flex: 1 }]}>{quoteDisplayRef}</Text>
              {linkedQuote?.id && (
                <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
              )}
            </View>
          </Pressable>
        ) : null}

        {/* Service lié */}
        {(linkedService || reservationServicesArr.length > 0 || r.serviceType || r.serviceName) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service</Text>
            {linkedService ? (
              <>
                <Text style={styles.valueMain}>{linkedService.name || linkedService.title}</Text>
                {linkedService.description ? <Text style={styles.valueSub}>{linkedService.description}</Text> : null}
                <View style={styles.serviceChips}>
                  {linkedService.basePrice ? (
                    <View style={styles.serviceChip}>
                      <Ionicons name="pricetag-outline" size={13} color={theme.textTertiary} />
                      <Text style={styles.serviceChipText}>
                        {parseFloat(String(linkedService.basePrice)).toFixed(2)} € HT
                      </Text>
                    </View>
                  ) : null}
                  {linkedService.duration ? (
                    <View style={styles.serviceChip}>
                      <Ionicons name="time-outline" size={13} color={theme.textTertiary} />
                      <Text style={styles.serviceChipText}>
                        {linkedService.duration >= 60
                          ? `${Math.floor(linkedService.duration / 60)}h${linkedService.duration % 60 > 0 ? linkedService.duration % 60 + "min" : ""}`
                          : `${linkedService.duration} min`}
                      </Text>
                    </View>
                  ) : null}
                  {linkedService.category ? (
                    <View style={styles.serviceChip}>
                      <Ionicons name="folder-outline" size={13} color={theme.textTertiary} />
                      <Text style={styles.serviceChipText}>{linkedService.category}</Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : r.serviceName ? (
              <Text style={styles.valueMain}>{r.serviceName}</Text>
            ) : r.serviceType ? (
              <Text style={styles.valueMain}>{r.serviceType}</Text>
            ) : null}
            {reservationServicesArr.length > 0 && reservationServicesArr.map((s: any, i: number) => (
              <View key={i} style={[styles.serviceRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 8 }]}>
                <Text style={styles.value}>{s.name || s.title || `Service #${s.id}`}</Text>
                {s.basePrice ? <Text style={styles.valueSub}>{parseFloat(String(s.basePrice)).toFixed(2)} € HT</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Informations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          {r.reference ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Référence</Text>
              <Text style={styles.value}>{r.reference}</Text>
            </View>
          ) : null}
          {r.serviceType && !linkedService ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Type de service</Text>
              <Text style={styles.value}>{r.serviceType}</Text>
            </View>
          ) : null}
          {(r.vehicleInfo?.brand || r.vehicleInfo?.model || r.vehicleInfo?.plate) ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Véhicule</Text>
              <Text style={styles.value}>
                {[r.vehicleInfo?.brand, r.vehicleInfo?.model].filter(Boolean).join(" ")}
                {r.vehicleInfo?.plate ? ` · ${r.vehicleInfo.plate}` : ""}
                {r.vehicleInfo?.year ? ` (${r.vehicleInfo.year})` : ""}
              </Text>
            </View>
          ) : null}
          {r.wheelCount ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Nb roues</Text>
              <Text style={styles.value}>{r.wheelCount}</Text>
            </View>
          ) : null}
          {r.diameter ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Diamètre</Text>
              <Text style={styles.value}>{r.diameter}"</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Créé le</Text>
            <Text style={styles.value}>{fmtDate(r.createdAt)}</Text>
          </View>
        </View>

        {/* Notes */}
        {r.notes || r.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {r.description ? <Text style={styles.prose}>{r.description}</Text> : null}
            {r.notes && r.notes !== r.description ? <Text style={styles.prose}>{r.notes}</Text> : null}
          </View>
        ) : null}

        {/* Product Details */}
        {r.productDetails ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Détails produit</Text>
            <Text style={styles.prose}>{typeof r.productDetails === "string" ? r.productDetails : JSON.stringify(r.productDetails, null, 2)}</Text>
          </View>
        ) : null}

        {statusKey !== "completed" && statusKey !== "cancelled" && (
          <Pressable
            style={styles.editBtn}
            onPress={() => router.push({ pathname: "/(admin)/reservation-create", params: { editId: id } } as any)}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.editBtnText}>Modifier le rendez-vous</Text>
          </Pressable>
        )}
      </ScrollView>
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
  dateBlock: { flexDirection: "row", alignItems: "center", gap: 10 },
  quoteLink: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textTertiary, width: 110 },
  value: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.text, flex: 1 },
  prose: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text, lineHeight: 20 },
  serviceChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  serviceChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  serviceChipText: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  serviceRow: { paddingTop: 4 },
  editBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.primary, borderRadius: 14, height: 54, marginTop: 4,
  },
  editBtnText: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: "#fff" },
});
