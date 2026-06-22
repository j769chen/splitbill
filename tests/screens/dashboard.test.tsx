import { screen } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import Dashboard from "@/app/(tabs)/index";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useBalances", () => ({
  useUserTotalBalance: jest.fn(),
}));
jest.mock("@/lib/queries/useGroups", () => ({ useGroups: jest.fn() }));

import { useAuth } from "@/lib/auth";
import { useUserTotalBalance } from "@/lib/queries/useBalances";
import { useGroups } from "@/lib/queries/useGroups";

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" } });
  (useUserTotalBalance as jest.Mock).mockReturnValue({
    data: { net: 25, totalOwed: 30, totalOwing: 5 },
    refetch: jest.fn(),
  });
  (useGroups as jest.Mock).mockReturnValue({ data: [], refetch: jest.fn() });
});

describe("Dashboard screen", () => {
  it("renders the formatted overall balance and owed/owing totals", async () => {
    await renderWithPaper(<Dashboard />);

    expect(screen.getByText("Overall Balance")).toBeTruthy();
    expect(screen.getByText("+$25.00")).toBeTruthy();
    expect(screen.getByText("$30.00")).toBeTruthy();
    expect(screen.getByText("$5.00")).toBeTruthy();
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
