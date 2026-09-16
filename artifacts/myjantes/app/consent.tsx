import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Calendar from "expo-calendar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

export default function ConsentScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedCookies, setAcceptedCookies] = useState(false);
  const [acceptedData, setAcceptedData] = useState(false);
  const [acceptedNotifications, setAcceptedNotifications] = useState(false);
  const [acceptedEmailNotifications, setAcceptedEmailNotifications] = useState(false);
  const [acceptedCalendar, setAcceptedCalendar] = useState(false);

  const allAccepted = acceptedPrivacy && acceptedCookies && acceptedData;

  const handleAccept = async () => {
    await AsyncStorage.setItem("consent_given", "true");
    await AsyncStorage.setItem("consent_notifications", acceptedNotifications ? "true" : "false");
    await AsyncStorage.setItem("consent_email_notifications", acceptedEmailNotifications ? "true" : "false");
    await AsyncStorage.setItem("consent_calendar", acceptedCalendar ? "true" : "false");

    if (acceptedNotifications && Platform.OS === "ios") {
      try {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        if (status !== "granted") {
          await AsyncStorage.setItem("consent_notifications", "false");
        }
      } catch {
        await AsyncStorage.setItem("consent_notifications", "false");
      }
    }

    if (acceptedCalendar && Platform.OS !== "web") {
      try {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (status !== "granted") {
          await AsyncStorage.setItem("consent_calendar", "false");
        }
      } catch {
        await AsyncStorage.setItem("consent_calendar", "false");
      }
    }

    router.replace("/");
  };

  const CheckRow = ({
    checked, onToggle, label, sub,
  }: { checked: boolean; onToggle: () => void; label: string; sub: string }) => (
    <Pressable style={styles.checkRow} onPress={onToggle}>
      <View style={[styles.checkbox, checked && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
        {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <View style={styles.checkText}>
        <Text style={styles.checkLabel}>{label}</Text>
        <Text style={styles.checkSub}>{sub}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Platform.OS === "web" ? 34 + 80 : insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/logo_new.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>

        <Text style={styles.title}>Bienvenue chez MyJantes</Text>
        <Text style={styles.subtitle}>
          Avant d'utiliser l'application, veuillez lire et accepter nos conditions.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark" size={22} color={theme.primary} />
            <Text style={styles.cardTitle}>Protection de vos données</Text>
          </View>
          <Text style={styles.cardText}>
            Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés, vous disposez d'un droit d'accès, de rectification, de portabilité et d'effacement de vos données personnelles.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle" size={22} color="#3B82F6" />
            <Text style={styles.cardTitle}>Données collectées</Text>
          </View>
          <Text style={styles.cardText}>
            Nous collectons uniquement les données nécessaires au fonctionnement du service : nom, email, téléphone, informations de véhicule et photos pour les devis. Vos données ne sont jamais vendues à des tiers.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Vos consentements</Text>
          <View style={styles.checkGroup}>
            <CheckRow
              checked={acceptedPrivacy}
              onToggle={() => setAcceptedPrivacy(v => !v)}
              label="Politique de confidentialité"
              sub="J'accepte la politique de confidentialité et de traitement des données personnelles"
            />
            <View style={styles.divider} />
            <CheckRow
              checked={acceptedCookies}
              onToggle={() => setAcceptedCookies(v => !v)}
              label="Cookies de session"
              sub="J'accepte l'utilisation des cookies nécessaires au fonctionnement de l'application (authentification)"
            />
            <View style={styles.divider} />
            <CheckRow
              checked={acceptedData}
              onToggle={() => setAcceptedData(v => !v)}
              label="Traitement des données"
              sub="J'accepte que mes données soient traitées pour la gestion de mes devis, factures et rendez-vous"
            />
            <View style={styles.divider} />
            <CheckRow
              checked={acceptedNotifications}
              onToggle={() => setAcceptedNotifications(v => !v)}
              label="Notifications"
              sub="J'accepte de recevoir des notifications push pour les mises à jour de devis, factures et rendez-vous (optionnel)"
            />
            <View style={styles.divider} />
            <CheckRow
              checked={acceptedEmailNotifications}
              onToggle={() => setAcceptedEmailNotifications(v => !v)}
              label="Emails"
              sub="J'accepte de recevoir des emails de notification pour les devis, factures et rendez-vous (optionnel)"
            />
            <View style={styles.divider} />
            <CheckRow
              checked={acceptedCalendar}
              onToggle={() => setAcceptedCalendar(v => !v)}
              label="Agenda"
              sub="J'accepte la synchronisation des rendez-vous avec le calendrier de mon téléphone (optionnel)"
            />
          </View>
        </View>

        <View style={styles.linksRow}>
          <Pressable onPress={() => router.push("/privacy")} style={styles.linkBtn}>
            <Text style={styles.linkText}>Confidentialité</Text>
          </Pressable>
          <View style={styles.linkDot} />
          <Pressable onPress={() => router.push("/legal")} style={styles.linkBtn}>
            <Text style={styles.linkText}>Mentions légales</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 34 + 16 : insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.acceptBtn,
            !allAccepted && styles.acceptBtnDisabled,
            pressed && allAccepted && { opacity: 0.85 },
          ]}
          onPress={handleAccept}
          disabled={!allAccepted}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.acceptBtnText}>Accepter et continuer</Text>
        </Pressable>
        {!allAccepted && (
          <Text style={styles.footerHint}>Veuillez cocher les 3 cases obligatoires pour continuer</Text>
        )}
      </View>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  logoContainer: { alignItems: "center", marginBottom: 20 },
  logo: { width: 90, height: 90, borderRadius: 20 },
  title: {
    fontSize: 26, fontFamily: "Exo2_800ExtraBold",
    color: theme.text, textAlign: "center", marginBottom: 8, letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14, fontFamily: "Exo2_400Regular",
    color: theme.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 24,
  },
  card: {
    backgroundColor: theme.surface, borderRadius: 14,
    borderWidth: 1, borderColor: theme.border,
    padding: 16, marginBottom: 12, gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.text },
  cardText: { fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, lineHeight: 20 },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 12, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginLeft: 4,
  },
  checkGroup: {
    backgroundColor: theme.surface, borderRadius: 14,
    borderWidth: 1, borderColor: theme.border, overflow: "hidden",
  },
  checkRow: { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: theme.border,
    justifyContent: "center", alignItems: "center", marginTop: 1,
    backgroundColor: theme.surface,
  },
  checkText: { flex: 1 },
  checkLabel: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text, marginBottom: 3 },
  checkSub: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textSecondary, lineHeight: 18 },
  divider: { height: 1, backgroundColor: theme.border, marginLeft: 14 },
  linksRow: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: 10, marginBottom: 8,
  },
  linkBtn: { paddingVertical: 6 },
  linkText: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.primary, textDecorationLine: "underline" },
  linkDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: theme.textTertiary },
  footer: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: theme.border,
    backgroundColor: theme.background, gap: 8,
  },
  acceptBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.primary, borderRadius: 14, height: 52,
  },
  acceptBtnDisabled: { backgroundColor: theme.border },
  acceptBtnText: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  footerHint: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary, textAlign: "center" },
});
