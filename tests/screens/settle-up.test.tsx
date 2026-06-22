import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import SettleUp from "@/app/(tabs)/groups/settle-up";

const mockBack = jest.fn();
const mockPayAsync = jest.fn();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ groupId: "g1" }),
}));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useBalances", () => ({ useGroupBalances: jest.fn() }));
jest.mock("@/lib/queries/usePayments", () => ({ useCreatePayment: jest.fn() }));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));

import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useGroupBalances } from "@/lib/queries/useBalances";
import { useCreatePayment } from "@/lib/queries/usePayments";
import { useSnackbar } from "@/lib/snackbar";

const owingBalances = [
  { user_id: "u1", full_name: "Me", balance: -20 },
  { user_id: "u2", full_name: "Bob", balance: 20 },
];

function setBalances(balances: unknown) {
  (useGroupBalances as jest.Mock).mockReturnValue({ data: balances });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPayAsync.mockResolvedValue({ id: "pay-1" });
  (router as unknown as { back: jest.Mock }).back = mockBack;
  (useAuth as jest.Mock).mockReturnValue({ user: { id: "u1" } });
  setBalances(owingBalances);
  (useCreatePayment as jest.Mock).mockReturnValue({
    mutateAsync: mockPayAsync,
    isPending: false,
  });
  (useSnackbar as jest.Mock).mockReturnValue({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  });
});

describe("SettleUp screen", () => {
  it("shows the settled-up message when there are no debts", async () => {
    setBalances([
      { user_id: "u1", full_name: "Me", balance: 0 },
      { user_id: "u2", full_name: "Bob", balance: 0 },
    ]);
    await renderWithPaper(<SettleUp />);

    expect(
      screen.getByText("You're all settled up in this group!")
    ).toBeTruthy();
  });

  it("records a payment for the selected debt with the auto-filled amount", async () => {
    await renderWithPaper(<SettleUp />);

    await fireEvent.press(screen.getByText("$20.00"));
    await fireEvent.press(screen.getByText("Record Payment"));

    await waitFor(() =>
      expect(mockPayAsync).toHaveBeenCalledWith({
        groupId: "g1",
        paidBy: "u1",
        paidTo: "u2",
        amount: 20,
        note: undefined,
      })
    );
    expect(mockShowSuccess).toHaveBeenCalledWith("Payment recorded!");
    expect(mockBack).toHaveBeenCalled();
  });

  it("includes a trimmed note when one is entered", async () => {
    await renderWithPaper(<SettleUp />);

    await fireEvent.press(screen.getByText("$20.00"));
    await fireEvent.changeText(
      screen.getByPlaceholderText("e.g., Venmo payment"),
      "  Venmo  "
    );
    await fireEvent.press(screen.getByText("Record Payment"));

    await waitFor(() =>
      expect(mockPayAsync).toHaveBeenCalledWith(
        expect.objectContaining({ note: "Venmo" })
      )
    );
  });

  it("rejects a non-positive amount", async () => {
    await renderWithPaper(<SettleUp />);

    await fireEvent.press(screen.getByText("$20.00"));
    await fireEvent.changeText(screen.getByPlaceholderText("0.00"), "-5");
    await fireEvent.press(screen.getByText("Record Payment"));

    expect(mockShowError).toHaveBeenCalledWith("Please enter a valid amount");
    expect(mockPayAsync).not.toHaveBeenCalled();
  });

  it("surfaces an error when recording the payment fails", async () => {
    mockPayAsync.mockRejectedValue({});
    await renderWithPaper(<SettleUp />);

    await fireEvent.press(screen.getByText("$20.00"));
    await fireEvent.press(screen.getByText("Record Payment"));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith(
        "Couldn't record payment. Please try again."
      )
    );
    expect(mockBack).not.toHaveBeenCalled();
  });
});
