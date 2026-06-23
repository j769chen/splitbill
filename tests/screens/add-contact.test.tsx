import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import AddContact from "@/app/contacts/add";

const mockBack = jest.fn();
const mockAddAsync = jest.fn();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useContacts", () => ({ useAddContact: jest.fn() }));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));

import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useAddContact } from "@/lib/queries/useContacts";
import { useSnackbar } from "@/lib/snackbar";

const EMAIL_PLACEHOLDER = "friend@example.com";

beforeEach(() => {
  jest.clearAllMocks();
  mockAddAsync.mockResolvedValue("user-2");
  (router as unknown as { back: jest.Mock }).back = mockBack;
  (useAuth as jest.Mock).mockReturnValue({ user: { email: "me@x.com" } });
  (useAddContact as jest.Mock).mockReturnValue({
    mutateAsync: mockAddAsync,
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

    await fireEvent.press(screen.getByText("Add Contact"));

    expect(mockShowError).toHaveBeenCalledWith("Please enter an email address");
    expect(mockAddAsync).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format", async () => {
    await renderWithPaper(<AddContact />);

    await fireEvent.changeText(
      screen.getByPlaceholderText(EMAIL_PLACEHOLDER),
      "not-an-email"
    );
    await fireEvent.press(screen.getByText("Add Contact"));

    expect(mockShowError).toHaveBeenCalledWith(
      "Please enter a valid email address"
    );
    expect(mockAddAsync).not.toHaveBeenCalled();
  });

  it("rejects the current user's own email", async () => {
    await renderWithPaper(<AddContact />);

    await fireEvent.changeText(
      screen.getByPlaceholderText(EMAIL_PLACEHOLDER),
      "me@x.com"
    );
    await fireEvent.press(screen.getByText("Add Contact"));

    expect(mockShowError).toHaveBeenCalledWith(
      "You can't add yourself as a contact"
    );
    expect(mockAddAsync).not.toHaveBeenCalled();
  });

  it("adds the contact and navigates back on success", async () => {
    await renderWithPaper(<AddContact />);

    await fireEvent.changeText(
      screen.getByPlaceholderText(EMAIL_PLACEHOLDER),
      "  Bob@X.com "
    );
    await fireEvent.press(screen.getByText("Add Contact"));

    await waitFor(() =>
      expect(mockAddAsync).toHaveBeenCalledWith("bob@x.com")
    );
    expect(mockShowSuccess).toHaveBeenCalledWith("Contact added");
    expect(mockBack).toHaveBeenCalled();
  });

  it("shows an error when the contact is already added", async () => {
    mockAddAsync.mockRejectedValueOnce(
      new Error("This contact is already added")
    );
    await renderWithPaper(<AddContact />);

    await fireEvent.changeText(
      screen.getByPlaceholderText(EMAIL_PLACEHOLDER),
      "bob@x.com"
    );
    await fireEvent.press(screen.getByText("Add Contact"));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith("This contact is already added")
    );
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("surfaces an error when adding the contact fails", async () => {
    mockAddAsync.mockRejectedValueOnce(new Error("No SplitBill account found"));
    await renderWithPaper(<AddContact />);

    await fireEvent.changeText(
      screen.getByPlaceholderText(EMAIL_PLACEHOLDER),
      "ghost@x.com"
    );
    await fireEvent.press(screen.getByText("Add Contact"));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith("No SplitBill account found")
    );
    expect(mockBack).not.toHaveBeenCalled();
  });
});
