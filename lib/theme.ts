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
    primary: "#1B998B",
    onPrimary: "#FFFFFF",
    primaryContainer: "#B3E8E2",
    onPrimaryContainer: "#082927",
    secondary: "#6366F1",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#E0E7FF",
    onSecondaryContainer: "#312E81",
    tertiary: "#177D72",
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
    brand: "#1B998B",
    onBrand: "#FFFFFF",
  },
};

export const darkTheme: AppTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#4DCABC",
    onPrimary: "#082927",
    primaryContainer: "#126159",
    onPrimaryContainer: "#B3E8E2",
    secondary: "#818CF8",
    onSecondary: "#1E1B4B",
    secondaryContainer: "#3730A3",
    onSecondaryContainer: "#E0E7FF",
    tertiary: "#80D9CF",
    onTertiary: "#0D4540",
    error: "#FF6B6B",
    onError: "#410002",
    errorContainer: "#7A2422",
    background: "#0B0F0E",
    onBackground: "#ECEDED",
    surface: "#15201E",
    onSurface: "#ECEDED",
    surfaceVariant: "#1F2A28",
    onSurfaceVariant: "#9CA3AF",
    outline: "#2A3633",
    outlineVariant: "#1F2A28",
    success: "#66BB6A",
    warning: "#FFB74D",
    brand: "#177D72",
    onBrand: "#FFFFFF",
  },
};

export function useAppTheme(): AppTheme {
  return useTheme<AppTheme>();
}
