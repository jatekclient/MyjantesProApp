import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

interface GuideSection {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  items: string[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "navigation",
    icon: "compass-outline",
    iconColor: "#DC2626",
    title: "Navigation générale",
    items: [
      "L'application comporte 6 onglets principaux en bas de l'écran : Accueil, Devis, Factures, Plus, Clients et Réglages.",
      "Le bouton flottant « + » (rouge) au centre de la barre d'onglets ouvre un menu rapide pour créer un devis, une facture, un rendez-vous ou un service.",
      "L'onglet « Plus » centralise les outils avancés : Rendez-vous, Services, Utilisateurs, Notifications, Analyses IA et Logs (selon votre rôle et plan).",
      "Tirez vers le bas sur n'importe quelle liste pour la rafraîchir.",
      "L'app fonctionne en mode clair et sombre — bascule automatique selon le réglage système.",
    ],
  },
  {
    id: "auth",
    icon: "lock-closed-outline",
    iconColor: "#0EA5E9",
    title: "Connexion & sécurité",
    items: [
      "Connectez-vous avec email + mot de passe, ou utilisez Sign in with Apple / Connexion Google pour un accès rapide.",
      "Activez Face ID / Touch ID dans Réglages > Sécurité pour vous reconnecter en un geste lors des sessions suivantes.",
      "Mot de passe oublié : un code à 6 chiffres vous est envoyé par email puis vous définissez un nouveau mot de passe.",
      "Vos identifiants et tokens d'authentification sont stockés dans le coffre-fort sécurisé du système (Keychain iOS / Keystore Android).",
      "Vous pouvez vous déconnecter à tout moment depuis Réglages > Déconnexion.",
    ],
  },
  {
    id: "dashboard",
    icon: "grid-outline",
    iconColor: "#3B82F6",
    title: "Tableau de bord",
    items: [
      "Affiche vos indicateurs clés en temps réel : chiffre d'affaires mensuel, nombre de devis actifs, factures impayées, clients enregistrés et rendez-vous à venir.",
      "Le graphique en bas montre l'évolution du chiffre d'affaires sur les 6 derniers mois.",
      "Les cartes de statut résument rapidement l'état de vos devis et factures (en attente, approuvés, payés, etc.).",
      "Appuyez sur n'importe quelle carte statistique pour accéder directement à la liste correspondante.",
      "Tirez vers le bas pour actualiser toutes les données du tableau de bord.",
    ],
  },
  {
    id: "quotes",
    icon: "document-text-outline",
    iconColor: "#8B5CF6",
    title: "Devis",
    items: [
      "Créez un nouveau devis via le bouton « + » ou depuis l'onglet Devis. Remplissez le client, les lignes de prestation et les prix HT.",
      "Chaque devis affiche son numéro, le client, le montant TTC et le statut (en attente, approuvé, rejeté, annulé).",
      "Appuyez sur un devis pour voir le détail complet : lignes de prestation, totaux HT et TTC, et accéder au PDF.",
      "Dans le détail, changez le statut directement avec les boutons d'action (Approuver, Rejeter, Annuler).",
      "Utilisez la barre de recherche pour trouver un devis par nom de client ou numéro.",
      "Filtrez par statut grâce aux chips de filtre en haut de la liste.",
      "Pour les devis créés par les clients via l'app, vous recevez une notification push à la création.",
    ],
  },
  {
    id: "invoices",
    icon: "receipt-outline",
    iconColor: "#22C55E",
    title: "Factures",
    items: [
      "Créez une facture via le bouton « + » en sélectionnant un client, les prestations et les conditions de paiement.",
      "Les statuts de facture sont : En attente, Payée, En retard et Annulée.",
      "Appuyez sur une facture pour voir le détail : lignes, totaux, informations client et accès au PDF.",
      "L'email et le téléphone du client s'affichent directement sur la carte pour un contact rapide.",
      "Filtrez par statut ou recherchez par nom de client ou numéro de facture.",
      "Les factures en retard de paiement sont signalées en rouge pour une meilleure visibilité.",
    ],
  },
  {
    id: "reservations",
    icon: "calendar-outline",
    iconColor: "#F59E0B",
    title: "Rendez-vous",
    items: [
      "Deux vues disponibles : vue calendrier (agenda mensuel) et vue liste. Basculez avec les icônes en haut à droite.",
      "En vue agenda, appuyez sur un jour pour voir les rendez-vous planifiés ce jour-là.",
      "Créez un rendez-vous via le bouton « + » : choisissez le client, le service, la date et l'heure.",
      "Confirmez un rendez-vous en attente avec le bouton vert, ou marquez-le comme terminé après la prestation.",
      "Annulez un rendez-vous depuis le détail avec le bouton rouge (annulation immédiate avec notification client).",
      "Filtrez par statut (en attente, confirmé, terminé, annulé) ou recherchez par nom de client ou véhicule.",
    ],
  },
  {
    id: "clients",
    icon: "people-outline",
    iconColor: "#06B6D4",
    title: "Clients",
    items: [
      "Accédez à la liste des clients depuis l'onglet « Clients » dans le menu principal.",
      "Chaque fiche client affiche l'email, le téléphone, le nombre de devis et de factures associés.",
      "Recherchez un client par nom, prénom ou adresse email.",
      "Appuyez sur un client pour voir sa fiche complète avec l'historique de ses devis, factures et rendez-vous.",
      "Créez ou modifiez une fiche client via le bouton « + » ou depuis le formulaire client.",
    ],
  },
  {
    id: "services",
    icon: "construct-outline",
    iconColor: "#F97316",
    title: "Gestion des services",
    items: [
      "Accédez à vos prestations depuis l'onglet « Plus » > « Services ».",
      "Créez vos services avec un nom, une description et un prix de référence.",
      "Les services servent de base lors de la création d'un devis ou d'une facture pour pré-remplir les lignes.",
      "Modifiez ou désactivez un service sans affecter les documents déjà créés.",
    ],
  },
  {
    id: "notifications",
    icon: "notifications-outline",
    iconColor: "#DC2626",
    title: "Notifications",
    items: [
      "Recevez une alerte push à chaque nouvelle action client : nouveau devis, demande de rendez-vous, paiement.",
      "Les notifications s'affichent en temps réel même quand l'application est en arrière-plan.",
      "Appuyez sur une notification pour accéder directement au document concerné.",
      "Activez ou désactivez les notifications push depuis Paramètres > Notifications push.",
      "Sur web, les notifications s'affichent via le système de notification du navigateur.",
    ],
  },
  {
    id: "ai",
    icon: "analytics-outline",
    iconColor: "#10B981",
    title: "Analyses IA (Plan Pro)",
    items: [
      "Les analyses IA sont disponibles depuis l'onglet « Plus » pour les abonnements Pro et supérieur.",
      "« Analyse globale IA » : résumé complet de votre activité avec recommandations personnalisées.",
      "« Analyse commerciale » : évolution du chiffre d'affaires, taux de conversion des devis et performance client.",
      "« Analyse croissance » : tendances, prévisions et pistes d'optimisation pour développer votre activité.",
      "Pour activer l'accès IA, contactez notre équipe ou upgradeez votre plan depuis l'espace client.",
    ],
  },
  {
    id: "support",
    icon: "chatbubbles-outline",
    iconColor: "#06B6D4",
    title: "Support & Contact",
    items: [
      "Contactez l'équipe MyJantes depuis Réglages > « Nous contacter » pour toute question ou problème.",
      "Consultez l'historique de vos échanges depuis Réglages > « Historique des demandes ».",
      "Vous pouvez également nous écrire directement à contact@mytoolsgroup.eu.",
      "Notre équipe répond sous 24h ouvrées du lundi au vendredi.",
      "Pour une urgence, précisez « URGENT » dans l'objet de votre message.",
    ],
  },
  {
    id: "permissions",
    icon: "shield-checkmark-outline",
    iconColor: "#A78BFA",
    title: "Permissions & confidentialité",
    items: [
      "Appareil photo : pour prendre des photos de véhicules ou pièces à joindre aux devis et factures.",
      "Photothèque : pour sélectionner ou enregistrer des photos depuis votre galerie.",
      "Calendrier : pour synchroniser vos rendez-vous avec le calendrier natif de votre téléphone (lecture/écriture).",
      "Face ID / Touch ID : uniquement pour déverrouiller l'app — aucune donnée biométrique ne quitte votre appareil.",
      "Notifications : pour recevoir les alertes push (nouveaux devis, paiements, rendez-vous).",
      "Microphone : optionnel, uniquement si vous enregistrez une vidéo depuis l'app. Vous pouvez refuser sans perdre la fonction photo.",
      "Toutes les permissions peuvent être refusées ou révoquées à tout moment depuis les Réglages système de votre téléphone.",
      "Politique de confidentialité complète : Réglages > Politique de confidentialité.",
    ],
  },
  {
    id: "account",
    icon: "person-remove-outline",
    iconColor: "#EF4444",
    title: "Gestion & suppression de compte",
    items: [
      "Modifiez vos informations personnelles depuis Réglages > Mon profil.",
      "Changez votre mot de passe depuis Réglages > Sécurité > Modifier le mot de passe.",
      "Pour supprimer définitivement votre compte : Réglages > Supprimer mon compte.",
      "La suppression est immédiate, irréversible et entraîne la suppression de toutes vos données personnelles, devis, factures, rendez-vous et fichiers associés.",
      "Aucune donnée n'est conservée après suppression sauf obligation légale (factures sur 10 ans selon la réglementation française).",
    ],
  },
];

export default function AdminGuideScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [expandedId, setExpandedId] = useState<string | null>("navigation");

  const toggleSection = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Guide de l'application</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <View style={styles.introIconWrap}>
            <Ionicons name="book" size={28} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>MyJantes — Guide complet</Text>
            <Text style={styles.introText}>
              Toutes les fonctionnalités de votre application de gestion de garage. Appuyez sur une section pour en savoir plus.
            </Text>
            <Text style={[styles.introText, { marginTop: 4, opacity: 0.6, fontSize: 12 }]}>Version 3.0.0</Text>
          </View>
        </View>

        <View style={styles.countRow}>
          <Text style={styles.countText}>{GUIDE_SECTIONS.length} sections</Text>
          <Pressable onPress={() => setExpandedId(null)}>
            <Text style={styles.collapseAll}>Tout réduire</Text>
          </Pressable>
        </View>

        {GUIDE_SECTIONS.map((section, index) => {
          const isExpanded = expandedId === section.id;
          return (
            <View key={section.id} style={styles.sectionCard}>
              <Pressable style={styles.sectionHeader} onPress={() => toggleSection(section.id)}>
                <View style={styles.sectionLeft}>
                  <View style={[styles.sectionIcon, { backgroundColor: section.iconColor + "18" }]}>
                    <Ionicons name={section.icon} size={20} color={section.iconColor} />
                  </View>
                  <View>
                    <Text style={styles.sectionIndex}>{String(index + 1).padStart(2, "0")}</Text>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                  </View>
                </View>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.textTertiary}
                />
              </Pressable>
              {isExpanded && (
                <View style={styles.sectionBody}>
                  {section.items.map((item, i) => (
                    <View key={i} style={styles.guideItem}>
                      <View style={[styles.bullet, { backgroundColor: section.iconColor + "20" }]}>
                        <Text style={[styles.bulletNumber, { color: section.iconColor }]}>{i + 1}</Text>
                      </View>
                      <Text style={styles.guideText}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.footerCard}>
          <Ionicons name="help-circle-outline" size={22} color={theme.textTertiary} />
          <Text style={styles.footerText}>
            Une question ? Contactez notre support depuis Paramètres ou à l'adresse contact@mytoolsgroup.eu
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.text },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  introCard: {
    flexDirection: "row",
    backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1,
    borderColor: theme.primary + "30", padding: 16, gap: 14, alignItems: "center",
  },
  introIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: theme.primary + "15",
    justifyContent: "center", alignItems: "center",
  },
  introTitle: { fontSize: 15, fontFamily: "Exo2_700Bold", color: theme.text, marginBottom: 4 },
  introText: {
    fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, lineHeight: 19,
  },
  countRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 4, marginTop: 4,
  },
  countText: { fontSize: 12, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  collapseAll: { fontSize: 12, fontFamily: "Exo2_500Medium", color: theme.primary },
  sectionCard: {
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1,
    borderColor: theme.border, overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 14,
  },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  sectionIcon: {
    width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center",
  },
  sectionIndex: {
    fontSize: 10, fontFamily: "Exo2_500Medium", color: theme.textTertiary,
    letterSpacing: 0.5, marginBottom: 1,
  },
  sectionTitle: { fontSize: 14, fontFamily: "Exo2_600SemiBold", color: theme.text },
  sectionBody: {
    paddingHorizontal: 14, paddingBottom: 14, gap: 10,
    borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12,
  },
  guideItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bullet: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: "center", alignItems: "center", marginTop: 1,
    flexShrink: 0,
  },
  bulletNumber: { fontSize: 11, fontFamily: "Exo2_600SemiBold" },
  guideText: { flex: 1, fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textSecondary, lineHeight: 20 },
  footerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1,
    borderColor: theme.border, padding: 16, marginTop: 4,
  },
  footerText: { flex: 1, fontSize: 13, fontFamily: "Exo2_400Regular", color: theme.textTertiary, lineHeight: 18 },
});
