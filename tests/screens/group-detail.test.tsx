import { fireEvent, screen } from "@testing-library/react-native";
import { renderWithPaper, actAsync } from "../helpers/testUtils";
import GroupDetail from "@/app/(tabs)/groups/[id]";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();
const mockScreenHolder: { options: any } = { options: null };

const mockDeleteMutate = jest.fn();
const mockDeletePaymentMutate = jest.fn();
const mockLeaveAsync = jest.fn();
const mockShowError = jest.fn();
const mockShowInfo = jest.fn();
const mockConfirm = jest.fn();
const mockRefetchGroup = jest.fn();
const mockRefetchExpenses = jest.fn();
const mockRefetchPayments = jest.fn();
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
jest.mock("@/lib/queries/usePayments", () => ({
  useGroupPayments: jest.fn(),
  useDeletePayment: jest.fn(),
}));
jest.mock("@/lib/queries/useBalances", () => ({ useGroupBalances: jest.fn() }));
jest.mock("@/lib/realtime", () => ({ useRealtimeSubscription: jest.fn() }));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));
jest.mock("@/lib/confirm", () => ({ useConfirm: jest.fn() }));

import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useGroup, useLeaveGroup } from "@/lib/queries/useGroups";
import { useExpenses, useDeleteExpense } from "@/lib/queries/useExpenses";
import { useGroupPayments, useDeletePayment } from "@/lib/queries/usePayments";
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
      { id: "s1", user_id: "u1", amount: 15, profiles: { full_name: "Me" } },
      { id: "s2", user_id: "u2", amount: 15, profiles: { full_name: "Bob" } },
    ],
  },
];
const paymentsFixture = [
  {
    id: "p1",
    amount: 20,
    paid_by: "u1",
    paid_to: "u2",
    payer: { full_name: "Me" },
    payee: { full_name: "Bob" },
    note: "Venmo transfer",
    created_at: "2024-01-02",
  },
];
const owingBalances = [
  { user_id: "u1", full_name: "Me", balance: -15 },
  { user_id: "u2", full_name: "Bob", balance: 15 },
];

function setup(overrides?: {
  expenses?: unknown;
  payments?: unknown;
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
  (useGroupPayments as jest.Mock).mockReturnValue({
    data: overrides && "payments" in overrides ? overrides.payments : [],
    refetch: mockRefetchPayments,
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
  mockRefetchPayments.mockResolvedValue(undefined);
  mockRefetchBalances.mockResolvedValue(undefined);
  (router as unknown as Record<string, jest.Mock>).push = mockPush;
  (router as unknown as Record<string, jest.Mock>).back = mockBack;
  (router as unknown as Record<string, jest.Mock>).replace = mockReplace;
  (router as unknown as Record<string, jest.Mock>).canGoBack = mockCanGoBack;
  (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" } });
  (useLeaveGroup as jest.Mock).mockReturnValue({ mutateAsync: mockLeaveAsync });
  (useDeleteExpense as jest.Mock).mockReturnValue({ mutate: mockDeleteMutate });
  (useDeletePayment as jest.Mock).mockReturnValue({
    mutate: mockDeletePaymentMutate,
  });
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
  it("renders the expenses tab with the user's personal stake", async () => {
    await renderWithPaper(<GroupDetail />);

    expect(screen.getByText("Dinner")).toBeTruthy();
    expect(screen.getByText("$30.00")).toBeTruthy();
    expect(screen.getByText("Paid by you")).toBeTruthy();
    expect(screen.getByText("You lent")).toBeTruthy();
    expect(screen.getByText("$15.00")).toBeTruthy();
  });

  it("shows what the user owes when someone else paid", async () => {
    setup({
      expenses: [
        {
          ...expensesFixture[0],
          paid_by: "u2",
          payer: { full_name: "Bob" },
        },
      ],
      payments: [],
    });
    await renderWithPaper(<GroupDetail />);

    expect(screen.getByText("Paid by Bob")).toBeTruthy();
    expect(screen.getByText("You owe")).toBeTruthy();
    expect(screen.getByText("$15.00")).toBeTruthy();
  });

  it("shows the empty state when there is no activity", async () => {
    setup({ expenses: [], payments: [] });
    await renderWithPaper(<GroupDetail />);

    expect(screen.getByText("No activity yet")).toBeTruthy();
  });

  it("renders debt payments in the activity feed, differentiated from expenses", async () => {
    setup({ expenses: [], payments: paymentsFixture });
    await renderWithPaper(<GroupDetail />);

    expect(screen.getByText("You paid Bob")).toBeTruthy();
    expect(screen.getByText("Payment")).toBeTruthy();
    expect(screen.getByText("$20.00")).toBeTruthy();
    expect(screen.getByText("Venmo transfer")).toBeTruthy();
  });

  it("asks for confirmation and deletes a payment on confirm", async () => {
    setup({ expenses: [], payments: paymentsFixture });
    await renderWithPaper(<GroupDetail />);

    await fireEvent(screen.getByText("You paid Bob"), "longPress");

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    const confirmArg = mockConfirm.mock.calls[0][0];
    expect(confirmArg.title).toBe("Delete Payment");
    expect(confirmArg.destructive).toBe(true);

    await actAsync(async () => {
      confirmArg.onConfirm();
    });

    expect(mockDeletePaymentMutate).toHaveBeenCalledWith(
      { paymentId: "p1", groupId: "g1" },
      expect.objectContaining({ onError: expect.any(Function) })
    );
  });

  it("does not delete a payment when confirmation is dismissed", async () => {
    setup({ expenses: [], payments: paymentsFixture });
    await renderWithPaper(<GroupDetail />);

    await fireEvent(screen.getByText("You paid Bob"), "longPress");

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockDeletePaymentMutate).not.toHaveBeenCalled();
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

  it("asks for confirmation and deletes an expense on confirm", async () => {
    await renderWithPaper(<GroupDetail />);

    await fireEvent(screen.getByText("Dinner"), "longPress");

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    const confirmArg = mockConfirm.mock.calls[0][0];
    expect(confirmArg.title).toBe("Delete Expense");
    expect(confirmArg.destructive).toBe(true);

    await actAsync(async () => {
      confirmArg.onConfirm();
    });

    expect(mockDeleteMutate).toHaveBeenCalledWith(
      { expenseId: "e1", groupId: "g1" },
      expect.objectContaining({ onError: expect.any(Function) })
    );
  });

  it("does not delete an expense when confirmation is dismissed", async () => {
    await renderWithPaper(<GroupDetail />);

    await fireEvent(screen.getByText("Dinner"), "longPress");

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it("lets a non-payer delete an expense they did not create", async () => {
    setup({
      expenses: [
        {
          ...expensesFixture[0],
          id: "e2",
          paid_by: "u2",
          payer: { full_name: "Bob" },
        },
      ],
      payments: [],
    });
    await renderWithPaper(<GroupDetail />);

    await fireEvent(screen.getByText("Dinner"), "longPress");

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    await actAsync(async () => {
      mockConfirm.mock.calls[0][0].onConfirm();
    });

    expect(mockDeleteMutate).toHaveBeenCalledWith(
      { expenseId: "e2", groupId: "g1" },
      expect.objectContaining({ onError: expect.any(Function) })
    );
  });

  it("lets a non-payer delete a payment they did not create", async () => {
    setup({
      expenses: [],
      payments: [
        {
          ...paymentsFixture[0],
          id: "p2",
          paid_by: "u2",
          paid_to: "u1",
          payer: { full_name: "Bob" },
          payee: { full_name: "Me" },
        },
      ],
    });
    await renderWithPaper(<GroupDetail />);

    await fireEvent(screen.getByText("Bob paid you"), "longPress");

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    await actAsync(async () => {
      mockConfirm.mock.calls[0][0].onConfirm();
    });

    expect(mockDeletePaymentMutate).toHaveBeenCalledWith(
      { paymentId: "p2", groupId: "g1" },
      expect.objectContaining({ onError: expect.any(Function) })
    );
  });
});
