import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, RefreshControl, TextInput, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adminClients } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

const ROOT_ROLES = ["root", "root_admin"];
const SUPER_ROLES = ["super_admin", "superadmin"];
const ADMIN_HIDDEN_ROLES = [...ROOT_ROLES, ...SUPER_ROLES];

function canEditUser(loggedRole: string, targetRole: string): boolean {
  if (ROOT_ROLES.includes(loggedRole)) return true;
  if (SUPER_ROLES.includes(loggedRole)) return !ROOT_ROLES.includes(targetRole);
  return !ADMIN_HIDDEN_ROLES.includes(targetRole);
}

export default function AdminClientsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { isAdmin, user } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const loggedRole = (user?.role || "").toLowerCase();
  const loggedGarageId = (user as any)?.garageId || null;

  const { data: clients = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: adminClients.getAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminClients.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const confirmDelete = (id: string, name: string) => {
    showAlert({
      type: "warning",
      title: "Supprimer ce client ?",
      message: `Le client ${name} et toutes ses données seront supprimés définitivement.`,
      buttons: [
        { text: "Annuler" },
        { text: "Supprimer", style: "primary", onPress: () => deleteMutation.mutate(id) },
      ],
    });
  };

  const arr = Array.isArray(clients) ? clients : [];

  const roleFiltered = arr.filter((c: any) => {
    const targetRole = (c.role || "").toLowerCase();
    if (ROOT_ROLES.includes(loggedRole)) return true;
    if (SUPER_ROLES.includes(loggedRole)) return !ROOT_ROLES.includes(targetRole);
    if (loggedRole === "admin") {
      if (ADMIN_HIDDEN_ROLES.includes(targetRole)) return false;
      if (loggedGarageId && c.garageId && c.garageId !== loggedGarageId) return false;
      return true;
    }
    return true;
  });

  const filtered = roleFiltered.filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const name = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
    return name.includes(s) || (c.email || "").toLowerCase().includes(s) || (c.phone || "").includes(s);
  });

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;

  const renderItem = useCallback(({ item }: { item: any }) => {
    const name = `${item.firstName || ""} ${item.lastName || ""}`.trim() || item.email;
    const itemRole = (item.role || "").toLowerCase();
    const isPro = item.role === "client_professionnel";
    const isAdminRole = [...ROOT_ROLES, ...SUPER_ROLES, "admin"].includes(itemRole);
    const canEdit = canEditUser(loggedRole, itemRole);
    const initials = [item.firstName?.[0], item.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";
    const roleBadgeColor = isAdminRole ? "#8B5CF6" : (isPro ? "#F59E0B" : theme.primary);
    const roleLabel = ROOT_ROLES.includes(itemRole) ? "Root" : SUPER_ROLES.includes(itemRole) ? "SuperAdmin" : itemRole === "admin" ? "Admin" : isPro ? "Pro" : "Particulier";
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }, !canEdit && { opacity: 0.6 }]}
        onPress={() => canEdit ? router.push({ pathname: "/(admin)/client-form", params: { id: item.id } } as any) : null}
      >
        <View style={styles.cardRow}>
          <View style={[styles.avatar, { backgroundColor: isAdminRole ? "#8B5CF620" : theme.primary + "20" }]}>
            <Text style={[styles.avatarText, { color: isAdminRole ? "#8B5CF6" : theme.primary }]}>{initials}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{name}</Text>
            <Text style={styles.cardEmail}>{item.email}</Text>
            {item.phone && <Text style={styles.cardPhone}>{item.phone}</Text>}
          </View>
          <View style={styles.cardRight}>
            <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor + "20" }]}>
              <Text style={[styles.roleText, { color: roleBadgeColor }]}>{roleLabel}</Text>
            </View>
            {isAdmin && canEdit && (
              <Pressable
                style={[styles.deleteBtn]}
                onPress={() => confirmDelete(item.id, name)}
                accessibilityLabel="Supprimer"
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    );
  }, [theme, isAdmin, loggedRole]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Image
          source={require("@/assets/images/logo_new.png")}
          style={styles.headerLogo}
          contentFit="contain"
        />
        <Text style={styles.screenTitle}>Clients</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/(admin)/client-form" as any);
          }}
          accessibilityLabel="Nouveau client"
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un client..."
            placeholderTextColor={theme.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countText}>{filtered.length} client{filtered.length !== 1 ? "s" : ""}</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Aucun client trouvé</Text>
            </View>
          }
        />
      )}
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  headerLogo: { width: 34, height: 34, borderRadius: 8 },
  screenTitle: { flex: 1, fontSize: 22, fontFamily: "Exo2_800ExtraBold", color: theme.text, letterSpacing: 0.5 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, justifyContent: "center", alignItems: "center" },
  searchRow: { paddingHorizontal: 16, marginBottom: 10 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
  countRow: { paddingHorizontal: 20, marginBottom: 8 },
  countText: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textTertiary },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 16, fontFamily: "Exo2_700Bold", color: "#fff" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  cardEmail: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 1 },
  cardPhone: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary, marginTop: 1 },
  cardRight: { alignItems: "flex-end", gap: 8 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 11, fontFamily: "Exo2_600SemiBold" },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#EF444420", justifyContent: "center", alignItems: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
});
