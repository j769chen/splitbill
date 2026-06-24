import { fireEvent, screen } from "@testing-library/react-native";
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
  it("toggles a preference via its switch", async () => {
    await renderWithPaper(<Notifications />);

    const switches = screen.getAllByRole("switch");
    await fireEvent(switches[0], "valueChange", false);

    expect(mockSetPref).toHaveBeenCalledWith("pushEnabled", false);
  });
});
