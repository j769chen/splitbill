import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import AddContact from "@/app/contacts/add";

const mockBack = jest.fn();
const mockSendAsync = jest.fn();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useContacts", () => ({
  useSendContactRequest: jest.fn(),
}));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));

import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useSendContactRequest } from "@/lib/queries/useContacts";
import { useSnackbar } from "@/lib/snackbar";

const EMAIL_PLACEHOLDER = "friend@example.com";

beforeEach(() => {
  jest.clearAllMocks();
  mockSendAsync.mockResolvedValue("user-2");
  (router as unknown as { back: jest.Mock }).back = mockBack;
  (useAuth as jest.Mock).mockReturnValue({ user: { email: "me@x.com" } });
  (useSendContactRequest as jest.Mock).mockReturnValue({
    mutateAsync: mockSendAsync,
    isPending: false,
  });
  (useSnackbar as jest.Mock).mockReturnValue({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  });
});

describe("AddContact screen", () => {
  it("requires an email address", async () => {
    await renderWithPaper(<AddContact />);

    await fireEvent.press(screen.getByText("Send Request"));

    expect(mockShowError).toHaveBeenCalledWith("Please enter an email address");
    expect(mockSendAsync).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format", async () => {
    await renderWithPaper(<AddContact />);

    await fireEvent.changeText(
      screen.getByPlaceholderText(EMAIL_PLACEHOLDER),
      "not-an-email"
    );
    await fireEvent.press(screen.getByText("Send Request"));

    expect(mockShowError).toHaveBeenCalledWith(
      "Please enter a valid email address"
    );
    expect(mockSendAsync).not.toHaveBeenCalled();
  });

  it("rejects the current user's own email", async () => {
    await renderWithPaper(<AddContact />);

    await fireEvent.changeText(
      screen.getByPlaceholderText(EMAIL_PLACEHOLDER),
      "me@x.com"
    );
    await fireEvent.press(screen.getByText("Send Request"));

    expect(mockShowError).toHaveBeenCalledWith(
      "You can't add yourself as a contact"
    );
    expect(mockSendAsync).not.toHaveBeenCalled();
  });

  it("sends the request and navigates back on success", async () => {
    await renderWithPaper(<AddContact />);

    await fireEvent.changeText(
      screen.getByPlaceholderText(EMAIL_PLACEHOLDER),
      "  Bob@X.com "
    );
    await fireEvent.press(screen.getByText("Send Request"));

    await waitFor(() =>
      expect(mockSendAsync).toHaveBeenCalledWith("bob@x.com")
    );
    expect(mockShowSuccess).toHaveBeenCalledWith("Request sent");
    expect(mockBack).toHaveBeenCalled();
  });

  it("shows an error when the person is already a contact", async () => {
    mockSendAsync.mockRejectedValueOnce(
      new Error("This person is already a contact")
    );
    await renderWithPaper(<AddContact />);

    await fireEvent.changeText(
      screen.getByPlaceholderText(EMAIL_PLACEHOLDER),
      "bob@x.com"
    );
    await fireEvent.press(screen.getByText("Send Request"));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith(
        "This person is already a contact"
      )
    );
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("surfaces an error when sending the request fails", async () => {
    mockSendAsync.mockRejectedValueOnce(new Error("No SplitBill account found"));
    await renderWithPaper(<AddContact />);

    await fireEvent.changeText(
      screen.getByPlaceholderText(EMAIL_PLACEHOLDER),
      "ghost@x.com"
    );
    await fireEvent.press(screen.getByText("Send Request"));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith("No SplitBill account found")
    );
    expect(mockBack).not.toHaveBeenCalled();
  });
});
