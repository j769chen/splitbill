import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import ContactSettleUp from "@/app/contacts/settle-up";

const mockBack = jest.fn();
const mockCreateAsync = jest.fn();
const mockUpdateAsync = jest.fn();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
const mockParams: { contactUserId: string; paymentId?: string } = {
  contactUserId: "user-2",
};

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useContacts", () => ({
  useContacts: jest.fn(),
  useContactBalance: jest.fn(),
  useContactPayments: jest.fn(),
  useCreateContactPayment: jest.fn(),
  useUpdateContactPayment: jest.fn(),
}));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));

import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  useContacts,
  useContactBalance,
  useContactPayments,
  useCreateContactPayment,
  useUpdateContactPayment,
} from "@/lib/queries/useContacts";
import { useSnackbar } from "@/lib/snackbar";

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.contactUserId = "user-2";
  mockParams.paymentId = undefined;
  mockCreateAsync.mockResolvedValue({ id: "cp-1" });
  mockUpdateAsync.mockResolvedValue({ id: "cp-1" });
  (router as unknown as { back: jest.Mock }).back = mockBack;
  (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });
  (useContacts as jest.Mock).mockReturnValue({
    data: [{ contact_user_id: "user-2", full_name: "Bob", balance: 15 }],
  });
  (useContactBalance as jest.Mock).mockReturnValue({ data: 15 });
  (useContactPayments as jest.Mock).mockReturnValue({ data: [] });
  (useCreateContactPayment as jest.Mock).mockReturnValue({
    mutateAsync: mockCreateAsync,
    isPending: false,
  });
  (useUpdateContactPayment as jest.Mock).mockReturnValue({
    mutateAsync: mockUpdateAsync,
    isPending: false,
  });
  (useSnackbar as jest.Mock).mockReturnValue({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  });
});

describe("ContactSettleUp screen (create)", () => {
  it("defaults the amount to the outstanding balance", async () => {
    await renderWithPaper(<ContactSettleUp />);

    expect(screen.getByDisplayValue("15.00")).toBeTruthy();
    expect(screen.getByText("Bob owes you $15.00")).toBeTruthy();
  });

  it("records a payment from the contact when they owe you", async () => {
    await renderWithPaper(<ContactSettleUp />);

    await fireEvent.press(screen.getByText("Record Payment"));

    await waitFor(() => expect(mockCreateAsync).toHaveBeenCalledTimes(1));
    // balance > 0 => contact owes you => default direction is they paid you.
    expect(mockCreateAsync).toHaveBeenCalledWith({
      contactUserId: "user-2",
      paidBy: "user-2",
      paidTo: "user-1",
      amount: 15,
      note: undefined,
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it("rejects an invalid amount", async () => {
    await renderWithPaper(<ContactSettleUp />);

    await fireEvent.changeText(screen.getByDisplayValue("15.00"), "0");
    await fireEvent.press(screen.getByText("Record Payment"));

    expect(mockShowError).toHaveBeenCalledWith("Please enter a valid amount");
    expect(mockCreateAsync).not.toHaveBeenCalled();
  });
});

describe("ContactSettleUp screen (edit)", () => {
  beforeEach(() => {
    mockParams.paymentId = "cp-1";
    (useContactPayments as jest.Mock).mockReturnValue({
      data: [
        {
          id: "cp-1",
          paid_by: "user-1",
          paid_to: "user-2",
          amount: 8,
          note: "cash",
        },
      ],
    });
  });

  it("prefills from the existing payment and updates it", async () => {
    await renderWithPaper(<ContactSettleUp />);

    expect(screen.getByDisplayValue("8.00")).toBeTruthy();
    expect(screen.getByDisplayValue("cash")).toBeTruthy();

    await fireEvent.press(screen.getByText("Save Changes"));

    await waitFor(() => expect(mockUpdateAsync).toHaveBeenCalledTimes(1));
    expect(mockUpdateAsync).toHaveBeenCalledWith({
      paymentId: "cp-1",
      contactUserId: "user-2",
      paidBy: "user-1",
      paidTo: "user-2",
      amount: 8,
      note: "cash",
    });
  });
});
