import React, { useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Linking, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { accountApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import * as Haptics from "expo-haptics";

interface Contact {
  id?: string;
  name?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  role?: string;
  jobTitle?: string;
  phone?: string;
  phoneNumber?: string;
  phone_number?: string;
  email?: string;
  emailAddress?: string;
  email_address?: string;
  avatar?: string;
  availableHours?: string;
}

function ContactCard({ contact, theme, styles }: { contact: Contact; theme: any; styles: any }) {
  const fullName = contact.name
    || [contact.firstName || contact.first_name, contact.lastName || contact.last_name].filter(Boolean).join(" ")
    || "Interlocuteur";
  const role = contact.jobTitle || contact.role || "Équipe MyJantes";
  const phone = contact.phone || contact.phoneNumber || contact.phone_number;
  const email = contact.email || contact.emailAddress || contact.email_address;
  const initials = fullName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  const handleCall = () => {
    if (!phone) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
  };

  const handleEmail = () => {
    if (!email) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`mailto:${email}`);
  };

  return (
    <View style={styles.contactCard}>
      <View style={styles.avatarSection}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <View style={styles.avatarInfo}>
          <Text style={styles.contactName}>{fullName}</Text>
          <View style={styles.rolePill}>
            <View style={[styles.roleDot, { backgroundColor: theme.primary }]} />
            <Text style={styles.roleText}>{role}</Text>
          </View>
          {contact.availableHours && (
            <Text style={styles.hoursText}>
              <Ionicons name="time-outline" size={12} color={theme.textTertiary} /> {contact.availableHours}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.actionRow}>
        {phone ? (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.callBtn, pressed && { opacity: 0.85 }]}
            onPress={handleCall}
          >
            <Ionicons name="call" size={20} color="#fff" />
            <View>
              <Text style={styles.actionBtnLabel}>Appeler</Text>
              <Text style={styles.actionBtnSub}>{phone}</Text>
            </View>
          </Pressable>
        ) : null}

        {email ? (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.emailBtn, pressed && { opacity: 0.85 }]}
            onPress={handleEmail}
          >
            <Ionicons name="mail" size={20} color={theme.primary} />
            <View>
              <Text style={[styles.actionBtnLabel, { color: theme.primary }]}>Email</Text>
              <Text style={[styles.actionBtnSub, { color: theme.textSecondary }]} numberOfLines={1}>{email}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function AccountContactScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const { data: rawData, isLoading, isError, refetch } = useQuery({
    queryKey: ["account-contacts"],
    queryFn: accountApi.getContacts,
    retry: 1,
  });

  const available = (rawData as any)?.available !== false;
  const contacts: Contact[] = useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    const nested = (rawData as any)?.contacts || (rawData as any)?.data || [];
    return Array.isArray(nested) ? nested : [];
  }, [rawData]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 10 : insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mon interlocuteur</Text>
          <Text style={styles.headerSub}>Votre contact dédié chez MyJantes</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Platform.OS === "web" ? 34 + 40 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="briefcase-outline" size={18} color={theme.primary} />
          <Text style={styles.infoBannerText}>
            Votre interlocuteur dédié est disponible pour toutes vos questions concernant vos prestations professionnelles.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Chargement de vos contacts…</Text>
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={52} color={theme.textTertiary} />
            <Text style={styles.errorTitle}>Données indisponibles</Text>
            <Text style={styles.errorSub}>Impossible de charger les informations de contact.</Text>
            <Pressable style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : !available || contacts.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="person-outline" size={52} color={theme.textTertiary} />
            <Text style={styles.errorTitle}>Interlocuteur non assigné</Text>
            <Text style={styles.errorSub}>
              Votre interlocuteur dédié n'est pas encore renseigné.{"\n"}
              Contactez-nous via le formulaire de devis ou par téléphone.
            </Text>
            <Pressable
              style={styles.callFallbackBtn}
              onPress={() => Linking.openURL("tel:0321408053")}
            >
              <Ionicons name="call-outline" size={18} color="#fff" />
              <Text style={styles.callFallbackText}>03 21 40 80 53</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {contacts.map((contact, idx) => (
              <ContactCard key={contact.id || idx} contact={contact} theme={theme} styles={styles} />
            ))}
          </View>
        )}

        {/* Default contact info — always visible */}
        <View style={styles.atelier}>
          <View style={styles.atelierHeader}>
            <Ionicons name="business-outline" size={18} color={theme.primary} />
            <Text style={styles.atelierTitle}>L'atelier MyJantes</Text>
          </View>
          <View style={styles.atelierRow}>
            <Ionicons name="location-outline" size={15} color={theme.textSecondary} />
            <Text style={styles.atelierText}>Zone industrielle, 62800 Liévin</Text>
          </View>
          <View style={styles.atelierRow}>
            <Ionicons name="call-outline" size={15} color={theme.textSecondary} />
            <Pressable onPress={() => Linking.openURL("tel:0321408053")}>
              <Text style={[styles.atelierText, { color: theme.primary }]}>03 21 40 80 53</Text>
            </Pressable>
          </View>
          <View style={styles.atelierRow}>
            <Ionicons name="time-outline" size={15} color={theme.textSecondary} />
            <Text style={styles.atelierText}>Lun – Ven : 8h00 – 18h00</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: theme.surfaceSecondary, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Exo2_800ExtraBold", color: theme.text, letterSpacing: 0.4 },
  headerSub: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, marginTop: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  infoBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: theme.primary + "12", borderRadius: 14, borderWidth: 1,
    borderColor: theme.primary + "30", padding: 14, marginBottom: 20,
  },
  infoBannerText: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, flex: 1, lineHeight: 19 },
  center: { alignItems: "center", gap: 12, paddingVertical: 40, paddingHorizontal: 16 },
  loadingText: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  errorTitle: { fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.textSecondary, textAlign: "center" },
  errorSub: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textTertiary, textAlign: "center", lineHeight: 20 },
  retryBtn: {
    backgroundColor: theme.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10,
  },
  retryBtnText: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  callFallbackBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  callFallbackText: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  contactCard: {
    backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 16,
  },
  avatarSection: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  avatarRing: {
    width: 70, height: 70, borderRadius: 35,
    borderWidth: 2.5, borderColor: theme.primary + "60",
    justifyContent: "center", alignItems: "center",
  },
  avatar: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: theme.primary, justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 22, fontFamily: "Exo2_700Bold", color: "#fff" },
  avatarInfo: { flex: 1, gap: 6 },
  contactName: { fontSize: 18, fontFamily: "Exo2_600SemiBold", color: theme.text },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: theme.surfaceSecondary, borderRadius: 20, borderWidth: 1, borderColor: theme.border,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.textSecondary },
  hoursText: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  divider: { height: 1, backgroundColor: theme.border, marginBottom: 14 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  callBtn: { backgroundColor: theme.primary },
  emailBtn: {
    backgroundColor: theme.surfaceSecondary, borderWidth: 1, borderColor: theme.border,
  },
  actionBtnLabel: { fontSize: 13, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  actionBtnSub: { fontSize: 11, fontFamily: "Exo2_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 1 },
  atelier: {
    marginTop: 20, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1,
    borderColor: theme.border, padding: 16, gap: 10,
  },
  atelierHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  atelierTitle: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
  atelierRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  atelierText: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary },
});
