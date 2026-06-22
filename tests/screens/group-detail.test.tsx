import { fireEvent, screen } from "@testing-library/react-native";
import { renderWithPaper, actAsync } from "../helpers/testUtils";
import GroupDetail from "@/app/(tabs)/groups/[id]";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();
const mockScreenHolder: { options: any } = { options: null };

const mockDeleteMutate = jest.fn();
const mockLeaveAsync = jest.fn();
const mockShowError = jest.fn();
const mockShowInfo = jest.fn();
const mockConfirm = jest.fn();
const mockRefetchGroup = jest.fn();
const mockRefetchExpenses = jest.fn();
const mockRefetchBalances = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(),
  },
  useLocalSearchParams: () => ({ id: "g1" }),
  Stack: {
    Screen: (props: any) => {
      mockScreenHolder.options = props.options;
      return null;
    },
  },
}));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useGroups", () => ({
  useGroup: jest.fn(),
  useLeaveGroup: jest.fn(),
}));
jest.mock("@/lib/queries/useExpenses", () => ({
  useExpenses: jest.fn(),
  useDeleteExpense: jest.fn(),
}));
jest.mock("@/lib/queries/useBalances", () => ({ useGroupBalances: jest.fn() }));
jest.mock("@/lib/realtime", () => ({ useRealtimeSubscription: jest.fn() }));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));
jest.mock("@/lib/confirm", () => ({ useConfirm: jest.fn() }));

import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useGroup, useLeaveGroup } from "@/lib/queries/useGroups";
import { useExpenses, useDeleteExpense } from "@/lib/queries/useExpenses";
import { useGroupBalances } from "@/lib/queries/useBalances";
import { useSnackbar } from "@/lib/snackbar";
import { useConfirm } from "@/lib/confirm";

const group = { id: "g1", name: "Trip" };
const expensesFixture = [
  {
    id: "e1",
    description: "Dinner",
    amount: 30,
    paid_by: "u1",
    payer: { full_name: "Me" },
    date: "2024-01-01",
    expense_splits: [
      { id: "s1", amount: 15, profiles: { full_name: "Me" } },
      { id: "s2", amount: 15, profiles: { full_name: "Bob" } },
    ],
  },
];
const owingBalances = [
  { user_id: "u1", full_name: "Me", balance: -15 },
  { user_id: "u2", full_name: "Bob", balance: 15 },
];

function setup(overrides?: {
  expenses?: unknown;
  balances?: unknown;
  group?: unknown;
}) {
  (useGroup as jest.Mock).mockReturnValue({
    data: overrides?.group ?? group,
    refetch: mockRefetchGroup,
  });
  (useExpenses as jest.Mock).mockReturnValue({
    data: overrides && "expenses" in overrides ? overrides.expenses : expensesFixture,
    refetch: mockRefetchExpenses,
  });
  (useGroupBalances as jest.Mock).mockReturnValue({
    data: overrides && "balances" in overrides ? overrides.balances : owingBalances,
    refetch: mockRefetchBalances,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockScreenHolder.options = null;
  mockLeaveAsync.mockResolvedValue(undefined);
  mockCanGoBack.mockReturnValue(true);
  mockRefetchGroup.mockResolvedValue(undefined);
  mockRefetchExpenses.mockResolvedValue(undefined);
  mockRefetchBalances.mockResolvedValue(undefined);
  (router as unknown as Record<string, jest.Mock>).push = mockPush;
  (router as unknown as Record<string, jest.Mock>).back = mockBack;
  (router as unknown as Record<string, jest.Mock>).replace = mockReplace;
  (router as unknown as Record<string, jest.Mock>).canGoBack = mockCanGoBack;
  (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" } });
  (useLeaveGroup as jest.Mock).mockReturnValue({ mutateAsync: mockLeaveAsync });
  (useDeleteExpense as jest.Mock).mockReturnValue({ mutate: mockDeleteMutate });
  (useSnackbar as jest.Mock).mockReturnValue({
    showError: mockShowError,
    showInfo: mockShowInfo,
  });
  (useConfirm as jest.Mock).mockReturnValue(mockConfirm);
  setup();
});

function pressLeave() {
  const el = mockScreenHolder.options.headerRight();
  el.props.onPress();
}

describe("GroupDetail screen", () => {
  it("renders the expenses tab with expense details and splits", async () => {
    await renderWithPaper(<GroupDetail />);

    expect(screen.getByText("Dinner")).toBeTruthy();
    expect(screen.getByText("$30.00")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("shows the empty state when there are no expenses", async () => {
    setup({ expenses: [] });
    await renderWithPaper(<GroupDetail />);

    expect(screen.getByText("No expenses yet")).toBeTruthy();
  });

  it("switches to the balances tab and shows a per-member balance accordion", async () => {
    await renderWithPaper(<GroupDetail />);

    await fireEvent.press(screen.getByText("Balances"));

    expect(screen.getByText("Me")).toBeTruthy();
    expect(screen.getByText("owes overall")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("is owed overall")).toBeTruthy();

    await fireEvent.press(screen.getByText("Me"));

    expect(screen.getByText("$15.00")).toBeTruthy();
  });

  it("shows the all-settled state when there are no balances", async () => {
    setup({ balances: [] });
    await renderWithPaper(<GroupDetail />);

    await fireEvent.press(screen.getByText("Balances"));

    expect(screen.getByText("All settled up!")).toBeTruthy();
  });

  it("navigates to add-expense and settle-up with the group id", async () => {
    await renderWithPaper(<GroupDetail />);

    await fireEvent.press(screen.getByText("Add Expense"));
    await fireEvent.press(screen.getByText("Settle Up"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/groups/add-expense",
      params: { groupId: "g1" },
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/groups/settle-up",
      params: { groupId: "g1" },
    });
  });

  it("blocks leaving when the user has an outstanding balance", async () => {
    await renderWithPaper(<GroupDetail />);

    await actAsync(async () => {
      pressLeave();
    });

    expect(mockShowInfo).toHaveBeenCalledWith(
      "You have an outstanding balance in this group. Settle up before leaving."
    );
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("confirms and leaves the group when settled, going back if possible", async () => {
    setup({ balances: [{ user_id: "u1", full_name: "Me", balance: 0 }] });
    await renderWithPaper(<GroupDetail />);

    await actAsync(async () => {
      pressLeave();
    });

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    const confirmArg = mockConfirm.mock.calls[0][0];
    expect(confirmArg.title).toBe("Leave Group");
    expect(confirmArg.destructive).toBe(true);

    await actAsync(async () => {
      await confirmArg.onConfirm();
    });

    expect(mockLeaveAsync).toHaveBeenCalledWith("g1");
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("replaces the route when leaving and there is no back stack", async () => {
    mockCanGoBack.mockReturnValue(false);
    setup({ balances: [{ user_id: "u1", full_name: "Me", balance: 0 }] });
    await renderWithPaper(<GroupDetail />);

    await actAsync(async () => {
      pressLeave();
    });
    const confirmArg = mockConfirm.mock.calls[0][0];

    await actAsync(async () => {
      await confirmArg.onConfirm();
    });

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/groups");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("surfaces an error when leaving the group fails", async () => {
    mockLeaveAsync.mockRejectedValue({});
    setup({ balances: [{ user_id: "u1", full_name: "Me", balance: 0 }] });
    await renderWithPaper(<GroupDetail />);

    await actAsync(async () => {
      pressLeave();
    });
    const confirmArg = mockConfirm.mock.calls[0][0];

    await actAsync(async () => {
      await confirmArg.onConfirm();
    });

    expect(mockShowError).toHaveBeenCalledWith(
      "Couldn't leave the group. Please try again."
    );
  });

  it("soft-deletes an expense with an undo option and restores it on undo", async () => {
    await renderWithPaper(<GroupDetail />);

    await fireEvent(screen.getByText("Dinner"), "longPress");

    expect(screen.queryByText("Dinner")).toBeNull();
    expect(mockShowInfo).toHaveBeenCalledWith(
      "Expense deleted",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Undo" }),
      })
    );

    const undoAction = mockShowInfo.mock.calls[0][1].action.onPress;
    await actAsync(async () => {
      undoAction();
    });

    expect(screen.getByText("Dinner")).toBeTruthy();
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it("commits the delete after the undo window elapses", async () => {
    jest.useFakeTimers();
    try {
      await renderWithPaper(<GroupDetail />);

      await fireEvent(screen.getByText("Dinner"), "longPress");

      await actAsync(async () => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockDeleteMutate).toHaveBeenCalledWith(
        { expenseId: "e1", groupId: "g1" },
        expect.objectContaining({ onError: expect.any(Function) })
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
