import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reservationsApi, quotesApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";
import { useCustomAlert } from "@/components/CustomAlert";

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  let d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isPast(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

interface CalendarProps {
  selected: Date | null;
  onSelect: (date: Date) => void;
}

function Calendar({ selected, onSelect }: CalendarProps) {
  const theme = useTheme();
  const calStyles = useMemo(() => getCalStyles(theme), [theme]);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const cells = useMemo(() => {
    const items: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) items.push(null);
    for (let d = 1; d <= daysInMonth; d++) items.push(d);
    return items;
  }, [viewYear, viewMonth, daysInMonth, firstDay]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const canGoPrev = () => {
    const now = new Date();
    return viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth > now.getMonth());
  };

  return (
    <View style={calStyles.container}>
      <View style={calStyles.nav}>
        <Pressable
          onPress={prevMonth}
          disabled={!canGoPrev()}
          style={[calStyles.navBtn, !canGoPrev() && calStyles.navBtnDisabled]}
        >
          <Ionicons name="chevron-back" size={20} color={canGoPrev() ? theme.text : theme.textTertiary} />
        </Pressable>
        <Text style={calStyles.monthTitle}>
          {MONTHS_FR[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={nextMonth} style={calStyles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={theme.text} />
        </Pressable>
      </View>

      <View style={calStyles.dayHeaders}>
        {DAYS.map(d => (
          <Text key={d} style={calStyles.dayHeader}>{d}</Text>
        ))}
      </View>

      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (day === null) {
            return <View key={`empty-${idx}`} style={calStyles.cell} />;
          }
          const date = new Date(viewYear, viewMonth, day);
          const past = isPast(date);
          const isSelected = selected ? isSameDay(date, selected) : false;
          const isToday = isSameDay(date, today);
          return (
            <Pressable
              key={`day-${day}`}
              style={[
                calStyles.cell,
                isSelected && calStyles.cellSelected,
                isToday && !isSelected && calStyles.cellToday,
                past && calStyles.cellPast,
              ]}
              onPress={() => !past && onSelect(date)}
              disabled={past}
            >
              <Text
                style={[
                  calStyles.cellText,
                  isSelected && calStyles.cellTextSelected,
                  isToday && !isSelected && calStyles.cellTextToday,
                  past && calStyles.cellTextPast,
                ]}
              >
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const getCalStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  monthTitle: {
    fontSize: 16,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
    textTransform: "capitalize" as const,
  },
  dayHeaders: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayHeader: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Exo2_600SemiBold",
    color: theme.textTertiary,
    paddingVertical: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  cellSelected: {
    backgroundColor: theme.primary,
  },
  cellToday: {
    backgroundColor: theme.surfaceSecondary,
  },
  cellPast: {
    opacity: 0.3,
  },
  cellText: {
    fontSize: 14,
    fontFamily: "Exo2_400Regular",
    color: theme.text,
  },
  cellTextSelected: {
    color: "#FFFFFF",
    fontFamily: "Exo2_700Bold",
  },
  cellTextToday: {
    color: theme.primary,
    fontFamily: "Exo2_600SemiBold",
  },
  cellTextPast: {
    color: theme.textTertiary,
  },
});

export default function RequestReservationScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { showAlert, AlertComponent } = useCustomAlert();
  const { quoteId, serviceId, quoteName, modifyReservationId } = useLocalSearchParams<{
    quoteId?: string;
    serviceId?: string;
    quoteName?: string;
    modifyReservationId?: string;
  }>();

  const isModification = !!modifyReservationId;

  const { data: allQuotes = [], isLoading: loadingQuotes } = useQuery({
    queryKey: ["quotes"],
    queryFn: quotesApi.getAll,
    enabled: !quoteId && !isModification,
  });

  const hasAcceptedQuote = quoteId || isModification || (Array.isArray(allQuotes) && allQuotes.some((q: any) => {
    const s = (q.status || "").toLowerCase();
    return s === "accepted" || s === "accepté" || s === "accepte" || s === "approved" || s === "approuvé" || s === "approuve";
  }));

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedSlot) throw new Error("Sélectionnez une date et un créneau.");
      const [h, m] = selectedSlot.split(":").map(Number);
      const scheduledDate = new Date(selectedDate);
      scheduledDate.setHours(h, m, 0, 0);
      const isoDate = scheduledDate.toISOString();
      const dateOnly = `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, "0")}-${String(scheduledDate.getDate()).padStart(2, "0")}`;
      const data: any = {
        quoteId: quoteId || undefined,
        serviceId: serviceId || undefined,
        scheduledDate: isoDate,
        date: dateOnly,
        timeSlot: selectedSlot,
        time_slot: selectedSlot,
        notes: notes.trim() || undefined,
      };
      if (isModification) {
        return reservationsApi.update(modifyReservationId!, data);
      }
      return reservationsApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      showAlert({
        type: "success",
        title: isModification ? "Réservation modifiée" : "Demande envoyée",
        message: isModification
          ? "Votre réservation a été modifiée avec succès."
          : "Votre demande de réservation a été envoyée. Vous serez notifié lorsqu'elle sera confirmée ou modifiée.",
        buttons: [
          {
            text: "OK",
            style: "primary",
            onPress: () => router.back(),
          },
        ],
      });
    },
    onError: (err: any) => {
      showAlert({
        type: "error",
        title: "Erreur",
        message: err?.message || "Impossible d'envoyer la demande. Veuillez réessayer.",
        buttons: [{ text: "OK", style: "primary" }],
      });
    },
  });

  const formattedDate = selectedDate
    ? selectedDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const canSubmit = !!selectedDate && !!selectedSlot && !mutation.isPending;

  const handleSubmit = () => {
    if (!selectedDate || !selectedSlot) {
      showAlert({
        type: "warning",
        title: "Sélection incomplète",
        message: "Veuillez sélectionner une date et un créneau horaire.",
        buttons: [{ text: "OK", style: "primary" }],
      });
      return;
    }
    showAlert({
      type: "info",
      title: "Confirmer la demande",
      message: `Vous souhaitez réserver le ${formattedDate} à ${selectedSlot}. Confirmer ?`,
      buttons: [
        { text: "Annuler" },
        {
          text: "Confirmer",
          style: "primary",
          onPress: () => mutation.mutate(),
        },
      ],
    });
  };

  if (!isModification && !quoteId && loadingQuotes) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!hasAcceptedQuote) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Demande de réservation</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.gateContainer}>
          <View style={styles.gateIconWrapper}>
            <Ionicons name="document-text-outline" size={56} color={theme.textTertiary} />
          </View>
          <Text style={styles.gateTitle}>Devis accepté requis</Text>
          <Text style={styles.gateSubtitle}>
            Vous devez d'abord avoir un devis accepté pour prendre rendez-vous.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.gateBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push("/(main)/(tabs)/quotes")}
          >
            <Ionicons name="document-text-outline" size={18} color="#fff" />
            <Text style={styles.gateBtnText}>Voir mes devis</Text>
          </Pressable>
        </View>
        {AlertComponent}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "web" ? 67 + 8 : insets.top + 8 },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isModification ? "Modifier la réservation" : "Demande de réservation"}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 34 + 100 : insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {quoteName ? (
          <View style={styles.quoteRef}>
            <Ionicons name="document-text-outline" size={16} color={theme.primary} />
            <Text style={styles.quoteRefText}>Devis : {quoteName}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>Choisir une date</Text>
          </View>
          <Calendar selected={selectedDate} onSelect={setSelectedDate} />
          {selectedDate && (
            <View style={styles.selectedDateBadge}>
              <Ionicons name="checkmark-circle" size={16} color={theme.accepted} />
              <Text style={styles.selectedDateText} numberOfLines={1}>
                {formattedDate}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>Choisir un créneau</Text>
          </View>
          <View style={styles.slotsGrid}>
            {TIME_SLOTS.map((slot) => {
              const isSelected = selectedSlot === slot;
              return (
                <Pressable
                  key={slot}
                  style={[styles.slotBtn, isSelected && styles.slotBtnSelected]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>
                    {slot}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.primary} />
            <Text style={styles.sectionTitle}>Notes (optionnel)</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Informations complémentaires pour la réservation..."
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
          <Text style={styles.infoText}>
            Votre demande sera examinée par notre équipe. Vous recevrez une confirmation ou une proposition alternative.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 10 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            pressed && canSubmit && styles.submitBtnPressed,
            !canSubmit && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send-outline" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>{isModification ? "Enregistrer les modifications" : "Envoyer la demande"}</Text>
            </>
          )}
        </Pressable>
      </View>

      {AlertComponent}
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  quoteRef: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  quoteRefText: {
    fontSize: 14,
    fontFamily: "Exo2_500Medium",
    color: theme.textSecondary,
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Exo2_600SemiBold",
    color: theme.text,
  },
  selectedDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  selectedDateText: {
    fontSize: 13,
    fontFamily: "Exo2_500Medium",
    color: "#166534",
    textTransform: "capitalize" as const,
    flex: 1,
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  slotBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  slotBtnSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  slotText: {
    fontSize: 14,
    fontFamily: "Exo2_500Medium",
    color: theme.text,
  },
  slotTextSelected: {
    color: "#FFFFFF",
    fontFamily: "Exo2_600SemiBold",
  },
  notesInput: {
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    fontSize: 15,
    fontFamily: "Exo2_400Regular",
    color: theme.text,
    minHeight: 90,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    lineHeight: 20,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  submitBtn: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    height: 52,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  submitBtnPressed: {
    backgroundColor: theme.primaryDark,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Exo2_600SemiBold",
  },
  gateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  gateIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: theme.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
  },
  gateTitle: {
    fontSize: 20,
    fontFamily: "Exo2_700Bold",
    color: theme.text,
    textAlign: "center",
  },
  gateSubtitle: {
    fontSize: 15,
    fontFamily: "Exo2_400Regular",
    color: theme.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  gateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  gateBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Exo2_600SemiBold",
  },
});
