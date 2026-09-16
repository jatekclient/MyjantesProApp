let expoFetch: typeof globalThis.fetch;
try { expoFetch = require("expo/fetch").fetch; } catch { expoFetch = globalThis.fetch; }
import { Platform } from "react-native";
import { NATIVE_BACKEND_URLS, getNativeApiBase } from "./config";

const REQUEST_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 1000;

export function getBackendUrl() {
  return getNativeApiBase();
}

function isNetworkError(err: any): boolean {
  if (err?.name === "AbortError" || err?.name === "TimeoutError") return true;
  if (err instanceof TimeoutError) return true;
  if (err?.name === "TypeError" && err?.message?.includes("Network")) return true;
  if (err?.message?.includes("fetch") || err?.message?.includes("network")) return true;
  return false;
}

class TimeoutError extends Error {
  constructor() {
    super("Le serveur met trop de temps à répondre. Vérifiez votre connexion et réessayez.");
    this.name = "TimeoutError";
  }
}

/** Typed API error that preserves the HTTP status code from the server response. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function fetchWithTimeout(
  url: string,
  options: any,
  useGlobal = false,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
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

async function fetchWithRetry(
  url: string,
  options: any,
  useGlobal = false,
  retries = 1
): Promise<Response> {
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
  // Keep the helper name for compatibility with existing API modules, but
  // never try a second host or the local Replit server.
  return fetchWithRetry(`${getNativeApiBase()}${endpoint}`, options, useGlobal);
}

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  isFormData?: boolean;
}

/** Identifier technique réutilisable lors d'un retry de la même mutation. */
export function createIdempotencyKey(prefix = "mobile") {
  const random = typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${random}`;
}

let sessionCookie: string | null = null;
let apiAccessToken: string | null = null;
let apiRefreshToken: string | null = null;
let apiOnTokensRefreshed: ((access: string, refresh: string | null) => void) | null = null;

export function setApiAccessToken(token: string | null) {
  apiAccessToken = token;
}

export function getApiAccessToken() {
  return apiAccessToken;
}

export function setApiRefreshToken(token: string | null) {
  apiRefreshToken = token;
}

export function setApiOnTokensRefreshed(cb: (access: string, refresh: string | null) => void) {
  apiOnTokensRefreshed = cb;
}

/** Renouvellement de jeton exposé pour les téléchargements hors apiCall (PDF). */
export async function refreshApiTokens(): Promise<boolean> {
  return tryRefreshApiToken();
}

async function tryRefreshApiToken(): Promise<boolean> {
  if (!apiRefreshToken) return false;
  try {
    const res = await fetchWithRetry(`${getNativeApiBase()}/api/mobile/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken: apiRefreshToken }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.accessToken) {
        apiAccessToken = data.accessToken;
        if (data.refreshToken) apiRefreshToken = data.refreshToken;
        if (apiOnTokensRefreshed) {
          apiOnTokensRefreshed(data.accessToken, data.refreshToken || null);
        }
        return true;
      }
    }
  } catch {}
  return false;
}

export function setSessionCookie(cookie: string | null) {
  if (cookie) {
    if (cookie.includes("=")) {
      sessionCookie = cookie;
    } else {
      sessionCookie = `myjantes.sid=${cookie}`;
    }
  } else {
    sessionCookie = null;
  }
}

export function getSessionCookie() {
  return sessionCookie;
}

export async function apiCall<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, isFormData = false } = options;

  const fetchHeaders: Record<string, string> = {
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...headers,
  };

  if (!isFormData && body) {
    fetchHeaders["Content-Type"] = "application/json";
  }

  if (apiAccessToken) {
    fetchHeaders["Authorization"] = `Bearer ${apiAccessToken}`;
  } else if (sessionCookie) {
    fetchHeaders["Cookie"] = sessionCookie;
  }

  let res: Response;

  if (isFormData) {
    const formHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() !== "content-type") formHeaders[key] = value;
    }
    if (apiAccessToken) {
      formHeaders["Authorization"] = `Bearer ${apiAccessToken}`;
    } else if (sessionCookie) {
      formHeaders["Cookie"] = sessionCookie;
    }

    res = await fetchWithNativeFallback(endpoint, {
      method,
      headers: formHeaders,
      body: body,
      credentials: "include" as const,
    }, false);
  } else {
    const fetchOptions: any = {
      method,
      headers: fetchHeaders,
      credentials: "include" as const,
    };
    if (body) {
      if (typeof body === 'object') {
        fetchOptions.body = JSON.stringify(body);
      } else {
        fetchOptions.body = String(body);
      }
    }
    res = await fetchWithNativeFallback(endpoint, fetchOptions, false);
  }

  const xSessionCookie = res.headers.get("x-session-cookie");
  if (xSessionCookie) {
    sessionCookie = xSessionCookie;
  } else {
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const sessionNames = ["myjantes.sid", "connect.sid", "laravel_session", "phpsessid"];
      const nameValuePart = setCookie.split(";")[0]?.trim() || "";
      const cookieName = nameValuePart.split("=")[0]?.toLowerCase() || "";
      const isSession = sessionNames.some(n => cookieName === n) ||
        cookieName.includes("session") || cookieName.includes("sid");
      if (isSession && nameValuePart) {
        sessionCookie = nameValuePart;
      }
    }
  }

  if (res.status === 429) {
    throw new Error("Trop de tentatives. Réessayez dans quelques minutes.");
  }

  if (res.status === 401 && apiRefreshToken) {
    const refreshed = await tryRefreshApiToken();
    if (refreshed) {
      if (isFormData) {
        const retryFormHeaders: Record<string, string> = {
          Authorization: `Bearer ${apiAccessToken}`,
        };
        res = await fetchWithNativeFallback(endpoint, {
          method,
          headers: retryFormHeaders,
          body,
          credentials: "include" as const,
        }, false);
      } else {
        fetchHeaders["Authorization"] = `Bearer ${apiAccessToken}`;
        const retryOptions: any = {
          method,
          headers: fetchHeaders,
          credentials: "include" as const,
        };
        if (body) {
          retryOptions.body = typeof body === "object" ? JSON.stringify(body) : String(body);
        }
        res = await fetchWithNativeFallback(endpoint, retryOptions, false);
      }
    }
  }

  if (!res.ok) {
    if (res.status >= 500 && res.status < 600) {
      try {
        const { reportUpstreamError } = require("./upstream-status");
        reportUpstreamError(res.status, endpoint);
      } catch {}
    }
    const httpStatus = res.status;
    let errorMessage = `Erreur ${httpStatus}`;
    try {
      const text = await res.text();
      try {
        const errorData = JSON.parse(text);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        if (text) errorMessage = text.substring(0, 200);
      }
    } catch {}
    // Throw ApiError (not plain Error) so callers can inspect the HTTP status reliably,
    // regardless of what the server put in the error body.
    throw new ApiError(errorMessage, httpStatus);
  }

  if (res.ok) {
    try {
      const { reportUpstreamRecovered, isUpstreamDegraded } = require("./upstream-status");
      if (isUpstreamDegraded()) reportUpstreamRecovered();
    } catch {}
  }

  const text = await res.text();
  if (!text || text.trim() === "") return {} as T;
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error("Service temporairement indisponible. Veuillez réessayer.");
  }
  try {
    const parsed = JSON.parse(text);
    return parsed as T;
  } catch {
    throw new ApiError("Réponse du serveur invalide. Veuillez réessayer.", 500);
  }
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  profileImageUrl: string | null;
  role: "client" | "client_professionnel" | "client_particulier" | "admin" | "super_admin" | "superadmin" | "root_admin" | "root" | "ROOT" | "employe" | "employee" | "manager";
  garageId: string | null;
  companyName: string | null;
  siret: string | null;
  tvaNumber: string | null;
  companyAddress: string | null;
  companyPostalCode: string | null;
  companyCity: string | null;
  companyCountry: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Normalize the profile envelope and the snake_case fields returned by the
 * production API. Keeping this at the API boundary prevents each screen from
 * silently displaying empty profile/company data.
 */
export function normalizeUserProfile(value: any): UserProfile | null {
  const raw = value?.user || value?.data?.user || value?.profile ||
    (value?.id || value?.email ? value : value?.data);
  if (!raw || typeof raw !== "object" || (!raw.id && !raw._id && !raw.email)) return null;
  return {
    ...raw,
    id: String(raw.id ?? raw._id ?? raw.userId ?? raw.user_id ?? ""),
    email: String(raw.email ?? raw.emailAddress ?? raw.email_address ?? ""),
    firstName: raw.firstName ?? raw.first_name ?? raw.firstname ?? raw.givenName ?? null,
    lastName: raw.lastName ?? raw.last_name ?? raw.lastname ?? raw.familyName ?? null,
    phone: raw.phone ?? raw.phoneNumber ?? raw.phone_number ?? null,
    address: raw.address ?? raw.streetAddress ?? raw.street_address ?? null,
    postalCode: raw.postalCode ?? raw.postal_code ?? raw.zipCode ?? raw.zip_code ?? null,
    city: raw.city ?? raw.town ?? null,
    profileImageUrl: raw.profileImageUrl ?? raw.profile_image_url ?? raw.avatarUrl ?? raw.avatar_url ?? raw.avatar ?? null,
    role: raw.role ?? raw.userRole ?? raw.user_role ?? "client",
    garageId: raw.garageId ?? raw.garage_id ?? null,
    companyName: raw.companyName ?? raw.company_name ?? raw.company ?? null,
    siret: raw.siret ?? raw.companySiret ?? raw.company_siret ?? null,
    tvaNumber: raw.tvaNumber ?? raw.tva_number ?? raw.vatNumber ?? raw.vat_number ?? null,
    companyAddress: raw.companyAddress ?? raw.company_address ?? null,
    companyPostalCode: raw.companyPostalCode ?? raw.company_postal_code ?? null,
    companyCity: raw.companyCity ?? raw.company_city ?? null,
    companyCountry: raw.companyCountry ?? raw.company_country ?? "FR",
    createdAt: raw.createdAt ?? raw.created_at ?? "",
    updatedAt: raw.updatedAt ?? raw.updated_at ?? "",
  } as UserProfile;
}

export interface Service {
  id: string;
  serviceId?: string;
  service_id?: string;
  _id?: string;
  garageId: string | null;
  name: string;
  description: string;
  basePrice: string;
  category: string;
  isActive: boolean;
  is_active?: boolean;
  isPublished?: boolean;
  is_published?: boolean;
  published?: boolean;
  visibleOnWebsite?: boolean;
  visible_on_website?: boolean;
  displayOnWebsite?: boolean;
  display_on_website?: boolean;
  status?: string;
  slug?: string;
  serviceType?: string;
  estimatedDuration: string | null;
  imageUrl: string | null;
  customFormFields: any;
  createdAt: string;
  updatedAt: string;
}

export interface Quote {
  id: string;
  quoteNumber: string | null;
  clientId: string;
  status: string;
  totalAmount: string | null;
  notes: string | null;
  items: any[];
  photos: any[];
  createdAt: string;
  updatedAt: string;
  services?: Service[];
  vehicleInfo?: any;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  role: "client" | "client_professionnel" | "client_particulier";
  garageId?: string;
  companyName?: string;
  siret?: string;
  tvaNumber?: string;
  companyAddress?: string;
  companyPostalCode?: string;
  companyCity?: string;
  companyCountry?: string;
}

export interface Garage {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
}

export const garagesApi = {
  getAll: async (): Promise<Garage[]> => {
    try {
      const result = await apiCall<any>("/api/public/garages");
      if (Array.isArray(result)) return result;
      if (result?.data && Array.isArray(result.data)) return result.data;
      return [];
    } catch {
      return [];
    }
  },
};

export interface LoginData {
  email: string;
  password: string;
}

export interface SupportContactData {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
}

export const authApi = {
  register: (data: RegisterData) =>
    apiCall<{ message: string; userId: string }>("/api/mobile/auth/register", {
      method: "POST",
      body: data,
    }),

  login: async (data: LoginData) => {
    const result = await apiCall<any>("/api/mobile/auth/login", {
      method: "POST",
      body: data,
    });
    const user = normalizeUserProfile(result);
    return { ...result, user };
  },

  logout: () =>
    apiCall("/api/mobile/auth/logout", { method: "POST" }),

  getUser: async () => {
    const result = await apiCall<any>("/api/mobile/auth/me");
    return normalizeUserProfile(result) as UserProfile;
  },

  updateUser: (data: Partial<UserProfile>) =>
    apiCall<UserProfile>("/api/mobile/profile", {
      method: "PATCH",
      body: data,
    }),

  forgotPassword: (email: string) =>
    apiCall<{ message: string; sent?: boolean }>("/api/mobile/auth/forgot-password", {
      method: "POST",
      body: { email },
    }),

  verifyResetCode: (email: string, code: string) =>
    apiCall<{ valid: boolean; resetToken?: string; message?: string }>("/api/mobile/auth/verify-reset-code", {
      method: "POST",
      body: { email, code },
    }),

  resetPassword: (resetToken: string, newPassword: string) =>
    apiCall("/api/mobile/auth/reset-password", {
      method: "POST",
      body: { resetToken, newPassword },
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiCall("/api/mobile/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    }),

  resendVerification: (email: string) =>
    apiCall<{ message: string }>("/api/mobile/auth/resend-verification", {
      method: "POST",
      body: { email },
    }),

  updateNotificationPreferences: (preferences: { push?: boolean; email?: boolean; sms?: boolean }) =>
    apiCall("/api/mobile/profile", {
      method: "PATCH",
      body: preferences,
    }),

  getNotificationPreferences: () =>
    apiCall<{ push: boolean; email: boolean; sms: boolean }>("/api/mobile/profile"),

  deleteAccount: () =>
    apiCall("/api/mobile/auth/account", { method: "DELETE" }),
};

export const devicesApi = {
  register: (token: string, platform: "ios" | "android") =>
    apiCall("/api/mobile/devices/register", {
      method: "POST",
      body: { token, platform },
    }),
  unregister: (token: string) =>
    apiCall(`/api/mobile/devices/${encodeURIComponent(token)}`, { method: "DELETE" }),
  getAll: () => apiCall<any[]>("/api/mobile/devices"),
};

export const profileApi = {
  get: async () => {
    const result = await apiCall<any>("/api/mobile/profile");
    return normalizeUserProfile(result) as UserProfile;
  },
  update: (data: Partial<UserProfile>) =>
    apiCall<UserProfile>("/api/mobile/profile", { method: "PATCH", body: data }),
  delete: () =>
    apiCall("/api/mobile/auth/account", { method: "DELETE" }),
  uploadAvatar: (formData: FormData) =>
    apiCall<any>("/api/mobile/profile/avatar", { method: "POST", body: formData, isFormData: true }),
};

export const legalApi = {
  getTerms: () => apiCall<any>("/api/mobile/legal/terms"),
  getCompliance: () => apiCall<any>("/api/mobile/legal/compliance"),
  getPrivacyPolicy: () => apiCall<any>("/api/mobile/public/privacy-policy"),
  getPublicTerms: () => apiCall<any>("/api/mobile/public/terms"),
  getLegalUrls: () => apiCall<{ privacyPolicyUrl: string; termsUrl: string; supportEmail: string; gdprCompliant: boolean }>("/api/mobile/public/legal"),
};

export const servicesApi = {
  /**
   * Charge la liste des services depuis api.myjantes.fr.
   * L'utilisateur doit être authentifié — le token Bearer est inclus automatiquement par apiCall.
   */
  getAll: async (): Promise<Service[]> =>
    getPublishedServices(unwrapList<Service>(
      await apiCall("/api/mobile/services?published=true&visibleOnWebsite=true"),
    )),
};

/**
 * The mobile and PWA forms use the same service records. Keep filtering here
 * so the dashboard and quote form cannot drift apart when the backend returns
 * internal, archived, or unpublished records alongside the public catalog.
 */
export function getPublishedServices(services: Service[]): Service[] {
  return services.map((service) => {
    const raw = service as Service & Record<string, any>;
    return {
      ...service,
      id: String(raw.id || raw.serviceId || raw.service_id || raw._id || ""),
      name: String(raw.name || raw.label || raw.title || raw.nom || ""),
      isActive: raw.isActive ?? raw.is_active ?? raw.active ?? true,
      isPublished: raw.isPublished ?? raw.is_published ?? raw.published,
      visibleOnWebsite: raw.visibleOnWebsite ?? raw.visible_on_website ?? raw.displayOnWebsite ?? raw.display_on_website,
      basePrice: String(raw.basePrice ?? raw.base_price ?? raw.price ?? ""),
    } as Service;
  }).filter((service) => {
    if (!service.id.trim() || !service.name.trim()) return false;
    if (service.isActive === false) return false;
    if (service.isPublished === false || service.published === false) return false;
    if (service.visibleOnWebsite === false || service.displayOnWebsite === false) return false;
    const status = String(service.status || "").trim().toLowerCase();
    return !["inactive", "inactif", "draft", "brouillon", "archived", "archive", "deleted", "supprimé", "supprime"].includes(status);
  });
}

export function getServiceId(service: Service): string {
  return String(service.id || service.serviceId || service.service_id || service._id || "");
}

export interface Invoice {
  id: string;
  quoteId: string | null;
  clientId: string;
  invoiceNumber: string;
  status: string;
  totalHT: string;
  totalTTC: string;
  tvaAmount: string;
  tvaRate: string;
  dueDate: string | null;
  paidAt: string | null;
  items: any[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: string;
  clientId: string;
  quoteId: string | null;
  serviceId: string | null;
  reference: string | null;
  date: string;
  scheduledDate: string | null;
  estimatedEndDate: string | null;
  timeSlot: string | null;
  status: string;
  notes: string | null;
  vehicleInfo: any;
  wheelCount: number | null;
  diameter: string | null;
  priceExcludingTax: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  productDetails: string | null;
  assignedEmployeeId: string | null;
  createdAt: string;
  updatedAt: string;
}

function unwrapList<T>(result: any): T[] {
  if (Array.isArray(result)) return result;
  if (!result || typeof result !== "object") return [];

  // The production API has returned all of these envelopes over time. Keep
  // the transport normalization here so every screen consumes remote data in
  // the same way instead of each screen guessing a different response shape.
  const listKeys = [
    "data", "results", "items", "rows", "records",
    "quotes", "invoices", "reservations", "services", "notifications",
    "messages", "conversations", "contacts", "interlocutors",
    "bon_livraisons", "deliveryNotes", "delivery_notes",
  ];
  for (const key of listKeys) {
    if (!(key in result)) continue;
    const value = result[key];
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === "object") {
      const nested = unwrapList<T>(value);
      if (nested.length > 0) return nested;
    }
  }

  // Last chance for an unknown envelope, but only recurse through objects.
  // Do not treat scalar metadata (count, available, message) as data.
  for (const value of Object.values(result)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = unwrapList<T>(value);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function unwrapSingle<T>(result: any): T {
  if (!result || typeof result !== "object") return result;
  if (result.id || result._id) return result as T;
  const objectKeys = [
    "data", "result", "item", "record", "quote", "invoice",
    "reservation", "user", "profile",
  ];
  for (const key of objectKeys) {
    const value = result[key];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const nested = unwrapSingle<T>(value);
    if (nested && typeof nested === "object" && ((nested as any).id || (nested as any)._id)) {
      return nested;
    }
  }
  return result as T;
}

function normalizeQuote(raw: any): Quote {
  const value = raw || {};
  return {
    ...value,
    id: String(value.id ?? value._id ?? value.quoteId ?? value.quote_id ?? ""),
    quoteNumber: value.quoteNumber ?? value.quote_number ?? value.reference ?? value.ref ?? null,
    clientId: String(value.clientId ?? value.client_id ?? value.customerId ?? value.customer_id ?? ""),
    status: String(value.status ?? value.state ?? ""),
    totalAmount: value.totalAmount ?? value.total_amount ?? value.totalTTC ??
      value.total_ttc ?? value.totalIncludingTax ?? value.total_including_tax ??
      value.amount ?? value.total ?? null,
    notes: value.notes ?? value.note ?? value.comments ?? null,
    items: value.items ?? value.lineItems ?? value.line_items ?? value.lignes ?? value.lines ?? [],
    photos: value.photos ?? value.images ?? value.media ?? [],
    createdAt: value.createdAt ?? value.created_at ?? value.date ?? value.requestedAt ?? "",
    updatedAt: value.updatedAt ?? value.updated_at ?? value.modifiedAt ?? "",
  } as Quote;
}

function normalizeInvoice(raw: any): Invoice {
  const value = raw || {};
  return {
    ...value,
    id: String(value.id ?? value._id ?? value.invoiceId ?? value.invoice_id ?? ""),
    quoteId: value.quoteId ?? value.quote_id ?? null,
    clientId: String(value.clientId ?? value.client_id ?? value.customerId ?? value.customer_id ?? ""),
    invoiceNumber: String(value.invoiceNumber ?? value.invoice_number ?? value.number ?? value.reference ?? value.id ?? ""),
    status: String(value.status ?? value.state ?? ""),
    totalHT: value.totalHT ?? value.total_ht ?? value.totalExcludingTax ?? value.total_excluding_tax ?? value.subtotal ?? "0",
    totalTTC: value.totalTTC ?? value.total_ttc ?? value.totalIncludingTax ?? value.total_including_tax ??
      value.totalAmount ?? value.total_amount ?? value.amount ?? value.total ?? "0",
    tvaAmount: value.tvaAmount ?? value.tva_amount ?? value.taxAmount ?? value.tax_amount ?? value.vatAmount ?? "0",
    tvaRate: value.tvaRate ?? value.tva_rate ?? value.taxRate ?? value.tax_rate ?? "20",
    dueDate: value.dueDate ?? value.due_date ?? value.paymentDueDate ?? null,
    paidAt: value.paidAt ?? value.paid_at ?? value.paymentDate ?? null,
    items: value.items ?? value.lineItems ?? value.line_items ?? value.lignes ?? value.lines ?? [],
    notes: value.notes ?? value.note ?? value.comments ?? null,
    createdAt: value.createdAt ?? value.created_at ?? value.issuedAt ?? value.issued_at ?? value.date ?? "",
    updatedAt: value.updatedAt ?? value.updated_at ?? value.modifiedAt ?? "",
  } as Invoice;
}

function normalizeReservation(raw: any): Reservation {
  const value = raw || {};
  return {
    ...value,
    id: String(value.id ?? value._id ?? value.reservationId ?? value.reservation_id ?? ""),
    clientId: String(value.clientId ?? value.client_id ?? value.customerId ?? value.customer_id ?? ""),
    quoteId: value.quoteId ?? value.quote_id ?? null,
    serviceId: value.serviceId ?? value.service_id ?? null,
    reference: value.reference ?? value.reservationNumber ?? value.reservation_number ?? null,
    date: value.date ?? value.scheduledDate ?? value.scheduled_date ?? value.createdAt ?? value.created_at ?? "",
    scheduledDate: value.scheduledDate ?? value.scheduled_date ?? value.date ?? null,
    estimatedEndDate: value.estimatedEndDate ?? value.estimated_end_date ?? null,
    timeSlot: value.timeSlot ?? value.time_slot ?? null,
    status: String(value.status ?? value.state ?? ""),
    notes: value.notes ?? value.note ?? null,
    vehicleInfo: value.vehicleInfo ?? value.vehicle_info ?? value.vehicle ?? null,
    wheelCount: value.wheelCount ?? value.wheel_count ?? null,
    diameter: value.diameter ?? null,
    priceExcludingTax: value.priceExcludingTax ?? value.price_excluding_tax ?? null,
    taxRate: value.taxRate ?? value.tax_rate ?? null,
    taxAmount: value.taxAmount ?? value.tax_amount ?? null,
    productDetails: value.productDetails ?? value.product_details ?? null,
    assignedEmployeeId: value.assignedEmployeeId ?? value.assigned_employee_id ?? null,
    createdAt: value.createdAt ?? value.created_at ?? "",
    updatedAt: value.updatedAt ?? value.updated_at ?? "",
  } as Reservation;
}

function normalizeMedia(raw: any): any {
  const value = raw || {};
  return {
    ...value,
    id: value.id ?? value._id ?? value.mediaId ?? value.media_id,
    url: value.url ?? value.uri ?? value.fileUrl ?? value.file_url ??
      value.publicUrl ?? value.public_url ?? value.downloadUrl ?? value.download_url,
    fileName: value.fileName ?? value.file_name ?? value.name,
    mimeType: value.mimeType ?? value.mime_type ?? value.contentType ?? value.content_type,
  };
}

function normalizeDeliveryNote(raw: any): any {
  const value = raw || {};
  return {
    ...value,
    id: String(value.id ?? value._id ?? value.deliveryNoteId ?? value.delivery_note_id ?? ""),
    number: value.number ?? value.reference ?? value.blNumber ?? value.bl_number ?? value.deliveryNoteNumber ?? value.delivery_note_number,
    reference: value.reference ?? value.number ?? value.blNumber ?? value.bl_number,
    status: value.status ?? value.state ?? "",
    date: value.date ?? value.createdAt ?? value.created_at ?? "",
    createdAt: value.createdAt ?? value.created_at ?? value.date ?? "",
    amount: value.amount ?? value.totalTTC ?? value.total_ttc ?? value.totalAmount ?? value.total_amount,
    pdfUrl: value.pdfUrl ?? value.pdf_url ?? value.pdf ?? value.documentUrl ?? value.document_url ??
      value.downloadUrl ?? value.download_url,
  };
}

export const quotesApi = {
  getAll: async () => unwrapList<Quote>(await apiCall("/api/mobile/quotes")).map(normalizeQuote),
  getById: async (id: string) => normalizeQuote(unwrapSingle<Quote>(await apiCall(`/api/mobile/quotes/${id}`))),
  getMedia: async (id: string) => unwrapList<any>(await apiCall<any>(`/api/mobile/quotes/${id}/media`)).map(normalizeMedia),
  getPdfData: (id: string) => apiCall<any>(`/api/mobile/quotes/${id}/pdf-data`),

  create: (data: any) =>
    apiCall<Quote>("/api/mobile/quotes", { method: "POST", body: data }),

  /**
   * The remote mobile API requires quote creation as multipart/form-data.
   * The `images` field is required and may contain up to 10 image files.
   */
  createWithPhotos: (formData: FormData, idempotencyKey = createIdempotencyKey("quote")) =>
    apiCall<Quote>("/api/mobile/quotes", {
      method: "POST",
      body: formData,
      isFormData: true,
      headers: { "Idempotency-Key": idempotencyKey },
    }),

  /** Upload photos to an existing quote (FormData with "images" or "media" field) */
  addMedia: (id: string, formData: FormData) =>
    apiCall<any>(`/api/mobile/quotes/${id}/media`, { method: "POST", body: formData, isFormData: true }),

  update: (id: string, data: any) =>
    apiCall<Quote>(`/api/mobile/quotes/${id}`, { method: "PATCH", body: data }),

  delete: (id: string) =>
    apiCall(`/api/mobile/quotes/${id}`, { method: "DELETE" }),

  convertToInvoice: (id: string) =>
    apiCall(`/api/mobile/quotes/${id}/convert-to-invoice`, { method: "POST" }),

  createReservation: (id: string, data: any) =>
    apiCall(`/api/mobile/quotes/${id}/create-reservation`, { method: "POST", body: data }),

  /**
   * Accepter un devis.
   * Essaie d'abord l'endpoint dédié POST /accept (certains backends l'exposent),
   * puis repasse sur PATCH { status: "accepted" } si ce n'est pas disponible.
   */
  accept: async (id: string) => {
    try {
      return await apiCall(`/api/mobile/quotes/${id}/accept`, { method: "POST" });
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 405) {
        return apiCall(`/api/mobile/quotes/${id}`, { method: "PATCH", body: { status: "accepted" } });
      }
      throw err;
    }
  },

  /**
   * Refuser un devis.
   * Même logique de fallback que accept.
   */
  reject: async (id: string) => {
    try {
      return await apiCall(`/api/mobile/quotes/${id}/reject`, { method: "POST" });
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 405) {
        return apiCall(`/api/mobile/quotes/${id}`, { method: "PATCH", body: { status: "rejected" } });
      }
      throw err;
    }
  },
};

export interface ConfiguratorQuoteRequest {
  configuration: {
    serviceType: "renovation" | "personnalisation" | "polissage";
    color: string;
    finish: "brillant" | "mat" | "satine" | "metallise";
    size: string;
    wheelCount: number;
    accessories: string[];
  };
  notes?: string;
  photoUrls?: string[];
  pickupMode: "depot" | "enlevement";
  pickupAddress?: string;
}

export const configuratorApi = {
  estimate: (configuration: ConfiguratorQuoteRequest["configuration"]) =>
    apiCall<any>("/api/mobile/configurator/estimate", {
      method: "POST",
      body: configuration,
    }),
  createQuoteRequest: (data: ConfiguratorQuoteRequest) =>
    apiCall<{ success: boolean; quoteId: string; message: string }>(
      "/api/mobile/configurator/quote-request",
      { method: "POST", body: data },
    ),
  getConfig: (garageId?: string) =>
    apiCall<any>(
      `/api/mobile/wheel-simulator/config${garageId ? `?garageId=${encodeURIComponent(garageId)}` : ""}`,
    ),
};

export interface RemovalRequest {
  materialType: string;
  materialLabel?: string;
  estimatedQuantity: string;
  wheelCount?: string;
  vehicleCount?: string;
  pickupMode: "depot" | "enlevement";
  pickupAddress: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
}

export const removalApi = {
  create: (data: RemovalRequest, idempotencyKey = createIdempotencyKey("removal")) =>
    apiCall<{ success: boolean; requestId?: string; message?: string }>(
      "/api/mobile/removal-requests",
      { method: "POST", body: data, headers: { "Idempotency-Key": idempotencyKey } },
    ),
};

export const invoicesApi = {
  getAll: async () => unwrapList<Invoice>(await apiCall("/api/mobile/invoices")).map(normalizeInvoice),
  getById: async (id: string) => normalizeInvoice(unwrapSingle<Invoice>(await apiCall(`/api/mobile/invoices/${id}`))),
  getMedia: async (id: string) => unwrapList<any>(await apiCall<any>(`/api/mobile/invoices/${id}/media`)).map(normalizeMedia),
  getPdfData: (id: string) => apiCall<any>(`/api/mobile/invoices/${id}/pdf-data`),

  create: (data: any) =>
    apiCall<Invoice>("/api/mobile/invoices", { method: "POST", body: data }),

  update: (id: string, data: any) =>
    apiCall<Invoice>(`/api/mobile/invoices/${id}`, { method: "PATCH", body: data }),

  delete: (id: string) =>
    apiCall(`/api/mobile/invoices/${id}`, { method: "DELETE" }),
};

export const reservationsApi = {
  getAll: async () => unwrapList<Reservation>(await apiCall("/api/mobile/reservations")).map(normalizeReservation),
  getById: async (id: string) => normalizeReservation(unwrapSingle<Reservation>(await apiCall(`/api/mobile/reservations/${id}`))),
  getServices: async (id: string) => unwrapList<any>(await apiCall(`/api/mobile/reservations/${id}/services`)),

  create: (data: {
    quoteId?: string;
    serviceId?: string;
    scheduledDate: string;
    date?: string;
    timeSlot: string;
    time_slot?: string;
    notes?: string;
    vehicleInfo?: any;
  }) => apiCall<Reservation>("/api/mobile/reservations", { method: "POST", body: data }),

  update: (id: string, data: any) =>
    apiCall<Reservation>(`/api/mobile/reservations/${id}`, { method: "PATCH", body: data }),

  delete: (id: string) =>
    apiCall(`/api/mobile/reservations/${id}`, { method: "DELETE" }),
};

export interface Notification {
  id: string;
  userId: string;
  type: "quote" | "invoice" | "reservation" | "service" | "chat";
  title: string;
  message: string;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdById: string;
  isArchived: boolean;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  participants?: any[];
  lastMessage?: ChatMessage;
  unreadCount?: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  sender?: { id: string; firstName: string; lastName: string; role: string };
}

export const notificationsApi = {
  getAll: async () => unwrapList<Notification>(await apiCall("/api/mobile/notifications")),
  getUnreadCount: () =>
    apiCall<{ count: number }>("/api/mobile/notifications/unread-count"),
  markRead: (id: string) =>
    apiCall("/api/mobile/notifications/" + id + "/read", { method: "PATCH" }),
  markAllRead: () =>
    apiCall("/api/mobile/notifications/mark-all-read", { method: "POST" }),
};

export const chatApi = {
  getConversations: async () => unwrapList<ChatConversation>(await apiCall("/api/mobile/chat/conversations")),
  getMessages: async (conversationId: string) =>
    unwrapList<ChatMessage>(await apiCall(`/api/mobile/chat/conversations/${conversationId}/messages`)),
  sendMessage: (conversationId: string, content: string) =>
    apiCall<ChatMessage>(`/api/mobile/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { content },
    }),
  getUsers: () => apiCall<any[]>("/api/mobile/chat/users"),
};

// ── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Returns true when the error comes from a 404/405 HTTP response.
 * Uses the ApiError.status property (set by apiCall) so the check is reliable
 * even when the server returns a custom JSON error body without the number.
 */
function isEndpointMissing(err: any): boolean {
  if (err instanceof ApiError) return err.status === 404 || err.status === 405;
  // Fallback for errors from code paths that don't go through apiCall
  const msg: string = err?.message || "";
  return /\b(404|405)\b/.test(msg) || /not found|route not found/i.test(msg);
}

// ── Delivery Notes (Bons de livraison) ──────────────────────────────────────
export const deliveryNotesApi = {
  /** Returns { available: false } when the endpoint returns 404/405 so the UI
   *  can show the graceful empty state instead of an error. */
  getAll: async (): Promise<any> => {
    try {
      const result = await apiCall<any>("/api/mobile/bon-livraison");
      if (result?.available === false) return result;
      const notes = unwrapList<any>(result).map(normalizeDeliveryNote);
      if (Array.isArray(result)) return notes;
      return { ...result, data: notes };
    } catch (err) {
      if (isEndpointMissing(err)) {
        // A few production deployments do not publish a standalone BL route,
        // but include the documents in the authenticated profile payload.
        try {
          const profile = await apiCall<any>("/api/mobile/auth/me");
          const notes = unwrapList<any>(
            profile?.deliveryNotes ||
            profile?.delivery_notes ||
            profile?.bonLivraisons ||
            profile?.bon_livraisons ||
            profile,
          ).map(normalizeDeliveryNote);
          if (notes.length > 0) return { available: true, data: notes };
        } catch {}
        return { available: false, data: [] };
      }
      throw err;
    }
  },
  getById: async (id: string): Promise<any> => {
    try {
      return normalizeDeliveryNote(await apiCall<any>(`/api/mobile/bon-livraison/${id}`));
    } catch (err) {
      if (isEndpointMissing(err)) return { available: false };
      throw err;
    }
  },
};

// ── Account (solde, remise, interlocuteurs) ──────────────────────────────────
export const accountApi = {
  /** Returns { available: false } on 404/405 so ProBalanceCard shows N/A gracefully. */
  getSummary: async (): Promise<any> => {
    try {
      const result = await apiCall<any>("/api/mobile/account/summary");
      const data = result?.data || result?.account || result;
      const balance = data?.balance ?? data?.solde ?? data?.outstanding_balance ?? data?.outstandingBalance ?? data?.amountDue ?? data?.amount_due;
      const discountRate = data?.discountRate ?? data?.discount_rate ?? data?.remise ?? data?.discount ?? data?.discountPercentage ?? data?.discount_percentage;
      return {
        ...result,
        available: result?.available !== false && (balance !== undefined || discountRate !== undefined),
        balance: balance ?? null,
        discountRate: discountRate ?? null,
        currency: data?.currency || "EUR",
      };
    } catch (err) {
      if (isEndpointMissing(err)) return { available: false };
      throw err;
    }
  },
  /** Returns { available: false, contacts: [] } on 404/405 so the screen shows
   *  "Interlocuteur non assigné" instead of "Données indisponibles". */
  getContacts: async (): Promise<any> => {
    try {
      const result = await apiCall<any>("/api/mobile/account/contacts");
      const contacts = unwrapList<any>(result);
      return contacts.length > 0
        ? { ...result, available: true, contacts }
        : { ...result, contacts: [] };
    } catch (err) {
      if (isEndpointMissing(err)) {
        // Older production accounts expose the assigned contact on the
        // authenticated profile rather than on /account/contacts.
        try {
          const profile = await apiCall<any>("/api/mobile/auth/me");
          const raw = profile?.user || profile?.data?.user || profile?.profile || profile;
          const contacts = raw?.contacts || raw?.interlocutors || raw?.accountManager || raw?.account_manager;
          if (Array.isArray(contacts)) return { available: true, contacts };
          if (contacts && typeof contacts === "object") return { available: true, contacts: [contacts] };
        } catch {}
        return { available: false, contacts: [] };
      }
      throw err;
    }
  },
};

// ── GCS Storage (presigned URL upload pour les photos devis) ─────────────────
export const storageApi = {
  /**
   * Demande une URL presignée au Replit api-server pour uploader une photo directement sur GCS.
   * Retourne { uploadURL, objectPath, publicUrl }.
   */
  requestUploadUrl: async (name: string, size: number, contentType: string) => {
    const { STORAGE_API_BASE } = await import("./config");
    if (!STORAGE_API_BASE) {
      throw new Error("Service de stockage non configuré. Veuillez contacter le support.");
    }
    const res = await globalThis.fetch(`${STORAGE_API_BASE}/mobile-storage/request-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, size, contentType }),
    });
    if (!res.ok) throw new Error(`Erreur storage ${res.status}`);
    return res.json() as Promise<{ uploadURL: string; objectPath: string; publicUrl: string }>;
  },

  /**
   * Upload un fichier directement sur GCS via PUT vers l'URL presignée.
   */
  uploadToGcs: async (uploadURL: string, fileUri: string, contentType: string): Promise<void> => {
    const blobRes = await globalThis.fetch(fileUri);
    const blob = await blobRes.blob();
    const putRes = await globalThis.fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });
    if (!putRes.ok) throw new Error(`Échec upload GCS ${putRes.status}`);
  },
};

export const supportApi = {
  sendMessage: (message: string) =>
    apiCall<{ success: boolean; message: string; messageId?: string; conversationId?: string }>(
      "/api/mobile/support/messages",
      { method: "POST", body: { message } }
    ),
  getHistory: async () => {
    try {
      const result = await apiCall<any>("/api/mobile/support/messages");
      if (Array.isArray(result)) return result;
      if (result && Array.isArray(result.data)) return result.data;
      if (result && Array.isArray(result.messages)) return result.messages;
      return [];
    } catch {
      return [];
    }
  },
  /**
   * Send a structured contact/support message.
   * Primary: POST /api/mobile/support/messages
   * Fallback: send via the chat conversations endpoint (GET conversations → send to first, or create new)
   */
  contact: async (data: SupportContactData) => {
    const formatted = `[${data.category}] ${data.subject}\n\nDe : ${data.name} (${data.email})\n\n${data.message}`;

    // 1. Try native support endpoint first
    try {
      const result = await apiCall<{ success: boolean; message: string }>("/api/mobile/support/messages", {
        method: "POST",
        body: { message: formatted },
      });
      return result;
    } catch (primaryErr: any) {
      // Use ApiError.status when available (set by apiCall); fall back to message parsing
      // for errors that don't originate from apiCall.
      if (!isEndpointMissing(primaryErr)) throw primaryErr;
      console.warn("[supportApi.contact] Primary endpoint not found, trying chat fallback:", primaryErr?.message);
    }

    // 2. Fallback: route through chat conversations
    try {
      // Try to find an existing conversation or create one
      let conversationId: string | null = null;
      try {
        const convs = await unwrapList<ChatConversation>(await apiCall("/api/mobile/chat/conversations"));
        if (convs && convs.length > 0) {
          conversationId = convs[0].id;
        }
      } catch {
        // ignore, will try to create below
      }

      if (!conversationId) {
        // Try creating a new conversation
        const newConv = await apiCall<any>("/api/mobile/chat/conversations", {
          method: "POST",
          body: { subject: data.subject, message: formatted },
        });
        conversationId = newConv?.id ?? newConv?.conversationId ?? null;
      }

      if (conversationId) {
        await apiCall(`/api/mobile/chat/conversations/${conversationId}/messages`, {
          method: "POST",
          body: { content: formatted },
        });
        return { success: true, message: "Message envoyé via le chat" };
      }
    } catch (chatErr: any) {
      console.warn("[supportApi.contact] Chat fallback also failed:", chatErr?.message);
    }

    // 3. Both failed — throw a clean error
    throw new Error("Impossible d'envoyer le message. Veuillez contacter le support directement.");
  },
};
