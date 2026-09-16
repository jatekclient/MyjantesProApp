import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

type Step = "email" | "otp" | "password" | "success";

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 60;

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const otpRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const startCountdown = useCallback(() => {
    setResendCountdown(RESEND_COUNTDOWN);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const otpValue = otp.join("");
  const isOtpComplete = otpValue.length === OTP_LENGTH && otp.every((d) => d !== "");

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed || !validateEmail(trimmed)) return;
    setLoading(true);
    setError("");
    try {
      await authApi.forgotPassword(trimmed);
      setStep("otp");
      setOtp(Array(OTP_LENGTH).fill(""));
      startCountdown();
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (e: any) {
      setError(e?.message || "Impossible d'envoyer le code. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setLoading(true);
    setError("");
    setOtp(Array(OTP_LENGTH).fill(""));
    try {
      await authApi.forgotPassword(email.trim());
      startCountdown();
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } catch (e: any) {
      setError(e?.message || "Impossible de renvoyer le code.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "");

    // Handle paste of full code
    if (cleaned.length > 1) {
      const digits = cleaned.slice(0, OTP_LENGTH).split("");
      const next = [...Array(OTP_LENGTH).fill("")];
      digits.forEach((d, i) => { next[i] = d; });
      setOtp(next);
      const focusIdx = Math.min(digits.length, OTP_LENGTH - 1);
      otpRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...otp];
    next[index] = cleaned.slice(-1);
    setOtp(next);

    if (cleaned && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>
  ) => {
    if (e.nativeEvent.key === "Backspace") {
      if (otp[index] === "" && index > 0) {
        const next = [...otp];
        next[index - 1] = "";
        setOtp(next);
        otpRefs.current[index - 1]?.focus();
      } else {
        const next = [...otp];
        next[index] = "";
        setOtp(next);
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (!isOtpComplete) return;
    setLoading(true);
    setError("");
    try {
      const result = await authApi.verifyResetCode(email.trim(), otpValue);
      if (result.valid && result.resetToken) {
        setResetToken(result.resetToken);
        setStep("password");
      } else {
        setError(result.message || "Code incorrect ou expiré. Vérifiez le code reçu par email.");
      }
    } catch (e: any) {
      setError(e?.message || "Code incorrect ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    if (newPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(resetToken, newPassword);
      setStep("success");
    } catch (e: any) {
      setError(e?.message || "Impossible de réinitialiser le mot de passe. Réessayez depuis le début.");
    } finally {
      setLoading(false);
    }
  };

  const paddingTop = Platform.OS === "web" ? 67 + 20 : insets.top + 20;
  const paddingBottom = Platform.OS === "web" ? 34 + 20 : insets.bottom + 20;

  if (step === "success") {
    return (
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: paddingTop + 20, paddingBottom }]}>
          <View style={styles.centeredContent}>
            <View style={[styles.iconCircle, { borderColor: theme.success + "40", backgroundColor: theme.success + "18" }]}>
              <Ionicons name="checkmark-circle-outline" size={40} color={theme.success} />
            </View>
            <Text style={styles.title}>Mot de passe réinitialisé</Text>
            <Text style={styles.subtitle}>
              Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Ionicons name="log-in-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Se connecter</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop, paddingBottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding logo */}
        <Image
          source={require("@/assets/images/logo_new.png")}
          style={styles.brandLogo}
          contentFit="contain"
        />

        <Pressable onPress={() => {
          if (step === "otp") setStep("email");
          else if (step === "password") { setStep("otp"); setOtp(Array(OTP_LENGTH).fill("")); }
          else router.back();
        }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>

        {/* ─── STEP 1 : EMAIL ─── */}
        {step === "email" && (
          <>
            <Text style={styles.heroLine1}>MOT DE PASSE</Text>
            <Text style={styles.heroLine2}>OUBLIÉ ?</Text>
            <View style={styles.heroBar} />
            <Text style={[styles.subtitle, { marginTop: 16 }]}>
              Saisissez votre adresse email. Vous recevrez un code à 6 chiffres pour réinitialiser votre mot de passe.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(""); }}
                  placeholder="votre@email.com"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={handleSendCode}
                  testID="forgot-email-input"
                />
              </View>
              {email.trim().length > 0 && !validateEmail(email.trim()) && (
                <Text style={styles.errorHint}>Adresse email invalide</Text>
              )}
            </View>

            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.primaryBtnPressed,
                (!email.trim() || !validateEmail(email.trim()) || loading) && styles.primaryBtnDisabled,
              ]}
              onPress={handleSendCode}
              disabled={!email.trim() || !validateEmail(email.trim()) || loading}
              testID="forgot-send-btn"
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="send-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Envoyer le code</Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.supportLink} onPress={() => router.push("/support" as any)}>
              <Ionicons name="help-circle-outline" size={18} color={theme.textSecondary} />
              <Text style={styles.supportLinkText}>Besoin d'aide ? Contacter le support</Text>
            </Pressable>
          </>
        )}

        {/* ─── STEP 2 : OTP ─── */}
        {step === "otp" && (
          <>
            <View style={styles.iconHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="keypad-outline" size={32} color={theme.primary} />
              </View>
            </View>
            <Text style={styles.title}>Vérification</Text>
            <Text style={styles.subtitle}>
              Un code à 6 chiffres a été envoyé à
            </Text>
            <Text style={styles.emailHighlight}>{email.trim()}</Text>
            <Text style={[styles.subtitle, { marginTop: 4, marginBottom: 28 }]}>
              Saisissez ce code ci-dessous pour continuer.
            </Text>

            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(r) => { otpRefs.current[index] = r; }}
                  style={[
                    styles.otpCell,
                    digit !== "" && styles.otpCellFilled,
                  ]}
                  value={digit}
                  onChangeText={(v) => handleOtpChange(index, v)}
                  onKeyPress={(e) => handleOtpKeyPress(index, e)}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  textAlign="center"
                  selectTextOnFocus
                  caretHidden
                  placeholderTextColor={theme.textTertiary}
                  placeholder="·"
                  testID={`otp-cell-${index}`}
                />
              ))}
            </View>

            {error ? <Text style={[styles.errorBanner, { marginTop: 8 }]}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { marginTop: 28 },
                pressed && styles.primaryBtnPressed,
                (!isOtpComplete || loading) && styles.primaryBtnDisabled,
              ]}
              onPress={handleVerifyOtp}
              disabled={!isOtpComplete || loading}
              testID="otp-verify-btn"
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Vérifier le code</Text>
                </>
              )}
            </Pressable>

            <View style={styles.resendRow}>
              {resendCountdown > 0 ? (
                <Text style={styles.resendCountdown}>
                  Renvoyer le code dans{" "}
                  <Text style={{ color: theme.primary, fontFamily: "Exo2_600SemiBold" }}>
                    {resendCountdown}s
                  </Text>
                </Text>
              ) : (
                <Pressable
                  onPress={handleResend}
                  disabled={loading}
                  style={styles.resendBtn}
                >
                  <Ionicons name="refresh-outline" size={16} color={theme.primary} />
                  <Text style={styles.resendBtnText}>Renvoyer le code</Text>
                </Pressable>
              )}
            </View>

            <Pressable onPress={() => setStep("email")} style={styles.changeEmailBtn}>
              <Ionicons name="pencil-outline" size={14} color={theme.textSecondary} />
              <Text style={styles.changeEmailText}>Changer d'adresse email</Text>
            </Pressable>
          </>
        )}

        {/* ─── STEP 3 : NEW PASSWORD ─── */}
        {step === "password" && (
          <>
            <View style={styles.iconHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark-outline" size={32} color={theme.primary} />
              </View>
            </View>
            <Text style={styles.title}>Nouveau mot de passe</Text>
            <Text style={styles.subtitle}>
              Choisissez un mot de passe sécurisé d'au moins 8 caractères.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nouveau mot de passe</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={(v) => { setNewPassword(v); setError(""); }}
                  placeholder="8 caractères minimum"
                  placeholderTextColor={theme.textTertiary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="next"
                  testID="new-password-input"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setError(""); }}
                  placeholder="Répétez le mot de passe"
                  placeholderTextColor={theme.textTertiary}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleResetPassword}
                  testID="confirm-password-input"
                />
                <Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={showConfirm ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.passwordRules}>
              <PasswordRule met={newPassword.length >= 8} label="Au moins 8 caractères" />
              <PasswordRule met={/[A-Z]/.test(newPassword)} label="Une majuscule" />
              <PasswordRule met={/[0-9]/.test(newPassword)} label="Un chiffre" />
              <PasswordRule
                met={confirmPassword.length > 0 && newPassword === confirmPassword}
                label="Les mots de passe correspondent"
              />
            </View>

            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { marginTop: 8 },
                pressed && styles.primaryBtnPressed,
                (newPassword.length < 8 || newPassword !== confirmPassword || loading) && styles.primaryBtnDisabled,
              ]}
              onPress={handleResetPassword}
              disabled={newPassword.length < 8 || newPassword !== confirmPassword || loading}
              testID="reset-password-btn"
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Réinitialiser le mot de passe</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
      <Ionicons
        name={met ? "checkmark-circle" : "ellipse-outline"}
        size={14}
        color={met ? theme.success : theme.textTertiary}
      />
      <Text style={{
        fontSize: 12,
        fontFamily: "Exo2_400Regular",
        color: met ? theme.success : theme.textTertiary,
      }}>
        {label}
      </Text>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.background },
  scrollContent: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  /* Branding */
  brandLogo: { width: 200, height: 72, marginBottom: 4, alignSelf: "flex-start" },
  heroLine1: {
    color: theme.text,
    fontFamily: "Exo2_700Bold",
    fontSize: 38,
    letterSpacing: 1,
    lineHeight: 44,
  },
  heroLine2: {
    color: theme.textSecondary,
    fontFamily: "Exo2_700Bold",
    fontSize: 28,
    letterSpacing: 1,
    lineHeight: 36,
  },
  heroBar: {
    marginTop: 8,
    width: 70,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.primary,
    marginBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  iconHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    fontSize: 24,
    fontFamily: "Exo2_700Bold",
    color: theme.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    lineHeight: 21,
    marginBottom: 0,
  },
  emailHighlight: {
    fontSize: 15,
    fontFamily: "Exo2_600SemiBold",
    color: theme.primary,
    textAlign: "center",
    marginTop: 4,
  },
  inputGroup: {
    gap: 6,
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontFamily: "Exo2_500Medium",
    color: theme.text,
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Exo2_400Regular",
    color: theme.text,
    height: "100%",
  },
  errorHint: {
    fontSize: 12,
    fontFamily: "Exo2_400Regular",
    color: theme.error,
    marginLeft: 4,
    marginTop: 4,
  },
  errorBanner: {
    fontSize: 13,
    fontFamily: "Exo2_400Regular",
    color: theme.error,
    textAlign: "center",
    backgroundColor: theme.error + "18",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnPressed: { backgroundColor: theme.primaryDark },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Exo2_600SemiBold",
  },
  supportLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 32,
    paddingVertical: 8,
  },
  supportLinkText: {
    fontSize: 13,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
  },
  // OTP
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  otpCell: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    fontSize: 22,
    fontFamily: "Exo2_700Bold",
    color: theme.text,
    textAlign: "center",
  },
  otpCellFilled: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + "12",
  },
  resendRow: {
    alignItems: "center",
    marginTop: 20,
  },
  resendCountdown: {
    fontSize: 13,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    textAlign: "center",
  },
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  resendBtnText: {
    fontSize: 14,
    fontFamily: "Exo2_500Medium",
    color: theme.primary,
  },
  changeEmailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 6,
  },
  changeEmailText: {
    fontSize: 13,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
  },
  passwordRules: {
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 4,
    gap: 2,
  },
  centeredContent: {
    flex: 1,
    alignItems: "center",
    paddingTop: 20,
  },
});
