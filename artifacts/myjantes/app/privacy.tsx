import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Platform.OS === "web" ? 34 + 40 : insets.bottom + 40 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Politique de Confidentialité</Text>
      <Text style={styles.lastUpdate}>Dernière mise à jour : Février 2026</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Collecte des données personnelles</Text>
        <Text style={styles.text}>
          Dans le cadre de l'utilisation de l'application MyJantes, nous collectons les données personnelles nécessaires au suivi de vos demandes :
        </Text>
        <Text style={styles.bullet}>- Nom et prénom</Text>
        <Text style={styles.bullet}>- Adresse email</Text>
        <Text style={styles.bullet}>- Numéro de téléphone</Text>
        <Text style={styles.bullet}>- Adresse postale</Text>
        <Text style={styles.bullet}>- Pour les professionnels : raison sociale, SIRET, numéro de TVA, adresse de l'entreprise</Text>
        <Text style={styles.bullet}>- Photos de jantes envoyées avec les demandes de devis</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Finalité du traitement</Text>
        <Text style={styles.text}>Les données collectées sont utilisées pour :</Text>
        <Text style={styles.bullet}>- La gestion de votre compte utilisateur</Text>
        <Text style={styles.bullet}>- Le traitement de vos demandes de devis</Text>
        <Text style={styles.bullet}>- L'établissement de factures</Text>
        <Text style={styles.bullet}>- La communication relative à nos services</Text>
        <Text style={styles.bullet}>- Le support client</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Base légale du traitement</Text>
        <Text style={styles.text}>
          Le traitement de vos données personnelles est fondé sur l'exécution du contrat qui nous lie (fourniture de services de rénovation de jantes) et sur votre consentement pour les communications commerciales.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Durée de conservation</Text>
        <Text style={styles.text}>
          Vos données personnelles sont conservées pendant la durée nécessaire à l'exécution de nos services et conformément aux obligations légales en vigueur. Les données de facturation sont conservées pendant 10 ans conformément aux obligations comptables.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Partage des données</Text>
        <Text style={styles.text}>
          Vos données personnelles ne sont pas vendues ni partagées avec des tiers à des fins commerciales. Elles peuvent être transmises à nos prestataires techniques dans le cadre strict de la fourniture de nos services.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>6. Sécurité des données</Text>
        <Text style={styles.text}>
          Nous mettons en oeuvre des mesures techniques et organisationnelles appropriées pour protéger vos données personnelles contre tout accès non autorisé, modification, divulgation ou destruction.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>7. Vos droits</Text>
        <Text style={styles.text}>
          Conformément au RGPD, vous disposez des droits suivants :
        </Text>
        <Text style={styles.bullet}>- Droit d'accès à vos données personnelles</Text>
        <Text style={styles.bullet}>- Droit de rectification de vos données</Text>
        <Text style={styles.bullet}>- Droit à l'effacement de vos données (Droit à l'oubli)</Text>
        <Text style={styles.bullet}>- Droit à la limitation du traitement</Text>
        <Text style={styles.bullet}>- Droit à la portabilité de vos données</Text>
        <Text style={styles.bullet}>- Droit d'opposition au traitement</Text>
        <Text style={styles.text}>
          Pour exercer vos droits, notamment la suppression de vos données, contactez-nous à : contact@myjantes.fr ou via le bouton de suppression dans votre profil.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>8. Cookies</Text>
        <Text style={styles.text}>
          L'application utilise des cookies de session nécessaires à son bon fonctionnement. Ces cookies sont indispensables à la navigation et ne peuvent pas être désactivés.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>9. Contact</Text>
        <Text style={styles.text}>
          Pour toute question relative à la protection de vos données personnelles :
        </Text>
        <Text style={styles.text}>Email : contact@myjantes.fr</Text>
      </View>
    </ScrollView>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: 20,
  },
  heading: {
    fontSize: 22,
    fontFamily: "Exo2_700Bold",
    color: theme.text,
    marginBottom: 4,
  },
  lastUpdate: {
    fontSize: 12,
    fontFamily: "Exo2_400Regular",
    color: theme.textTertiary,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    lineHeight: 22,
    marginBottom: 4,
  },
  bullet: {
    fontSize: 14,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    lineHeight: 22,
    paddingLeft: 12,
  },
});
