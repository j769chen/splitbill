import { fireEvent, screen } from "@testing-library/react-native";
import { Button } from "react-native-paper";
import { renderWithPaper } from "../helpers/testUtils";
import { SnackbarProvider, useSnackbar } from "@/lib/snackbar";

function Trigger() {
  const { showError, showSuccess, hide } = useSnackbar();
  return (
    <>
      <Button onPress={() => showError("Something failed")}>Error</Button>
      <Button onPress={() => showSuccess("Saved!")}>Success</Button>
      <Button onPress={hide}>Hide</Button>
    </>
  );
}

function renderWithSnackbar() {
  return renderWithPaper(
    <SnackbarProvider>
      <Trigger />
    </SnackbarProvider>
  );
}

describe("SnackbarProvider / useSnackbar", () => {
  it("shows an error message", async () => {
    await renderWithSnackbar();

    await fireEvent.press(screen.getByText("Error"));

    expect(screen.getByText("Something failed")).toBeTruthy();
  });

  it("shows a success message", async () => {
    await renderWithSnackbar();

    await fireEvent.press(screen.getByText("Success"));

    expect(screen.getByText("Saved!")).toBeTruthy();
  });

  it("renders a dismiss control that can be pressed", async () => {
    await renderWithSnackbar();

    await fireEvent.press(screen.getByText("Success"));
    expect(screen.getByText("Saved!")).toBeTruthy();

    const dismiss = screen.getByLabelText("Dismiss");
    expect(dismiss).toBeTruthy();
    await fireEvent.press(dismiss);
  });

  it("dismisses when the snackbar body is pressed", async () => {
    await renderWithSnackbar();

    await fireEvent.press(screen.getByText("Success"));
    expect(screen.getByText("Saved!")).toBeTruthy();

    const body = screen.getByTestId("snackbar-dismiss");
    expect(body.props.accessibilityRole).toBe("button");
    await fireEvent.press(body);
  });

  it("throws when used outside of a provider", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(renderWithPaper(<Trigger />)).rejects.toThrow();
    spy.mockRestore();
  });
});
