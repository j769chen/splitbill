import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import AddExpense from "@/app/(tabs)/groups/add-expense";

const mockBack = jest.fn();
const mockMutateAsync = jest.fn();
const mockShowError = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ groupId: "g1" }),
}));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useGroups", () => ({ useGroup: jest.fn() }));
jest.mock("@/lib/queries/useExpenses", () => ({ useCreateExpense: jest.fn() }));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));

import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useGroup } from "@/lib/queries/useGroups";
import { useCreateExpense } from "@/lib/queries/useExpenses";
import { useSnackbar } from "@/lib/snackbar";

const group = {
  id: "g1",
  name: "Trip",
  group_members: [
    { user_id: "u1", profiles: { full_name: "Me" } },
    { user_id: "u2", profiles: { full_name: "Bob" } },
    { user_id: "u3", profiles: { full_name: "Cara" } },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockMutateAsync.mockResolvedValue({ id: "exp-1" });
  (router as unknown as { back: jest.Mock }).back = mockBack;
  (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" } });
  (useGroup as jest.Mock).mockReturnValue({ data: group });
  (useCreateExpense as jest.Mock).mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });
  (useSnackbar as jest.Mock).mockReturnValue({ showError: mockShowError });
});

describe("AddExpense screen", () => {
  it("shows a validation error and does not submit when the description is empty", async () => {
    await renderWithPaper(<AddExpense />);

    await fireEvent.press(screen.getByText("Add Expense"));

    expect(mockShowError).toHaveBeenCalledWith("Please enter a description");
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("shows a validation error for a non-positive amount", async () => {
    await renderWithPaper(<AddExpense />);

    await fireEvent.changeText(
      screen.getByPlaceholderText("What was this expense for?"),
      "Dinner"
    );
    await fireEvent.changeText(screen.getByPlaceholderText("0.00"), "0");

    await fireEvent.press(screen.getByText("Add Expense"));

    expect(mockShowError).toHaveBeenCalledWith("Please enter a valid amount");
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("submits an equal split and navigates back on success", async () => {
    await renderWithPaper(<AddExpense />);

    await fireEvent.changeText(
      screen.getByPlaceholderText("What was this expense for?"),
      "  Dinner  "
    );
    await fireEvent.changeText(screen.getByPlaceholderText("0.00"), "30");

    await fireEvent.press(screen.getByText("Add Expense"));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync).toHaveBeenCalledWith({
      groupId: "g1",
      paidBy: "u1",
      description: "Dinner",
      amount: 30,
      splitType: "equal",
      splits: [
        { userId: "u1", amount: 10 },
        { userId: "u2", amount: 10 },
        { userId: "u3", amount: 10 },
      ],
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it("surfaces a submit failure via the snackbar without navigating", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Network down"));
    await renderWithPaper(<AddExpense />);

    await fireEvent.changeText(
      screen.getByPlaceholderText("What was this expense for?"),
      "Dinner"
    );
    await fireEvent.changeText(screen.getByPlaceholderText("0.00"), "30");

    await fireEvent.press(screen.getByText("Add Expense"));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith("Network down")
    );
    expect(mockBack).not.toHaveBeenCalled();
  });

  async function fillBasics() {
    await fireEvent.changeText(
      screen.getByPlaceholderText("What was this expense for?"),
      "Dinner"
    );
    await fireEvent.changeText(screen.getByPlaceholderText("0.00"), "30");
  }

  it("submits an exact split with per-member amounts", async () => {
    await renderWithPaper(<AddExpense />);
    await fillBasics();

    await fireEvent.press(screen.getByText("Exact"));
    const inputs = screen.getAllByPlaceholderText("$0.00");
    await fireEvent.changeText(inputs[0], "10");
    await fireEvent.changeText(inputs[1], "12");
    await fireEvent.changeText(inputs[2], "8");

    await fireEvent.press(screen.getByText("Add Expense"));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        splitType: "exact",
        splits: [
          { userId: "u1", amount: 10 },
          { userId: "u2", amount: 12 },
          { userId: "u3", amount: 8 },
        ],
      })
    );
  });

  it("rejects an exact split that does not reconcile to the total", async () => {
    await renderWithPaper(<AddExpense />);
    await fillBasics();

    await fireEvent.press(screen.getByText("Exact"));
    const inputs = screen.getAllByPlaceholderText("$0.00");
    await fireEvent.changeText(inputs[0], "10");
    await fireEvent.changeText(inputs[1], "10");
    await fireEvent.changeText(inputs[2], "5");

    await fireEvent.press(screen.getByText("Add Expense"));

    expect(mockShowError).toHaveBeenCalledWith(
      "Split amounts ($25.00) don't add up to total ($30.00)"
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("submits a percentage split distributing the total", async () => {
    await renderWithPaper(<AddExpense />);
    await fillBasics();

    await fireEvent.press(screen.getByText("%"));
    const inputs = screen.getAllByPlaceholderText("%");
    await fireEvent.changeText(inputs[0], "50");
    await fireEvent.changeText(inputs[1], "30");
    await fireEvent.changeText(inputs[2], "20");

    await fireEvent.press(screen.getByText("Add Expense"));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        splitType: "percentage",
        splits: [
          { userId: "u1", amount: 15 },
          { userId: "u2", amount: 9 },
          { userId: "u3", amount: 6 },
        ],
      })
    );
  });

  it("rejects a percentage split that does not total 100%", async () => {
    await renderWithPaper(<AddExpense />);
    await fillBasics();

    await fireEvent.press(screen.getByText("%"));
    const inputs = screen.getAllByPlaceholderText("%");
    await fireEvent.changeText(inputs[0], "40");
    await fireEvent.changeText(inputs[1], "40");
    await fireEvent.changeText(inputs[2], "10");

    await fireEvent.press(screen.getByText("Add Expense"));

    expect(mockShowError).toHaveBeenCalledWith(
      "Percentages must add up to 100% (currently 90.0%)"
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
