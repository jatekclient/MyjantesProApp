import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, ActivityIndicator, TextInput,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminServices } from "@/lib/admin-api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

export default function ServicesListScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [search, setSearch] = useState("");

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  const { data: services = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-services"],
    queryFn: adminServices.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const servicesArr = Array.isArray(services) ? services : [];
  const filtered = servicesArr.filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.name || "").toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q);
  });

  const formatPrice = (s: any) => {
    const p = parseFloat(s.basePrice || s.price || s.unit_price || s.priceExcludingTax || 0);
    return p > 0 ? `${p.toFixed(2)} €` : "—";
  };

  const formatDuration = (mins: number) => {
    if (!mins) return "—";
    if (mins >= 480) return `${Math.floor(mins / 480)} jour${Math.floor(mins / 480) > 1 ? "s" : ""}`;
    if (mins >= 60) return `${Math.floor(mins / 60)}h${mins % 60 ? (mins % 60) + "min" : ""}`;
    return `${mins} min`;
  };

  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push({ pathname: "/(admin)/service-create", params: { id: item.id || item._id } } as any);
      }}
    >
      <View style={[styles.iconBg, { backgroundColor: "#F59E0B18" }]}>
        <Ionicons name="construct" size={20} color="#F59E0B" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <View style={styles.meta}>
          {item.category ? <Text style={styles.metaText}>{item.category}</Text> : null}
          <Text style={styles.metaText}>{formatDuration(item.duration)}</Text>
          <Text style={[styles.metaText, { color: theme.primary }]}>{formatPrice(item)}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Services</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(admin)/service-create" as any);
          }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={theme.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un service..."
          placeholderTextColor={theme.textTertiary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => String(item.id || item._id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, gap: 8 }}
          scrollEnabled={filtered.length > 0}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="construct-outline" size={40} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Aucun service trouvé</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Exo2_700Bold", color: theme.text },
  addBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginVertical: 10,
    backgroundColor: theme.surface, borderRadius: 12,
    borderWidth: 1, borderColor: theme.border,
    paddingHorizontal: 12, height: 42,
  },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text,
  },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.surface, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: theme.border,
  },
  iconBg: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  name: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  meta: { flexDirection: "row", gap: 10, marginTop: 3 },
  metaText: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  empty: { alignItems: "center", gap: 10, marginTop: 60 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.textTertiary },
});
