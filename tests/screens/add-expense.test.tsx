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
});
