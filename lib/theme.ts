import {
  MD3DarkTheme,
  MD3LightTheme,
  type MD3Theme,
  useTheme,
} from "react-native-paper";

export interface AppTheme extends MD3Theme {
  colors: MD3Theme["colors"] & {
    success: string;
    warning: string;
    brand: string;
    onBrand: string;
  };
}

export const lightTheme: AppTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#2563EB",
    onPrimary: "#FFFFFF",
    primaryContainer: "#DBEAFE",
    onPrimaryContainer: "#0B295E",
    secondary: "#1E3A8A",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#D9E2FF",
    onSecondaryContainer: "#142A63",
    tertiary: "#1D4ED8",
    onTertiary: "#FFFFFF",
    error: "#F44336",
    onError: "#FFFFFF",
    errorContainer: "#FCD9D6",
    background: "#F9FAFB",
    onBackground: "#111827",
    surface: "#FFFFFF",
    onSurface: "#111827",
    surfaceVariant: "#F3F4F6",
    onSurfaceVariant: "#6B7280",
    outline: "#E5E7EB",
    outlineVariant: "#F3F4F6",
    success: "#4CAF50",
    warning: "#FF9800",
    brand: "#2563EB",
    onBrand: "#FFFFFF",
  },
};

export const darkTheme: AppTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#60A5FA",
    onPrimary: "#0B295E",
    primaryContainer: "#1E40AF",
    onPrimaryContainer: "#DBEAFE",
    secondary: "#AAC4FF",
    onSecondary: "#142A63",
    secondaryContainer: "#2A4699",
    onSecondaryContainer: "#D9E2FF",
    tertiary: "#93C5FD",
    onTertiary: "#0B295E",
    error: "#FF6B6B",
    onError: "#410002",
    errorContainer: "#7A2422",
    background: "#0B0F1A",
    onBackground: "#ECEDEF",
    surface: "#151B26",
    onSurface: "#ECEDEF",
    surfaceVariant: "#1F2733",
    onSurfaceVariant: "#9CA3AF",
    outline: "#2A3340",
    outlineVariant: "#1F2733",
    success: "#66BB6A",
    warning: "#FFB74D",
    brand: "#1D4ED8",
    onBrand: "#FFFFFF",
  },
};

export function useAppTheme(): AppTheme {
  return useTheme<AppTheme>();
}
