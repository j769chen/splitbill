import { screen } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import Index from "@/app/index";
import AuthLayout from "@/app/(auth)/_layout";
import TabsLayout from "@/app/(tabs)/_layout";

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Redirect = ({ href }: { href: string }) =>
    React.createElement(Text, null, `REDIRECT:${href}`);
  const Stack = () => React.createElement(Text, null, "STACK");
  (Stack as unknown as { Screen: () => null }).Screen = () => null;
  const Tabs = () => React.createElement(Text, null, "TABS");
  (Tabs as unknown as { Screen: () => null }).Screen = () => null;
  return { Redirect, Stack, Tabs };
});
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/realtime", () => ({
  useContactRequestsSubscription: jest.fn(),
}));

import { useAuth } from "@/lib/auth";

function setAuth(state: { session?: unknown; loading?: boolean }) {
  (useAuth as jest.Mock).mockReturnValue({
    session: state.session ?? null,
    loading: state.loading ?? false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Index entry point", () => {
  it("redirects to the tabs when a session exists", async () => {
    setAuth({ session: { user: { id: "u1" } } });
    await renderWithPaper(<Index />);

    expect(screen.getByText("REDIRECT:/(tabs)")).toBeTruthy();
  });

  it("redirects to sign-in when there is no session", async () => {
    setAuth({ session: null });
    await renderWithPaper(<Index />);

    expect(screen.getByText("REDIRECT:/(auth)/sign-in")).toBeTruthy();
  });

  it("shows a spinner while auth is loading", async () => {
    setAuth({ loading: true });
    await renderWithPaper(<Index />);

    expect(screen.queryByText(/REDIRECT:/)).toBeNull();
  });
});

describe("AuthLayout gate", () => {
  it("redirects signed-in users to the tabs", async () => {
    setAuth({ session: { user: { id: "u1" } } });
    await renderWithPaper(<AuthLayout />);

    expect(screen.getByText("REDIRECT:/(tabs)")).toBeTruthy();
  });

  it("renders the auth stack when signed out", async () => {
    setAuth({ session: null });
    await renderWithPaper(<AuthLayout />);

    expect(screen.getByText("STACK")).toBeTruthy();
  });

  it("shows a spinner while loading", async () => {
    setAuth({ loading: true });
    await renderWithPaper(<AuthLayout />);

    expect(screen.queryByText("STACK")).toBeNull();
    expect(screen.queryByText(/REDIRECT:/)).toBeNull();
  });
});

describe("TabsLayout gate", () => {
  it("renders the tabs for signed-in users", async () => {
    setAuth({ session: { user: { id: "u1" } } });
    await renderWithPaper(<TabsLayout />);

    expect(screen.getByText("TABS")).toBeTruthy();
  });

  it("redirects to sign-in when signed out", async () => {
    setAuth({ session: null });
    await renderWithPaper(<TabsLayout />);

    expect(screen.getByText("REDIRECT:/(auth)/sign-in")).toBeTruthy();
  });

  it("shows a spinner while loading", async () => {
    setAuth({ loading: true });
    await renderWithPaper(<TabsLayout />);

    expect(screen.queryByText("TABS")).toBeNull();
    expect(screen.queryByText(/REDIRECT:/)).toBeNull();
  });
});
