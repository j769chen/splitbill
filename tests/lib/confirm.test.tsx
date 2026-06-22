import { fireEvent, screen } from "@testing-library/react-native";
import { Button } from "react-native-paper";
import { renderWithPaper } from "../helpers/testUtils";
import { ConfirmProvider, useConfirm, type ConfirmOptions } from "@/lib/confirm";

function Trigger({ options }: { options: ConfirmOptions }) {
  const confirm = useConfirm();
  return <Button onPress={() => confirm(options)}>Open</Button>;
}

function renderWithConfirm(options: ConfirmOptions) {
  return renderWithPaper(
    <ConfirmProvider>
      <Trigger options={options} />
    </ConfirmProvider>
  );
}

describe("ConfirmProvider / useConfirm", () => {
  it("shows the dialog title and message when confirm is called", async () => {
    await renderWithConfirm({
      title: "Delete expense?",
      message: "This cannot be undone.",
      onConfirm: jest.fn(),
    });

    await fireEvent.press(screen.getByText("Open"));

    expect(screen.getByText("Delete expense?")).toBeTruthy();
    expect(screen.getByText("This cannot be undone.")).toBeTruthy();
  });

  it("runs onConfirm and closes when the confirm action is pressed", async () => {
    const onConfirm = jest.fn();
    await renderWithConfirm({
      title: "Proceed?",
      confirmText: "Yes",
      onConfirm,
    });

    await fireEvent.press(screen.getByText("Open"));
    await fireEvent.press(screen.getByText("Yes"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Proceed?")).toBeNull();
  });

  it("does not run onConfirm when cancelled", async () => {
    const onConfirm = jest.fn();
    await renderWithConfirm({
      title: "Proceed?",
      cancelText: "Nope",
      onConfirm,
    });

    await fireEvent.press(screen.getByText("Open"));
    await fireEvent.press(screen.getByText("Nope"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText("Proceed?")).toBeNull();
  });
});
