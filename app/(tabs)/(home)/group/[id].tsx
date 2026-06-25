import { useLocalSearchParams } from "expo-router";
import { GroupDetailScreen } from "@/components/groups/GroupDetailScreen";

export default function HomeGroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GroupDetailScreen groupId={id!} leaveFallbackRoute="/(tabs)/(home)" />;
}
