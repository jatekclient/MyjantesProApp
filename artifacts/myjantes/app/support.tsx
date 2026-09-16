import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { supportApi, SupportContactData } from "@/lib/api";
import { useCustomAlert } from "@/components/CustomAlert";

const CATEGORIES = [
  "Question générale",
  "Devis / Facturation",
  "Réservation",
  "Problème technique",
  "Autre",
];

export default function SupportScreen() {
  const { user } = useAuth();
  const { showAlert, AlertComponent } = useCustomAlert();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [name, setName] = useState(
    user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : ""
  );
  const [email, setEmail] = useState(user?.email ?? "");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = !!(name.trim() && email.trim() && subject.trim() && message.trim());


  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const data: SupportContactData = {
        name: name.trim(),
        email: email.trim(),
        category,
        subject: subject.trim(),
        message: message.trim(),
      };
      await supportApi.contact(data);
      showAlert({
        type: "success",
        title: "Message envoyé",
        message: "Votre message a bien été envoyé. Nous vous répondrons dans les plus brefs délais.",
        buttons: [{ text: "OK", style: "primary", onPress: () => router.back() }],
      });
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "Erreur",
        message: err?.message || "Une erreur est survenue. Veuillez réessayer plus tard.",
        buttons: [{ text: "OK", style: "primary" }],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.grabberBar} />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Nous contacter</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          <View style={styles.field}>
            <Text style={styles.label}>Nom</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Votre nom"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.chipContainer}>
              {CATEGORIES.map((cat) => {
                const selected = category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Sujet</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Objet de votre demande"
              placeholderTextColor={theme.textTertiary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Décrivez votre demande..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          <View style={{ height: 16 }} />
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
              pressed && canSubmit && styles.submitButtonPressed,
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.submitButtonText}>Envoi…</Text>
              </View>
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Envoyer</Text>
              </>
            )}
          </Pressable>
          <View style={{ height: Platform.OS === "web" ? 34 : Math.max(insets.bottom, 16) }} />
        </ScrollView>
      </KeyboardAvoidingView>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  grabberBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.textTertiary,
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    paddingBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  messageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    fontFamily: "Exo2_400Regular",
    color: theme.text,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
  },
  chipTextSelected: {
    color: "#fff",
    fontFamily: "Exo2_500Medium",
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.background,
  },
  submitButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    height: 52,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonPressed: {
    backgroundColor: theme.primaryDark,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Exo2_600SemiBold",
  },
});
