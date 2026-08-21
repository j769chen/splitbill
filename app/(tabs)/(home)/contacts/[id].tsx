import { useLocalSearchParams } from "expo-router";
import { ContactDetailScreen } from "@/components/contacts/ContactDetailScreen";

export default function ContactDetail() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  return <ContactDetailScreen contactUserId={id} name={name} />;
}
