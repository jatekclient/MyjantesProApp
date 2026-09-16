import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Switch,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";
import { getBackendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Step = "role" | "siret" | "form" | "success";
type RoleType = "particulier" | "professionnel" | null;

interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  siret: string;
  siren: string;
  legalForm: string;
  tvaNumber: string;
}

function getPasswordStrength(pwd: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!pwd) return { level: 0, label: "", color: "transparent" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { level: 1, label: "Faible", color: "#EF4444" };
  if (score === 2) return { level: 2, label: "Moyen", color: "#F59E0B" };
  return { level: 3, label: "Fort", color: "#10B981" };
}

export default function RegisterScreen() {
  const params = useLocalSearchParams();
  const prefillEmail = Array.isArray(params.email) ? params.email[0] : (params.email as string || "");
  const prefillName = Array.isArray(params.displayName) ? params.displayName[0] : (params.displayName as string || "");
  const firebaseUid = Array.isArray(params.firebaseUid) ? params.firebaseUid[0] : (params.firebaseUid as string || "");
  const idToken = Array.isArray(params.idToken) ? params.idToken[0] : (params.idToken as string || "");
  const isGoogleFlow = !!firebaseUid;

  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { showAlert, AlertComponent } = useCustomAlert();
  const { socialLogin } = useAuth();

  const [step, setStep] = useState<Step>("role");
  const [roleType, setRoleType] = useState<RoleType>(null);
  const [loading, setLoading] = useState(false);

  // SIRET search (pro only)
  const [siretInput, setSiretInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const siretLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual entry (pro only)
  const [manualEntry, setManualEntry] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [manualPostalCode, setManualPostalCode] = useState("");
  const [manualSiret, setManualSiret] = useState("");
  const [manualSiren, setManualSiren] = useState("");
  const [manualLegalForm, setManualLegalForm] = useState("");
  const [manualTvaNumber, setManualTvaNumber] = useState("");
  const [certificationConsent, setCertificationConsent] = useState(false);

  // Personal info
  const nameParts = prefillName.split(" ");
  const [firstName, setFirstName] = useState(nameParts[0] || "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" ") || "");
  const [email, setEmail] = useState(prefillEmail);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [garageName, setGarageName] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [legalConsent, setLegalConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const pwdStrength = getPasswordStrength(password);
  const apiBase = getBackendUrl();
  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 34 + 24 : insets.bottom + 24;

  // ─── Role selection ─────────────────────────────────────────────────────────
  const handleSelectRole = useCallback((role: RoleType) => {
    setRoleType(role);
    if (role === "particulier") {
      setStep("form");
    } else {
      setStep("siret");
    }
  }, []);

  // ─── Company lookup (production backend with official registry fallback) ──────
  const safeParseJson = useCallback(async (res: Response): Promise<any | null> => {
    try {
      const text = await res.text();
      if (!text || text.trim() === "") return null;
      if (text.trim().startsWith("<")) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  }, []);

  const lookupPublicCompany = useCallback(async (query: string): Promise<CompanyInfo | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=1`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const payload = await safeParseJson(res);
      if (!res.ok) throw new Error(`Service public indisponible (${res.status})`);

      const item = payload?.results?.[0];
      if (!item) return null;

      const siege = item.siege || item.matching_etablissements?.[0] || {};
      const digits = query.replace(/\D/g, "");
      const siret = siege.siret || item.siret || (digits.length === 14 ? digits : "");
      const siren = item.siren || siret.slice(0, 9);
      const address =
        siege.adresse ||
        [siege.numero_voie, siege.type_voie, siege.libelle_voie].filter(Boolean).join(" ");
      const name = item.nom_complet || item.nom_raison_sociale || item.name || "";

      if (!name) return null;
      return {
        name,
        address: address || "",
        city: siege.libelle_commune || siege.ville || "",
        postalCode: siege.code_postal || "",
        siret,
        siren,
        legalForm: item.nature_juridique || item.section_activite_principale || "",
        tvaNumber: siren ? `FR${siren}` : "",
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }, [safeParseJson]);

  const doLookup = useCallback(async (query: string, isSiret: boolean) => {
    setLoading(true);
    setSearchAttempted(true);
    try {
      const param = isSiret ? `siret=${encodeURIComponent(query)}` : `name=${encodeURIComponent(query)}`;
      const reqHeaders: Record<string, string> = { Accept: "application/json" };
      if (idToken) reqHeaders["Authorization"] = `Bearer ${idToken}`;

      let data: any = null;
      let fetchError: string | null = null;

      try {
        const res = await fetch(`${apiBase}/api/mobile/company/search?${param}`, {
          headers: reqHeaders,
        });
        if (res.ok) {
          data = await safeParseJson(res);
        } else {
          const err = await safeParseJson(res);
          if (err?.requiresManualEntry) { setManualEntry(true); return; }
          fetchError = err?.message || `Erreur ${res.status}`;
        }
      } catch (e: any) {
        fetchError = e?.message || "Impossible de contacter le serveur.";
      }

      // Production may not have the company-search proxy deployed yet.
      // Fall back to the official public registry using real data, never mocks.
      if (!data) {
        try {
          data = await lookupPublicCompany(query);
          if (data) fetchError = null;
        } catch (fallbackError: any) {
          if (!fetchError) {
            fetchError = fallbackError?.message || "Impossible de contacter le service public.";
          }
        }
      }

      if (fetchError && !data) {
        showAlert({
          type: "error",
          title: "Erreur de recherche",
          message: `${fetchError}\n\nVérifiez votre connexion ou saisissez vos informations manuellement.`,
          buttons: [
            { text: "Saisir manuellement", style: "primary", onPress: () => setManualEntry(true) },
            { text: "Réessayer", style: "cancel" },
          ],
        });
        return;
      }

      if (!data || (!data.name && !data.companyName)) {
        showAlert({
          type: "error",
          title: "Entreprise introuvable",
          message: "Aucune entreprise trouvée pour cette recherche.\n\nVous pouvez saisir les informations manuellement.",
          buttons: [
            { text: "Saisir manuellement", style: "primary", onPress: () => setManualEntry(true) },
            { text: "Réessayer", style: "cancel" },
          ],
        });
        return;
      }

      setCompany({
        name: data.name || data.companyName || "",
        address: data.address || "",
        city: data.city || "",
        postalCode: data.postalCode || "",
        siret: data.siret || query,
        siren: data.siren || "",
        legalForm: data.legalForm || "",
        tvaNumber: data.tvaNumber || "",
      });
      if (!garageName && (data.name || data.companyName)) setGarageName(data.name || data.companyName);
      setManualEntry(false);
    } catch (err: any) {
      setCompany(null);
      showAlert({
        type: "error",
        title: "Erreur de recherche",
        message: `${err.message || "Impossible de contacter le serveur."}\n\nVous pouvez saisir vos informations manuellement.`,
        buttons: [
          { text: "Saisir manuellement", style: "primary", onPress: () => setManualEntry(true) },
          { text: "Réessayer", style: "cancel" },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [garageName, apiBase, idToken, lookupPublicCompany, safeParseJson, showAlert]);

  const handleSiretChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 14);
    setSiretInput(digits);
    setCompany(null);
    setSearchAttempted(false);
    if (siretLookupTimer.current) clearTimeout(siretLookupTimer.current);
    if (digits.length === 14) {
      siretLookupTimer.current = setTimeout(() => doLookup(digits, true), 300);
    }
  }, [doLookup]);

  const lookupManual = useCallback(async () => {
    const query = siretInput.trim() || nameInput.trim();
    if (!query) {
      showAlert({ type: "error", title: "Erreur", message: "Veuillez saisir un SIRET ou un nom d'entreprise.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    await doLookup(query, !!siretInput.trim());
  }, [siretInput, nameInput, doLookup]);

  const checkEmailAndProceed = useCallback(async () => {
    if (manualEntry) {
      if (!manualName.trim()) {
        showAlert({ type: "error", title: "Champ requis", message: "La raison sociale est obligatoire.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      if (!manualAddress.trim()) {
        showAlert({ type: "error", title: "Champ requis", message: "L'adresse est obligatoire.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      if (!manualCity.trim()) {
        showAlert({ type: "error", title: "Champ requis", message: "La ville est obligatoire.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      if (!manualPostalCode.trim() || !/^\d{5}$/.test(manualPostalCode.trim())) {
        showAlert({ type: "error", title: "Champ requis", message: "Le code postal doit contenir exactement 5 chiffres.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      if (!certificationConsent) {
        showAlert({ type: "error", title: "Certification requise", message: "Vous devez certifier l'exactitude des informations renseignées.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      setCompany({
        name: manualName.trim(),
        address: manualAddress.trim(),
        city: manualCity.trim(),
        postalCode: manualPostalCode.trim(),
        siret: manualSiret.trim(),
        siren: manualSiren.trim(),
        legalForm: manualLegalForm.trim(),
        tvaNumber: manualTvaNumber.trim(),
      });
      if (!garageName) setGarageName(manualName.trim());
      setStep("form");
      return;
    }
    if (!company) return;
    if (!certificationConsent) {
      showAlert({ type: "error", title: "Certification requise", message: "Vous devez certifier l'exactitude des informations renseignées.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    setStep("form");
  }, [company, manualEntry, manualName, manualAddress, manualCity, manualPostalCode, manualSiret, manualSiren, manualLegalForm, manualTvaNumber, certificationConsent, garageName]);

  // ─── Registration submit ────────────────────────────────────────────────────
  const handleRegister = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showAlert({ type: "error", title: "Erreur", message: "Prénom et nom requis.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (!email.trim()) {
      showAlert({ type: "error", title: "Erreur", message: "Email requis.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }
    if (!isGoogleFlow) {
      if (!password || password.length < 8) {
        showAlert({ type: "error", title: "Erreur", message: "Le mot de passe doit contenir au moins 8 caractères.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
      if (password !== confirmPassword) {
        showAlert({ type: "error", title: "Erreur", message: "Les mots de passe ne correspondent pas.", buttons: [{ text: "OK", style: "primary" }] });
        return;
      }
    }
    if (!legalConsent) {
      showAlert({ type: "error", title: "Erreur", message: "Vous devez accepter les conditions générales.", buttons: [{ text: "OK", style: "primary" }] });
      return;
    }

    setLoading(true);
    try {
      // Check email availability — explicit error if server unreachable
      try {
        const checkRes = await fetch(`${apiBase}/api/users/check-email?email=${encodeURIComponent(email.trim().toLowerCase())}`, {
          headers: { Accept: "application/json" },
        });
        if (checkRes.ok) {
          const checkData = await safeParseJson(checkRes);
          if (checkData?.exists) {
            showAlert({ type: "info", title: "Compte existant", message: "Un compte existe déjà avec cette adresse email. Veuillez vous connecter.", buttons: [{ text: "Se connecter", style: "primary", onPress: () => router.replace("/(auth)/login") }] });
            setLoading(false);
            return;
          }
        }
      } catch {}

      const isParticulier = roleType === "particulier";

      const body: any = {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: isParticulier ? "client_particulier" : "client_professionnel",
        smsConsent,
        certificationConsent: true,
      };

      if (phone.trim()) body.phone = phone.trim();

      if (!isParticulier) {
        // Pro fields
        body.garageName = garageName.trim() || company?.name || "";
        body.companyName = company?.name || "";
        body.siret = company?.siret || "";
        body.siren = company?.siren || "";
        body.address = company?.address || "";
        body.city = company?.city || "";
        body.postalCode = company?.postalCode || "";
        body.tvaNumber = company?.tvaNumber || "";
        body.legalForm = company?.legalForm || "";
      }

      if (isGoogleFlow) {
        body.firebaseUid = firebaseUid;
      } else {
        body.password = password;
      }

      const res = await fetch(`${apiBase}/api/mobile/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await safeParseJson(res) ?? {};
        console.error("[Register] API error:", res.status, JSON.stringify(err));
        throw new Error(err?.message || err?.error || "Inscription échouée. Veuillez réessayer.");
      }

      if (isGoogleFlow && idToken) {
        try {
          const loginResult = await socialLogin(idToken, "google");
          if (loginResult.status === "authenticated") {
            setStep("success");
            return;
          }
          showAlert({
            type: "info",
            title: "Compte créé",
            message: "Votre compte a été créé. La connexion Google n'est pas encore disponible — utilisez « Mot de passe oublié » sur l'écran de connexion pour définir un mot de passe.",
            buttons: [{ text: "Se connecter", style: "primary", onPress: () => router.replace("/(auth)/login") }],
          });
          setLoading(false);
          return;
        } catch (loginErr: any) {
          console.error("[Register] Auto-login after registration failed:", loginErr.message);
          showAlert({
            type: "info",
            title: "Compte créé",
            message: "Votre compte a été créé. Utilisez « Mot de passe oublié » sur l'écran de connexion pour définir un mot de passe et vous connecter.",
            buttons: [{ text: "Se connecter", style: "primary", onPress: () => router.replace("/(auth)/login") }],
          });
          setLoading(false);
          return;
        }
      }

      setStep("success");
    } catch (err: any) {
      const msg: string = err.message || "Inscription échouée.";
      const emailTaken = /déjà utilisé|already (exists|taken|registered)|email.*exist/i.test(msg);
      if (emailTaken && isGoogleFlow) {
        showAlert({
          type: "info",
          title: "Compte existant",
          message: "Un compte existe déjà avec cette adresse email. Utilisez « Mot de passe oublié » sur l'écran de connexion si vous ne vous souvenez pas de votre mot de passe.",
          buttons: [{ text: "Se connecter", style: "primary", onPress: () => router.replace("/(auth)/login") }],
        });
      } else {
        showAlert({ type: "error", title: "Erreur", message: msg, buttons: [{ text: "OK", style: "primary" }] });
      }
    } finally {
      setLoading(false);
    }
  }, [firstName, lastName, email, phone, password, confirmPassword, garageName, smsConsent, legalConsent, company, firebaseUid, isGoogleFlow, idToken, roleType, socialLogin, apiBase, safeParseJson]);

  // ─── Stepper ────────────────────────────────────────────────────────────────
  const renderStepper = () => {
    if (step === "role") return null;

    if (roleType === "particulier") {
      // 3 steps: Compte → Informations → Succès
      const pos = step === "form" ? 1 : 2;
      return (
        <View style={styles.stepIndicator}>
          {[0, 1, 2].map((i) => (
            <React.Fragment key={i}>
              <View style={[
                styles.stepDot,
                i < pos && styles.stepDotDone,
                i === pos && styles.stepDotActive,
              ]} />
              {i < 2 && <View style={[styles.stepLine, i < pos && styles.stepLineDone]} />}
            </React.Fragment>
          ))}
        </View>
      );
    } else {
      // 4 steps: Compte → Entreprise → Informations → Succès
      const pos = step === "siret" ? 1 : step === "form" ? 2 : 3;
      return (
        <View style={styles.stepIndicator}>
          {[0, 1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <View style={[
                styles.stepDot,
                i < pos && styles.stepDotDone,
                i === pos && styles.stepDotActive,
              ]} />
              {i < 3 && <View style={[styles.stepLine, i < pos && styles.stepLineDone]} />}
            </React.Fragment>
          ))}
        </View>
      );
    }
  };

  // ─── Render: Role selection ─────────────────────────────────────────────────
  const renderRoleStep = () => (
    <>
      <Text style={styles.roleSubtitle}>
        Choisissez le type de compte qui correspond à votre situation.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.roleCard, pressed && styles.roleCardPressed]}
        onPress={() => handleSelectRole("particulier")}
      >
        <View style={[styles.roleIconCircle, { backgroundColor: "#3B82F620" }]}>
          <Ionicons name="person-outline" size={30} color="#3B82F6" />
        </View>
        <View style={styles.roleCardContent}>
          <Text style={styles.roleCardTitle}>Particulier</Text>
          <Text style={styles.roleCardDesc}>
            Je fais entretenir ou réparer mon véhicule personnel chez MyJantes.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.roleCard, styles.roleCardPro, pressed && styles.roleCardPressed]}
        onPress={() => handleSelectRole("professionnel")}
      >
        <View style={[styles.roleIconCircle, { backgroundColor: theme.primary + "20" }]}>
          <Ionicons name="business-outline" size={30} color={theme.primary} />
        </View>
        <View style={styles.roleCardContent}>
          <Text style={styles.roleCardTitle}>Professionnel</Text>
          <Text style={styles.roleCardDesc}>
            Je suis un garage, une carrosserie ou un professionnel de l'automobile.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
      </Pressable>

      <Pressable style={styles.backStepBtn} onPress={() => router.back()}>
        <Ionicons name="log-in-outline" size={16} color={theme.textSecondary} />
        <Text style={styles.backStepText}>J'ai déjà un compte — Se connecter</Text>
      </Pressable>
    </>
  );

  // ─── Render: SIRET step (pro only) ──────────────────────────────────────────
  const renderCertificationCheckbox = () => (
    <Pressable
      style={[styles.certRow, certificationConsent && { borderColor: theme.primary + "60", backgroundColor: theme.primary + "08" }]}
      onPress={() => setCertificationConsent(!certificationConsent)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: certificationConsent }}
    >
      <View style={[styles.certCheckbox, certificationConsent && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
        {certificationConsent && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <Text style={styles.certLabel}>
        <Text style={{ fontFamily: "Exo2_600SemiBold" }}>Je certifie sur l'honneur</Text> que les informations renseignées sont exactes et j'autorise MyJantes à les vérifier si nécessaire.
      </Text>
    </Pressable>
  );

  const renderManualEntryForm = () => (
    <View style={styles.manualContainer}>
      <View style={[styles.manualHeader, { backgroundColor: theme.warning + "15" || "#F59E0B15" }]}>
        <Ionicons name="create-outline" size={18} color={theme.warning || "#F59E0B"} />
        <Text style={[styles.manualHeaderText, { color: theme.warning || "#F59E0B" }]}>
          Saisie manuelle des informations
        </Text>
      </View>

      <Text style={styles.label}>Raison sociale <Text style={styles.required}>*</Text></Text>
      <TextInput style={styles.input} value={manualName} onChangeText={setManualName} placeholder="Ex: Garage Dupont SARL" placeholderTextColor={theme.textTertiary} autoCapitalize="words" />

      <Text style={styles.label}>Adresse <Text style={styles.required}>*</Text></Text>
      <TextInput style={styles.input} value={manualAddress} onChangeText={setManualAddress} placeholder="Ex: 12 rue de la Paix" placeholderTextColor={theme.textTertiary} autoCapitalize="words" />

      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          <Text style={styles.label}>Ville <Text style={styles.required}>*</Text></Text>
          <TextInput style={styles.input} value={manualCity} onChangeText={setManualCity} placeholder="Paris" placeholderTextColor={theme.textTertiary} autoCapitalize="words" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Code postal <Text style={styles.required}>*</Text></Text>
          <TextInput style={styles.input} value={manualPostalCode} onChangeText={(t) => setManualPostalCode(t.replace(/\D/g, "").slice(0, 5))} placeholder="75001" placeholderTextColor={theme.textTertiary} keyboardType="number-pad" maxLength={5} />
        </View>
      </View>

      <Text style={styles.label}>Numéro SIRET</Text>
      <TextInput style={styles.input} value={manualSiret} onChangeText={(t) => setManualSiret(t.replace(/\D/g, "").slice(0, 14))} placeholder="14 chiffres (recommandé)" placeholderTextColor={theme.textTertiary} keyboardType="number-pad" maxLength={14} />
      {manualSiret.length > 0 && manualSiret.length < 14 && <Text style={styles.siretHint}>{manualSiret.length}/14 chiffres</Text>}

      <Text style={styles.label}>Numéro SIREN</Text>
      <TextInput style={styles.input} value={manualSiren} onChangeText={(t) => setManualSiren(t.replace(/\D/g, "").slice(0, 9))} placeholder="9 chiffres (optionnel)" placeholderTextColor={theme.textTertiary} keyboardType="number-pad" maxLength={9} />

      <Text style={styles.label}>Forme juridique</Text>
      <TextInput style={styles.input} value={manualLegalForm} onChangeText={setManualLegalForm} placeholder="Ex: SARL, SAS, EI, EURL..." placeholderTextColor={theme.textTertiary} autoCapitalize="characters" />

      <Text style={styles.label}>N° TVA Intracommunautaire</Text>
      <TextInput style={styles.input} value={manualTvaNumber} onChangeText={setManualTvaNumber} placeholder="Ex: FR12345678901 (optionnel)" placeholderTextColor={theme.textTertiary} autoCapitalize="characters" />

      {renderCertificationCheckbox()}

      <Pressable
        style={[styles.primaryBtn, (!certificationConsent || !manualName.trim() || !manualAddress.trim() || !manualCity.trim() || manualPostalCode.length !== 5) && { opacity: 0.5 }]}
        onPress={checkEmailAndProceed}
        disabled={!certificationConsent || !manualName.trim() || !manualAddress.trim() || !manualCity.trim() || manualPostalCode.length !== 5}
      >
        <Ionicons name="arrow-forward-circle" size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>Continuer avec ces informations</Text>
      </Pressable>

      <Pressable style={styles.backStepBtn} onPress={() => setManualEntry(false)}>
        <Ionicons name="search" size={16} color={theme.textSecondary} />
        <Text style={styles.backStepText}>Réessayer la recherche</Text>
      </Pressable>
    </View>
  );

  const renderSiretStep = () => (
    <>
      <View style={styles.stepHeader}>
        <View style={[styles.stepIcon, { backgroundColor: theme.primary + "20" }]}>
          <Ionicons name="business-outline" size={28} color={theme.primary} />
        </View>
        <Text style={styles.stepTitle}>Votre entreprise</Text>
        <Text style={styles.stepDesc}>
          Recherchez votre garage par numéro SIRET ou par nom d'entreprise.
        </Text>
      </View>

      {isGoogleFlow && (
        <View style={[styles.companyBadge, { backgroundColor: "#10B98115", marginBottom: 16 }]}>
          <Ionicons name="logo-google" size={16} color="#10B981" />
          <Text style={[styles.companyBadgeText, { color: "#10B981" }]}>Connecté via Google ({prefillEmail})</Text>
        </View>
      )}

      {!manualEntry ? (
        <>
          <Text style={styles.label}>Numéro SIRET</Text>
          <TextInput style={styles.input} value={siretInput} onChangeText={handleSiretChange} placeholder="Ex: 12345678901234" placeholderTextColor={theme.textTertiary} keyboardType="number-pad" maxLength={14} autoCapitalize="none" />
          {siretInput.length > 0 && siretInput.length < 14 && <Text style={styles.siretHint}>{siretInput.length}/14 chiffres</Text>}

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>ou</Text>
            <View style={styles.orLine} />
          </View>

          <Text style={styles.label}>Nom de l'entreprise</Text>
          <TextInput style={styles.input} value={nameInput} onChangeText={(t) => { setNameInput(t); setCompany(null); setSearchAttempted(false); }} placeholder="Ex: Mon Garage Auto" placeholderTextColor={theme.textTertiary} autoCapitalize="words" />

          <Pressable style={[styles.primaryBtn, loading && { opacity: 0.6 }]} onPress={lookupManual} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Ionicons name="search" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Rechercher</Text>
              </>
            )}
          </Pressable>

          {searchAttempted && !company && !loading && (
            <Pressable style={styles.manualEntryBtn} onPress={() => setManualEntry(true)}>
              <Ionicons name="create-outline" size={16} color={theme.primary} />
              <Text style={styles.manualEntryBtnText}>Saisir manuellement mes informations</Text>
            </Pressable>
          )}

          {!searchAttempted && (
            <Pressable style={styles.manualEntryBtn} onPress={() => setManualEntry(true)}>
              <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.manualEntryBtnText, { color: theme.textSecondary }]}>
                Mon entreprise n'est pas dans la base de données
              </Text>
            </Pressable>
          )}

          {company && (
            <View style={styles.companyCard}>
              <Text style={styles.companyName}>{company.name}</Text>
              <View style={styles.companyRow}>
                <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                <Text style={styles.companyDetail}>{company.address}, {company.postalCode} {company.city}</Text>
              </View>
              {company.siret ? (
                <View style={styles.companyRow}>
                  <Ionicons name="document-text-outline" size={14} color={theme.textSecondary} />
                  <Text style={styles.companyDetail}>SIRET: {company.siret}</Text>
                </View>
              ) : null}
              {company.tvaNumber ? (
                <View style={styles.companyRow}>
                  <Ionicons name="receipt-outline" size={14} color={theme.textSecondary} />
                  <Text style={styles.companyDetail}>TVA: {company.tvaNumber}</Text>
                </View>
              ) : null}
              {company.legalForm ? (
                <View style={styles.companyRow}>
                  <Ionicons name="briefcase-outline" size={14} color={theme.textSecondary} />
                  <Text style={styles.companyDetail}>{company.legalForm}</Text>
                </View>
              ) : null}

              {renderCertificationCheckbox()}

              <Pressable style={[styles.confirmBtn, !certificationConsent && { opacity: 0.5 }]} onPress={checkEmailAndProceed} disabled={!certificationConsent}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>C'est mon entreprise — Continuer</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
        renderManualEntryForm()
      )}

      <Pressable style={styles.backStepBtn} onPress={() => { setStep("role"); setRoleType(null); }}>
        <Ionicons name="arrow-back" size={16} color={theme.textSecondary} />
        <Text style={styles.backStepText}>Changer le type de compte</Text>
      </Pressable>
    </>
  );

  // ─── Render: Form step ──────────────────────────────────────────────────────
  const renderFormStep = () => {
    const isParticulier = roleType === "particulier";
    return (
      <>
        <View style={styles.stepHeader}>
          <View style={[styles.stepIcon, { backgroundColor: "#10B98120" }]}>
            <Ionicons name="person-outline" size={28} color="#10B981" />
          </View>
          <Text style={styles.stepTitle}>Vos informations</Text>
          <Text style={styles.stepDesc}>
            {isParticulier
              ? "Complétez vos informations personnelles pour créer votre compte."
              : isGoogleFlow
                ? "Complétez les informations de votre garage."
                : "Complétez vos informations pour créer votre compte professionnel."}
          </Text>
        </View>

        {isGoogleFlow && (
          <View style={[styles.companyBadge, { backgroundColor: "#10B98115", marginBottom: 12 }]}>
            <Ionicons name="logo-google" size={16} color="#10B981" />
            <Text style={[styles.companyBadgeText, { color: "#10B981" }]}>
              Connecté via Google — aucun mot de passe requis
            </Text>
          </View>
        )}

        {!isParticulier && company && (
          <View style={styles.companyBadge}>
            <Ionicons name="business" size={16} color={theme.primary} />
            <Text style={styles.companyBadgeText}>{company.name}</Text>
            {!company.siret && (
              <View style={[styles.manualBadge, { backgroundColor: "#F59E0B20" }]}>
                <Ionicons name="create-outline" size={11} color="#F59E0B" />
                <Text style={{ fontSize: 10, color: "#F59E0B", fontFamily: "Exo2_500Medium" }}>Manuel</Text>
              </View>
            )}
          </View>
        )}

        {isParticulier && (
          <View style={[styles.companyBadge, { backgroundColor: "#3B82F615", marginBottom: 4 }]}>
            <Ionicons name="person" size={16} color="#3B82F6" />
            <Text style={[styles.companyBadgeText, { color: "#3B82F6" }]}>Compte particulier</Text>
          </View>
        )}

        {!isParticulier && (
          <>
            <Text style={styles.label}>Nom du garage</Text>
            <TextInput style={styles.input} value={garageName} onChangeText={setGarageName} placeholder="Nom affiché pour vos clients" placeholderTextColor={theme.textTertiary} />
          </>
        )}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Prénom <Text style={styles.required}>*</Text></Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Jean" placeholderTextColor={theme.textTertiary} autoCapitalize="words" editable={!isGoogleFlow || !nameParts[0]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Nom <Text style={styles.required}>*</Text></Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Dupont" placeholderTextColor={theme.textTertiary} autoCapitalize="words" editable={!isGoogleFlow || !nameParts.slice(1).join(" ")} />
          </View>
        </View>

        <Text style={styles.label}>Email <Text style={styles.required}>*</Text></Text>
        <TextInput style={[styles.input, isGoogleFlow && { opacity: 0.7, backgroundColor: theme.surface }]} value={email} onChangeText={setEmail} placeholder={isParticulier ? "votre@email.com" : "contact@garage.com"} placeholderTextColor={theme.textTertiary} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!isGoogleFlow} />

        <Text style={styles.label}>Téléphone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={(t) => setPhone(t.replace(/[^0-9+\s]/g, ""))} placeholder="06 12 34 56 78" placeholderTextColor={theme.textTertiary} keyboardType="phone-pad" autoComplete="tel" />

        {!isGoogleFlow && (
          <>
            <Text style={styles.label}>Mot de passe <Text style={styles.required}>*</Text></Text>
            <View style={styles.passwordRow}>
              <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={password} onChangeText={setPassword} placeholder="8 caractères minimum" placeholderTextColor={theme.textTertiary} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
              <Pressable style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textTertiary} />
              </Pressable>
            </View>
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={[styles.strengthBar, { backgroundColor: i <= pwdStrength.level ? pwdStrength.color : theme.border }]} />
                ))}
                <Text style={[styles.strengthLabel, { color: pwdStrength.color }]}>{pwdStrength.label}</Text>
              </View>
            )}

            <Text style={styles.label}>Confirmer le mot de passe <Text style={styles.required}>*</Text></Text>
            <TextInput style={[styles.input, confirmPassword.length > 0 && password !== confirmPassword && { borderColor: "#EF4444" }]} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirmez votre mot de passe" placeholderTextColor={theme.textTertiary} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={styles.fieldError}>Les mots de passe ne correspondent pas</Text>
            )}
          </>
        )}

        <View style={styles.switchRow}>
          <Switch value={smsConsent} onValueChange={setSmsConsent} trackColor={{ false: theme.border, true: theme.primary + "60" }} thumbColor={smsConsent ? theme.primary : theme.textTertiary} />
          <Text style={styles.switchLabel}>J'accepte de recevoir des notifications SMS</Text>
        </View>

        <Pressable style={styles.checkboxRow} onPress={() => setLegalConsent(!legalConsent)}>
          <View style={[styles.checkbox, legalConsent && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
            {legalConsent && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={styles.checkboxLabel}>
            J'accepte les{" "}
            <Text style={{ color: theme.primary }} onPress={() => router.push("/legal" as any)}>conditions générales d'utilisation</Text>
            {" "}et la{" "}
            <Text style={{ color: theme.primary }} onPress={() => router.push("/privacy" as any)}>politique de confidentialité</Text>
            {" "}<Text style={styles.required}>*</Text>
          </Text>
        </Pressable>

        <Pressable style={[styles.primaryBtn, (loading || !legalConsent) && { opacity: 0.6 }]} onPress={handleRegister} disabled={loading || !legalConsent}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : (
            <>
              <Ionicons name="rocket-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Créer mon compte</Text>
            </>
          )}
        </Pressable>

        <Pressable style={styles.backStepBtn} onPress={() => {
          if (isParticulier) {
            setStep("role");
            setRoleType(null);
          } else {
            setStep("siret");
            setCertificationConsent(false);
          }
        }}>
          <Ionicons name="arrow-back" size={16} color={theme.textSecondary} />
          <Text style={styles.backStepText}>
            {isParticulier ? "Changer le type de compte" : "Modifier l'entreprise"}
          </Text>
        </Pressable>
      </>
    );
  };

  // ─── Render: Success step ───────────────────────────────────────────────────
  const renderSuccessStep = () => {
    const isParticulier = roleType === "particulier";
    return (
      <View style={styles.successContainer}>
        <View style={[styles.stepIcon, { backgroundColor: "#10B98120", width: 80, height: 80, borderRadius: 24 }]}>
          <Ionicons name={isGoogleFlow ? "checkmark-circle-outline" : "mail-outline"} size={40} color="#10B981" />
        </View>
        <Text style={styles.successTitle}>
          {isGoogleFlow ? "Inscription réussie !" : "Vérifiez votre email"}
        </Text>
        <Text style={styles.successDesc}>
          {isParticulier ? (
            isGoogleFlow ? (
              <>Votre compte particulier a été créé.{"\n\n"}Vous pouvez maintenant suivre vos prestations et devis directement dans l'application.</>
            ) : (
              <>Un email de vérification a été envoyé à{"\n"}<Text style={{ fontFamily: "Exo2_600SemiBold", color: theme.text }}>{email}</Text>{"\n\n"}Cliquez sur le lien pour activer votre compte, puis connectez-vous pour suivre vos prestations.</>
            )
          ) : (
            isGoogleFlow ? (
              <>Votre compte professionnel a été créé avec succès.{"\n\n"}Vous pouvez maintenant vous connecter avec Google et accéder à votre espace pro.</>
            ) : (
              <>Un email de vérification a été envoyé à{"\n"}<Text style={{ fontFamily: "Exo2_600SemiBold", color: theme.text }}>{email}</Text>{"\n\n"}Cliquez sur le lien dans l'email pour activer votre compte, puis connectez-vous à votre espace professionnel.</>
            )
          )}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace("/(auth)/login")}>
          <Ionicons name="log-in-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Aller à la connexion</Text>
        </Pressable>
      </View>
    );
  };

  // ─── Header title ───────────────────────────────────────────────────────────
  const headerTitle = () => {
    if (step === "role") return "Inscription";
    if (step === "siret") return "Votre entreprise";
    if (step === "form") return roleType === "particulier" ? "Vos informations" : "Informations pro";
    return "Inscription";
  };

  const handleBack = () => {
    if (step === "role") router.back();
    else if (step === "siret") { setStep("role"); setRoleType(null); }
    else if (step === "form") {
      if (roleType === "particulier") { setStep("role"); setRoleType(null); }
      else { setStep("siret"); setCertificationConsent(false); }
    }
    else router.back();
  };

  // ─── Main render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Branding header */}
      {step === "role" ? (
        <View style={[styles.brandHeader, { paddingTop: topPad }]}>
          <Image
            source={require("@/assets/images/logo_new.png")}
            style={styles.brandLogo}
            contentFit="contain"
          />
          <Text style={styles.heroLine1}>CRÉEZ</Text>
          <Text style={styles.heroLine2}>VOTRE COMPTE</Text>
          <View style={styles.heroBar} />
        </View>
      ) : (
        <View style={[styles.header, { paddingTop: topPad }]}>
          <Pressable style={styles.backBtn} onPress={handleBack} accessibilityLabel="Retour">
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <Image
            source={require("@/assets/images/logo_new.png")}
            style={styles.miniLogo}
            contentFit="contain"
          />
          <View style={{ width: 44 }} />
        </View>
      )}

      {renderStepper()}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {step === "role" && renderRoleStep()}
          {step === "siret" && renderSiretStep()}
          {step === "form" && renderFormStep()}
          {step === "success" && renderSuccessStep()}
        </ScrollView>
      </KeyboardAvoidingView>
      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  /* Branding header (role step) */
  brandHeader: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  brandLogo: { width: 200, height: 72, marginBottom: 8 },
  heroLine1: {
    color: theme.text,
    fontFamily: "Exo2_700Bold",
    fontSize: 42,
    letterSpacing: 1,
    lineHeight: 48,
  },
  heroLine2: {
    color: theme.textSecondary,
    fontFamily: "Exo2_700Bold",
    fontSize: 30,
    letterSpacing: 1,
    lineHeight: 38,
  },
  heroBar: {
    marginTop: 8,
    width: 70,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.primary,
    marginBottom: 4,
  },
  /* Standard header (other steps) */
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  miniLogo: { width: 120, height: 44 },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Exo2_600SemiBold", color: theme.text },
  stepIndicator: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 40, paddingBottom: 8,
  },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.border },
  stepDotActive: { backgroundColor: theme.primary, width: 12, height: 12, borderRadius: 6 },
  stepDotDone: { backgroundColor: "#10B981" },
  stepLine: { flex: 1, height: 2, backgroundColor: theme.border, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: "#10B981" },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  stepHeader: { alignItems: "center", marginBottom: 24 },
  stepIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  stepTitle: { fontSize: 22, fontFamily: "Exo2_700Bold", color: theme.text, marginBottom: 6 },
  stepDesc: { fontSize: 14, color: theme.textSecondary, textAlign: "center", lineHeight: 20 },
  // Role selection cards
  roleCard: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: 14, padding: 18, marginBottom: 12,
  },
  roleCardPro: { borderColor: theme.primary + "40" },
  roleCardPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  roleIconCircle: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  roleSubtitle: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.textSecondary, lineHeight: 20, marginBottom: 20, marginTop: 4 },
  roleCardContent: { flex: 1 },
  roleCardTitle: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text, marginBottom: 4 },
  roleCardDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 18, fontFamily: "Exo2_400Regular" },
  // Form fields
  label: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.textSecondary, marginBottom: 6, marginTop: 12 },
  required: { color: "#EF4444", fontSize: 13 },
  input: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text,
    fontFamily: "Exo2_400Regular", marginBottom: 0,
  },
  fieldError: { fontSize: 12, color: "#EF4444", marginTop: 4, fontFamily: "Exo2_400Regular" },
  row: { flexDirection: "row", gap: 10 },
  orRow: { flexDirection: "row", alignItems: "center", marginVertical: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: theme.border },
  orText: { fontSize: 13, color: theme.textTertiary, marginHorizontal: 12, fontFamily: "Exo2_400Regular" },
  siretHint: { fontSize: 11, color: theme.textTertiary, marginTop: 4, fontFamily: "Exo2_400Regular" },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: theme.primary, borderRadius: 12, paddingVertical: 14, gap: 8, marginTop: 16,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  manualEntryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, marginTop: 8 },
  manualEntryBtnText: { fontSize: 14, fontFamily: "Exo2_500Medium", color: theme.primary },
  companyCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 16, marginTop: 16 },
  companyName: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text, marginBottom: 8 },
  companyRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4 },
  companyDetail: { fontSize: 13, color: theme.textSecondary, flex: 1, fontFamily: "Exo2_400Regular" },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#10B981", borderRadius: 10, paddingVertical: 12, gap: 8, marginTop: 12,
  },
  confirmBtnText: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: "#fff" },
  companyBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.primary + "15", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4, flexWrap: "wrap",
  },
  companyBadgeText: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.primary, flex: 1 },
  manualBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  certRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border,
    borderRadius: 10, padding: 14, marginTop: 16,
  },
  certCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: theme.border, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  certLabel: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 19, fontFamily: "Exo2_400Regular" },
  manualContainer: { marginTop: 4 },
  manualHeader: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  manualHeaderText: { fontSize: 13, fontFamily: "Exo2_600SemiBold" },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 0, marginBottom: 0 },
  eyeBtn: { padding: 12, marginLeft: -50 },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, marginBottom: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontFamily: "Exo2_500Medium", marginLeft: 4 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, marginTop: 8 },
  switchLabel: { flex: 1, fontSize: 14, color: theme.textSecondary, fontFamily: "Exo2_400Regular" },
  checkboxRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: theme.border, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  checkboxLabel: { flex: 1, fontSize: 14, color: theme.textSecondary, lineHeight: 20, fontFamily: "Exo2_400Regular" },
  backStepBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, marginTop: 4 },
  backStepText: { fontSize: 14, color: theme.textSecondary, fontFamily: "Exo2_400Regular" },
  successContainer: { alignItems: "center", paddingTop: 40, gap: 12 },
  successTitle: { fontSize: 24, fontFamily: "Exo2_700Bold", color: theme.text, textAlign: "center" },
  successDesc: { fontSize: 15, color: theme.textSecondary, textAlign: "center", lineHeight: 22, fontFamily: "Exo2_400Regular" },
});
