import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  TextInput, ActivityIndicator,
} from "react-native";
import { DateTimePicker } from "@/components/DateTimePicker";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminReservations, adminClients, adminQuotes, adminServices } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { consumePendingNewClientId } from "@/lib/new-client-store";

export default function ReservationCreateScreen() {
  const params = useLocalSearchParams();
  const paramClientId = Array.isArray(params.clientId) ? params.clientId[0] : (params.clientId as string || "");
  const quoteId = Array.isArray(params.quoteId) ? params.quoteId[0] : (params.quoteId as string || "");
  const quoteName = Array.isArray(params.quoteName) ? params.quoteName[0] : (params.quoteName as string || "");
  const editId = Array.isArray(params.editId) ? params.editId[0] : (params.editId as string || "");
  const isEditMode = !!editId;

  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { showAlert, AlertComponent } = useCustomAlert();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const defaultStartISO = tomorrow.toISOString();
  const defaultEndISO = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString();

  const [selectedClientId, setSelectedClientId] = useState<string>(paramClientId);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [startDate, setStartDate] = useState(defaultStartISO);
  const [endDate, setEndDate] = useState(defaultEndISO);
  const [notes, setNotes] = useState(quoteName ? `Devis: ${quoteName}` : "");
  const [serviceType, setServiceType] = useState("");

  const [pickedQuoteId, setPickedQuoteId] = useState<string>(quoteId);
  const [pickedQuoteName, setPickedQuoteName] = useState<string>(quoteName);
  const [showQuotePicker, setShowQuotePicker] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState("");

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [editLoaded, setEditLoaded] = useState(false);

  const { data: editReservation } = useQuery({
    queryKey: ["admin-reservation", editId],
    queryFn: () => adminReservations.getById(editId),
    enabled: isEditMode && !editLoaded,
  });

  useEffect(() => {
    if (!isEditMode || editLoaded || !editReservation) return;
    if (editReservation.clientId) setSelectedClientId(String(editReservation.clientId));
    if (editReservation.notes) setNotes(editReservation.notes);
    if (editReservation.quoteId) {
      setPickedQuoteId(String(editReservation.quoteId));
      setPickedQuoteName(editReservation.quoteReference || editReservation.quoteNumber || "Devis associé");
    }
    if (editReservation.serviceId) setSelectedServiceIds([String(editReservation.serviceId)]);
    else if (editReservation.service_id) setSelectedServiceIds([String(editReservation.service_id)]);
    else if (Array.isArray(editReservation.serviceIds)) setSelectedServiceIds(editReservation.serviceIds.map(String));
    if (editReservation.serviceType) setServiceType(editReservation.serviceType);
    const schedDate = editReservation.scheduledDate || editReservation.reservationDate || editReservation.date;
    if (schedDate) {
      const d = new Date(schedDate);
      if (!isNaN(d.getTime())) setStartDate(d.toISOString());
    }
    const endD = editReservation.estimatedEndDate || editReservation.endDate;
    if (endD) {
      const d = new Date(endD);
      if (!isNaN(d.getTime())) setEndDate(d.toISOString());
    }
    setEditLoaded(true);
  }, [editReservation, isEditMode, editLoaded]);

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: adminServices.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const servicesArr = Array.isArray(services) ? services : [];
  const selectedServicesArr = servicesArr.filter((s: any) => selectedServiceIds.includes(String(s.id)));
  const serviceLabel = selectedServicesArr.length > 0
    ? selectedServicesArr.map((s: any) => s.name || s.title || `Service #${s.id}`).join(", ")
    : "Sélectionner un ou plusieurs services *";

  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ["admin-quotes"],
    queryFn: adminQuotes.getAll,
    staleTime: 2 * 60 * 1000,
  });

  const quotesArr = Array.isArray(quotes) ? quotes : [];
  const filteredQuotes = quotesArr.filter((q: any) => {
    if (!quoteSearch) return true;
    const s = quoteSearch.toLowerCase();
    const ref = (q.quoteNumber || q.reference || "").toLowerCase();
    const cn = `${q.clientFirstName || ""} ${q.clientLastName || ""} ${q.clientName || ""}`.toLowerCase();
    return ref.includes(s) || cn.includes(s);
  });
  const selectedQuoteObj = quotesArr.find((q: any) => String(q.id) === String(pickedQuoteId));

  const applyQuote = (q: any) => {
    const ref = q.quoteNumber || q.reference || "Devis associé";
    setPickedQuoteId(String(q.id));
    setPickedQuoteName(ref);
    setShowQuotePicker(false);
    setQuoteSearch("");
    if (q.clientId) setSelectedClientId(String(q.clientId));
    if (!notes) setNotes(`Devis: ${ref}`);
    // Auto-select service from quote
    const qServiceId = q.serviceId || (Array.isArray(q.services) && q.services[0]?.id) || "";
    if (qServiceId) setSelectedServiceIds(prev => prev.includes(String(qServiceId)) ? prev : [...prev, String(qServiceId)]);
  };

  useFocusEffect(
    useCallback(() => {
      const newId = consumePendingNewClientId();
      if (newId) {
        setSelectedClientId(newId);
        setShowClientPicker(false);
        queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      }
    }, [queryClient])
  );

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: adminClients.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const clientsArr = Array.isArray(clients) ? clients : [];

  const filteredClients = clientsArr.filter((c: any) => {
    if (!clientSearch) return true;
    const s = clientSearch.toLowerCase();
    const name = `${c.firstName || ""} ${c.lastName || ""} ${c.email || ""}`.toLowerCase();
    return name.includes(s);
  });

  const selectedClient = clientsArr.find((c: any) => String(c.id) === String(selectedClientId));

  const clientLabel = selectedClient
    ? `${selectedClient.firstName || ""} ${selectedClient.lastName || ""}`.trim() || selectedClient.name || selectedClient.email || "Client"
    : selectedClientId ? `Client #${selectedClientId}` : "Sélectionner un client";

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedClientId) throw new Error("Veuillez sélectionner un client.");
      const payload: any = {
        clientId: selectedClientId,
        serviceId: selectedServiceIds[0] || "",
        serviceIds: selectedServiceIds,
        scheduledDate: startDate,
        date: startDate,
        start_date: startDate,
        startDate: startDate,
        estimatedEndDate: endDate,
        end_date: endDate,
        endDate: endDate,
      };
      if (!isEditMode) payload.status = "pending";
      if (pickedQuoteId) payload.quoteId = pickedQuoteId;
      if (serviceType) payload.serviceType = serviceType;
      if (notes) payload.notes = notes;
      if (isEditMode) {
        return adminReservations.update(editId, payload);
      }
      return adminReservations.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reservations"] });
      if (isEditMode) queryClient.invalidateQueries({ queryKey: ["admin-reservation", editId] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({
        type: "success",
        title: isEditMode ? "Rendez-vous modifié" : "Rendez-vous créé",
        message: isEditMode ? "Le rendez-vous a été modifié avec succès." : "Le rendez-vous a été planifié avec succès.",
        buttons: [{ text: "OK", style: "primary", onPress: () => router.back() }],
      });
    },
    onError: (err: any) => {
      showAlert({
        type: "error",
        title: "Erreur",
        message: err?.message || (isEditMode ? "Impossible de modifier le rendez-vous." : "Impossible de créer le rendez-vous."),
        buttons: [{ text: "OK", style: "primary" }],
      });
    },
  });

  const canSubmit = !!selectedClientId && (isEditMode || selectedServiceIds.length > 0) && !!startDate && !mutation.isPending;

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  if (isEditMode && !editLoaded) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, gap: 14 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Quote Picker */}
        <View style={styles.section}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={styles.sectionTitle}>Devis lié</Text>
            {pickedQuoteId && !paramClientId && (
              <Pressable onPress={() => { setPickedQuoteId(""); setPickedQuoteName(""); setSelectedClientId(""); setSelectedServiceIds([]); }}>
                <Text style={{ fontSize: 11, color: theme.textTertiary, fontFamily: "Exo2_400Regular" }}>Effacer</Text>
              </Pressable>
            )}
          </View>
          {pickedQuoteId ? (
            <View style={styles.quoteSelected}>
              <View style={styles.quoteSelectedIcon}>
                <Ionicons name="document-text" size={18} color={theme.primary} />
              </View>
              <Text style={styles.quoteSelectedRef}>{pickedQuoteName || "Devis associé"}</Text>
              <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            </View>
          ) : (
            <>
              <Pressable style={styles.pickerBtn} onPress={() => setShowQuotePicker(!showQuotePicker)}>
                <Text style={[styles.pickerText, { color: theme.textTertiary }]}>Sélectionner un devis (optionnel)</Text>
                <Ionicons name={showQuotePicker ? "chevron-up" : "chevron-down"} size={18} color={theme.textTertiary} />
              </Pressable>
              {showQuotePicker && (
                <View style={styles.clientDropdown}>
                  <View style={styles.clientSearch}>
                    <Ionicons name="search" size={15} color={theme.textTertiary} />
                    <TextInput
                      style={styles.clientSearchInput}
                      placeholder="Rechercher un devis..."
                      placeholderTextColor={theme.textTertiary}
                      value={quoteSearch}
                      onChangeText={setQuoteSearch}
                      autoCapitalize="none"
                    />
                  </View>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {quotesLoading ? (
                      <ActivityIndicator size="small" color={theme.primary} style={{ padding: 12 }} />
                    ) : filteredQuotes.length === 0 ? (
                      <Text style={styles.noClient}>Aucun devis trouvé</Text>
                    ) : (
                      filteredQuotes.map((q: any) => {
                        const ref = q.quoteNumber || q.reference || "Devis";
                        const cn = `${q.clientFirstName || ""} ${q.clientLastName || ""}`.trim() || q.clientName || "";
                        return (
                          <Pressable key={q.id} style={styles.clientOption} onPress={() => applyQuote(q)}>
                            <Text style={styles.clientOptionName}>{ref}</Text>
                            {cn ? <Text style={styles.clientOptionEmail}>{cn}</Text> : null}
                          </Pressable>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </View>

        {/* Client Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client *</Text>
          {(paramClientId || pickedQuoteId) && selectedClient ? (
            <View style={styles.clientRow}>
              <View style={styles.clientAvatar}>
                <Ionicons name="person" size={18} color={theme.primary} />
              </View>
              <Text style={styles.clientName}>{clientLabel}</Text>
            </View>
          ) : (
            <>
              <Pressable style={styles.pickerBtn} onPress={() => setShowClientPicker(!showClientPicker)}>
                <Text style={[styles.pickerText, !selectedClient && { color: theme.textTertiary }]}>
                  {clientLabel}
                </Text>
                <Ionicons name={showClientPicker ? "chevron-up" : "chevron-down"} size={18} color={theme.textTertiary} />
              </Pressable>
              {showClientPicker && (
                <View style={styles.clientDropdown}>
                  <View style={styles.clientSearch}>
                    <Ionicons name="search" size={15} color={theme.textTertiary} />
                    <TextInput
                      style={styles.clientSearchInput}
                      placeholder="Rechercher..."
                      placeholderTextColor={theme.textTertiary}
                      value={clientSearch}
                      onChangeText={setClientSearch}
                      autoCapitalize="none"
                    />
                  </View>
                  <Pressable
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.primary + "10" }}
                    onPress={() => router.push({ pathname: "/(admin)/client-form", params: { returnTo: "reservation-create" } } as any)}
                  >
                    <Ionicons name="person-add-outline" size={16} color={theme.primary} />
                    <Text style={{ fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.primary }}>Nouveau client</Text>
                  </Pressable>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {clientsLoading ? (
                      <ActivityIndicator size="small" color={theme.primary} style={{ padding: 12 }} />
                    ) : filteredClients.length === 0 ? (
                      <Text style={styles.noClient}>Aucun client trouvé</Text>
                    ) : (
                      filteredClients.map((c: any) => (
                        <Pressable
                          key={c.id}
                          style={[styles.clientOption, String(selectedClientId) === String(c.id) && { backgroundColor: theme.primary + "20" }]}
                          onPress={() => { setSelectedClientId(String(c.id)); setShowClientPicker(false); setClientSearch(""); }}
                        >
                          <Text style={[styles.clientOptionName, String(selectedClientId) === String(c.id) && { color: theme.primary }]}>
                            {`${c.firstName || ""} ${c.lastName || ""}`.trim() || c.email}
                          </Text>
                          <Text style={styles.clientOptionEmail}>{c.email}</Text>
                        </Pressable>
                      ))
                    )}
                  </ScrollView>
                </View>
              )}
            </>
          )}
        </View>

        {/* Service Picker (Multi-Select) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services *</Text>
          {selectedServicesArr.length > 0 && (
            <View style={{ gap: 6 }}>
              {selectedServicesArr.map((s: any) => (
                <View key={s.id} style={styles.quoteSelected}>
                  <View style={styles.quoteSelectedIcon}>
                    <Ionicons name="construct" size={18} color={theme.primary} />
                  </View>
                  <Text style={[styles.quoteSelectedRef, { flex: 1 }]}>{s.name || s.title || `Service #${s.id}`}</Text>
                  <Pressable onPress={() => setSelectedServiceIds(prev => prev.filter(sid => sid !== String(s.id)))}>
                    <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Pressable style={styles.pickerBtn} onPress={() => setShowServicePicker(!showServicePicker)}>
            <Text style={[styles.pickerText, { color: selectedServicesArr.length > 0 ? theme.text : theme.textTertiary }]}>
              {selectedServicesArr.length > 0 ? "Ajouter un service" : serviceLabel}
            </Text>
            <Ionicons name={showServicePicker ? "chevron-up" : "chevron-down"} size={18} color={theme.textTertiary} />
          </Pressable>
          {showServicePicker && (
            <View style={[styles.clientDropdown, { marginTop: 4 }]}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {servicesLoading ? (
                  <ActivityIndicator size="small" color={theme.primary} style={{ padding: 12 }} />
                ) : servicesArr.length === 0 ? (
                  <Text style={styles.noClient}>Aucun service disponible</Text>
                ) : (
                  servicesArr.map((s: any) => {
                    const isSelected = selectedServiceIds.includes(String(s.id));
                    return (
                      <Pressable
                        key={s.id}
                        style={[styles.clientOption, isSelected && { backgroundColor: theme.primary + "20" }]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedServiceIds(prev => prev.filter(sid => sid !== String(s.id)));
                          } else {
                            setSelectedServiceIds(prev => [...prev, String(s.id)]);
                          }
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Ionicons
                            name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                            size={20}
                            color={isSelected ? theme.primary : theme.textTertiary}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.clientOptionName, isSelected && { color: theme.primary }]}>
                              {s.name || s.title || `Service #${s.id}`}
                            </Text>
                            {s.description ? <Text style={styles.clientOptionEmail} numberOfLines={1}>{s.description}</Text> : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dates *</Text>
          <DateTimePicker
            label="Date et heure de début"
            value={startDate}
            onChange={(iso) => {
              setStartDate(iso);
              const start = new Date(iso);
              const end = new Date(endDate);
              if (end <= start) {
                setEndDate(new Date(start.getTime() + 60 * 60 * 1000).toISOString());
              }
            }}
            showTime
            minDate={isEditMode ? undefined : new Date()}
          />
          <DateTimePicker
            label="Date et heure de fin"
            value={endDate}
            onChange={setEndDate}
            showTime
            minDate={startDate ? new Date(startDate) : (isEditMode ? undefined : new Date())}
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (optionnel)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Informations complémentaires..."
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Submit */}
        <Pressable
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={() => mutation.mutate()}
          disabled={!canSubmit}
        >
          {mutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name={isEditMode ? "checkmark-circle-outline" : "calendar-outline"} size={18} color="#fff" />
                <Text style={styles.submitBtnText}>{isEditMode ? "Enregistrer les modifications" : "Confirmer le rendez-vous"}</Text>
              </>
          }
        </Pressable>
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
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.text, textAlign: "center" },
  section: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
  pickerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: theme.inputBg || theme.background, borderRadius: 10, borderWidth: 1,
    borderColor: theme.inputBorder || theme.border, paddingHorizontal: 12, paddingVertical: 11,
  },
  pickerText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
  clientDropdown: { borderRadius: 10, borderWidth: 1, borderColor: theme.border, overflow: "hidden", marginTop: 4 },
  clientSearch: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.background },
  clientSearchInput: { flex: 1, fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.text },
  noClient: { padding: 12, fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textTertiary, textAlign: "center" },
  addClientBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.primary + "08",
  },
  addClientIcon: {
    width: 30, height: 30, borderRadius: 8,
    justifyContent: "center", alignItems: "center",
  },
  addClientText: { flex: 1, fontSize: 14, fontFamily: "Exo2_600SemiBold" },
  clientOption: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 2 },
  clientOptionName: { fontSize: 13, fontFamily: "Exo2_600SemiBold", color: theme.text },
  clientOptionEmail: { fontSize: 11, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  clientRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  clientAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.primary + "15", justifyContent: "center", alignItems: "center" },
  clientName: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text, flex: 1 },
  quoteRef: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  quoteRefText: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.primary },
  quoteSelected: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.primary + "10", borderRadius: 10, borderWidth: 1,
    borderColor: theme.primary + "40", paddingHorizontal: 12, paddingVertical: 10,
  },
  quoteSelectedIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: theme.primary + "15", justifyContent: "center", alignItems: "center" },
  quoteSelectedRef: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.primary },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textSecondary },
  input: {
    backgroundColor: theme.inputBg || theme.background, borderRadius: 10, borderWidth: 1,
    borderColor: theme.inputBorder || theme.border, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text,
  },
  textarea: { minHeight: 80, paddingTop: 10 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.primary, borderRadius: 14, height: 54,
  },
  submitBtnDisabled: { backgroundColor: theme.border },
  submitBtnText: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: "#fff" },
});
