let expoFetch: typeof globalThis.fetch;
try { expoFetch = require("expo/fetch").fetch; } catch { expoFetch = globalThis.fetch; }
import { Platform, Share } from "react-native";
import { router } from "expo-router";
import { getSessionCookie, setSessionCookie } from "./api";
import * as Clipboard from "expo-clipboard";
import { NATIVE_BACKEND_URLS, getNativeApiBase, PUBLIC_BASE_URL } from "./config";

const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 1000;

export function adminApiBase(): string {
  return getNativeApiBase();
}

let accessToken: string | null = null;
let refreshTokenValue: string | null = null;
let onTokenExpired: (() => void) | null = null;

export function setAdminTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshTokenValue = refresh;
}

export function getAdminAccessToken() {
  return accessToken;
}

export function setOnTokenExpired(cb: () => void) {
  onTokenExpired = cb;
}

class TimeoutError extends Error {
  constructor() {
    super("Le serveur met trop de temps à répondre. Vérifiez votre connexion et réessayez.");
    this.name = "TimeoutError";
  }
}

function isNetworkError(err: any): boolean {
  if (err?.name === "AbortError" || err?.name === "TimeoutError") return true;
  if (err instanceof TimeoutError) return true;
  if (err?.name === "TypeError" && err?.message?.includes("Network")) return true;
  if (err?.message?.includes("fetch") || err?.message?.includes("network")) return true;
  return false;
}

async function fetchWithTimeout(url: string, options: any, useGlobal = false, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetchFn = useGlobal ? globalThis.fetch : expoFetch;
    const res = await fetchFn(url, { ...options, signal: controller.signal });
    return res;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new TimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithRetry(url: string, options: any, useGlobal = false, retries = 1): Promise<Response> {
  try {
    return await fetchWithTimeout(url, options, useGlobal);
  } catch (err: any) {
    if (retries > 0 && isNetworkError(err)) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return fetchWithRetry(url, options, useGlobal, retries - 1);
    }
    if (isNetworkError(err) && !(err instanceof TimeoutError)) {
      throw new Error("Erreur réseau. Vérifiez votre connexion et réessayez.");
    }
    throw err;
  }
}

async function fetchWithNativeFallback(endpoint: string, options: any, useGlobal = false): Promise<Response> {
  // Kept for compatibility with legacy admin modules. There is no fallback:
  // every mobile request must stay on the MyJantes production API.
  return fetchWithRetry(`${getNativeApiBase()}${endpoint}`, options, useGlobal);
}

interface AdminApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function adminApiCall<T = any>(
  endpoint: string,
  options: AdminApiOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const fetchHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    "X-Requested-With": "XMLHttpRequest",
    ...headers,
  };

  if (accessToken) {
    fetchHeaders["Authorization"] = `Bearer ${accessToken}`;
  }

  const cookie = getSessionCookie();
  if (cookie) {
    fetchHeaders["Cookie"] = cookie;
  }

  const fetchOptions: any = {
    method,
    headers: fetchHeaders,
  };

  if (body) {
    fetchOptions.body = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetchWithNativeFallback(endpoint, fetchOptions, false);

  const xSessionCookie = res.headers.get("x-session-cookie");
  if (xSessionCookie) {
    setSessionCookie(xSessionCookie);
  }

  if (res.status === 429) {
    throw new Error("Trop de tentatives. Réessayez dans quelques minutes.");
  }

  if (res.status === 401) {
    if (refreshTokenValue) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        fetchHeaders["Authorization"] = `Bearer ${accessToken}`;
        const retryRes = await fetchWithNativeFallback(endpoint, { ...fetchOptions, headers: fetchHeaders }, false);
        if (retryRes.ok) return parseResponse<T>(retryRes);
      }
    }
    if (onTokenExpired) onTokenExpired();
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  if (res.status === 403) {
    throw new Error("Accès refusé. Vous n'avez pas les permissions nécessaires.");
  }

  if (!res.ok) {
    if (res.status >= 500 && res.status < 600) {
      try {
        const { reportUpstreamError } = require("./upstream-status");
        reportUpstreamError(res.status, endpoint);
      } catch {}
    }
    const errMsg = await parseError(res);
    throw new Error(errMsg);
  }

  try {
    const { reportUpstreamRecovered, isUpstreamDegraded } = require("./upstream-status");
    if (isUpstreamDegraded()) reportUpstreamRecovered();
  } catch {}

  return parseResponse<T>(res);
}

async function tryRefreshToken(): Promise<boolean> {
  if (!refreshTokenValue) return false;
  try {
    const res = await fetchWithRetry(`${getNativeApiBase()}/api/mobile/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.accessToken) {
        accessToken = data.accessToken;
        if (data.refreshToken) refreshTokenValue = data.refreshToken;
        return true;
      }
    }
  } catch {}
  return false;
}

async function parseError(res: Response): Promise<string> {
  let errorMessage = `Erreur ${res.status}`;
  try {
    const text = await res.text();
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      if (text && !text.startsWith("<!DOCTYPE")) errorMessage = text.substring(0, 200);
    }
  } catch {}
  return errorMessage;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text || text.trim() === "") return {} as T;
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export async function adminLogin(email: string, password: string) {
  const res = await fetchWithRetry(`${getNativeApiBase()}/api/mobile/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const errMsg = await parseError(res);
    throw new Error(errMsg);
  }

  const xSessionCookie = res.headers.get("x-session-cookie");
  if (xSessionCookie) {
    setSessionCookie(xSessionCookie);
  }

  const data = await res.json();

  if (data.accessToken) {
    accessToken = data.accessToken;
    refreshTokenValue = data.refreshToken || null;
  }

  let user = data.user || data.data || data;
  if (!user?.id && !user?.email) {
    if (data.accessToken) {
      try {
        const meRes = await fetchWithRetry(`${getNativeApiBase()}/api/mobile/auth/me`, {
          headers: { Authorization: `Bearer ${data.accessToken}`, Accept: "application/json" },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          user = meData.user || meData;
        }
      } catch {}
    }
  }

  return { user, accessToken: data.accessToken || null, refreshToken: data.refreshToken || null };
}

export async function adminGetMe(): Promise<any> {
  if (!accessToken) return null;
  try {
    const res = await fetchWithRetry(`${getNativeApiBase()}/api/mobile/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      return data.user || data;
    }
  } catch {}
  return null;
}

export async function getGaragePlan(): Promise<{ plan: string; features: string[] }> {
  try {
    const me = await adminGetMe();
    const garage = me?.garage || me?.partnerGarage || me?.garageInfo || {};
    const plan = (garage?.plan || garage?.subscriptionPlan || garage?.subscription?.plan || me?.plan || "free").toLowerCase();
    const customFeatures: string[] = garage?.features || garage?.enabledFeatures || garage?.customFeatures || me?.features || [];
    const proPlans = ["pro", "premium", "enterprise", "business", "unlimited", "custom"];
    const isPro = proPlans.includes(plan) || customFeatures.length > 0;
    const features: string[] = ["reservations"];
    if (isPro || customFeatures.includes("ai_analytics") || customFeatures.includes("analytics")) {
      features.push("ai_analytics");
    }
    features.push("ocr");
    return { plan, features };
  } catch {
    return { plan: "free", features: ["reservations", "ocr"] };
  }
}

export const adminAnalytics = {
  get: () => adminApiCall<any>("/api/mobile/admin/dashboard"),
  getAdvanced: () => adminApiCall<any>("/api/mobile/admin/stats"),
  getStats: () => adminApiCall<any>("/api/mobile/admin/stats"),
  getQuotas: () => adminApiCall<any>("/api/mobile/admin/quotas"),
  syncQuotas: () => adminApiCall<any>("/api/mobile/admin/quota-sync"),
};

export const adminQuotes = {
  getAll: () => adminApiCall<any[]>("/api/mobile/admin/quotes"),
  getById: (id: string) => adminApiCall<any>(`/api/mobile/admin/quotes/${id}`),
  create: (data: any) => adminApiCall<any>("/api/mobile/admin/quotes", { method: "POST", body: data }),

  update: (id: string, data: any) => adminApiCall<any>(`/api/mobile/admin/quotes/${id}`, { method: "PATCH", body: data }),
  updateStatus: (id: string, status: string) => adminApiCall<any>(`/api/mobile/admin/quotes/${id}/status`, { method: "PATCH", body: { status } }),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/quotes/${id}`, { method: "DELETE" }),

  getItems: (quoteId: string) => adminApiCall<any[]>(`/api/mobile/admin/quotes/${quoteId}/items`),
  addItem: (quoteId: string, item: {
    description: string;
    quantity: string;
    unitPriceExcludingTax: string;
    totalExcludingTax: string;
    taxRate: string;
    taxAmount: string;
    totalIncludingTax: string;
  }) => adminApiCall<any>(`/api/mobile/admin/quotes/${quoteId}/items`, { method: "POST", body: item }),
  updateItem: (quoteId: string, itemId: string, data: any) =>
    adminApiCall<any>(`/api/mobile/admin/quotes/${quoteId}/items/${itemId}`, { method: "PATCH", body: data }),
  deleteItem: (quoteId: string, itemId: string) =>
    adminApiCall<any>(`/api/mobile/admin/quotes/${quoteId}/items/${itemId}`, { method: "DELETE" }),

  addMedia: (quoteId: string, formData: FormData) =>
    adminApiCall<any>(`/api/mobile/admin/quotes/${quoteId}/media`, { method: "POST", body: formData }),
  getMedia: (quoteId: string) => adminApiCall<any[]>(`/api/mobile/admin/quotes/${quoteId}/media`),

  sendEmail: (id: string) => adminApiCall<any>(`/api/mobile/admin/quotes/${id}/send-email`, { method: "POST" }),
  convertToInvoice: (id: string) => adminApiCall<any>(`/api/mobile/admin/quotes/${id}/convert-to-invoice`, { method: "POST", body: {} }),
  createReservationFromQuote: (id: string, data: any) =>
    adminApiCall<any>(`/api/mobile/admin/quotes/${id}/create-reservation`, { method: "POST", body: data }),
};

export const adminInvoices = {
  getAll: () => adminApiCall<any[]>("/api/mobile/admin/invoices"),
  getById: (id: string) => adminApiCall<any>(`/api/mobile/admin/invoices/${id}`),
  create: (data: any) => adminApiCall<any>("/api/mobile/admin/invoices", { method: "POST", body: data }),
  createDirect: (data: any) => adminApiCall<any>("/api/mobile/admin/invoices/direct", { method: "POST", body: data }),

  update: (id: string, data: any) => adminApiCall<any>(`/api/mobile/admin/invoices/${id}`, { method: "PATCH", body: data }),
  updateStatus: (id: string, status: string) => adminApiCall<any>(`/api/mobile/admin/invoices/${id}/status`, { method: "PATCH", body: { status } }),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/invoices/${id}`, { method: "DELETE" }),

  getItems: (invoiceId: string) => adminApiCall<any[]>(`/api/mobile/admin/invoices/${invoiceId}/items`),
  addItem: (invoiceId: string, item: {
    description: string;
    quantity: string;
    unitPriceExcludingTax: string;
    totalExcludingTax: string;
    taxRate: string;
    taxAmount: string;
    totalIncludingTax: string;
  }) => adminApiCall<any>(`/api/mobile/admin/invoices/${invoiceId}/items`, { method: "POST", body: item }),
  updateItem: (invoiceId: string, itemId: string, data: any) =>
    adminApiCall<any>(`/api/mobile/admin/invoices/${invoiceId}/items/${itemId}`, { method: "PATCH", body: data }),
  deleteItem: (invoiceId: string, itemId: string) =>
    adminApiCall<any>(`/api/mobile/admin/invoices/${invoiceId}/items/${itemId}`, { method: "DELETE" }),

  addMedia: (invoiceId: string, formData: FormData) =>
    adminApiCall<any>(`/api/mobile/admin/invoices/${invoiceId}/media`, { method: "POST", body: formData }),
  getMedia: (invoiceId: string) => adminApiCall<any[]>(`/api/mobile/admin/invoices/${invoiceId}/media`),

  sendEmail: (id: string) => adminApiCall<any>(`/api/mobile/admin/invoices/${id}/send-email`, { method: "POST" }),
};

export const adminReservations = {
  getAll: () => adminApiCall<any[]>("/api/mobile/admin/reservations"),
  getById: (id: string) => adminApiCall<any>(`/api/mobile/admin/reservations/${id}`),
  create: (data: any) => adminApiCall<any>("/api/mobile/admin/reservations", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/mobile/admin/reservations/${id}`, { method: "PATCH", body: data }),
  updateStatus: (id: string, status: string) => adminApiCall<any>(`/api/mobile/admin/reservations/${id}/status`, { method: "PATCH", body: { status } }),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/reservations/${id}`, { method: "DELETE" }),
  getServices: (id: string) => adminApiCall<any[]>(`/api/mobile/admin/reservations/${id}/services`),
};

export const adminUsers = {
  getAll: () => adminApiCall<any[]>("/api/mobile/admin/users"),
  getById: (id: string) => adminApiCall<any>(`/api/mobile/admin/users/${id}`),
  create: (data: any) => adminApiCall<any>("/api/mobile/admin/users", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/mobile/admin/users/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/users/${id}`, { method: "DELETE" }),
  changePassword: (id: string, data: { password: string }) =>
    adminApiCall<any>(`/api/mobile/admin/users/${id}/password`, { method: "PATCH", body: data }),
};

export const adminClients = {
  getAll: () => adminApiCall<any[]>("/api/mobile/admin/clients"),
  getById: (id: string) => adminApiCall<any>(`/api/mobile/admin/clients/${id}`),
  getQuotes: (id: string) => adminApiCall<any[]>(`/api/mobile/admin/clients/${id}/quotes`),
  getInvoices: (id: string) => adminApiCall<any[]>(`/api/mobile/admin/clients/${id}/invoices`),
  getReservations: (id: string) => adminApiCall<any[]>(`/api/mobile/admin/clients/${id}/reservations`),
  create: (data: any) => adminApiCall<any>("/api/mobile/admin/users", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/mobile/admin/users/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/users/${id}`, { method: "DELETE" }),
};

export const adminServices = {
  getAll: () => adminApiCall<any[]>("/api/mobile/services"),
  getById: (id: string) => adminApiCall<any>(`/api/mobile/services/${id}`),
  create: (data: any) => adminApiCall<any>("/api/mobile/admin/services", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/mobile/admin/services/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/services/${id}`, { method: "DELETE" }),
};

export const adminProfile = {
  get: () => adminApiCall<any>("/api/mobile/admin/settings"),
  update: (data: any) => adminApiCall<any>("/api/mobile/admin/settings", { method: "PATCH", body: data }),
};

export const adminLogs = {
  get: (since?: string) => {
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    return adminApiCall<{ logs: any[]; total: number }>(`/api/admin/logs${qs}`);
  },
  clear: () => adminApiCall<{ message: string }>("/api/admin/logs", { method: "DELETE" }),
};

export const adminNotifications = {
  getAll: () => adminApiCall<any[]>("/api/mobile/notifications"),
  getUnreadCount: () => adminApiCall<{ count: number }>("/api/mobile/notifications/unread-count"),
  markRead: (id: string) => adminApiCall<any>(`/api/mobile/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => adminApiCall<any>("/api/mobile/notifications/mark-all-read", { method: "POST" }),
};

export const adminReviews = {
  getAll: () => adminApiCall<any[]>("/api/mobile/admin/reviews"),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/reviews/${id}`, { method: "DELETE" }),
  approve: (id: string) => adminApiCall<any>(`/api/mobile/admin/reviews/${id}/approve`, { method: "PATCH" }),
};

export const adminSms = {
  send: (data: any) => adminApiCall<any>("/api/mobile/admin/sms/send", { method: "POST", body: data }),
  getLogs: () => adminApiCall<any[]>("/api/mobile/admin/sms/logs"),
};

export const adminExport = {
  quotes: () => adminApiCall<any>("/api/mobile/admin/export/quotes"),
  invoices: () => adminApiCall<any>("/api/mobile/admin/export/invoices"),
};

export const adminExpenses = {
  getAll: () => adminApiCall<any[]>("/api/mobile/admin/expenses"),
  getById: (id: string) => adminApiCall<any>(`/api/mobile/admin/expenses/${id}`),
  create: (data: any) => adminApiCall<any>("/api/mobile/admin/expenses", { method: "POST", body: data }),
  update: (id: string, data: any) => adminApiCall<any>(`/api/mobile/admin/expenses/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) => adminApiCall<any>(`/api/mobile/admin/expenses/${id}`, { method: "DELETE" }),
};

export function getMobilePdfUrl(type: "quotes" | "invoices", id: string): string {
  return `${getNativeApiBase()}/api/mobile/${type}/${id}/pdf`;
}

export async function downloadMobilePdf(
  type: "quotes" | "invoices",
  id: string
): Promise<{ blob: Blob; filename: string }> {
  const url = getMobilePdfUrl(type, id);
  const headers: Record<string, string> = { Accept: "application/pdf" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const cookie = getSessionCookie();
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Erreur ${res.status} lors du téléchargement du PDF`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename[^;=\n]*=["']?([^"';\n]*)["']?/);
  const fallbackName = type === "quotes" ? `devis-${id}.pdf` : `facture-${id}.pdf`;
  return { blob, filename: match?.[1] || fallbackName };
}

export const PUBLIC_PREVIEW_BASE = PUBLIC_BASE_URL;

export function getPublicPdfUrl(type: "quotes" | "invoices", id: string, viewToken: string): string {
  return `${PUBLIC_PREVIEW_BASE}/api/public/pdf/${type}/${id}?token=${encodeURIComponent(viewToken)}`;
}

export async function sharePdfDirect(
  type: "quotes" | "invoices",
  id: string,
  reference?: string,
  viewToken?: string
): Promise<"shared" | "copied"> {
  const url = viewToken
    ? getPublicPdfUrl(type, id, viewToken)
    : getMobilePdfUrl(type, id);
  const title = type === "quotes"
    ? `Devis ${reference || ""}`
    : `Facture ${reference || ""}`;

  if (Platform.OS !== "web") {
    await Share.share({
      message: url,
      title: title.trim(),
    });
    return "shared";
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: title.trim(), url });
      return "shared";
    } catch (_) {}
  }

  await Clipboard.setStringAsync(url);
  return "copied";
}
