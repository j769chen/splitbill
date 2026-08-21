import { useLocalSearchParams } from "expo-router";
import { ContactDetailScreen } from "@/components/contacts/ContactDetailScreen";

export default function ActivityContactDetail() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  return (
    <ContactDetailScreen contactUserId={id} name={name} routeBase="/activity" />
  );
}
