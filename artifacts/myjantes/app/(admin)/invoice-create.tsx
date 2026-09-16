import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert,
  TextInput, ActivityIndicator, FlatList,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminInvoices, adminClients, adminServices } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { consumePendingNewClientId } from "@/lib/new-client-store";

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  tvaRate: string;
  originalId?: string;
}

interface OriginalItemSnapshot {
  description: string;
  quantity: string;
  unitPrice: string;
  tvaRate: string;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const TVA_OPTIONS = ["0", "10", "20"];

const PAYMENT_METHODS: { key: string; label: string }[] = [
  { key: "wire_transfer", label: "Virement bancaire" },
  { key: "card", label: "Carte bancaire" },
  { key: "cash", label: "Espèces" },
  { key: "sepa", label: "Prélèvement SEPA" },
  { key: "stripe", label: "Stripe" },
  { key: "klarna", label: "Klarna" },
  { key: "alma", label: "Alma" },
];

function calcTTC(item: LineItem): number {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  const tva = parseFloat(item.tvaRate) || 0;
  return qty * price * (1 + tva / 100);
}

function calcTotals(items: LineItem[]): { totalHT: number; totalTVA: number; totalTTC: number } {
  let totalHT = 0;
  let totalTTC = 0;
  for (const it of items) {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unitPrice) || 0;
    const tva = parseFloat(it.tvaRate) || 0;
    totalHT += qty * price;
    totalTTC += qty * price * (1 + tva / 100);
  }
  return { totalHT, totalTVA: totalTTC - totalHT, totalTTC };
}

function fmtEur(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}


export default function InvoiceCreateScreen() {
  const params = useLocalSearchParams();
  const paramClientId = Array.isArray(params.clientId) ? params.clientId[0] : (params.clientId as string || "");
  const editId = Array.isArray(params.editId) ? params.editId[0] : (params.editId as string || "");
  const isEditMode = !!editId;
  const originalItemsRef = useRef<Map<string, OriginalItemSnapshot>>(new Map());

  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { showAlert, AlertComponent } = useCustomAlert();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(paramClientId || null);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([{ id: uid(), description: "", quantity: "1", unitPrice: "", tvaRate: "20" }]);
  const [photos, setPhotos] = useState<{ uri: string; name: string }[]>([]);
  const [editLoaded, setEditLoaded] = useState(false);

  const { data: editInvoice } = useQuery({
    queryKey: ["admin-invoice", editId],
    queryFn: () => adminInvoices.getById(editId),
    enabled: isEditMode && !editLoaded,
  });

  useEffect(() => {
    if (!isEditMode || editLoaded || !editInvoice) return;
    if (editInvoice.clientId) setSelectedClientId(String(editInvoice.clientId));
    if (editInvoice.notes) setNotes(editInvoice.notes);
    if (editInvoice.description) setNotes(editInvoice.description);
    if (editInvoice.paymentMethod) setPaymentMethod(editInvoice.paymentMethod);
    const rawItems: any[] = editInvoice.items || editInvoice.lineItems || editInvoice.lines || editInvoice.invoice_lines || [];
    const existingItems = rawItems.filter((it: any) => {
      const desc = String(it.description || it.name || "").trim();
      const price = parseFloat(String(it.unit_price_excluding_tax ?? it.unitPriceExcludingTax ?? it.unitPrice ?? it.unit_price ?? it.price ?? 0)) || 0;
      return desc.length > 0 || price > 0;
    });
    if (existingItems.length > 0) {
      const snapshots = new Map<string, OriginalItemSnapshot>();
      const mapped = existingItems.map((it: any) => {
        const description = it.description || it.name || "";
        const quantity = String(it.quantity ?? 1);
        const unitPrice = String(it.unit_price_excluding_tax ?? it.unitPriceExcludingTax ?? it.unitPrice ?? it.unit_price ?? it.price ?? 0);
        const tvaRate = String(it.tax_rate ?? it.taxRate ?? it.tvaRate ?? 20);
        const originalId = it.id ? String(it.id) : undefined;
        if (originalId) {
          snapshots.set(originalId, { description, quantity, unitPrice, tvaRate });
        }
        return { id: uid(), description, quantity, unitPrice, tvaRate, originalId };
      });
      originalItemsRef.current = snapshots;
      setLineItems(mapped);
    } else {
      originalItemsRef.current = new Map();
      setLineItems([{ id: uid(), description: "", quantity: "1", unitPrice: "", tvaRate: "20" }]);
    }
    setEditLoaded(true);
  }, [editInvoice, isEditMode, editLoaded]);

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

  const { data: services = [] } = useQuery({
    queryKey: ["admin-services"],
    queryFn: adminServices.getAll,
    staleTime: 10 * 60 * 1000,
  });

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

  const selectedClient = clientsArr.find((c: any) => c.id === selectedClientId);
  const selectedClientLabel = selectedClient
    ? `${selectedClient.firstName || ""} ${selectedClient.lastName || ""}`.trim() || selectedClient.email
    : "Sélectionner un client";

  const selectedPaymentLabel = paymentMethod
    ? PAYMENT_METHODS.find(p => p.key === paymentMethod)?.label || paymentMethod
    : "Sélectionner un mode de paiement";

  const servicesArr = Array.isArray(services) ? services : [];

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const rawItems: any[] = Array.isArray(payload.items) ? payload.items : [];
      const mappedItems = rawItems.map((item: any) => {
        const qty = parseFloat(String(item.quantity)) || 1;
        const price = parseFloat(String(item.unit_price_excluding_tax || item.unit_price)) || 0;
        const tax = parseFloat(String(item.tax_rate)) || 0;
        const totalHT = qty * price;
        const taxAmt = totalHT * (tax / 100);
        const totalTTC = totalHT + taxAmt;
        return {
          description: item.description,
          quantity: String(qty),
          unitPriceExcludingTax: price.toFixed(2),
          totalExcludingTax: totalHT.toFixed(2),
          taxRate: String(tax),
          taxAmount: taxAmt.toFixed(2),
          totalIncludingTax: totalTTC.toFixed(2),
          originalId: item.originalId as string | undefined,
        };
      });

      if (isEditMode) {
        // 1) PATCH the entity (fields only, no items array — items handled per-line below).
        //    Status is intentionally NOT changed here (edited from the detail screen
        //    via adminInvoices.updateStatus). We forward it untouched so the backend
        //    keeps its current value.
        const entityResp = await adminInvoices.update(editId, {
          clientId: payload.clientId,
          total_excluding_tax: payload.total_excluding_tax,
          total_including_tax: payload.total_including_tax,
          amount: payload.amount,
          notes: payload.notes,
          paymentMethod: payload.paymentMethod,
          status: editInvoice?.status,
        });

        // 2) Diff items: DELETE removed, PATCH updated, POST new.
        //    Each successful sub-op updates originalItemsRef so retries are
        //    idempotent (no double-delete, no duplicate POST, no stale PATCH).
        const original = originalItemsRef.current;
        const currentOriginalIds = new Set<string>(
          mappedItems.map(it => it.originalId).filter((x): x is string => !!x)
        );

        const newAddedIds: { lineUid: string; newId: string }[] = [];

        for (const origId of Array.from(original.keys())) {
          if (!currentOriginalIds.has(origId)) {
            await adminInvoices.deleteItem(editId, origId);
            original.delete(origId);
          }
        }

        for (let i = 0; i < mappedItems.length; i++) {
          const item = mappedItems[i];
          const itemPayload = {
            description: item.description,
            quantity: item.quantity,
            unitPriceExcludingTax: item.unitPriceExcludingTax,
            totalExcludingTax: item.totalExcludingTax,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            totalIncludingTax: item.totalIncludingTax,
          };
          const snapshot: OriginalItemSnapshot = {
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPriceExcludingTax,
            tvaRate: item.taxRate,
          };

          if (item.originalId) {
            const orig = original.get(item.originalId);
            const changed = !orig
              || orig.description !== snapshot.description
              || (parseFloat(orig.quantity) || 0) !== parseFloat(snapshot.quantity)
              || (parseFloat(orig.unitPrice) || 0) !== parseFloat(snapshot.unitPrice)
              || (parseFloat(orig.tvaRate) || 0) !== parseFloat(snapshot.tvaRate);
            if (changed) {
              await adminInvoices.updateItem(editId, item.originalId, itemPayload);
              original.set(item.originalId, snapshot);
            }
          } else {
            const created = await adminInvoices.addItem(editId, itemPayload);
            const newId = created?.id ? String(created.id) : undefined;
            if (newId) {
              original.set(newId, snapshot);
              const lineUid = lineItems[i]?.id;
              if (lineUid) newAddedIds.push({ lineUid, newId });
            }
          }
        }

        // Reflect newly-created item IDs into React state so subsequent saves
        // in the same screen treat them as updates rather than re-creating them.
        if (newAddedIds.length > 0) {
          setLineItems(prev => prev.map(li => {
            const hit = newAddedIds.find(x => x.lineUid === li.id);
            return hit ? { ...li, originalId: hit.newId } : li;
          }));
        }

        // 3) Refresh local cache (document_amounts.items) with the final state
        //    of the lines. The per-item endpoints update the upstream API but
        //    not the local cache, so without this PATCH the cache stays stale
        //    and overrides the fresh upstream data on the next GET (causing
        //    edits to "disappear" from the edit screen, the preview and the PDF).
        try {
          await adminInvoices.update(editId, {
            clientId: payload.clientId,
            total_excluding_tax: payload.total_excluding_tax,
            total_including_tax: payload.total_including_tax,
            amount: payload.amount,
            notes: payload.notes,
            paymentMethod: payload.paymentMethod,
            status: editInvoice?.status,
            items: mappedItems,
          });
        } catch (cacheErr: any) {
          console.warn("[InvoiceCreate] Local items cache refresh failed (non-blocking):", cacheErr?.message);
        }

        return entityResp;
      }

      const invoiceShell = await adminInvoices.create({
        clientId: payload.clientId,
        status: payload.status,
        total_excluding_tax: payload.total_excluding_tax,
        total_including_tax: payload.total_including_tax,
        amount: payload.amount,
        issueDate: payload.issueDate,
        dueDate: payload.dueDate,
        notes: payload.notes,
        paymentMethod: payload.paymentMethod,
        items: mappedItems,
        lineItems: mappedItems,
      });
      
      if (!invoiceShell?.id) throw new Error("Invoice creation failed: no ID returned");

      // PATCH immediately after to guarantee items are saved (replace-all semantics)
      if (mappedItems.length > 0) {
        try {
          await adminInvoices.update(invoiceShell.id, {
            clientId: payload.clientId,
            total_excluding_tax: payload.total_excluding_tax,
            total_including_tax: payload.total_including_tax,
            amount: payload.amount,
            notes: payload.notes,
            paymentMethod: payload.paymentMethod,
            items: mappedItems,
          });
        } catch (patchErr: any) {
          console.warn("[InvoiceCreate] Item PATCH after create failed (non-blocking):", patchErr?.message);
        }
      }

      const photosList: any[] = payload.photos || [];
      if (photosList.length > 0) {
        const mediaForm = new FormData();
        photosList.forEach((photo: any, idx: number) => {
          mediaForm.append("media", new File(photo.uri), photo.name || `invoice_photo_${idx}.jpg`);
        });
        await adminInvoices.addMedia(invoiceShell.id, mediaForm);
      }
      
      return invoiceShell;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["admin-invoice", editId] });
        queryClient.invalidateQueries({ queryKey: ["admin-invoice-items", editId] });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({
        type: "success",
        title: isEditMode ? "Facture modifiée" : "Facture créée",
        message: isEditMode ? "La facture a été modifiée avec succès." : "La facture a été créée avec succès.",
        buttons: [{ text: "OK", style: "primary", onPress: () => router.back() }],
      });
    },
    onError: (err: any) => {
      showAlert({
        type: "error",
        title: "Erreur",
        message: err?.message || (isEditMode ? "Impossible de modifier la facture." : "Impossible de créer la facture."),
        buttons: [{ text: "OK", style: "primary" }],
      });
    },
  });

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: uid(), description: "", quantity: "1", unitPrice: "", tvaRate: "20" }]);
  };

  const removeLineItem = (idx: number) => {
    setLineItems(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updateLineItem = (idx: number, field: keyof LineItem, val: string) => {
    setLineItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const { totalHT, totalTVA, totalTTC } = calcTotals(lineItems);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission requise", "Acceptez l'accès à votre galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const newPhotos = result.assets.map((a: any) => ({
        uri: a.uri,
        name: a.fileName || `photo_${Date.now()}`,
      }));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleSubmit = () => {
    if (!selectedClientId) {
      showAlert({ type: "warning", title: "Attention", message: "Veuillez sélectionner un client.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }

    for (let i = 0; i < lineItems.length; i++) {
      const it = lineItems[i];
      if (!it.description.trim()) {
        showAlert({ type: "warning", title: "Attention", message: `Prestation ${i + 1} : la description est obligatoire.`, buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      const priceNum = parseFloat((it.unitPrice || "").trim());
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        showAlert({ type: "warning", title: "Attention", message: `Prestation ${i + 1} : le prix unitaire doit être un nombre supérieur à 0.`, buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      const qtyNum = parseFloat((it.quantity || "").trim());
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        showAlert({ type: "warning", title: "Attention", message: `Prestation ${i + 1} : la quantité doit être un nombre supérieur à 0.`, buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
    }

    const mappedItems = lineItems.map(it => {
      const qty = parseFloat(it.quantity) || 1;
      const price = parseFloat(it.unitPrice) || 0;
      const tax = parseFloat(it.tvaRate) || 0;
      return {
        description: it.description.trim(),
        quantity: qty,
        unit_price: price.toString(),
        unit_price_excluding_tax: price.toString(),
        tax_rate: tax.toString(),
        originalId: it.originalId,
      };
    });

    const dominantTva = lineItems.length > 0
      ? (parseFloat(lineItems[0].tvaRate) || 20).toString()
      : "20";

    const issueDate = new Date().toISOString().split("T")[0];
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 1);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const payload = {
      clientId: selectedClientId,
      status: "pending",
      items: mappedItems,
      total_excluding_tax: totalHT.toFixed(2),
      total_including_tax: totalTTC.toFixed(2),
      amount: totalTTC.toFixed(2),
      issueDate,
      dueDate: dueDateStr,
      notes: notes.trim() || null,
      paymentMethod: paymentMethod || null,
      photos,
    };
    
    createMutation.mutate(payload);
  };

  return (
    <View style={styles.container}>
      {AlertComponent}
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? "Modifier la facture" : "Nouvelle facture"}</Text>
        <Pressable
          style={[styles.submitHeaderBtn, createMutation.isPending && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.submitHeaderText}>{isEditMode ? "Enregistrer" : "Créer"}</Text>}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, gap: 14 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Client Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client *</Text>
          <Pressable style={styles.pickerBtn} onPress={() => setShowClientPicker(!showClientPicker)}>
            <Text style={[styles.pickerText, !selectedClient && { color: theme.textTertiary }]}>
              {selectedClientLabel}
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
                onPress={() => router.push({ pathname: "/(admin)/client-form", params: { returnTo: "invoice-create" } } as any)}
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
                      onPress={() => {
                        setSelectedClientId(String(c.id));
                        setShowClientPicker(false);
                        setClientSearch("");
                      }}
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
        </View>

        {/* Mode de paiement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mode de paiement (optionnel)</Text>
          <Pressable style={styles.pickerBtn} onPress={() => setShowPaymentPicker(!showPaymentPicker)}>
            <Text style={[styles.pickerText, !paymentMethod && { color: theme.textTertiary }]}>
              {selectedPaymentLabel}
            </Text>
            <Ionicons name={showPaymentPicker ? "chevron-up" : "chevron-down"} size={18} color={theme.textTertiary} />
          </Pressable>
          {showPaymentPicker && (
            <View style={[styles.clientDropdown, { marginTop: 4 }]}>
              {PAYMENT_METHODS.map(p => (
                <Pressable
                  key={p.key}
                  style={[styles.clientOption, paymentMethod === p.key && { backgroundColor: theme.primary + "20" }]}
                  onPress={() => {
                    setPaymentMethod(p.key);
                    setShowPaymentPicker(false);
                  }}
                >
                  <Text style={[styles.clientOptionName, paymentMethod === p.key && { color: theme.primary }]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.clientOption}
                onPress={() => {
                  setPaymentMethod(null);
                  setShowPaymentPicker(false);
                }}
              >
                <Text style={[styles.clientOptionName, { color: theme.textTertiary }]}>Non spécifié</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes / Description</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Description ou remarques..."
            placeholderTextColor={theme.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Services disponibles */}
        {servicesArr.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services disponibles</Text>
            <FlatList
              scrollEnabled={false}
              data={servicesArr}
              keyExtractor={(s: any) => s.id}
              renderItem={({ item: service }: { item: any }) => {
                const servicePrice = service.price || service.unitPrice || service.basePrice || service.priceHT || service.priceExcludingTax || service.hourlyRate || service.rate || 0;
                return (
                  <Pressable
                    style={styles.serviceOption}
                    onPress={() => {
                      setLineItems(prev => [...prev, {
                        id: uid(),
                        description: service.name || service.label || "",
                        quantity: "1",
                        unitPrice: String(servicePrice),
                        tvaRate: "20",
                      }]);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.serviceName}>{service.name || service.label}</Text>
                      {service.description ? <Text style={styles.serviceDesc}>{service.description}</Text> : null}
                    </View>
                    <Text style={styles.servicePrice}>{fmtEur(parseFloat(String(servicePrice)))} HT</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        {/* Photos (optionnel) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos (optionnel, maximum 3)</Text>
          {photos.length > 0 ? (
            <FlatList
              scrollEnabled={false}
              data={photos}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item, index }) => (
                <View style={styles.photoItem}>
                  <ExpoImage source={{ uri: item.uri }} style={styles.photoThumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.photoName} numberOfLines={1}>{item.name}</Text>
                  </View>
                  <Pressable onPress={() => setPhotos(prev => prev.filter((_, i) => i !== index))}>
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </Pressable>
                </View>
              )}
            />
          ) : null}
          {photos.length < 3 && (
            <Pressable style={styles.addPhotoBtn} onPress={pickPhoto}>
              <Ionicons name="image-outline" size={18} color={theme.primary} />
              <Text style={styles.addPhotoBtnText}>Ajouter des photos ({photos.length}/3)</Text>
            </Pressable>
          )}
        </View>

        {/* Prestations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prestations *</Text>
          {lineItems.map((item, idx) => (
            <View key={item.id} style={[styles.lineItemCard, idx > 0 && { marginTop: 10 }]}>
              <View style={styles.lineItemHeader}>
                <Text style={styles.lineItemLabel}>Prestation {idx + 1}</Text>
                {lineItems.length > 1 && (
                  <Pressable onPress={() => removeLineItem(idx)}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </Pressable>
                )}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Description de la prestation"
                placeholderTextColor={theme.textTertiary}
                value={item.description}
                onChangeText={v => updateLineItem(idx, "description", v)}
              />
              <View style={styles.lineItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Qté</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={item.quantity}
                    onChangeText={v => updateLineItem(idx, "quantity", v.replace(",", "."))}
                    placeholder="1"
                    placeholderTextColor={theme.textTertiary}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabel}>Prix HT (€)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={item.unitPrice}
                    onChangeText={v => updateLineItem(idx, "unitPrice", v.replace(",", "."))}
                    placeholder="0.00"
                    placeholderTextColor={theme.textTertiary}
                  />
                </View>
                <View style={{ flex: 1.5 }}>
                  <Text style={styles.fieldLabel}>TVA %</Text>
                  <View style={styles.tvaPickerRow}>
                    {TVA_OPTIONS.map(opt => (
                      <Pressable
                        key={opt}
                        style={[styles.tvaPickerOpt, item.tvaRate === opt && styles.tvaPickerOptActive]}
                        onPress={() => updateLineItem(idx, "tvaRate", opt)}
                      >
                        <Text style={[styles.tvaPickerTxt, item.tvaRate === opt && styles.tvaPickerTxtActive]}>{opt}%</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={styles.lineTotalCalc}>Total TTC : {fmtEur(calcTTC(item))}</Text>
            </View>
          ))}
          <Pressable style={styles.addLineBtn} onPress={addLineItem}>
            <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
            <Text style={styles.addLineBtnText}>Ajouter une prestation</Text>
          </Pressable>
        </View>

        {/* Totaux */}
        <View style={[styles.section, { gap: 6 }]}>
          <Text style={styles.sectionTitle}>Récapitulatif</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{fmtEur(totalHT)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA</Text>
            <Text style={styles.totalValue}>{fmtEur(totalTVA)}</Text>
          </View>
          <View style={[styles.totalRow, { paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border, marginTop: 4 }]}>
            <Text style={[styles.totalLabel, { fontFamily: "Exo2_700Bold", color: theme.text }]}>Total TTC</Text>
            <Text style={{ fontFamily: "Exo2_700Bold", fontSize: 18, color: theme.primary }}>{fmtEur(totalTTC)}</Text>
          </View>
        </View>
      </ScrollView>

    </View>
  );
}

function getStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 18, fontFamily: "Exo2_700Bold", color: theme.text, flex: 1, textAlign: "center" },
    submitHeaderBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.primary,
      borderRadius: 8,
    },
    submitHeaderText: { color: "#fff", fontSize: 14, fontFamily: "Exo2_600SemiBold" },
    section: { gap: 8 },
    sectionTitle: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text },
    pickerBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: theme.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pickerText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
    clientDropdown: {
      marginTop: 6,
      backgroundColor: theme.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    clientSearch: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 8,
    },
    clientSearchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Exo2_400Regular",
      color: theme.text,
    },
    clientOption: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: 2,
    },
    clientOptionName: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.text },
    clientOptionEmail: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
    noClient: { paddingHorizontal: 12, paddingVertical: 12, color: theme.textTertiary },
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
    input: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.card,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: 14,
      fontFamily: "Exo2_400Regular",
      color: theme.text,
    },
    textarea: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.card,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: 14,
      fontFamily: "Exo2_400Regular",
      color: theme.text,
      minHeight: 80,
    },
    serviceOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.card,
      borderRadius: 6,
      marginVertical: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    serviceName: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.text, flex: 1 },
    serviceDesc: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary, marginTop: 2 },
    servicePrice: { fontSize: 13, fontFamily: "Exo2_600SemiBold", color: theme.primary },
    photoItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.card,
      borderRadius: 6,
      marginVertical: 4,
    },
    photoThumb: { width: 50, height: 50, borderRadius: 6 },
    photoName: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.text, flex: 1 },
    addPhotoBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      backgroundColor: theme.primary + "10",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primary,
      marginVertical: 8,
    },
    addPhotoBtnText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.primary },
    lineItemCard: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: theme.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    lineItemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    lineItemLabel: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
    lineItemRow: {
      flexDirection: "row",
      gap: 10,
    },
    fieldLabel: { fontSize: 12, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, marginBottom: 4 },
    tvaPickerRow: {
      flexDirection: "row",
      gap: 4,
    },
    tvaPickerOpt: {
      flex: 1,
      paddingVertical: 10,
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    tvaPickerOptActive: {
      backgroundColor: theme.primary + "15",
      borderColor: theme.primary,
    },
    tvaPickerTxt: { fontSize: 12, fontFamily: "Exo2_600SemiBold", color: theme.textSecondary },
    tvaPickerTxtActive: { color: theme.primary },
    lineTotalCalc: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.primary, marginTop: 4 },
    addLineBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      backgroundColor: theme.primary + "10",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primary,
      marginVertical: 8,
    },
    addLineBtnText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.primary },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    totalLabel: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.textTertiary },
    totalValue: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
  });
}
