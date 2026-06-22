import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import EditProfile from "@/app/(tabs)/account/edit-profile";

const mockBack = jest.fn();
const mockUpdateAsync = jest.fn();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useProfile", () => ({ useUpdateProfile: jest.fn() }));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));

import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useUpdateProfile } from "@/lib/queries/useProfile";
import { useSnackbar } from "@/lib/snackbar";

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateAsync.mockResolvedValue(undefined);
  (router as unknown as { back: jest.Mock }).back = mockBack;
  (useAuth as jest.Mock).mockReturnValue({
    user: { email: "me@x.com", user_metadata: { full_name: "Alice" } },
  });
  (useUpdateProfile as jest.Mock).mockReturnValue({
    mutateAsync: mockUpdateAsync,
    isPending: false,
  });
  (useSnackbar as jest.Mock).mockReturnValue({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  });
});

describe("EditProfile screen", () => {
  it("does not submit when the name is unchanged (button disabled)", async () => {
    await renderWithPaper(<EditProfile />);

    await fireEvent.press(screen.getByText("Save Changes"));

    expect(mockUpdateAsync).not.toHaveBeenCalled();
  });

  it("rejects a blank name", async () => {
    await renderWithPaper(<EditProfile />);

    await fireEvent.changeText(screen.getByPlaceholderText("Your name"), "   ");
    await fireEvent.press(screen.getByText("Save Changes"));

    expect(mockShowError).toHaveBeenCalledWith("Please enter your name");
    expect(mockUpdateAsync).not.toHaveBeenCalled();
  });

  it("saves a trimmed name and navigates back", async () => {
    await renderWithPaper(<EditProfile />);

    await fireEvent.changeText(
      screen.getByPlaceholderText("Your name"),
      "  Bob  "
    );
    await fireEvent.press(screen.getByText("Save Changes"));

    await waitFor(() =>
      expect(mockUpdateAsync).toHaveBeenCalledWith({ fullName: "Bob" })
    );
    expect(mockShowSuccess).toHaveBeenCalledWith("Profile updated");
    expect(mockBack).toHaveBeenCalled();
  });

  it("surfaces an error when the update fails", async () => {
    mockUpdateAsync.mockRejectedValue({});
    await renderWithPaper(<EditProfile />);

    await fireEvent.changeText(screen.getByPlaceholderText("Your name"), "Bob");
    await fireEvent.press(screen.getByText("Save Changes"));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith(
        "Couldn't update your profile. Please try again."
      )
    );
    expect(mockBack).not.toHaveBeenCalled();
  });
});
