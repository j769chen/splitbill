import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import AddGroupMembers from "@/app/(tabs)/groups/add-members";

const mockBack = jest.fn();
const mockAddAsync = jest.fn();
const mockCheckAsync = jest.fn();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ groupId: "g1" }),
}));
jest.mock("@/lib/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/queries/useGroups", () => ({
  useGroup: jest.fn(),
  useAddGroupMembers: jest.fn(),
  useCheckEmailExists: jest.fn(),
}));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));

import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  useGroup,
  useAddGroupMembers,
  useCheckEmailExists,
} from "@/lib/queries/useGroups";
import { useSnackbar } from "@/lib/snackbar";

const EMAIL_PLACEHOLDER = "friend@example.com";

async function addEmail(email: string) {
  await fireEvent.changeText(
    screen.getByPlaceholderText(EMAIL_PLACEHOLDER),
    email
  );
  await fireEvent(
    screen.getByPlaceholderText(EMAIL_PLACEHOLDER),
    "submitEditing"
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAddAsync.mockResolvedValue(undefined);
  mockCheckAsync.mockResolvedValue(true);
  (router as unknown as { back: jest.Mock }).back = mockBack;
  (useAuth as jest.Mock).mockReturnValue({ user: { email: "me@x.com" } });
  (useGroup as jest.Mock).mockReturnValue({
    data: {
      id: "g1",
      name: "Trip",
      group_members: [{ user_id: "u1", profiles: { full_name: "Me" } }],
    },
  });
  (useAddGroupMembers as jest.Mock).mockReturnValue({
    mutateAsync: mockAddAsync,
    isPending: false,
  });
  (useCheckEmailExists as jest.Mock).mockReturnValue({
    mutateAsync: mockCheckAsync,
    isPending: false,
  });
  (useSnackbar as jest.Mock).mockReturnValue({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  });
});

describe("AddGroupMembers screen", () => {
  it("adds members and navigates back on success", async () => {
    await renderWithPaper(<AddGroupMembers />);

    await addEmail("bob@x.com");
    await waitFor(() => expect(screen.getByText("bob@x.com")).toBeTruthy());

    await fireEvent.press(screen.getByText("Add Members"));

    await waitFor(() =>
      expect(mockAddAsync).toHaveBeenCalledWith({
        groupId: "g1",
        memberEmails: ["bob@x.com"],
        existingMemberIds: ["u1"],
      })
    );
    expect(mockShowSuccess).toHaveBeenCalledWith("Member added");
    expect(mockBack).toHaveBeenCalled();
  });

  it("requires at least one email before adding members", async () => {
    await renderWithPaper(<AddGroupMembers />);

    await fireEvent.press(screen.getByText("Add Members"));

    expect(mockShowError).toHaveBeenCalledWith("Add at least one email to invite");
    expect(mockAddAsync).not.toHaveBeenCalled();
  });

  it("surfaces the block when adding someone already in the group", async () => {
    mockAddAsync.mockRejectedValue(
      new Error("Already in this group: bob@x.com")
    );
    await renderWithPaper(<AddGroupMembers />);

    await addEmail("bob@x.com");
    await waitFor(() => expect(screen.getByText("bob@x.com")).toBeTruthy());
    await fireEvent.press(screen.getByText("Add Members"));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith(
        "Already in this group: bob@x.com"
      )
    );
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("surfaces an error when adding members fails", async () => {
    mockAddAsync.mockRejectedValue({});
    await renderWithPaper(<AddGroupMembers />);

    await addEmail("bob@x.com");
    await waitFor(() => expect(screen.getByText("bob@x.com")).toBeTruthy());
    await fireEvent.press(screen.getByText("Add Members"));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith(
        "Couldn't add members. Please try again."
      )
    );
    expect(mockBack).not.toHaveBeenCalled();
  });
});
