import { fireEvent, screen } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import GroupsList from "@/app/(tabs)/groups/index";

const mockPush = jest.fn();
const mockRefetch = jest.fn();

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/lib/queries/useGroups", () => ({ useGroups: jest.fn() }));

import { router } from "expo-router";
import { useGroups } from "@/lib/queries/useGroups";

function setGroups(overrides?: { data?: unknown; isLoading?: boolean }) {
  (useGroups as jest.Mock).mockReturnValue({
    data: overrides?.data ?? [],
    isLoading: overrides?.isLoading ?? false,
    refetch: mockRefetch,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRefetch.mockResolvedValue(undefined);
  (router as unknown as { push: jest.Mock }).push = mockPush;
  setGroups();
});

describe("GroupsList screen", () => {
  it("shows a spinner while loading", async () => {
    setGroups({ isLoading: true });
    await renderWithPaper(<GroupsList />);

    expect(screen.queryByText("No groups yet")).toBeNull();
  });

  it("shows the empty state when there are no groups", async () => {
    await renderWithPaper(<GroupsList />);

    expect(screen.getByText("No groups yet")).toBeTruthy();
    expect(screen.getByText("Tap + to create your first group")).toBeTruthy();
  });

  it("renders groups with correctly pluralized member counts", async () => {
    setGroups({
      data: [
        { id: "g1", name: "Trip", group_members: [{}, {}] },
        { id: "g2", name: "Lunch", group_members: [{}] },
      ],
    });
    await renderWithPaper(<GroupsList />);

    expect(screen.getByText("Trip")).toBeTruthy();
    expect(screen.getByText("2 members")).toBeTruthy();
    expect(screen.getByText("Lunch")).toBeTruthy();
    expect(screen.getByText("1 member")).toBeTruthy();
  });

  it("navigates to a group when its card is pressed", async () => {
    setGroups({ data: [{ id: "g1", name: "Trip", group_members: [{}] }] });
    await renderWithPaper(<GroupsList />);

    await fireEvent.press(screen.getByText("Trip"));

    expect(mockPush).toHaveBeenCalledWith("/(tabs)/groups/g1");
  });

  it("navigates to the create screen via the FAB", async () => {
    await renderWithPaper(<GroupsList />);

    // Empty state has no cards, so the only button is the FAB.
    await fireEvent.press(screen.getByRole("button"));

    expect(mockPush).toHaveBeenCalledWith("/group-create");
  });
});
