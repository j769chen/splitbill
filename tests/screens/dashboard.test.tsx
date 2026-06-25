import { screen } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import Dashboard from "@/app/(tabs)/(home)/index";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useBalances", () => ({
  useUserTotalBalance: jest.fn(),
}));
jest.mock("@/lib/queries/useGroups", () => ({ useGroups: jest.fn() }));
jest.mock("@/lib/queries/useContacts", () => ({
  useContacts: jest.fn(),
  useContactRequests: jest.fn(),
}));

import { useAuth } from "@/lib/auth";
import { useUserTotalBalance } from "@/lib/queries/useBalances";
import { useGroups } from "@/lib/queries/useGroups";
import { useContacts, useContactRequests } from "@/lib/queries/useContacts";

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" } });
  (useUserTotalBalance as jest.Mock).mockReturnValue({
    data: { net: 25, totalOwed: 30, totalOwing: 5 },
    refetch: jest.fn(),
  });
  (useGroups as jest.Mock).mockReturnValue({ data: [], refetch: jest.fn() });
  (useContacts as jest.Mock).mockReturnValue({ data: [], refetch: jest.fn() });
  (useContactRequests as jest.Mock).mockReturnValue({
    data: { incoming: [], outgoing: [] },
    refetch: jest.fn(),
  });
});

describe("Dashboard screen", () => {
  it("renders the overall balance message when owed", async () => {
    await renderWithPaper(<Dashboard />);

    expect(screen.getByText("You are owed $25.00 overall")).toBeTruthy();
  });

  it("renders the overall balance message when owing", async () => {
    (useUserTotalBalance as jest.Mock).mockReturnValue({
      data: { net: -10, totalOwed: 0, totalOwing: 10 },
      refetch: jest.fn(),
    });

    await renderWithPaper(<Dashboard />);

    expect(screen.getByText("You owe $10.00 overall")).toBeTruthy();
  });

  it("renders the settled-up message when balance is zero", async () => {
    (useUserTotalBalance as jest.Mock).mockReturnValue({
      data: { net: 0, totalOwed: 0, totalOwing: 0 },
      refetch: jest.fn(),
    });

    await renderWithPaper(<Dashboard />);

    expect(screen.getByText("You are settled up!")).toBeTruthy();
  });

  it("shows the empty state when there are no groups", async () => {
    await renderWithPaper(<Dashboard />);

    expect(
      screen.getByText("No groups yet. Create one to start splitting expenses!")
    ).toBeTruthy();
  });

  it("lists groups with a member count when present", async () => {
    (useGroups as jest.Mock).mockReturnValue({
      data: [
        {
          id: "g1",
          name: "Trip",
          group_members: [{ user_id: "u1" }, { user_id: "u2" }],
        },
      ],
      refetch: jest.fn(),
    });

    await renderWithPaper(<Dashboard />);

    expect(screen.getByText("Trip")).toBeTruthy();
    expect(screen.getByText("2 members")).toBeTruthy();
  });
});
