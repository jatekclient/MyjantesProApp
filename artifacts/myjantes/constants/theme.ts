export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  error: string;
  errorLight: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  pending: string;
  pendingBg: string;
  accepted: string;
  acceptedBg: string;
  rejected: string;
  rejectedBg: string;
  overlay: string;
  white: string;
  navyDark: string;
  navyMedium: string;
  isDark: boolean;
  fontRegular: string;
  fontMedium: string;
  fontSemiBold: string;
  fontBold: string;
  fontTitle: string;
  tabBarBg: string;
  inputBg: string;
  inputBorder: string;
  headerBg: string;
  shadow: string;
}

// Gris métal + Rouge sang — mode clair
export const LightTheme: ThemeColors = {
  background: "#DCDCDF",
  surface: "#EAEAED",
  surfaceSecondary: "#D4D4D8",
  surfaceElevated: "#CACACE",
  card: "#E4E4E8",
  text: "#0C0C0C",
  textSecondary: "#4A4A52",
  textTertiary: "#8A8A96",
  border: "#C2C2C8",
  borderLight: "#D6D6DA",
  // Rouge sang
  primary: "#8B0000",
  primaryDark: "#6B0000",
  primaryLight: "#AA0000",
  accent: "#C41230",
  error: "#CC0000",
  errorLight: "#FFE0E0",
  // Bleu à la place du vert/turquoise
  success: "#1D4ED8",
  successLight: "#DBEAFE",
  // Gris clair à la place de l'ambre/jaune
  warning: "#9CA3AF",
  warningLight: "#F3F4F6",
  pending: "#9CA3AF",
  pendingBg: "#F3F4F6",
  accepted: "#1D4ED8",
  acceptedBg: "#DBEAFE",
  rejected: "#8B0000",
  rejectedBg: "#FFE0E0",
  overlay: "rgba(0,0,0,0.5)",
  white: "#FFFFFF",
  navyDark: "#0C0C0C",
  navyMedium: "#1A1A1A",
  isDark: false,
  fontRegular: "Exo2_400Regular",
  fontMedium: "Exo2_500Medium",
  fontSemiBold: "Exo2_600SemiBold",
  fontBold: "Exo2_700Bold",
  fontTitle: "Exo2_800ExtraBold",
  tabBarBg: "#E2E2E6",
  inputBg: "#EAEAED",
  inputBorder: "#C2C2C8",
  headerBg: "#E2E2E6",
  shadow: "#000000",
};

// Gris métal foncé + Rouge sang — mode sombre (design Cockpit-style)
export const DarkTheme: ThemeColors = {
  background: "#1A1D21",
  surface: "#24282E",
  surfaceSecondary: "#2C3138",
  surfaceElevated: "#343B44",
  card: "#1E2228",
  text: "#EBEBEB",
  textSecondary: "#A0A8B0",
  textTertiary: "#606870",
  border: "#373E47",
  borderLight: "#2C3138",
  // Rouge sang (légèrement plus vif pour lisibilité sur fond sombre)
  primary: "#A30000",
  primaryDark: "#7A0000",
  primaryLight: "#C41230",
  accent: "#C41230",
  error: "#C41230",
  errorLight: "rgba(163,0,0,0.18)",
  // Bleu à la place du turquoise/vert
  success: "#2563EB",
  successLight: "rgba(37,99,235,0.18)",
  // Gris clair à la place du jaune/ambre
  warning: "#9CA3AF",
  warningLight: "rgba(156,163,175,0.15)",
  pending: "#9CA3AF",
  pendingBg: "rgba(156,163,175,0.15)",
  accepted: "#2563EB",
  acceptedBg: "rgba(37,99,235,0.18)",
  rejected: "#C41230",
  rejectedBg: "rgba(163,0,0,0.18)",
  overlay: "rgba(0,0,0,0.80)",
  white: "#FFFFFF",
  navyDark: "#EBEBEB",
  navyMedium: "#C8C8C8",
  isDark: true,
  fontRegular: "Exo2_400Regular",
  fontMedium: "Exo2_500Medium",
  fontSemiBold: "Exo2_600SemiBold",
  fontBold: "Exo2_700Bold",
  fontTitle: "Exo2_800ExtraBold",
  tabBarBg: "#1A1D21",
  inputBg: "#2C3138",
  inputBorder: "#434B56",
  headerBg: "#1A1D21",
  shadow: "#000000",
};

export const Colors = LightTheme;
export default Colors;
