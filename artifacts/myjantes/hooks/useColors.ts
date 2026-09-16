import { useColorScheme } from 'react-native';
import { LightTheme, DarkTheme } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';

/**
 * Returns the design tokens for the current color scheme.
 * Uses the app's ThemeColors (LightTheme / DarkTheme from constants/theme.ts).
 */
export function useColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DarkTheme : LightTheme;
}
