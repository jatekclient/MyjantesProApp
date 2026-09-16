import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { devicesApi } from "./api";

const PUSH_TOKEN_KEY = "push_device_token";

export async function storePushToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  } catch {}
}

export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function registerDevice(pushToken: string): Promise<void> {
  if (!pushToken || Platform.OS === "web") return;
  try {
    await storePushToken(pushToken);
    await devicesApi.register(pushToken, Platform.OS === "ios" ? "ios" : "android");
  } catch {}
}

export async function unregisterDevice(pushToken: string): Promise<void> {
  if (!pushToken || Platform.OS === "web") return;
  try {
    await devicesApi.unregister(pushToken);
  } catch {}
  try {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {}
}
