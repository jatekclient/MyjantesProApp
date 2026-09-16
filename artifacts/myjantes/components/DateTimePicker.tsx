import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, Modal, ScrollView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { ThemeColors } from "@/constants/theme";

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseDate(iso: string): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatDisplay(iso: string, showTime: boolean): string {
  if (!iso) return "—";
  const d = parseDate(iso);
  const date = `${pad(d.getDate())} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
  if (!showTime) return date;
  return `${date}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildISO(year: number, month: number, day: number, hours: number, minutes: number): string {
  return new Date(year, month, day, hours, minutes, 0).toISOString();
}

interface Props {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  showTime?: boolean;
  minDate?: Date;
  disabled?: boolean;
}

export function DateTimePicker({ label, value, onChange, showTime = false, minDate, disabled = false }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [visible, setVisible] = useState(false);

  const parsed = useMemo(() => parseDate(value), [value]);
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());
  const [selYear, setSelYear] = useState(parsed.getFullYear());
  const [selMonth, setSelMonth] = useState(parsed.getMonth());
  const [selDay, setSelDay] = useState(parsed.getDate());
  const [selHours, setSelHours] = useState(parsed.getHours());
  const [selMinutes, setSelMinutes] = useState(parsed.getMinutes());

  const open = () => {
    const d = parseDate(value);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelYear(d.getFullYear());
    setSelMonth(d.getMonth());
    setSelDay(d.getDate());
    setSelHours(d.getHours());
    setSelMinutes(d.getMinutes());
    setVisible(true);
  };

  const confirm = () => {
    const iso = buildISO(selYear, selMonth, selDay, selHours, selMinutes);
    onChange(iso);
    setVisible(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = (() => {
    const d = new Date(viewYear, viewMonth, 1).getDay();
    return d === 0 ? 6 : d - 1;
  })();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const isSelected = (day: number) =>
    day === selDay && viewMonth === selMonth && viewYear === selYear;

  const isDisabled = (day: number): boolean => {
    if (!minDate) return false;
    const d = new Date(viewYear, viewMonth, day);
    return d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
  };

  const selectDay = (day: number) => {
    if (isDisabled(day)) return;
    setSelDay(day);
    setSelMonth(viewMonth);
    setSelYear(viewYear);
  };

  const changeHours = (delta: number) => {
    setSelHours(h => (h + delta + 24) % 24);
  };
  const changeMinutes = (delta: number) => {
    setSelMinutes(m => Math.round(((m + delta) % 60 + 60) % 60 / 5) * 5 % 60);
  };

  const TIME_SLOTS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"];

  const displayValue = formatDisplay(value, showTime);

  if (Platform.OS === "web") {
    const webDt = value ? new Date(value) : null;
    const webValue = (webDt && !isNaN(webDt.getTime())) ? (showTime
      ? webDt.toISOString().slice(0, 16)
      : webDt.toISOString().slice(0, 10))
      : "";

    return (
      <View>
        <Text style={styles.label}>{label}</Text>
        <input
          type={showTime ? "datetime-local" : "date"}
          value={webValue}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const parsed = showTime ? new Date(v) : new Date(v + "T00:00:00");
            if (!isNaN(parsed.getTime())) onChange(parsed.toISOString());
          }}
          style={{
            width: "100%", padding: "10px 12px", fontSize: 15, borderRadius: 10,
            border: `1.5px solid #ddd`, backgroundColor: "transparent",
            color: "inherit", fontFamily: "Exo2_400Regular",
            boxSizing: "border-box" as any, cursor: "pointer",
          }}
        />
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.trigger} onPress={open}>
        <Ionicons name="calendar-outline" size={18} color={theme.primary} />
        <Text style={[styles.triggerText, !value && { color: theme.textTertiary }]}>
          {value ? displayValue : "Sélectionner une date"}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
      </Pressable>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setVisible(false)} style={styles.sheetCancel}>
              <Text style={styles.sheetCancelText}>Annuler</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>{label}</Text>
            <Pressable onPress={confirm} style={styles.sheetConfirm}>
              <Text style={styles.sheetConfirmText}>OK</Text>
            </Pressable>
          </View>

          {/* Month navigation */}
          <View style={styles.monthNav}>
            <Pressable style={styles.monthNavBtn} onPress={prevMonth}>
              <Ionicons name="chevron-back" size={20} color={theme.primary} />
            </Pressable>
            <Text style={styles.monthTitle}>
              {MONTHS_FR[viewMonth]} {viewYear}
            </Text>
            <Pressable style={styles.monthNavBtn} onPress={nextMonth}>
              <Ionicons name="chevron-forward" size={20} color={theme.primary} />
            </Pressable>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeaders}>
            {DAYS_FR.map(d => (
              <Text key={d} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.calGrid}>
            {cells.map((day, i) => (
              <Pressable
                key={i}
                style={[
                  styles.dayCell,
                  !!day && isSelected(day) && { backgroundColor: theme.primary },
                  !!day && isDisabled(day) && { opacity: 0.25 },
                ]}
                onPress={() => day && selectDay(day)}
                disabled={!day}
              >
                {day ? (
                  <Text style={[
                    styles.dayCellText,
                    isSelected(day) && { color: "#fff", fontFamily: "Exo2_700Bold" },
                  ]}>
                    {day}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>

          {/* Time picker */}
          {showTime && (
            <View style={styles.timeSection}>
              <Text style={styles.timeSectionLabel}>Heure du rendez-vous</Text>
              {/* Créneau rapide */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 2 }}>
                  {TIME_SLOTS.map(slot => {
                    const [h, m] = slot.split(":").map(Number);
                    const active = selHours === h && selMinutes === m;
                    return (
                      <Pressable
                        key={slot}
                        style={[styles.slotChip, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                        onPress={() => { setSelHours(h); setSelMinutes(m); }}
                      >
                        <Text style={[styles.slotChipText, active && { color: "#fff" }]}>{slot}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              {/* Fine control */}
              <View style={styles.timePicker}>
                <View style={styles.timeUnit}>
                  <Pressable style={styles.timeBtn} onPress={() => changeHours(1)}>
                    <Ionicons name="chevron-up" size={22} color={theme.primary} />
                  </Pressable>
                  <Text style={styles.timeValue}>{pad(selHours)}</Text>
                  <Pressable style={styles.timeBtn} onPress={() => changeHours(-1)}>
                    <Ionicons name="chevron-down" size={22} color={theme.primary} />
                  </Pressable>
                </View>
                <Text style={styles.timeSep}>:</Text>
                <View style={styles.timeUnit}>
                  <Pressable style={styles.timeBtn} onPress={() => changeMinutes(5)}>
                    <Ionicons name="chevron-up" size={22} color={theme.primary} />
                  </Pressable>
                  <Text style={styles.timeValue}>{pad(selMinutes)}</Text>
                  <Pressable style={styles.timeBtn} onPress={() => changeMinutes(-5)}>
                    <Ionicons name="chevron-down" size={22} color={theme.primary} />
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: ThemeColors) => StyleSheet.create({
  label: { fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 },
  trigger: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  triggerText: { flex: 1, fontSize: 15, fontFamily: "Exo2_500Medium", color: theme.primary },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: theme.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingBottom: 32, maxHeight: "85%",
  },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  sheetCancel: { width: 72 },
  sheetCancelText: { fontSize: 15, fontFamily: "Exo2_400Regular", color: theme.textTertiary },
  sheetTitle: { flex: 1, textAlign: "center", fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text },
  sheetConfirm: { width: 72, alignItems: "flex-end" },
  sheetConfirmText: { fontSize: 15, fontFamily: "Exo2_600SemiBold", color: theme.primary },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  monthNavBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + "18", justifyContent: "center", alignItems: "center" },
  monthTitle: { fontSize: 16, fontFamily: "Exo2_600SemiBold", color: theme.text },
  dayHeaders: { flexDirection: "row", paddingHorizontal: 14, marginBottom: 4 },
  dayHeader: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, textTransform: "uppercase" },
  calGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, gap: 2 },
  dayCell: { width: `${100 / 7}%` as any, aspectRatio: 1, justifyContent: "center", alignItems: "center", borderRadius: 10 },
  dayCellText: { fontSize: 14, fontFamily: "Exo2_400Regular", color: theme.text },
  timeSection: { paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.border, marginTop: 10 },
  timeSectionLabel: { fontSize: 12, fontFamily: "Exo2_600SemiBold", color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  timePicker: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  timeUnit: { alignItems: "center", gap: 4 },
  timeBtn: { padding: 6 },
  timeValue: { fontSize: 32, fontFamily: "Exo2_700Bold", color: theme.text, width: 60, textAlign: "center" },
  timeSep: { fontSize: 32, fontFamily: "Exo2_700Bold", color: theme.text, marginBottom: 4 },
  slotChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.background },
  slotChipText: { fontSize: 13, fontFamily: "Exo2_500Medium", color: theme.text },
});
