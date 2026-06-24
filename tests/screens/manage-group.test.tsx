import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import ManageGroup from "@/app/(tabs)/groups/manage";

const mockRenameAsync = jest.fn();
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ groupId: "g1" }),
}));
jest.mock("@/lib/queries/useGroups", () => ({
  useGroup: jest.fn(),
  useRenameGroup: jest.fn(),
}));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));

import {
  useGroup,
  useRenameGroup,
} from "@/lib/queries/useGroups";
import { useSnackbar } from "@/lib/snackbar";

beforeEach(() => {
  jest.clearAllMocks();
  mockRenameAsync.mockResolvedValue({ id: "g1", name: "Ski Trip" });
  (useGroup as jest.Mock).mockReturnValue({
    data: {
      id: "g1",
      name: "Trip",
      group_members: [{ user_id: "u1", profiles: { full_name: "Me" } }],
    },
  });
  (useRenameGroup as jest.Mock).mockReturnValue({
    mutateAsync: mockRenameAsync,
    isPending: false,
  });
  (useSnackbar as jest.Mock).mockReturnValue({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  });
});

describe("ManageGroup screen", () => {
  it("prefills the current name and renames the group", async () => {
    await renderWithPaper(<ManageGroup />);

    await fireEvent.changeText(screen.getByDisplayValue("Trip"), "Ski Trip");
    await fireEvent.press(screen.getByText("Save Name"));

    await waitFor(() =>
      expect(mockRenameAsync).toHaveBeenCalledWith({
        groupId: "g1",
        name: "Ski Trip",
      })
    );
    expect(mockShowSuccess).toHaveBeenCalledWith("Group renamed");
  });

  it("rejects renaming to the unchanged name", async () => {
    await renderWithPaper(<ManageGroup />);

    await fireEvent.press(screen.getByText("Save Name"));

    expect(mockShowError).toHaveBeenCalledWith("That's already the group name");
    expect(mockRenameAsync).not.toHaveBeenCalled();
  });

  it("rejects a blank name", async () => {
    await renderWithPaper(<ManageGroup />);

    await fireEvent.changeText(screen.getByDisplayValue("Trip"), "   ");
    await fireEvent.press(screen.getByText("Save Name"));

    expect(mockShowError).toHaveBeenCalledWith("Please enter a group name");
    expect(mockRenameAsync).not.toHaveBeenCalled();
  });

  it("no longer hosts the add-members UI", async () => {
    await renderWithPaper(<ManageGroup />);

    expect(screen.queryByText("Add Members")).toBeNull();
  });
});
