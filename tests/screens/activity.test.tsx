import { screen } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import Activity from "@/app/(tabs)/activity";

const mockRefetch = jest.fn();
const mockRefetchPayments = jest.fn();
const mockRefetchContactExpenses = jest.fn();
const mockRefetchContactPayments = jest.fn();
const mockRefetchSimplifyEvents = jest.fn();

jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useExpenses", () => ({ useRecentActivity: jest.fn() }));
jest.mock("@/lib/queries/usePayments", () => ({ useRecentPayments: jest.fn() }));
jest.mock("@/lib/queries/useContacts", () => ({
  useRecentContactActivity: jest.fn(),
  useRecentContactPayments: jest.fn(),
}));
jest.mock("@/lib/queries/useGroups", () => ({
  useRecentGroupSettingChanges: jest.fn(),
}));

import { useAuth } from "@/lib/auth";
import { useRecentActivity } from "@/lib/queries/useExpenses";
import { useRecentPayments } from "@/lib/queries/usePayments";
import {
  useRecentContactActivity,
  useRecentContactPayments,
} from "@/lib/queries/useContacts";
import { useRecentGroupSettingChanges } from "@/lib/queries/useGroups";

function setActivity(overrides?: { data?: unknown; isLoading?: boolean }) {
  (useRecentActivity as jest.Mock).mockReturnValue({
    data: overrides?.data ?? [],
    isLoading: overrides?.isLoading ?? false,
    refetch: mockRefetch,
  });
}

function setPayments(overrides?: { data?: unknown; isLoading?: boolean }) {
  (useRecentPayments as jest.Mock).mockReturnValue({
    data: overrides?.data ?? [],
    isLoading: overrides?.isLoading ?? false,
    refetch: mockRefetchPayments,
  });
}

function setContactExpenses(overrides?: {
  data?: unknown;
  isLoading?: boolean;
}) {
  (useRecentContactActivity as jest.Mock).mockReturnValue({
    data: overrides?.data ?? [],
    isLoading: overrides?.isLoading ?? false,
    refetch: mockRefetchContactExpenses,
  });
}

function setContactPayments(overrides?: {
  data?: unknown;
  isLoading?: boolean;
}) {
  (useRecentContactPayments as jest.Mock).mockReturnValue({
    data: overrides?.data ?? [],
    isLoading: overrides?.isLoading ?? false,
    refetch: mockRefetchContactPayments,
  });
}

function setSimplifyEvents(overrides?: {
  data?: unknown;
  isLoading?: boolean;
}) {
  (useRecentGroupSettingChanges as jest.Mock).mockReturnValue({
    data: overrides?.data ?? [],
    isLoading: overrides?.isLoading ?? false,
    refetch: mockRefetchSimplifyEvents,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRefetch.mockResolvedValue(undefined);
  mockRefetchPayments.mockResolvedValue(undefined);
  mockRefetchContactExpenses.mockResolvedValue(undefined);
  mockRefetchContactPayments.mockResolvedValue(undefined);
  mockRefetchSimplifyEvents.mockResolvedValue(undefined);
  (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" } });
  setActivity();
  setPayments();
  setContactExpenses();
  setContactPayments();
  setSimplifyEvents();
});

describe("Activity screen", () => {
  it("shows the empty state when there is no activity", async () => {
    await renderWithPaper(<Activity />);

    expect(screen.getByText("No recent activity")).toBeTruthy();
    expect(
      screen.getByText("Add expenses or settle up to see activity here")
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

  it("shows a payment the current user made to settle a debt", async () => {
    setPayments({
      data: [
        {
          id: "p1",
          amount: 20,
          created_at: "2024-01-05",
          paid_by: "u1",
          paid_to: "u2",
          note: null,
          payer: { full_name: "Me" },
          payee: { full_name: "Bob" },
          groups: { name: "Trip" },
        },
      ],
    });
    await renderWithPaper(<Activity />);

    expect(screen.getByText("You paid Bob")).toBeTruthy();
    expect(screen.getByText("in Trip")).toBeTruthy();
    expect(screen.getByText("$20.00")).toBeTruthy();
  });

  it("shows a payment received by the current user", async () => {
    setPayments({
      data: [
        {
          id: "p2",
          amount: 15,
          created_at: "2024-01-06",
          paid_by: "u3",
          paid_to: "u1",
          note: "thanks!",
          payer: { full_name: "Carol" },
          payee: { full_name: "Me" },
          groups: { name: "Lunch" },
        },
      ],
    });
    await renderWithPaper(<Activity />);

    expect(screen.getByText("Carol paid you")).toBeTruthy();
    expect(screen.getByText("thanks!")).toBeTruthy();
  });

  it("shows a contact expense the current user paid", async () => {
    setContactExpenses({
      data: [
        {
          id: "ce1",
          description: "Movie tickets",
          amount: 24,
          date: "2024-01-07",
          paid_by: "u1",
          user_lo: "u1",
          user_hi: "u2",
          payer: { id: "u1", full_name: "Me" },
          user_lo_profile: { id: "u1", full_name: "Me" },
          user_hi_profile: { id: "u2", full_name: "Bob" },
        },
      ],
    });
    await renderWithPaper(<Activity />);

    expect(screen.getByText("Movie tickets")).toBeTruthy();
    expect(screen.getByText("You paid · with Bob")).toBeTruthy();
    expect(screen.getByText("$24.00")).toBeTruthy();
  });

  it("labels a contact expense paid by the other person", async () => {
    setContactExpenses({
      data: [
        {
          id: "ce2",
          description: "Groceries",
          amount: 40,
          date: "2024-01-08",
          paid_by: "u2",
          user_lo: "u1",
          user_hi: "u2",
          payer: { id: "u2", full_name: "Bob" },
          user_lo_profile: { id: "u1", full_name: "Me" },
          user_hi_profile: { id: "u2", full_name: "Bob" },
        },
      ],
    });
    await renderWithPaper(<Activity />);

    expect(screen.getByText("Bob paid · with you")).toBeTruthy();
  });

  it("shows a contact payment the current user made", async () => {
    setContactPayments({
      data: [
        {
          id: "cp1",
          amount: 18,
          currency: "USD",
          created_at: "2024-01-09",
          paid_by: "u1",
          paid_to: "u2",
          note: "rent",
          payer: { id: "u1", full_name: "Me" },
          payee: { id: "u2", full_name: "Bob" },
        },
      ],
    });
    await renderWithPaper(<Activity />);

    expect(screen.getByText("You paid Bob")).toBeTruthy();
    expect(screen.getByText("rent")).toBeTruthy();
    expect(screen.getByText("$18.00")).toBeTruthy();
  });

  it("shows a contact payment received by the current user", async () => {
    setContactPayments({
      data: [
        {
          id: "cp2",
          amount: 9,
          currency: "USD",
          created_at: "2024-01-10",
          paid_by: "u3",
          paid_to: "u1",
          note: null,
          payer: { id: "u3", full_name: "Carol" },
          payee: { id: "u1", full_name: "Me" },
        },
      ],
    });
    await renderWithPaper(<Activity />);

    expect(screen.getByText("Carol paid you")).toBeTruthy();
  });

  it("shows when the current user turned simplify debts on", async () => {
    setSimplifyEvents({
      data: [
        {
          id: "sd1",
          group_id: "g1",
          actor_id: "u1",
          enabled: true,
          created_at: "2024-01-11",
          actor: { id: "u1", full_name: "Me" },
          groups: { name: "Trip" },
        },
      ],
    });
    await renderWithPaper(<Activity />);

    expect(screen.getByText("You turned on simplify debts")).toBeTruthy();
    expect(screen.getByText("in Trip")).toBeTruthy();
  });

  it("shows when another member turned simplify debts off", async () => {
    setSimplifyEvents({
      data: [
        {
          id: "sd2",
          group_id: "g1",
          actor_id: "u2",
          enabled: false,
          created_at: "2024-01-12",
          actor: { id: "u2", full_name: "Bob" },
          groups: { name: "Trip" },
        },
      ],
    });
    await renderWithPaper(<Activity />);

    expect(screen.getByText("Bob turned off simplify debts")).toBeTruthy();
  });

});
