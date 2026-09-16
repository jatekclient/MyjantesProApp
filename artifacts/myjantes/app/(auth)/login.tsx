import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

export default function LoginScreen() {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { login, biometricLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState("Biométrie");

  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      try {
        // Use the same platform-aware store as the profile toggle (SecureStore on native).
        // We already returned early above if Platform.OS === "web", so SecureStore is safe here.
        const enabled = await SecureStore.getItemAsync("biometric_enabled");
        if (enabled !== "true") return;

        // A biometric session only makes sense when a stored token still exists
        // (i.e. the user has not explicitly logged out).
        const storedToken = await SecureStore.getItemAsync("access_token");
        if (!storedToken) return;

        const LocalAuth = await import("expo-local-authentication");
        const hasHw = await LocalAuth.hasHardwareAsync();
        const enrolled = await LocalAuth.isEnrolledAsync();
        if (!hasHw || !enrolled) return;
        const types = await LocalAuth.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType("Face ID");
        } else if (types.includes(LocalAuth.AuthenticationType.FINGERPRINT)) {
          setBiometricType("Empreinte digitale");
        }
        setBiometricAvailable(true);
      } catch {}
    })();
  }, []);

  const handleBiometricLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const success = await biometricLogin();
      if (success) {
        router.replace("/(main)" as any);
      } else {
        setError("Authentification biométrique échouée. Connectez-vous avec votre email.");
      }
    } catch {
      setError("Authentification biométrique indisponible.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Saisissez votre adresse email et votre mot de passe.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      router.replace("/(main)" as any);
    } catch (err: any) {
      setError(err?.message || "Identifiants incorrects. Vérifiez vos informations.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === "web" ? 67 + 24 : insets.top + 24,
            paddingBottom: Platform.OS === "web" ? 34 + 32 : insets.bottom + 32,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo ── */}
        <View style={styles.logoWrap}>
          <Image
            source={require("@/assets/images/logo_new.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>

        {/* ── Hero title ── */}
        <View style={styles.heroWrap}>
          <Text style={styles.heroLine1}>L'EXPERT</Text>
          <Text style={styles.heroLine2}>DE JANTES ALU</Text>
          <View style={styles.heroBar} />
        </View>

        {/* ── Form ── */}
        <View style={styles.form}>
          {/* Email */}
          <Text style={styles.label}>EMAIL</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={20} color={theme.textTertiary} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Votre email"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              testID="input-email"
            />
          </View>

          {/* Password */}
          <Text style={[styles.label, { marginTop: 20 }]}>MOT DE PASSE</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.textTertiary} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Votre mot de passe"
              placeholderTextColor={theme.textTertiary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              testID="input-password"
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={12}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.textTertiary}
              />
            </Pressable>
          </View>

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              loading && styles.disabled,
            ]}
            onPress={submit}
            disabled={loading}
            testID="button-login"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>SE CONNECTER</Text>
            )}
          </Pressable>

          {/* Forgot */}
          <Pressable
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.forgotWrap}
          >
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </Pressable>

          {/* Biometric login */}
          {biometricAvailable && (
            <Pressable
              style={({ pressed }) => [
                styles.biometricButton,
                pressed && styles.pressed,
                loading && styles.disabled,
              ]}
              onPress={handleBiometricLogin}
              disabled={loading}
              testID="button-biometric"
            >
              <Ionicons
                name={biometricType === "Face ID" ? "scan-outline" : "finger-print-outline"}
                size={22}
                color={theme.primary}
              />
              <Text style={styles.biometricButtonText}>
                Connexion via {biometricType}
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Separator ── */}
        <View style={styles.separator}>
          <View style={styles.sepLine} />
          <View style={styles.sepDot} />
          <View style={styles.sepLine} />
        </View>

        {/* ── Register link ── */}
        <Pressable
          onPress={() => router.push("/(auth)/register")}
          style={styles.registerWrap}
        >
          <Text style={styles.registerText}>
            Créer un <Text style={styles.registerLink}>compte</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.background },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
    },

    /* Logo */
    logoWrap: { alignItems: "center", marginBottom: 8 },
    logo: { width: 220, height: 80 },

    /* Hero */
    heroWrap: { marginBottom: 32 },
    heroLine1: {
      color: theme.text,
      fontFamily: theme.fontBold,
      fontSize: 48,
      letterSpacing: 1,
      lineHeight: 54,
    },
    heroLine2: {
      color: theme.textSecondary,
      fontFamily: theme.fontBold,
      fontSize: 36,
      letterSpacing: 1,
      lineHeight: 44,
    },
    heroBar: {
      marginTop: 10,
      width: 80,
      height: 3,
      borderRadius: 2,
      backgroundColor: theme.primary,
    },

    /* Form */
    form: { width: "100%" },
    label: {
      color: theme.textSecondary,
      fontFamily: theme.fontSemiBold,
      fontSize: 11,
      letterSpacing: 1.5,
      marginBottom: 8,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 16,
      minHeight: 56,
    },
    input: {
      flex: 1,
      color: theme.text,
      fontFamily: theme.fontRegular,
      fontSize: 16,
      minHeight: 54,
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: theme.errorLight,
      borderRadius: 8,
      padding: 12,
      marginTop: 16,
    },
    errorText: {
      flex: 1,
      color: theme.error,
      fontFamily: theme.fontRegular,
      fontSize: 13,
      lineHeight: 18,
    },
    primaryButton: {
      minHeight: 56,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      borderRadius: 10,
      marginTop: 24,
    },
    primaryButtonText: {
      color: "#fff",
      fontFamily: theme.fontBold,
      fontSize: 16,
      letterSpacing: 1.5,
    },
    pressed: { opacity: 0.82 },
    disabled: { opacity: 0.65 },
    forgotWrap: { alignItems: "center", marginTop: 20 },
    forgotText: {
      color: theme.textSecondary,
      fontFamily: theme.fontRegular,
      fontSize: 14,
    },
    biometricButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      marginTop: 16,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.primary,
      backgroundColor: "transparent",
    },
    biometricButtonText: {
      color: theme.primary,
      fontFamily: theme.fontSemiBold,
      fontSize: 14,
      letterSpacing: 0.5,
    },

    /* Separator */
    separator: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 28,
      marginBottom: 20,
      gap: 0,
    },
    sepLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.border,
    },
    sepDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.border,
      marginHorizontal: 10,
    },

    /* Register */
    registerWrap: { alignItems: "center" },
    registerText: {
      color: theme.textSecondary,
      fontFamily: theme.fontRegular,
      fontSize: 15,
    },
    registerLink: {
      color: theme.primary,
      fontFamily: theme.fontSemiBold,
    },
  });
