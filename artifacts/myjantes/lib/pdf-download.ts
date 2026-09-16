import { Platform, Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { getApiAccessToken, getSessionCookie, refreshApiTokens } from "./api";
import { getMobileApiUrl } from "./config";

const getDIRECT_API = () => getMobileApiUrl();
const PDF_TIMEOUT_MS = 30_000;

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/pdf" };
  const token = getApiAccessToken();
  const cookie = getSessionCookie();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  else if (cookie) headers["Cookie"] = cookie;
  return headers;
}

/** fetch avec timeout — évite un bouton "Chargement…" bloqué indéfiniment. */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PDF_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build a public view URL for a PDF document if the server provides a viewToken.
 * The token comes from the quote/invoice detail payload.
 */
function buildPublicPdfUrl(
  type: "quotes" | "invoices",
  id: string,
  viewToken: string
): string {
  return `${getDIRECT_API()}/api/mobile/${type}/${id}/pdf?token=${encodeURIComponent(viewToken)}`;
}

function resolvePdfUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${getDIRECT_API()}${url.startsWith("/") ? "" : "/"}${url}`;
}

async function removeExistingFile(filePath: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(filePath, { idempotent: true });
  } catch {
    // A missing file is expected on the first download.
  }
}

async function downloadPdfFile(
  url: string,
  filePath: string,
  headers: Record<string, string>,
): Promise<{ uri: string; status: number; headers?: Record<string, string> }> {
  await removeExistingFile(filePath);
  let result = await FileSystem.downloadAsync(url, filePath, { headers });
  if (result.status === 401 && (await refreshApiTokens())) {
    await removeExistingFile(filePath);
    result = await FileSystem.downloadAsync(url, filePath, { headers: buildAuthHeaders() });
  }
  return result as { uri: string; status: number; headers?: Record<string, string> };
}

function isJsonContentType(contentType: string): boolean {
  return contentType.includes("application/json") || contentType.includes("text/json");
}

function getRedirectUrl(json: any): string | undefined {
  return json?.url || json?.pdfUrl || json?.pdf_url || json?.downloadUrl || json?.link || json?.href;
}

async function sharePdfFile(filePath: string, fileName: string, resultUri?: string): Promise<void> {
  const fileInfo = await FileSystem.getInfoAsync(filePath);
  if (!fileInfo.exists || !fileInfo.size) throw new Error("PDF vide reçu du serveur.");
  await Sharing.shareAsync(resultUri || filePath, {
    mimeType: "application/pdf",
    dialogTitle: fileName,
  });
}

/**
 * Opens a PDF URL supplied by the backend (for example a delivery note).
 * URLs on the MyJantes API are fetched with the current auth headers instead
 * of being handed to the OS browser without credentials. Presigned external
 * URLs are opened directly because their signature is their authorization.
 */
export async function viewDocumentPdf(
  rawUrl: string,
  fileName = "document.pdf",
): Promise<boolean> {
  try {
    const url = resolvePdfUrl(rawUrl);
    const isApiUrl = url.startsWith(getDIRECT_API());

    if (!isApiUrl) {
      if (Platform.OS === "web") {
        window.open(url, "_blank");
      } else {
        const safeFileName = fileName.replace(/[^a-z0-9._-]/gi, "_");
        const filePath = `${FileSystem.documentDirectory}${safeFileName}`;
        const result = await downloadPdfFile(url, filePath, {});
        if (result.status !== 200) {
          throw new Error(`Le serveur a répondu ${result.status}. Réessayez plus tard.`);
        }
        await sharePdfFile(filePath, safeFileName, result.uri);
      }
      return true;
    }

    if (Platform.OS === "web") {
      let response = await fetchWithTimeout(url, {
        method: "GET",
        headers: buildAuthHeaders(),
        credentials: "include",
      });
      if (response.status === 401 && (await refreshApiTokens())) {
        response = await fetchWithTimeout(url, {
          method: "GET",
          headers: buildAuthHeaders(),
          credentials: "include",
        });
      }
      if (!response.ok) {
        throw new Error(response.status === 401
          ? "Session expirée. Veuillez vous reconnecter."
          : `Le serveur a répondu ${response.status}. Réessayez plus tard.`);
      }
      if (isJsonContentType(response.headers.get("content-type") || "")) {
        const redirectUrl = getRedirectUrl(await response.json());
        if (!redirectUrl) throw new Error("Le serveur n'a pas retourné de PDF.");
        window.open(resolvePdfUrl(redirectUrl), "_blank");
        return true;
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("PDF vide reçu du serveur.");
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
      return true;
    }

    const safeFileName = fileName.replace(/[^a-z0-9._-]/gi, "_");
    const filePath = `${FileSystem.documentDirectory}${safeFileName}`;
    const result = await downloadPdfFile(url, filePath, buildAuthHeaders());
    if (result.status !== 200) {
      throw new Error(result.status === 401
        ? "Session expirée. Veuillez vous reconnecter."
        : `Le serveur a répondu ${result.status}. Réessayez plus tard.`);
    }
    const contentType = String(
      (result.headers as Record<string, string> | undefined)?.["content-type"]
        || (result.headers as Record<string, string> | undefined)?.["Content-Type"]
        || "",
    );
    if (isJsonContentType(contentType)) {
      const redirectUrl = getRedirectUrl(JSON.parse(await FileSystem.readAsStringAsync(filePath)));
      if (!redirectUrl) throw new Error("Le serveur n'a pas retourné de PDF.");
      const redirectTarget = resolvePdfUrl(redirectUrl);
      const redirected = await downloadPdfFile(
        redirectTarget,
        filePath,
        redirectTarget.startsWith(getDIRECT_API()) ? buildAuthHeaders() : {},
      );
      if (redirected.status !== 200) {
        throw new Error(`Le serveur a répondu ${redirected.status}. Réessayez plus tard.`);
      }
      await sharePdfFile(filePath, safeFileName, redirected.uri);
      return true;
    }
    await sharePdfFile(filePath, safeFileName, result.uri);
    return true;
  } catch (err: any) {
    console.error("[PDF-VIEW-DOCUMENT] Error:", err);
    Alert.alert("Erreur", err?.message || "Impossible d'ouvrir le PDF.", [{ text: "OK" }]);
    return false;
  }
}

export async function viewPdf(
  type: "quotes" | "invoices",
  id: string,
  fileName: string = "document.pdf",
  viewToken?: string | null,
): Promise<boolean> {
  try {
    // ── Authenticated fetch ──────────────────────────────────────────────────
    const directUrl = `${getDIRECT_API()}/api/mobile/${type}/${id}/pdf`;

    if (Platform.OS === "web") {
      try {
        let response = await fetchWithTimeout(directUrl, {
          method: "GET",
          headers: buildAuthHeaders(),
          credentials: "include",
        });

        // Jeton expiré : tenter un renouvellement puis rejouer une seule fois.
        if (response.status === 401 && (await refreshApiTokens())) {
          response = await fetchWithTimeout(directUrl, {
            method: "GET",
            headers: buildAuthHeaders(),
            credentials: "include",
          });
        }

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Session expirée. Veuillez vous reconnecter."
              : `Le serveur a répondu ${response.status}. Réessayez plus tard.`
          );
        }

        // Le serveur peut retourner JSON avec { url } au lieu d'un binaire PDF
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json") || contentType.includes("text/json")) {
          const json = await response.json();
          const redirectUrl: string | undefined =
            json?.url || json?.pdfUrl || json?.pdf_url || json?.downloadUrl || json?.link || json?.href;
          if (redirectUrl) {
            window.open(resolvePdfUrl(redirectUrl), "_blank");
            return true;
          }
          throw new Error(json?.message || json?.error || "Le serveur n'a pas retourné de PDF.");
        }

        const blob = await response.blob();
        if (!blob || blob.size === 0) {
          throw new Error("PDF vide reçu du serveur.");
        }

        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
        return true;
      } catch (err: any) {
        console.error("[PDF-VIEW-WEB] Error:", err);
        Alert.alert("Erreur", err?.message || "Impossible d'ouvrir le PDF.", [{ text: "OK" }]);
        return false;
      }
    }

    // ── Native download + share ──────────────────────────────────────────────
    try {
      const safeFileName = fileName.replace(/[^a-z0-9._-]/gi, "_");
      const filePath = `${FileSystem.documentDirectory}${safeFileName}`;

      let result: { uri: string; status: number; headers?: Record<string, string> };
      try {
        result = await downloadPdfFile(directUrl, filePath, buildAuthHeaders());
      } catch (err) {
        // Some remote API versions expose a tokenized public PDF route instead
        // of the authenticated binary route. Use it only as a fallback; the
        // normal path always downloads through the authenticated API.
        if (!viewToken) throw err;
        const publicUrl = buildPublicPdfUrl(type, id, viewToken);
        result = await downloadPdfFile(publicUrl, filePath, {});
      }
      if (result.status !== 200 && viewToken) {
        const publicUrl = buildPublicPdfUrl(type, id, viewToken);
        result = await downloadPdfFile(publicUrl, filePath, {});
      }

      if (result.status !== 200) {
        throw new Error(
          result.status === 401
            ? "Session expirée. Veuillez vous reconnecter."
            : `Le serveur a répondu ${result.status}. Réessayez plus tard.`
        );
      }

      // Détecter si le serveur a retourné du JSON au lieu d'un PDF
      // (certains backends retournent { url: "..." } plutôt que le binaire)
      const headers = result.headers as Record<string, string> | undefined;
      const respContentType = headers?.["content-type"] || headers?.["Content-Type"] || "";
      if (respContentType.includes("application/json") || respContentType.includes("text/json")) {
        // Lire le fichier comme texte pour extraire l'URL
        const jsonText = await FileSystem.readAsStringAsync(filePath);
        try {
          const json = JSON.parse(jsonText);
          const redirectUrl: string | undefined =
            json?.url || json?.pdfUrl || json?.pdf_url || json?.downloadUrl || json?.link || json?.href;
          if (redirectUrl) {
             const redirectTarget = resolvePdfUrl(redirectUrl);
             const redirected = await downloadPdfFile(
               redirectTarget,
               filePath,
               redirectTarget.startsWith(getDIRECT_API()) ? buildAuthHeaders() : {},
             );
             if (redirected.status !== 200) {
               throw new Error(`Le serveur a répondu ${redirected.status}. Réessayez plus tard.`);
             }
             await sharePdfFile(filePath, safeFileName, redirected.uri);
            return true;
          }
          throw new Error(json?.message || json?.error || "Le serveur n'a pas retourné de PDF.");
        } catch (parseErr: any) {
          throw new Error(parseErr?.message || "Réponse du serveur inattendue.");
        }
      }

      // Vérification de sécurité : lire les premiers octets pour détecter JSON
      // même si content-type est absent ou incorrect
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists || !fileInfo.size || fileInfo.size === 0) {
        throw new Error("PDF vide reçu du serveur.");
      }

      if (fileInfo.size < 200_000) {
        // Fichier assez petit pour un contrôle rapide
        const preview = await FileSystem.readAsStringAsync(filePath, { length: 10 });
        if (preview.trimStart().startsWith("{") || preview.trimStart().startsWith("[")) {
          const fullText = await FileSystem.readAsStringAsync(filePath);
          try {
            const json = JSON.parse(fullText);
            const redirectUrl: string | undefined =
              json?.url || json?.pdfUrl || json?.pdf_url || json?.downloadUrl || json?.link || json?.href;
            if (redirectUrl) {
               const redirectTarget = resolvePdfUrl(redirectUrl);
               const redirected = await downloadPdfFile(
                 redirectTarget,
                 filePath,
                 redirectTarget.startsWith(getDIRECT_API()) ? buildAuthHeaders() : {},
               );
               if (redirected.status !== 200) {
                 throw new Error(`Le serveur a répondu ${redirected.status}. Réessayez plus tard.`);
               }
               await sharePdfFile(filePath, safeFileName, redirected.uri);
              return true;
            }
            throw new Error(json?.message || json?.error || "Le serveur n'a pas retourné de PDF.");
          } catch (parseErr: any) {
            throw new Error(parseErr?.message || "Réponse JSON inattendue du serveur.");
          }
        }
      }

       await sharePdfFile(filePath, safeFileName, result.uri);

      return true;
    } catch (err: any) {
      console.error("[PDF-VIEW-MOBILE] Error:", err);
      Alert.alert("Erreur", err?.message || "Impossible d'ouvrir le PDF.", [{ text: "OK" }]);
      return false;
    }
  } catch (err: any) {
    console.error("[PDF-VIEW] Error:", err);
    Alert.alert("Erreur", err?.message || "Impossible d'ouvrir le PDF.", [{ text: "OK" }]);
    return false;
  }
}
