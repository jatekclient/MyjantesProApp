import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

export default function LegalScreen() {
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
      <Text style={styles.heading}>Mentions Légales</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Éditeur du site et de l'application</Text>
        <Text style={styles.text}>
          L'application mobile MyJantes est dédiée aux clients de l'expert en rénovation et personnalisation de jantes automobiles.
        </Text>
        <Text style={styles.text}>Email : contact@myjantes.fr</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Hébergement</Text>
        <Text style={styles.text}>
          L'application et les données associées sont hébergées par des prestataires professionnels garantissant la sécurité et la disponibilité des services.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Propriété intellectuelle</Text>
        <Text style={styles.text}>
          L'ensemble des éléments constituant l'application MyJantes (textes, images, logos, icônes, sons, logiciels, etc.) est protégé par les droits de leurs propriétaires. Toute reproduction non autorisée est interdite.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Limitation de responsabilité</Text>
        <Text style={styles.text}>
          MyJantes s'efforce de fournir des informations aussi précises que possible. Toutefois, des omissions ou retards de mise à jour peuvent subsister.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Droit applicable</Text>
        <Text style={styles.text}>
          Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux français seront seuls compétents.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>6. Fonctionnalités de l'application</Text>
        <Text style={styles.text}>
          L'application MyJantes permet la consultation de vos devis et factures. Aucun paiement ne peut être effectué depuis l'application.
        </Text>
        <Text style={styles.text}>
          La modification de vos informations personnelles et de votre mot de passe s'effectue exclusivement depuis votre espace client sur notre site internet, pour des raisons de sécurité.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>7. Contact</Text>
        <Text style={styles.text}>
          Pour toute question relative aux mentions légales, vous pouvez nous contacter à l'adresse : contact@myjantes.fr
        </Text>
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
});
