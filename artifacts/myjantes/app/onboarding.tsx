import React, { useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Dimensions,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

const { width } = Dimensions.get("window");

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
}

const slides: OnboardingSlide[] = [
  {
    id: "1",
    icon: "rocket",
    iconColor: "#DC2626",
    title: "Bienvenue chez MyJantes",
    description:
      "Built for Performance. La solution SaaS complète pour les garages d'élite qui visent le sommet.",
  },
  {
    id: "2",
    icon: "document-text",
    iconColor: "#3B82F6",
    title: "Devis instantané",
    description:
      "Chaque devis compte. Envoyez vos demandes et recevez un devis personnalisé rapidement. Acceptez ou refusez directement depuis l'application.",
  },
  {
    id: "3",
    icon: "receipt",
    iconColor: "#10B981",
    title: "Facturation fluide",
    description:
      "Retrouvez l'ensemble de vos factures. Rien n'est approximatif — chaque transaction est tracée avec précision.",
  },
  {
    id: "4",
    icon: "car",
    iconColor: "#8B5CF6",
    title: "Suivi véhicule millimétré",
    description:
      "Consultez vos réservations et suivez l'avancement de vos prestations en temps réel. Analyse en temps réel, décision immédiate.",
  },
  {
    id: "5",
    icon: "chatbubbles",
    iconColor: "#F59E0B",
    title: "Communication directe",
    description:
      "Un chat intégré pour communiquer facilement avec votre garage. Précision absolue, réactivité totale.",
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const goToNext = async () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace("/(main)" as any);
    }
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={[styles.slide, { width }]}>
      <View style={[styles.iconCircle, { backgroundColor: `${item.iconColor}15` }]}>
        <Ionicons name={item.icon} size={48} color={item.iconColor} />
      </View>
      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideDescription}>{item.description}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 + 12 : insets.top + 12 },
        ]}
      >
        <Pressable style={styles.closeBtn} onPress={() => {
          router.replace("/(main)" as any);
        }}>
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
      />

      <View
        style={[
          styles.footer,
          { paddingBottom: Platform.OS === "web" ? 34 + 20 : insets.bottom + 20 },
        ]}
      >
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.8 }]}
          onPress={goToNext}
        >
          <Text style={styles.nextBtnText}>
            {currentIndex === slides.length - 1 ? "Commencer" : "Suivant"}
          </Text>
          <Ionicons
            name={currentIndex === slides.length - 1 ? "checkmark" : "arrow-forward"}
            size={20}
            color="#fff"
          />
        </Pressable>

        {currentIndex < slides.length - 1 && (
          <Pressable style={styles.skipBtn} onPress={() => {
            router.replace("/(main)" as any);
          }}>
            <Text style={styles.skipBtnText}>Passer</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  slideTitle: {
    fontSize: 24,
    fontFamily: "Exo2_700Bold",
    color: theme.text,
    textAlign: "center",
    marginBottom: 16,
  },
  slideDescription: {
    fontSize: 15,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 12,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.surfaceSecondary,
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.primary,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.primary,
    borderRadius: 12,
    height: 52,
    width: "100%",
  },
  nextBtnText: {
    fontSize: 16,
    fontFamily: "Exo2_600SemiBold",
    color: "#fff",
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipBtnText: {
    fontSize: 14,
    fontFamily: "Exo2_500Medium",
    color: theme.textSecondary,
  },
});
