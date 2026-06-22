import { screen } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import Activity from "@/app/(tabs)/activity";

const mockRefetch = jest.fn();

jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useExpenses", () => ({ useRecentActivity: jest.fn() }));

import { useAuth } from "@/lib/auth";
import { useRecentActivity } from "@/lib/queries/useExpenses";

function setActivity(overrides?: { data?: unknown; isLoading?: boolean }) {
  (useRecentActivity as jest.Mock).mockReturnValue({
    data: overrides?.data ?? [],
    isLoading: overrides?.isLoading ?? false,
    refetch: mockRefetch,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRefetch.mockResolvedValue(undefined);
  (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" } });
  setActivity();
});

describe("Activity screen", () => {
  it("shows a spinner while loading", async () => {
    setActivity({ isLoading: true });
    await renderWithPaper(<Activity />);

    expect(screen.queryByText("No recent activity")).toBeNull();
  });

  it("shows the empty state when there is no activity", async () => {
    await renderWithPaper(<Activity />);

    expect(screen.getByText("No recent activity")).toBeTruthy();
    expect(
      screen.getByText("Add expenses to groups to see activity here")
    ).toBeTruthy();
  });

  it("labels the current user's own expenses as 'You'", async () => {
    setActivity({
      data: [
        {
          id: "e1",
          description: "Dinner",
          amount: 30,
          paid_by: "u1",
          payer: { full_name: "Me" },
          groups: { name: "Trip" },
          date: "2024-01-01",
        },
      ],
    });
    await renderWithPaper(<Activity />);

    expect(screen.getByText("Dinner")).toBeTruthy();
    expect(screen.getByText("You paid in Trip")).toBeTruthy();
    expect(screen.getByText("$30.00")).toBeTruthy();
  });

  it("labels other members' expenses by their name and group", async () => {
    setActivity({
      data: [
        {
          id: "e2",
          description: "Taxi",
          amount: 12,
          paid_by: "u2",
          payer: { full_name: "Bob" },
          groups: { name: "Trip" },
          date: "2024-01-02",
        },
      ],
    });
    await renderWithPaper(<Activity />);

    expect(screen.getByText("Bob paid in Trip")).toBeTruthy();
  });

  it("falls back gracefully when payer and group are missing", async () => {
    setActivity({
      data: [
        {
          id: "e3",
          description: "Snacks",
          amount: 5,
          paid_by: "u3",
          payer: null,
          groups: null,
          date: "2024-01-03",
        },
      ],
    });
    await renderWithPaper(<Activity />);

    expect(screen.getByText("Someone paid in a group")).toBeTruthy();
  });
});
