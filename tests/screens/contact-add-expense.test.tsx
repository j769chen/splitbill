import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import AddContactExpense from "@/app/contacts/add-expense";

const mockBack = jest.fn();
const mockMutateAsync = jest.fn();
const mockShowError = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ contactUserId: "user-2" }),
}));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useContacts", () => ({
  useContacts: jest.fn(),
  useCreateContactExpense: jest.fn(),
}));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));

import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useContacts, useCreateContactExpense } from "@/lib/queries/useContacts";
import { useSnackbar } from "@/lib/snackbar";

beforeEach(() => {
  jest.clearAllMocks();
  mockMutateAsync.mockResolvedValue({ id: "ce-1" });
  (router as unknown as { back: jest.Mock }).back = mockBack;
  (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });
  (useContacts as jest.Mock).mockReturnValue({
    data: [{ contact_user_id: "user-2", full_name: "Bob", balance: 0 }],
  });
  (useCreateContactExpense as jest.Mock).mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });
  (useSnackbar as jest.Mock).mockReturnValue({ showError: mockShowError });
});

describe("AddContactExpense screen", () => {
  it("validates an empty description", async () => {
    await renderWithPaper(<AddContactExpense />);

    await fireEvent.press(screen.getByText("Add Expense"));

    expect(mockShowError).toHaveBeenCalledWith("Please enter a description");
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("validates a non-positive amount", async () => {
    await renderWithPaper(<AddContactExpense />);

    await fireEvent.changeText(
      screen.getByPlaceholderText("What was this expense for?"),
      "Coffee"
    );
    await fireEvent.changeText(screen.getByPlaceholderText("0.00"), "0");
    await fireEvent.press(screen.getByText("Add Expense"));

    expect(mockShowError).toHaveBeenCalledWith("Please enter a valid amount");
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("submits an equal split between you and the contact", async () => {
    await renderWithPaper(<AddContactExpense />);

    await fireEvent.changeText(
      screen.getByPlaceholderText("What was this expense for?"),
      "  Dinner  "
    );
    await fireEvent.changeText(screen.getByPlaceholderText("0.00"), "30");

    await fireEvent.press(screen.getByText("Add Expense"));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync).toHaveBeenCalledWith({
      contactUserId: "user-2",
      paidBy: "user-1",
      description: "Dinner",
      amount: 30,
      splitType: "equal",
      splits: [
        { userId: "user-1", amount: 15 },
        { userId: "user-2", amount: 15 },
      ],
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it("surfaces a submit failure without navigating", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Network down"));
    await renderWithPaper(<AddContactExpense />);

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
