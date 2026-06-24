import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
