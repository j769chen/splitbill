import { useLocalSearchParams } from "expo-router";
import { GroupDetailScreen } from "@/components/groups/GroupDetailScreen";

export default function ActivityGroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GroupDetailScreen groupId={id!} leaveFallbackRoute="/(tabs)/activity" />;
}
