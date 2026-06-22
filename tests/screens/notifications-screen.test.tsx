import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import Notifications from "@/app/(tabs)/account/notifications";

const mockSetPref = jest.fn();

jest.mock("@/lib/notifications", () => ({ useNotificationPrefs: jest.fn() }));

import { useNotificationPrefs } from "@/lib/notifications";

const allOnPrefs = {
  pushEnabled: true,
  newExpenses: true,
  settlements: true,
  groupInvites: true,
  paymentReminders: true,
};

function setHook(overrides?: Record<string, unknown>) {
  (useNotificationPrefs as jest.Mock).mockReturnValue({
    prefs: allOnPrefs,
    setPref: mockSetPref,
    loading: false,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setHook();
});

describe("Notifications screen", () => {
  it("shows a loading spinner while preferences load", async () => {
    setHook({ loading: true });
    const { toJSON } = await renderWithPaper(<Notifications />);

    expect(screen.queryByText("Push Notifications")).toBeNull();
    expect(toJSON()).toBeTruthy();
  });

  it("renders all preference rows when loaded", async () => {
    await renderWithPaper(<Notifications />);

    expect(screen.getByText("Push Notifications")).toBeTruthy();
    expect(screen.getByText("New Expenses")).toBeTruthy();
    expect(screen.getByText("Settlements")).toBeTruthy();
    expect(screen.getByText("Group Invites")).toBeTruthy();
    expect(screen.getByText("Payment Reminders")).toBeTruthy();
  });

  it("toggles a preference via its switch", async () => {
    await renderWithPaper(<Notifications />);

    const switches = screen.getAllByRole("switch");
    await fireEvent(switches[0], "valueChange", false);

    expect(mockSetPref).toHaveBeenCalledWith("pushEnabled", false);
  });

  it("disables activity switches when push is off", async () => {
    setHook({ prefs: { ...allOnPrefs, pushEnabled: false } });
    await renderWithPaper(<Notifications />);

    const switches = screen.getAllByRole("switch");
    // index 0 is the push toggle (enabled); the rest are disabled.
    expect(switches[0].props.disabled).toBeFalsy();
    expect(switches[1].props.disabled).toBe(true);
  });
});
