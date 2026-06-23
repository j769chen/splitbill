import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithPaper } from "../helpers/testUtils";
import ContactRequests from "@/app/contacts/requests";

const mockRespondAsync = jest.fn();
const mockCancelAsync = jest.fn();
const mockRefetch = jest.fn().mockResolvedValue(undefined);
const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock("@/lib/queries/useContacts", () => ({
  useContactRequests: jest.fn(),
  useRespondContactRequest: jest.fn(),
  useCancelContactRequest: jest.fn(),
}));
jest.mock("@/lib/snackbar", () => ({ useSnackbar: jest.fn() }));

import {
  useContactRequests,
  useRespondContactRequest,
  useCancelContactRequest,
} from "@/lib/queries/useContacts";
import { useSnackbar } from "@/lib/snackbar";

const incomingFixture = {
  id: "req-1",
  direction: "incoming" as const,
  status: "pending" as const,
  created_at: "2026-01-02T00:00:00Z",
  profile: { id: "user-2", full_name: "Bob", avatar_url: null },
};

const outgoingFixture = {
  id: "req-2",
  direction: "outgoing" as const,
  status: "pending" as const,
  created_at: "2026-01-01T00:00:00Z",
  profile: { id: "user-3", full_name: "Carol", avatar_url: null },
};

function setup(data: {
  incoming?: typeof incomingFixture[];
  outgoing?: typeof outgoingFixture[];
}) {
  (useContactRequests as jest.Mock).mockReturnValue({
    data: { incoming: data.incoming ?? [], outgoing: data.outgoing ?? [] },
    refetch: mockRefetch,
    isLoading: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRespondAsync.mockResolvedValue(undefined);
  mockCancelAsync.mockResolvedValue(undefined);
  (useRespondContactRequest as jest.Mock).mockReturnValue({
    mutateAsync: mockRespondAsync,
    isPending: false,
  });
  (useCancelContactRequest as jest.Mock).mockReturnValue({
    mutateAsync: mockCancelAsync,
    isPending: false,
  });
  (useSnackbar as jest.Mock).mockReturnValue({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  });
});

describe("ContactRequests screen", () => {
  it("shows an empty state when there are no requests", async () => {
    setup({});
    await renderWithPaper(<ContactRequests />);

    expect(screen.getByText("No pending requests")).toBeTruthy();
  });

  it("renders incoming and outgoing requests", async () => {
    setup({ incoming: [incomingFixture], outgoing: [outgoingFixture] });
    await renderWithPaper(<ContactRequests />);

    expect(screen.getByText("Incoming")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("Sent")).toBeTruthy();
    expect(screen.getByText("Carol")).toBeTruthy();
  });

  it("accepts an incoming request", async () => {
    setup({ incoming: [incomingFixture] });
    await renderWithPaper(<ContactRequests />);

    await fireEvent.press(screen.getByText("Accept"));

    await waitFor(() =>
      expect(mockRespondAsync).toHaveBeenCalledWith({
        requestId: "req-1",
        accept: true,
      })
    );
    expect(mockShowSuccess).toHaveBeenCalledWith("Contact added");
  });

  it("declines an incoming request", async () => {
    setup({ incoming: [incomingFixture] });
    await renderWithPaper(<ContactRequests />);

    await fireEvent.press(screen.getByText("Decline"));

    await waitFor(() =>
      expect(mockRespondAsync).toHaveBeenCalledWith({
        requestId: "req-1",
        accept: false,
      })
    );
    expect(mockShowSuccess).toHaveBeenCalledWith("Request declined");
  });

  it("cancels an outgoing request", async () => {
    setup({ outgoing: [outgoingFixture] });
    await renderWithPaper(<ContactRequests />);

    await fireEvent.press(screen.getByText("Cancel"));

    await waitFor(() =>
      expect(mockCancelAsync).toHaveBeenCalledWith("req-2")
    );
    expect(mockShowSuccess).toHaveBeenCalledWith("Request cancelled");
  });

  it("surfaces an error when responding fails", async () => {
    mockRespondAsync.mockRejectedValueOnce(
      new Error("This request has already been handled")
    );
    setup({ incoming: [incomingFixture] });
    await renderWithPaper(<ContactRequests />);

    await fireEvent.press(screen.getByText("Accept"));

    await waitFor(() =>
      expect(mockShowError).toHaveBeenCalledWith(
        "This request has already been handled"
      )
    );
  });
});
