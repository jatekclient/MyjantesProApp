import React, { useState } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, ActivityIndicator,
  Alert, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
let expoFetch: typeof globalThis.fetch;
try { expoFetch = require("expo/fetch").fetch; } catch { expoFetch = globalThis.fetch; }
import { useTheme } from "@/lib/theme";
import { getApiUrl } from "@/lib/query-client";

export interface OCRResult {
  clientName?: string | null;
  clientEmail?: string | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehiclePlate?: string | null;
  notes?: string | null;
  paymentMethod?: string | null;
  items?: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    tvaRate: string;
  }>;
}

interface Props {
  visible: boolean;
  mode: "invoice" | "quote";
  onResult: (result: OCRResult) => void;
  onClose: () => void;
}

async function imageToBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const [header, base64] = dataUrl.split(",");
        const mimeType = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
        resolve({ base64, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64" as any,
    });
    const ext = uri.split(".").pop()?.toLowerCase();
    const mimeType = ext === "png" ? "image/png" : "image/jpeg";
    return { base64, mimeType };
  }
}

export default function OCRScannerModal({ visible, mode, onResult, onClose }: Props) {
  const theme = useTheme();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyze = async (uri: string) => {
    setIsAnalyzing(true);
    try {
      const { base64, mimeType } = await imageToBase64(uri);
      const apiBase = getApiUrl();
      const url = new URL("/api/ocr/analyze", apiBase).toString();
      const response = await expoFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType, mode }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        Alert.alert("Erreur OCR", json.message || "Impossible d'analyser ce document.");
        return;
      }
      onResult(json.data as OCRResult);
      onClose();
    } catch (err: any) {
      console.error("[OCR] analyze error:", err?.message || err);
      Alert.alert("Erreur OCR", "Impossible d'analyser l'image. " + (err?.message || "Vérifiez votre connexion."));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "L'accès à la caméra est nécessaire pour le scan OCR.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      quality: 0.5,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      await analyze(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "L'accès à la galerie est nécessaire pour le scan OCR.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.5,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      await analyze(result.assets[0].uri);
    }
  };

  const title = mode === "quote" ? "Scanner un devis" : "Scanner une facture";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={isAnalyzing ? undefined : onClose}>
        <Pressable style={[styles.card, { backgroundColor: theme.surface }]} onPress={() => {}}>
          {isAnalyzing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.text }]}>
                Analyse en cours...{"\n"}
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  Extraction des données du document
                </Text>
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.iconHeader}>
                <View style={[styles.iconBg, { backgroundColor: theme.primary + "20" }]}>
                  <Ionicons name="scan-outline" size={32} color={theme.primary} />
                </View>
                <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  Photographiez ou importez un document pour pré-remplir automatiquement le formulaire
                </Text>
              </View>

              <View style={styles.buttons}>
                <Pressable
                  style={[styles.btn, { backgroundColor: theme.primary }]}
                  onPress={pickFromCamera}
                >
                  <Ionicons name="camera" size={22} color="#fff" />
                  <Text style={styles.btnText}>Prendre une photo</Text>
                </Pressable>

                <Pressable
                  style={[styles.btn, styles.btnSecondary, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
                  onPress={pickFromGallery}
                >
                  <Ionicons name="images-outline" size={22} color={theme.text} />
                  <Text style={[styles.btnText, { color: theme.text }]}>Choisir depuis la galerie</Text>
                </Pressable>

                <Pressable style={styles.cancelBtn} onPress={onClose}>
                  <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Annuler</Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    gap: 20,
  },
  iconHeader: {
    alignItems: "center",
    gap: 12,
  },
  iconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  buttons: {
    gap: 10,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnSecondary: {
    borderWidth: 1,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 15,
  },
  loadingContainer: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 24,
  },
});
