import { fireEvent, screen } from "@testing-library/react-native";
import { renderWithPaper, actAsync } from "../helpers/testUtils";
import ContactDetail from "@/app/contacts/[id]";

const mockPush = jest.fn();
const mockDeleteMutate = jest.fn();
const mockShowError = jest.fn();
const mockConfirm = jest.fn();
const mockScreenHolder: { options: any } = { options: null };

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ id: "user-2" }),
  Stack: {
    Screen: (props: any) => {
      mockScreenHolder.options = props.options;
      return null;
    },
  },
}));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useContacts", () => ({
  useContacts: jest.fn(),
  useContactBalance: jest.fn(),
  useContactExpenses: jest.fn(),
  useDeleteContactExpense: jest.fn(),
}));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));
jest.mock("@/lib/confirm", () => ({ useConfirm: jest.fn() }));

import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  useContacts,
  useContactBalance,
  useContactExpenses,
  useDeleteContactExpense,
} from "@/lib/queries/useContacts";
import { useSnackbar } from "@/lib/snackbar";
import { useConfirm } from "@/lib/confirm";

const expensesFixture = [
  {
    id: "ce-1",
    description: "Dinner",
    amount: 30,
    paid_by: "user-1",
    payer: { full_name: "Me" },
    date: "2024-01-01",
    expense_splits: [
      { id: "s1", user_id: "user-1", amount: 15, profiles: { full_name: "Me" } },
      { id: "s2", user_id: "user-2", amount: 15, profiles: { full_name: "Bob" } },
    ],
  },
];

function setup(overrides?: { balance?: number; expenses?: unknown }) {
  (useContactBalance as jest.Mock).mockReturnValue({
    data: overrides?.balance ?? 15,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
  (useContactExpenses as jest.Mock).mockReturnValue({
    data: overrides && "expenses" in overrides ? overrides.expenses : expensesFixture,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockScreenHolder.options = null;
  (router as unknown as Record<string, jest.Mock>).push = mockPush;
  (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });
  (useContacts as jest.Mock).mockReturnValue({
    data: [{ contact_user_id: "user-2", full_name: "Bob", balance: 15 }],
  });
  (useDeleteContactExpense as jest.Mock).mockReturnValue({
    mutate: mockDeleteMutate,
  });
  (useSnackbar as jest.Mock).mockReturnValue({ showError: mockShowError });
  (useConfirm as jest.Mock).mockReturnValue(mockConfirm);
  setup();
});

describe("ContactDetail screen", () => {
  it("sets the screen title to the contact name", async () => {
    await renderWithPaper(<ContactDetail />);

    expect(mockScreenHolder.options.title).toBe("Bob");
  });

  it("shows the contact owes you when balance is positive", async () => {
    await renderWithPaper(<ContactDetail />);

    expect(screen.getByText("Bob owes you")).toBeTruthy();
    expect(screen.getByText("Dinner")).toBeTruthy();
  });

  it("shows you owe the contact when balance is negative", async () => {
    setup({ balance: -15 });
    await renderWithPaper(<ContactDetail />);

    expect(screen.getByText("You owe Bob")).toBeTruthy();
  });

  it("shows the settled state and empty expenses", async () => {
    setup({ balance: 0, expenses: [] });
    await renderWithPaper(<ContactDetail />);

    expect(screen.getByText("You're all settled up")).toBeTruthy();
    expect(screen.getByText("No expenses yet")).toBeTruthy();
  });

  it("navigates to add-expense with the contact id", async () => {
    await renderWithPaper(<ContactDetail />);

    await fireEvent.press(screen.getByText("Add Expense"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/contacts/add-expense",
      params: { contactUserId: "user-2" },
    });
  });

  it("confirms and deletes an expense on confirm", async () => {
    await renderWithPaper(<ContactDetail />);

    await fireEvent(screen.getByText("Dinner"), "longPress");

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    const confirmArg = mockConfirm.mock.calls[0][0];
    expect(confirmArg.title).toBe("Delete Expense");
    expect(confirmArg.destructive).toBe(true);

    await actAsync(async () => {
      confirmArg.onConfirm();
    });

    expect(mockDeleteMutate).toHaveBeenCalledWith(
      { expenseId: "ce-1", contactUserId: "user-2" },
      expect.objectContaining({ onError: expect.any(Function) })
    );
  });
});
