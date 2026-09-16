import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, ActivityIndicator, Alert, FlatList,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminQuotes, adminClients, adminServices } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { consumePendingNewClientId } from "@/lib/new-client-store";

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  tvaRate: string;
  fromServiceId?: string;
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

export default function QuoteCreateScreen() {
  const params = useLocalSearchParams();
  const editId = Array.isArray(params.editId) ? params.editId[0] : (params.editId as string || "");
  const isEditMode = !!editId;
  const originalItemsRef = useRef<Map<string, OriginalItemSnapshot>>(new Map());

  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [photos, setPhotos] = useState<{ uri: string; name: string }[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [showServicesPicker, setShowServicesPicker] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: uid(), description: "", quantity: "1", unitPrice: "", tvaRate: "20" },
  ]);
  const [editLoaded, setEditLoaded] = useState(false);

  const { data: editQuote } = useQuery({
    queryKey: ["admin-quote", editId],
    queryFn: () => adminQuotes.getById(editId),
    enabled: isEditMode && !editLoaded,
  });

  useEffect(() => {
    if (!isEditMode || editLoaded || !editQuote) return;
    if (editQuote.clientId) setSelectedClientId(String(editQuote.clientId));
    if (editQuote.notes) setNotes(editQuote.notes);
    if (editQuote.description) setNotes(editQuote.description);
    if (editQuote.vehicleInfo) {
      let vi = editQuote.vehicleInfo;
      if (typeof vi === "string") {
        try { vi = JSON.parse(vi); } catch {}
      }
      if (vi && typeof vi === "object") {
        setVehicleBrand(vi.brand || vi.marque || "");
        setVehicleModel(vi.model || vi.modele || "");
        setVehiclePlate(vi.plate || vi.immatriculation || vi.registration || "");
      }
    }
    const rawItems: any[] = editQuote.items || editQuote.lineItems || editQuote.lines || editQuote.quote_items || [];
    const existingItems = rawItems.filter((it: any) => {
      const desc = String(it.description || it.name || "").trim();
      const price = parseFloat(String(it.unit_price_excluding_tax ?? it.unitPriceExcludingTax ?? it.unitPrice ?? it.unit_price ?? it.price ?? 0)) || 0;
      return desc.length > 0 || price > 0;
    });
    if (existingItems.length > 0) {
      const snapshots = new Map<string, OriginalItemSnapshot>();
      const linkedServiceIds: string[] = [];
      const mapped = existingItems.map((it: any) => {
        const description = it.description || it.name || "";
        const quantity = String(it.quantity ?? 1);
        const unitPrice = String(it.unit_price_excluding_tax ?? it.unitPriceExcludingTax ?? it.unitPrice ?? it.unit_price ?? it.price ?? 0);
        const tvaRate = String(it.tax_rate ?? it.taxRate ?? it.tvaRate ?? 20);
        const originalId = it.id ? String(it.id) : undefined;
        const fromServiceRaw = it.fromServiceId ?? it.serviceId ?? it.service_id ?? it.from_service_id;
        const fromServiceId = fromServiceRaw ? String(fromServiceRaw) : undefined;
        if (fromServiceId) linkedServiceIds.push(fromServiceId);
        if (originalId) snapshots.set(originalId, { description, quantity, unitPrice, tvaRate });
        return { id: uid(), description, quantity, unitPrice, tvaRate, originalId, fromServiceId };
      });
      originalItemsRef.current = snapshots;
      setLineItems(mapped);
      if (linkedServiceIds.length > 0) {
        setSelectedServices(prev => Array.from(new Set([...prev, ...linkedServiceIds])));
      }
    } else {
      originalItemsRef.current = new Map();
    }
    setEditLoaded(true);
  }, [editQuote, isEditMode, editLoaded]);

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

  const { data: services = [] } = useQuery({
    queryKey: ["admin-services"],
    queryFn: adminServices.getAll,
    staleTime: 10 * 60 * 1000,
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

  const createMutation = useMutation({
    mutationFn: async (payload: {
      clientId: string;
      serviceId?: string;
      status: string;
      notes?: string;
      vehicleInfo?: any;
      validItems: Array<{ description: string; quantity: string; unitPrice: string; tvaRate: string; originalId?: string }>;
      photos: Array<{ uri: string; name: string }>;
    }) => {
      if (isEditMode) {
        const mappedItems = payload.validItems.map(it => {
          const qty = parseFloat(it.quantity) || 1;
          const price = parseFloat(it.unitPrice) || 0;
          const tva = parseFloat(it.tvaRate) || 0;
          const totalHT = qty * price;
          const taxAmount = totalHT * (tva / 100);
          const totalTTC = totalHT + taxAmount;
          return {
            description: it.description.trim(),
            quantity: String(qty),
            unitPriceExcludingTax: price.toFixed(2),
            totalExcludingTax: totalHT.toFixed(2),
            taxRate: String(tva),
            taxAmount: taxAmount.toFixed(2),
            totalIncludingTax: totalTTC.toFixed(2),
            originalId: it.originalId as string | undefined,
          };
        });
        const sumHT = mappedItems.reduce((s, it) => s + (parseFloat(it.totalExcludingTax) || 0), 0);
        const sumTTC = mappedItems.reduce((s, it) => s + (parseFloat(it.totalIncludingTax) || 0), 0);

        // 1) PATCH the entity (no items array — items handled per-line).
        //    Status is intentionally NOT changed here (managed via the detail
        //    screen action / adminQuotes.updateStatus). We forward it
        //    untouched so the backend keeps its current value.
        const updateBody: any = {
          clientId: payload.clientId,
          notes: payload.notes || null,
          priceExcludingTax: sumHT.toFixed(2),
          total_excluding_tax: sumHT.toFixed(2),
          quoteAmount: sumTTC.toFixed(2),
          total_including_tax: sumTTC.toFixed(2),
          amount: sumTTC.toFixed(2),
          status: editQuote?.status,
        };
        if (payload.vehicleInfo) updateBody.vehicleInfo = payload.vehicleInfo;
        const entityResp = await adminQuotes.update(editId, updateBody);

        // 2) Diff items: DELETE removed, PATCH updated, POST new.
        //    Each successful sub-op updates originalItemsRef so retries
        //    are idempotent (no double-delete, no duplicate POST).
        const original = originalItemsRef.current;
        const currentOriginalIds = new Set<string>(
          mappedItems.map(it => it.originalId).filter((x): x is string => !!x)
        );
        const newAddedIds: { lineUid: string; newId: string }[] = [];

        for (const origId of Array.from(original.keys())) {
          if (!currentOriginalIds.has(origId)) {
            await adminQuotes.deleteItem(editId, origId);
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
              await adminQuotes.updateItem(editId, item.originalId, itemPayload);
              original.set(item.originalId, snapshot);
            }
          } else {
            const created = await adminQuotes.addItem(editId, itemPayload);
            const newId = created?.id ? String(created.id) : undefined;
            if (newId) {
              original.set(newId, snapshot);
              const lineUid = lineItems[i]?.id;
              if (lineUid) newAddedIds.push({ lineUid, newId });
            }
          }
        }

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
          const refreshBody: any = { ...updateBody, items: mappedItems };
          await adminQuotes.update(editId, refreshBody);
        } catch (cacheErr: any) {
          console.warn("[QuoteCreate] Local items cache refresh failed (non-blocking):", cacheErr?.message);
        }

        return entityResp;
      }

      const createMappedItems = payload.validItems.map(it => {
        const qty = parseFloat(it.quantity) || 1;
        const price = parseFloat(it.unitPrice) || 0;
        const tva = parseFloat(it.tvaRate) || 0;
        const totalHT = qty * price;
        const taxAmount = totalHT * (tva / 100);
        const totalTTC = totalHT + taxAmount;
        return {
          description: it.description.trim(),
          quantity: String(qty),
          unitPriceExcludingTax: price.toFixed(2),
          totalExcludingTax: totalHT.toFixed(2),
          taxRate: String(tva),
          taxAmount: taxAmount.toFixed(2),
          totalIncludingTax: totalTTC.toFixed(2),
        };
      });
      const createSumHT = createMappedItems.reduce((s, it) => s + (parseFloat(it.totalExcludingTax) || 0), 0);
      const createSumTTC = createMappedItems.reduce((s, it) => s + (parseFloat(it.totalIncludingTax) || 0), 0);

      const quoteBody: any = {
        clientId: payload.clientId,
        status: payload.status,
        priceExcludingTax: createSumHT.toFixed(2),
        total_excluding_tax: createSumHT.toFixed(2),
        quoteAmount: createSumTTC.toFixed(2),
        total_including_tax: createSumTTC.toFixed(2),
        amount: createSumTTC.toFixed(2),
        items: createMappedItems,
        lineItems: createMappedItems,
      };
      if (payload.serviceId) quoteBody.serviceId = payload.serviceId;
      if (payload.notes?.trim()) quoteBody.notes = payload.notes.trim();
      if (payload.vehicleInfo) quoteBody.vehicleInfo = payload.vehicleInfo;

      const quote = await adminQuotes.create(quoteBody);
      if (!quote?.id) throw new Error("Échec de la création du devis.");

      // PATCH immediately after to guarantee items are saved (replace-all semantics)
      if (createMappedItems.length > 0) {
        try {
          await adminQuotes.update(quote.id, {
            clientId: payload.clientId,
            priceExcludingTax: createSumHT.toFixed(2),
            total_excluding_tax: createSumHT.toFixed(2),
            quoteAmount: createSumTTC.toFixed(2),
            total_including_tax: createSumTTC.toFixed(2),
            amount: createSumTTC.toFixed(2),
            items: createMappedItems,
          });
        } catch (patchErr: any) {
          console.warn("[QuoteCreate] Item PATCH after create failed (non-blocking):", patchErr?.message);
        }
      }

      if (payload.photos.length > 0) {
        const mediaForm = new FormData();
        payload.photos.forEach((photo, idx) => {
          mediaForm.append("media", new File(photo.uri), photo.name || `quote_photo_${idx}.jpg`);
        });
        await adminQuotes.addMedia(quote.id, mediaForm);
      }

      return quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["admin-quote", editId] });
        queryClient.invalidateQueries({ queryKey: ["admin-quote-items", editId] });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (err: any) => {
      Alert.alert(
        "Erreur",
        err?.message || (isEditMode ? "Impossible de modifier le devis." : "Impossible de créer le devis.")
      );
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

  const servicesArr = Array.isArray(services) ? services : [];

  const selectedServicesRef = React.useRef(selectedServices);
  selectedServicesRef.current = selectedServices;

  const toggleService = (serviceId: string) => {
    const current = selectedServicesRef.current;
    const isDeselecting = current.includes(serviceId);

    // In edit mode, refuse to deselect a service that is linked to a previously
    // saved line (has originalId) — this preserves the service↔line invariant.
    if (isDeselecting && isEditMode) {
      const linkedSavedLine = lineItems.find(it => it.fromServiceId === serviceId && it.originalId);
      if (linkedSavedLine) {
        Alert.alert(
          "Service verrouillé",
          "Ce service est lié à une ligne déjà enregistrée du devis et ne peut pas être retiré ici."
        );
        return;
      }
    }

    const newSelection = isDeselecting
      ? current.filter(id => id !== serviceId)
      : [...current, serviceId];

    setSelectedServices(newSelection);

    const selectedServiceObjs = servicesArr.filter((s: any) => newSelection.includes(s.id));

    setLineItems(prevItems => {
      const prevByService = new Map<string, LineItem>();
      prevItems.forEach(it => {
        if (it.fromServiceId) prevByService.set(it.fromServiceId, it);
      });

      const serviceItems: LineItem[] = selectedServiceObjs.map((s: any) => {
        const existing = prevByService.get(s.id);
        if (existing) {
          // Preserve originalId so the diff doesn't churn existing saved lines.
          return existing;
        }
        return {
          id: uid(),
          description: s.name || s.label || "",
          quantity: "1",
          unitPrice: String(s.price || s.unitPrice || s.basePrice || s.priceHT || s.priceExcludingTax || s.hourlyRate || s.rate || 0),
          tvaRate: String(s.taxRate || s.tvaRate || "20"),
          fromServiceId: s.id,
        };
      });

      const freeFormItems = prevItems.filter(it => !it.fromServiceId && it.description.trim());

      if (newSelection.length > 0) {
        return [...serviceItems, ...freeFormItems];
      }
      return freeFormItems.length > 0
        ? freeFormItems
        : [{ id: uid(), description: "", quantity: "1", unitPrice: "", tvaRate: "20" }];
    });
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
      Alert.alert("Attention", "Veuillez sélectionner un client.");
      return;
    }
    if (!isEditMode && selectedServices.length === 0 && servicesArr.length > 0) {
      Alert.alert("Attention", "Veuillez sélectionner au moins un service.");
      return;
    }
    if (!isEditMode && photos.length === 0) {
      Alert.alert("Attention", "Veuillez ajouter au moins une photo.");
      return;
    }
    if (photos.length > 3) {
      Alert.alert("Attention", "Maximum 3 photos autorisées.");
      return;
    }
    for (let i = 0; i < lineItems.length; i++) {
      const it = lineItems[i];
      if (!it.description.trim()) {
        Alert.alert("Attention", `Prestation ${i + 1} : la description est obligatoire.`);
        return;
      }
      const priceNum = parseFloat((it.unitPrice || "").trim());
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        Alert.alert("Attention", `Prestation ${i + 1} : le prix unitaire doit être un nombre supérieur à 0.`);
        return;
      }
      const qtyNum = parseFloat((it.quantity || "").trim());
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        Alert.alert("Attention", `Prestation ${i + 1} : la quantité doit être un nombre supérieur à 0.`);
        return;
      }
    }

    const vehicleInfo = (vehicleBrand || vehicleModel || vehiclePlate) ? {
      brand: vehicleBrand.trim() || undefined,
      model: vehicleModel.trim() || undefined,
      plate: vehiclePlate.trim() || undefined,
    } : undefined;

    createMutation.mutate({
      clientId: selectedClientId,
      serviceId: selectedServices[0] || undefined,
      status: "pending",
      notes: notes.trim() || undefined,
      vehicleInfo,
      validItems: lineItems,
      photos,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? "Modifier le devis" : "Nouveau devis"}</Text>
        <Pressable
          style={[styles.submitBtn, createMutation.isPending && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.submitText}>{isEditMode ? "Enregistrer" : "Créer"}</Text>}
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
                onPress={() => router.push({ pathname: "/(admin)/client-form", params: { returnTo: "quote-create" } } as any)}
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

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes / Description</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Description des travaux..."
            placeholderTextColor={theme.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Véhicule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Véhicule (optionnel)</Text>
          <TextInput style={styles.input} placeholder="Marque" placeholderTextColor={theme.textTertiary} value={vehicleBrand} onChangeText={setVehicleBrand} />
          <TextInput style={styles.input} placeholder="Modèle" placeholderTextColor={theme.textTertiary} value={vehicleModel} onChangeText={setVehicleModel} />
          <TextInput style={styles.input} placeholder="Immatriculation" placeholderTextColor={theme.textTertiary} value={vehiclePlate} onChangeText={setVehiclePlate} autoCapitalize="characters" />
        </View>

        {/* Services */}
        {servicesArr.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services *</Text>
            <Pressable style={styles.pickerBtn} onPress={() => setShowServicesPicker(!showServicesPicker)}>
              <Text style={[styles.pickerText, selectedServices.length === 0 && { color: theme.textTertiary }]}>
                {selectedServices.length === 0 ? "Sélectionner des services" : `${selectedServices.length} service(s) sélectionné(s)`}
              </Text>
              <Ionicons name={showServicesPicker ? "chevron-up" : "chevron-down"} size={18} color={theme.textTertiary} />
            </Pressable>
            {showServicesPicker && (
              <FlatList
                scrollEnabled={false}
                data={servicesArr}
                keyExtractor={(s: any) => s.id}
                renderItem={({ item: service }: { item: any }) => {
                  const servicePrice = service.price || service.unitPrice || service.basePrice || service.priceHT || service.priceExcludingTax || service.hourlyRate || service.rate || 0;
                  const isSelected = selectedServices.includes(service.id);
                  return (
                    <Pressable
                      style={[styles.serviceOption, isSelected && { backgroundColor: theme.primary + "20" }]}
                      onPress={() => toggleService(service.id)}
                    >
                      <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={18} color={isSelected ? theme.primary : theme.textTertiary} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={[styles.serviceName, isSelected && { color: theme.primary }, { flex: 1 }]}>{service.name || service.label}</Text>
                          <Text style={[styles.servicePrice, isSelected && { color: theme.primary }]}>
                            {fmtEur(parseFloat(String(servicePrice)))} HT
                          </Text>
                        </View>
                        {service.description ? <Text style={styles.serviceDesc}>{service.description}</Text> : null}
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        ) : null}

        {/* Photos */}
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
                  {photos.length > 0 && (
                    <Pressable onPress={() => setPhotos(prev => prev.filter((_, i) => i !== index))}>
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </Pressable>
                  )}
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

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prestations *</Text>
          {lineItems.map((item, idx) => {
            const fromService = !!item.fromServiceId;
            return (
              <View key={item.id} style={[styles.lineItemCard, idx > 0 && { marginTop: 10 }]}>
                <View style={styles.lineItemHeader}>
                  <Text style={styles.lineItemLabel}>
                    Prestation {idx + 1}{fromService ? "  ·  liée au service" : ""}
                  </Text>
                  {!fromService && (
                    <Pressable onPress={() => removeLineItem(idx)}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </Pressable>
                  )}
                </View>
                {fromService ? (
                  <>
                    <Text style={styles.lockedText}>{item.description}</Text>
                    <View style={styles.lineItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Qté</Text>
                        <Text style={styles.lockedText}>{item.quantity}</Text>
                      </View>
                      <View style={{ flex: 2 }}>
                        <Text style={styles.fieldLabel}>Prix HT (€)</Text>
                        <Text style={styles.lockedText}>{item.unitPrice}</Text>
                      </View>
                      <View style={{ flex: 1.5 }}>
                        <Text style={styles.fieldLabel}>TVA %</Text>
                        <Text style={styles.lockedText}>{item.tvaRate}%</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
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
                  </>
                )}
                <Text style={styles.lineTotalCalc}>
                  Total TTC : {fmtEur(calcTTC(item))}
                </Text>
              </View>
            );
          })}
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

        {/* Submit */}
        <Pressable
          style={[styles.createBtn, createMutation.isPending && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.createBtnText}>{isEditMode ? "Enregistrer les modifications" : "Créer le devis"}</Text>
              </>}
        </Pressable>
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
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.text },
  submitBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: theme.primary, justifyContent: "center", alignItems: "center", minWidth: 60,
  },
  submitText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  section: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.8 },
  pickerBtn: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: theme.background,
  },
  pickerText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text, flex: 1 },
  clientDropdown: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    backgroundColor: theme.background, overflow: "hidden",
  },
  clientSearch: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  clientSearchInput: { flex: 1, fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
  clientOption: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  clientOptionName: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.text },
  clientOptionEmail: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary, marginTop: 2 },
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
  textarea: {
    minHeight: 72, borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
    fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text,
    backgroundColor: theme.background,
  },
  vehicleRow: { flexDirection: "row", gap: 8 },
  input: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text,
    backgroundColor: theme.background,
  },
  lineItemCard: { backgroundColor: theme.background, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12, gap: 8 },
  lineItemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lineItemLabel: { fontSize: 12, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, textTransform: "uppercase" },
  lineItemRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  fieldLabel: { fontSize: 11, fontFamily: "Exo2_500Medium", color: theme.textTertiary, marginBottom: 4 },
  tvaPickerRow: { flexDirection: "row", gap: 4 },
  tvaPickerOpt: {
    flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.border,
    justifyContent: "center", alignItems: "center", backgroundColor: theme.surface,
  },
  tvaPickerOptActive: { backgroundColor: theme.primary + "15", borderColor: theme.primary },
  tvaPickerTxt: { fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textSecondary },
  tvaPickerTxtActive: { color: theme.primary },
  lineTotalCalc: { fontSize: 13, fontFamily: "Exo2_600SemiBold", color: theme.primary, textAlign: "right" },
  addLineBtn: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 10 },
  addLineBtnText: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.primary },
  serviceOption: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  serviceName: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.text },
  serviceDesc: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 2 },
  servicePrice: { fontSize: 13, fontFamily: "Exo2_600SemiBold", color: theme.textSecondary, marginLeft: 8 },
  lockedText: {
    fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.text,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.surface,
    borderRadius: 10, borderWidth: 1, borderColor: theme.border,
  },
  photoItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, marginVertical: 4, backgroundColor: theme.background, borderRadius: 8, paddingHorizontal: 8 },
  photoThumb: { width: 50, height: 50, borderRadius: 6 },
  photoName: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  addPhotoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 10, marginTop: 8 },
  addPhotoBtnText: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.primary },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.textSecondary },
  totalValue: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
  createBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: theme.primary, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 20,
  },
  createBtnText: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: "#fff" },
});
