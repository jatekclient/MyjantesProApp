import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

export const syncReservationsToCalendar = async (
  reservations: any[],
): Promise<{ success: boolean; message: string; count?: number }> => {
  try {
    if (Platform.OS === "web") {
      return { success: false, message: "Calendar sync not available on web" };
    }

    // Check consent
    const consentCalendar = await AsyncStorage.getItem("consent_calendar");
    if (consentCalendar !== "true") {
      return { success: false, message: "Calendar sync not authorized" };
    }

    // Request permission if needed
    const { status: existingStatus } = await Calendar.getCalendarPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      await AsyncStorage.setItem("consent_calendar", "false");
      return { success: false, message: "Calendar permission denied" };
    }

    // Get or create the MyJantes calendar
    const calendars = await Calendar.getCalendarsAsync();
    let myToolsCalendar = calendars.find((c) => c.title === "MyJantes");

    if (!myToolsCalendar) {
      // Get default source for calendar creation
      let sourceId: string | undefined;
      if (Platform.OS === "ios") {
        // On iOS, get the default local source
        const sources = await Calendar.getSourcesAsync();
        const localSource = sources.find((s) => s.type === "local");
        sourceId = localSource?.id;
      }

      try {
        const newCalendarId = await Calendar.createCalendarAsync({
          title: "MyJantes",
          color: "#DC2626",
          entityType: Calendar.EntityTypes.EVENT,
          sourceId,
          name: "MyJantes",
          ownerAccount: "MyJantes",
          timeZone: "Europe/Paris",
        });

        myToolsCalendar = { id: newCalendarId } as Calendar.Calendar;
      } catch (calError) {
        return { success: false, message: "Could not create calendar" };
      }
    }

    if (!myToolsCalendar?.id) {
      return { success: false, message: "Could not access calendar" };
    }

    // Filter confirmed reservations from now onwards
    const now = new Date();
    const confirmedUpcoming = reservations.filter((r) => {
      if (r.status?.toLowerCase() !== "confirmed") return false;
      const resDate = r.scheduledDate ? new Date(r.scheduledDate) : null;
      return resDate && resDate > now;
    });

    if (confirmedUpcoming.length === 0) {
      return { success: true, message: "No confirmed reservations to sync", count: 0 };
    }

    // Create events
    let count = 0;
    for (const reservation of confirmedUpcoming) {
      if (!reservation.scheduledDate) continue;

      const startDate = new Date(reservation.scheduledDate);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

      // Fix clientName construction with proper operator precedence
      let clientName = "Client";
      if (reservation.clientName) {
        clientName = reservation.clientName;
      } else if (reservation.clientFirstName || reservation.clientLastName) {
        clientName = `${reservation.clientFirstName || ""} ${reservation.clientLastName || ""}`.trim();
      }

      const serviceType = reservation.serviceType || "";
      const dateStr = startDate.toLocaleDateString("fr-FR", { month: "short", day: "numeric" });
      const timeStr = startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const title = `${clientName}${serviceType ? " - " + serviceType : ""} (${dateStr} ${timeStr})`;

      try {
        await Calendar.createEventAsync(myToolsCalendar.id, {
          title,
          startDate,
          endDate,
          timeZone: "Europe/Paris",
          notes: `Rendez-vous ID: ${reservation.id}`,
        });
        count++;
      } catch (eventError) {
        // Continue with next event even if one fails
      }
    }

    return {
      success: true,
      message: `Synchronisé ${count} rendez-vous avec le calendrier`,
      count,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Calendar sync failed",
    };
  }
};
