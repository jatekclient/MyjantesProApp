/**
 * The mobile client has one and only one upstream for business data.
 *
 * Do not derive this from the Replit preview origin or from an environment
 * variable: doing so would make the installed app talk to a local proxy.
 */
export const MYJANTES_API_BASE = "https://api.myjantes.fr";

/**
 * Storage API — the deployed Replit api-server (presigned URL generation for
 * direct photo upload). This is a SEPARATE service from MYJANTES_API_BASE.
 *
 * REQUIRED: set EXPO_PUBLIC_STORAGE_API_URL in EAS environment variables to
 * the deployed api-server URL (e.g. https://your-api.replit.app/api).
 * When unset the storage feature is disabled rather than pointing at the wrong host.
 */
export const STORAGE_API_BASE: string =
  (process.env.EXPO_PUBLIC_STORAGE_API_URL as string) || "";

export async function initApiConfig(): Promise<void> {
  // Intentionally a no-op. The API contract requires a fixed production host.
}

export function getMobileApiUrl(): string {
  return MYJANTES_API_BASE;
}

export const NATIVE_BACKEND_URLS = [MYJANTES_API_BASE] as const;

export function getNativeApiBase(): string {
  return MYJANTES_API_BASE;
}

export const EXTERNAL_API_PRIMARY = MYJANTES_API_BASE;
export const PUBLIC_BASE_URL = MYJANTES_API_BASE;
