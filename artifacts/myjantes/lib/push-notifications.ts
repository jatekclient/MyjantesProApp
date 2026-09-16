import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { notificationsApi, Notification as AppNotification } from "@/lib/api";

let Notifications: any = null;
try {
  Notifications = require("expo-notifications");
} catch {}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

let lastCheckedAt: string | null = null;
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let activeFetchFn: (() => Promise<any[]>) | null = null;
let knownNotificationIds: Set<string> = new Set();

const NOTIFICATION_LABELS: Record<string, string> = {
  quote: "Nouveau devis",
  invoice: "Nouvelle facture",
  reservation: "Nouveau rendez-vous",
  chat: "Nouveau message",
  service: "Service",
  payment: "Paiement",
  reminder: "Rappel",
};

function getNotificationSubtitle(type: string): string {
  return NOTIFICATION_LABELS[type] || "MyJantes";
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications) return null;
  if (Platform.OS === "web") return null;

  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "MyJantes",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#DC2626",
      sound: "default",
    });
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.expoConfig?.slug;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    return token.data;
  } catch {
    return null;
  }
}

async function isNotificationConsentGranted(): Promise<boolean> {
  try {
    const consent = await AsyncStorage.getItem("consent_notifications");
    return consent !== "false";
  } catch {
    return true;
  }
}

export async function requestWebNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if ((window as any).Notification.permission === "granted") return true;
  if ((window as any).Notification.permission === "denied") return false;
  const result = await (window as any).Notification.requestPermission();
  return result === "granted";
}

async function showLocalNotification(notification: AppNotification) {
  const consentOk = await isNotificationConsentGranted();
  if (!consentOk) return;

  const title = notification.title || getNotificationSubtitle(notification.type);
  const body = notification.message;

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        if ((window as any).Notification.permission === "granted") {
          new (window as any).Notification(title, { body, icon: "/favicon.ico" });
        }
      } catch {}
    }
    return;
  }

  if (!Notifications) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        type: notification.type,
        relatedId: notification.relatedId,
        notificationId: notification.id,
      },
      sound: "default",
      subtitle: getNotificationSubtitle(notification.type),
    },
    trigger: null,
  });
}

export async function checkForNewNotifications() {
  try {
    const fetchFn = activeFetchFn || notificationsApi.getAll;
    const notifications = await fetchFn();
    if (!Array.isArray(notifications)) return;

    const unread = notifications.filter((n) => !n.isRead && !n.read);

    if (knownNotificationIds.size > 0) {
      const newNotifs = notifications.filter(
        (n) => !knownNotificationIds.has(String(n.id))
      );

      for (const notif of newNotifs) {
        if (!notif.isRead && !notif.read) {
          await showLocalNotification(notif);
        }
      }
    } else if (lastCheckedAt) {
      const lastDate = new Date(lastCheckedAt);
      const newNotifs = unread.filter(
        (n) => new Date(n.createdAt) > lastDate
      );

      for (const notif of newNotifs) {
        await showLocalNotification(notif);
      }
    }

    for (const n of notifications) {
      knownNotificationIds.add(String(n.id));
    }

    if (notifications.length > 0) {
      const newest = notifications.reduce((a, b) =>
        new Date(a.createdAt) > new Date(b.createdAt) ? a : b
      );
      lastCheckedAt = newest.createdAt;
    } else if (!lastCheckedAt) {
      lastCheckedAt = new Date().toISOString();
    }

    if (Notifications) {
      await Notifications.setBadgeCountAsync(unread.length);
    }
  } catch {}
}

export function startNotificationPolling(intervalMs = 15000, fetchFn?: () => Promise<any[]>) {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  activeFetchFn = fetchFn || null;
  knownNotificationIds = new Set();
  lastCheckedAt = null;

  checkForNewNotifications();

  pollingInterval = setInterval(() => {
    checkForNewNotifications();
  }, intervalMs);
}

export function stopNotificationPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  activeFetchFn = null;
  knownNotificationIds = new Set();
  lastCheckedAt = null;
}

export function addNotificationResponseListener(
  callback: (response: any) => void
) {
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(callback);
}
