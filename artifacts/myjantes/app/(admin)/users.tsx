import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator,
  TextInput, Modal,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
const ADMIN_ROLES = [...ROOT_ROLES, ...SUPER_ROLES, "admin"];

function getRoleLabel(role: string): string {
  const r = role.toLowerCase();
  if (ROOT_ROLES.includes(r)) return "Root Admin";
  if (SUPER_ROLES.includes(r)) return "Super Admin";
  if (r === "admin") return "Administrateur";
  if (["employe", "employee"].includes(r)) return "Employé";
  if (r === "manager") return "Manager";
  if (r === "client_professionnel") return "Client Pro";
  if (r === "client") return "Client";
  return "Utilisateur";
}

function getRoleColor(role: string): string {
  const r = role.toLowerCase();
  if (ROOT_ROLES.includes(r)) return "#DC2626";
  if (SUPER_ROLES.includes(r)) return "#8B5CF6";
  if (r === "admin") return "#3B82F6";
  if (["employe", "employee", "manager"].includes(r)) return "#10B981";
  return "#6B7280";
}

function canViewUser(loggedRole: string, targetRole: string): boolean {
  if (ROOT_ROLES.includes(loggedRole)) return true;
  if (SUPER_ROLES.includes(loggedRole)) return !ROOT_ROLES.includes(targetRole);
  return false;
}

function canEditUser(loggedRole: string, targetRole: string): boolean {
  if (ROOT_ROLES.includes(loggedRole)) return true;
  if (SUPER_ROLES.includes(loggedRole)) return !ROOT_ROLES.includes(targetRole) && !SUPER_ROLES.includes(targetRole);
  return false;
}

function canDeleteUser(loggedRole: string, targetRole: string): boolean {
  if (ROOT_ROLES.includes(loggedRole)) return !ROOT_ROLES.includes(targetRole);
  if (SUPER_ROLES.includes(loggedRole)) return !ROOT_ROLES.includes(targetRole) && !SUPER_ROLES.includes(targetRole);
  return false;
}

function getAvailableRoles(loggedRole: string) {
  const base = [
    { value: "admin", label: "Administrateur" },
    { value: "employe", label: "Employé" },
    { value: "manager", label: "Manager" },
  ];
  if (ROOT_ROLES.includes(loggedRole)) {
    return [
      { value: "super_admin", label: "Super Admin" },
      ...base,
    ];
  }
  return base;
}

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { showAlert, AlertComponent } = useCustomAlert();
  const { user: loggedUser } = useAuth();

  const loggedRole = (loggedUser?.role || "").toLowerCase();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", role: "admin" });

  const availableRoles = useMemo(() => getAvailableRoles(loggedRole), [loggedRole]);

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminClients.getAll(),
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => adminClients.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      setShowCreateModal(false);
      setFormData({ firstName: "", lastName: "", email: "", role: "admin" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({ type: "success", title: "Utilisateur créé", message: "L'utilisateur a été créé avec succès.", buttons: [{ text: "OK", style: "primary" }] });
    },
    onError: (err: any) => {
      showAlert({ type: "error", title: "Erreur", message: err?.message || "Impossible de créer l'utilisateur.", buttons: [{ text: "OK", style: "primary" }] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => adminClients.update(data._userId, { firstName: data.firstName, lastName: data.lastName, email: data.email, role: data.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      setEditingUser(null);
      setShowCreateModal(false);
      setFormData({ firstName: "", lastName: "", email: "", role: "admin" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert({ type: "success", title: "Utilisateur modifié", message: "L'utilisateur a été modifié avec succès.", buttons: [{ text: "OK", style: "primary" }] });
    },
    onError: (err: any) => {
      showAlert({ type: "error", title: "Erreur", message: err?.message || "Impossible de modifier l'utilisateur.", buttons: [{ text: "OK", style: "primary" }] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminClients.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any) => {
      showAlert({ type: "error", title: "Erreur", message: err?.message || "Impossible de supprimer l'utilisateur.", buttons: [{ text: "OK", style: "primary" }] });
    },
  });

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  const handleSubmit = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      showAlert({ type: "error", title: "Champs requis", message: "Veuillez remplir tous les champs.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (editingUser) {
      updateMutation.mutate({ ...formData, _userId: editingUser.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (u: any) => {
    setEditingUser(u);
    setFormData({ firstName: u.firstName || "", lastName: u.lastName || "", email: u.email, role: u.role || "admin" });
    setShowCreateModal(true);
  };

  const confirmDelete = (u: any) => {
    const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;
    showAlert({
      type: "warning",
      title: "Supprimer cet utilisateur ?",
      message: `${name} sera supprimé définitivement.`,
      buttons: [
        { text: "Annuler" },
        { text: "Supprimer", style: "primary", onPress: () => deleteMutation.mutate(u.id) },
      ],
    });
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingUser(null);
    setFormData({ firstName: "", lastName: "", email: "", role: "admin" });
  };

  const rawUsers = Array.isArray(users) ? users : (users as any)?.data || (users as any)?.users || (users as any)?.results || [];
  const usersArr = (Array.isArray(rawUsers) ? rawUsers : []).filter((u: any) => {
    const targetRole = (u.role || "").toLowerCase();
    return ADMIN_ROLES.includes(targetRole) || ["employe", "employee", "manager"].includes(targetRole);
  });

  const visibleUsers = usersArr.filter((u: any) => canViewUser(loggedRole, (u.role || "").toLowerCase()));

  if (isLoading) {
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
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>Utilisateurs</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            setEditingUser(null);
            setFormData({ firstName: "", lastName: "", email: "", role: "admin" });
            setShowCreateModal(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countText}>{visibleUsers.length} utilisateur{visibleUsers.length !== 1 ? "s" : ""}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad, gap: 8 }}>
        {visibleUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={theme.textTertiary} />
            <Text style={styles.emptyText}>Aucun utilisateur</Text>
          </View>
        ) : (
          visibleUsers.map((u: any) => {
            const targetRole = (u.role || "").toLowerCase();
            const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;
            const roleLabel = getRoleLabel(targetRole);
            const roleColor = getRoleColor(targetRole);
            const editable = canEditUser(loggedRole, targetRole);
            const deletable = canDeleteUser(loggedRole, targetRole);
            const initials = [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";

            return (
              <View key={u.id} style={styles.userCard}>
                <View style={[styles.avatar, { backgroundColor: roleColor + "18" }]}>
                  <Text style={[styles.avatarText, { color: roleColor }]}>{initials}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{name}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: roleColor + "18" }]}>
                    <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
                  </View>
                </View>
                <View style={styles.userActions}>
                  {editable && (
                    <Pressable style={styles.actionBtn} onPress={() => openEdit(u)}>
                      <Ionicons name="pencil-outline" size={16} color={theme.primary} />
                    </Pressable>
                  )}
                  {deletable && (
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: "#EF444418" }]}
                      onPress={() => confirmDelete(u)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 16 }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={closeModal}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
              <Text style={styles.modalTitle}>{editingUser ? "Modifier" : "Nouvel"} utilisateur</Text>
              <Pressable onPress={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                <Text style={[styles.modalSubmit, { color: theme.primary }]}>
                  {createMutation.isPending || updateMutation.isPending ? "..." : "Valider"}
                </Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 32 }}>
              <View style={styles.field}>
                <Text style={styles.label}>Prénom</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Prénom"
                  value={formData.firstName}
                  onChangeText={(v) => setFormData({ ...formData, firstName: v })}
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Nom</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nom"
                  value={formData.lastName}
                  onChangeText={(v) => setFormData({ ...formData, lastName: v })}
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@exemple.com"
                  value={formData.email}
                  onChangeText={(v) => setFormData({ ...formData, email: v })}
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Rôle</Text>
                <View style={styles.roleSelector}>
                  {availableRoles.map((r) => (
                    <Pressable
                      key={r.value}
                      style={[styles.roleOption, formData.role === r.value && { backgroundColor: getRoleColor(r.value), borderColor: getRoleColor(r.value) }]}
                      onPress={() => setFormData({ ...formData, role: r.value })}
                    >
                      <Text style={[styles.roleOptionText, formData.role === r.value && { color: "#fff" }]}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row",
    justifyContent: "space-between", alignItems: "center", gap: 12,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontFamily: "Exo2_700Bold", color: theme.text, flex: 1 },
  addBtn: { backgroundColor: theme.primary, width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  countRow: { paddingHorizontal: 20, marginBottom: 8 },
  countText: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textTertiary },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  userCard: {
    backgroundColor: theme.surface, borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: theme.border,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 15, fontFamily: "Exo2_700Bold" },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  userEmail: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
  roleBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  roleText: { fontSize: 10, fontFamily: "Exo2_600SemiBold" },
  userActions: { flexDirection: "row", gap: 6 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: theme.primary + "18", justifyContent: "center", alignItems: "center",
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 20, maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  modalTitle: { fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.text },
  modalSubmit: { fontFamily: "Exo2_600SemiBold", fontSize: 15 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  input: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: theme.text, fontFamily: "Exo2_400Regular", fontSize: 14,
  },
  roleSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleOption: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface,
  },
  roleOptionText: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.textSecondary },
});
