import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi, getApiAccessToken, normalizeUserProfile, setApiAccessToken, setApiOnTokensRefreshed, setApiRefreshToken, type LoginData, type RegisterData, type UserProfile } from "./api";
import { MYJANTES_API_BASE } from "./config";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const CLIENT_ROLES = new Set(["client", "client_professionnel", "client_particulier"]);

interface SocialLoginSuccess {
  status: "authenticated";
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

interface SocialLoginNeedsRegistration {
  status: "needs_registration";
  email: string;
  displayName: string | null;
  firebaseUid: string;
}

type SocialLoginResult = SocialLoginSuccess | SocialLoginNeedsRegistration;

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requiresBiometric: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  isAdminOrEmployee: boolean;
  accessToken: string | null;
  login: (data: LoginData) => Promise<UserProfile | null>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  biometricLogin: () => Promise<boolean>;
  socialLogin: (idToken: string, provider: string) => Promise<SocialLoginResult>;
  appleLogin: (idToken: string, rawNonce: string) => Promise<SocialLoginResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function storageSet(key: string, value: string) {
  if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
  return SecureStore.setItemAsync(key, value);
}

async function storageGet(key: string) {
  if (Platform.OS === "web") return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function storageRemove(key: string) {
  if (Platform.OS === "web") return AsyncStorage.removeItem(key);
  return SecureStore.deleteItemAsync(key);
}

function isClientUser(user: UserProfile | null) {
  if (!user) return false;
  const role = String(user.role || "").toLowerCase();
  return CLIENT_ROLES.has(role);
}

function decodeJwt(token: string): any {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  // True when the user has biometric protection enabled and startup must wait
  // for biometricLogin() before restoring the session.
  const [requiresBiometric, setRequiresBiometric] = useState(false);

  const clearSession = useCallback(async () => {
    setUser(null);
    setAccessToken(null);
    setRequiresBiometric(false);
    setApiAccessToken(null);
    setApiRefreshToken(null);
    await Promise.all([
      storageRemove(ACCESS_TOKEN_KEY),
      storageRemove(REFRESH_TOKEN_KEY),
    ]);
  }, []);

  const refreshUser = useCallback(async () => {
    const savedAccess = await storageGet(ACCESS_TOKEN_KEY);
    const savedRefresh = await storageGet(REFRESH_TOKEN_KEY);
    if (!savedAccess) {
      await clearSession();
      return;
    }

    // When biometric protection is enabled, do NOT restore the session
    // automatically. Leave the user unauthenticated so the app routes to the
    // login screen where biometricLogin() acts as the gate. The stored tokens
    // are intentionally left in SecureStore — they will be read by
    // biometricLogin() once biometric auth passes.
    if (Platform.OS !== "web") {
      const biometricEnabled = await SecureStore.getItemAsync("biometric_enabled");
      if (biometricEnabled === "true") {
        setRequiresBiometric(true);
        return;
      }
    }

    setApiAccessToken(savedAccess);
    setApiRefreshToken(savedRefresh);
    try {
       const current = normalizeUserProfile(await authApi.getUser());
      if (!isClientUser(current)) {
        await clearSession();
        return;
      }
      setAccessToken(savedAccess);
      setUser(current);
    } catch (err: any) {
      // Ne purger la session que si l'authentification est réellement invalide.
      // Une panne réseau ou une indisponibilité temporaire du backend ne doit
      // pas déconnecter l'utilisateur ni détruire son refresh token.
      if (err?.status === 401 || err?.status === 403) {
        await clearSession();
      } else {
        setAccessToken(savedAccess);
      }
    }
  }, [clearSession]);

  useEffect(() => {
    setApiOnTokensRefreshed((access, refresh) => {
      setAccessToken(access);
      void storageSet(ACCESS_TOKEN_KEY, access);
      if (refresh) {
        void storageSet(REFRESH_TOKEN_KEY, refresh);
      }
    });
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (data: LoginData) => {
    const result = await authApi.login(data);
    const loggedInUser = normalizeUserProfile(result);
    const token = result?.accessToken || result?.token || result?.data?.accessToken;
    const refresh = result?.refreshToken || result?.data?.refreshToken;

    if (!loggedInUser || !isClientUser(loggedInUser)) {
      await clearSession();
      throw new Error("Cette application est réservée aux clients MyJantes.");
    }
    if (token) {
      setApiAccessToken(token);
      setApiRefreshToken(refresh || null);
      setAccessToken(token);
      await storageSet(ACCESS_TOKEN_KEY, token);
      if (refresh) await storageSet(REFRESH_TOKEN_KEY, refresh);
    }
    setUser(loggedInUser);
    setRequiresBiometric(false);
    return loggedInUser;
  }, [clearSession]);

  const register = useCallback(async (data: RegisterData) => {
    await authApi.register({ ...data, role: "client" });
    await login({ email: data.email, password: data.password });
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The local session is still cleared if the upstream is unavailable.
    }
    await clearSession();
  }, [clearSession]);

  const socialLogin = useCallback(async (idToken: string, provider: string): Promise<SocialLoginResult> => {
    const response = await fetch("https://api.myjantes.fr/api/mobile/auth/firebase", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, provider }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 404) {
      const decoded = decodeJwt(idToken);
      return {
        status: "needs_registration",
        email: data.email || decoded?.email || "",
        displayName: data.displayName || decoded?.name || null,
        firebaseUid: data.firebaseUid || decoded?.user_id || decoded?.sub || "",
      };
    }
    if (!response.ok) throw new Error(data.message || "Authentification sociale indisponible.");
    const loggedInUser = normalizeUserProfile(data);
    const token = data.accessToken || data.token || data.data?.accessToken;
    const refresh = data.refreshToken || data.data?.refreshToken;
    if (!loggedInUser || !token || !isClientUser(loggedInUser)) {
      throw new Error("Ce compte n'est pas un compte client MyJantes.");
    }
    setApiAccessToken(token);
    setApiRefreshToken(refresh || null);
    setAccessToken(token);
    setUser(loggedInUser);
    setRequiresBiometric(false);
    await storageSet(ACCESS_TOKEN_KEY, token);
    if (refresh) await storageSet(REFRESH_TOKEN_KEY, refresh);
    return { status: "authenticated", accessToken: token, refreshToken: refresh || "", user: loggedInUser };
  }, []);

  const appleLogin = useCallback(async (idToken: string, rawNonce: string): Promise<SocialLoginResult> => {
    // Forward the raw nonce so the backend (and Firebase) can verify it against
    // the SHA-256 hash that was sent to Apple during sign-in.
    const response = await fetch(`${MYJANTES_API_BASE}/api/mobile/auth/firebase`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, provider: "apple", nonce: rawNonce }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 404) {
      const decoded = decodeJwt(idToken);
      return {
        status: "needs_registration",
        email: data.email || decoded?.email || "",
        displayName: data.displayName || decoded?.name || null,
        firebaseUid: data.firebaseUid || decoded?.user_id || decoded?.sub || "",
      };
    }
    if (!response.ok) throw new Error(data.message || "Authentification Apple indisponible.");
    const loggedInUser = normalizeUserProfile(data);
    const token = data.accessToken || data.token || data.data?.accessToken;
    const refresh = data.refreshToken || data.data?.refreshToken;
    if (!loggedInUser || !token || !isClientUser(loggedInUser)) {
      throw new Error("Ce compte n'est pas un compte client MyJantes.");
    }
    setApiAccessToken(token);
    setApiRefreshToken(refresh || null);
    setAccessToken(token);
    setUser(loggedInUser);
    setRequiresBiometric(false);
    await storageSet(ACCESS_TOKEN_KEY, token);
    if (refresh) await storageSet(REFRESH_TOKEN_KEY, refresh);
    return { status: "authenticated", accessToken: token, refreshToken: refresh || "", user: loggedInUser };
  }, []);

  const biometricLogin = useCallback(async (): Promise<boolean> => {
    try {
      const LocalAuth = await import("expo-local-authentication");
      const hasHardware = await LocalAuth.hasHardwareAsync();
      if (!hasHardware) return false;
      const isEnrolled = await LocalAuth.isEnrolledAsync();
      if (!isEnrolled) return false;
      const result = await LocalAuth.authenticateAsync({
        promptMessage: "Connexion biométrique MyJantes",
        cancelLabel: "Annuler",
        disableDeviceFallback: false,
      });
      if (!result.success) return false;

      // Biometric auth passed — attempt session restoration.
      // Tokens are intentionally NOT installed into the global API client until
      // getUser() succeeds and client-role validation passes, so that no
      // authenticated API call can be issued on a failure path.
      const savedAccess = await storageGet(ACCESS_TOKEN_KEY);
      const savedRefresh = await storageGet(REFRESH_TOKEN_KEY);
      if (!savedAccess) return false;

      // Temporarily install tokens only for the getUser() probe.
      setApiAccessToken(savedAccess);
      setApiRefreshToken(savedRefresh);
      let current: ReturnType<typeof normalizeUserProfile>;
      try {
        current = normalizeUserProfile(await authApi.getUser());
      } catch {
        // Network/backend failure — revoke the temporarily installed tokens so
        // no authenticated call can escape before the gate is cleared.
        setApiAccessToken(null);
        setApiRefreshToken(null);
        return false;
      }

      if (!isClientUser(current)) {
        // Non-client account — revoke tokens and leave requiresBiometric set.
        setApiAccessToken(null);
        setApiRefreshToken(null);
        return false;
      }

      // Session validated — fully restore auth state.
      setAccessToken(savedAccess);
      setUser(current);
      setRequiresBiometric(false);
      return true;
    } catch {
      setApiAccessToken(null);
      setApiRefreshToken(null);
      return false;
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    requiresBiometric,
    isAdmin: false,
    isEmployee: false,
    isAdminOrEmployee: false,
    accessToken: accessToken || getApiAccessToken(),
    login,
    register,
    logout,
    refreshUser,
    biometricLogin,
    socialLogin,
    appleLogin,
  }), [user, isLoading, requiresBiometric, accessToken, login, register, logout, refreshUser, biometricLogin, socialLogin, appleLogin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}