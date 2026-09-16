import React, { createContext, useContext } from "react";
import { useColorScheme } from "react-native";
import { LightTheme, DarkTheme, ThemeColors } from "@/constants/theme";

const ThemeContext = createContext<ThemeColors>(LightTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? DarkTheme : LightTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function ForceDarkProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={DarkTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeColors {
  return useContext(ThemeContext);
}

export default useTheme;
