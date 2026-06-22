export { ProfileAvatar } from "./ProfileAvatar";
export { ProfileHeader } from "./ProfileHeader";
export { SettingsLinkRow } from "./SettingsLinkRow";
export { NotificationToggleItem } from "./NotificationToggleItem";
export { AppVersion } from "./AppVersion";

// FaqItem is intentionally not re-exported here: it depends on
// react-native-reanimated, which is not initialized in the Jest environment.
// Importing it directly from "@/components/account/FaqItem" keeps that
// dependency out of screens (and their tests) that don't need it.
