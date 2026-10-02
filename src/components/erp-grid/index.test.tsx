// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErpGridProvider, NumberCell } from "./index";

function renderCell(props: {
  value: string;
  onChange: (value: number | string) => void | Promise<void>;
  onInput?: (value: number | string) => void;
}) {
  return render(
    <ErpGridProvider rowIds={["p1"]} colKeys={["dias"]} onPaste={() => {}}>
      <NumberCell
        rowId="p1"
        colKey="dias"
        value={props.value}
        onChange={props.onChange}
        onInput={props.onInput}
      />
    </ErpGridProvider>,
  );
}

describe("NumberCell", () => {
  it("mantém o valor digitado durante refetch enquanto a célula está focada", () => {
    const onChange = vi.fn();
    const onInput = vi.fn();
    const view = renderCell({ value: "0", onChange, onInput });
    const input = screen.getByRole("textbox") as HTMLInputElement;

    input.focus();
    fireEvent.change(input, { target: { value: "17" } });
    expect(input.value).toBe("17");
    expect(onInput).toHaveBeenLastCalledWith("17");

    view.rerender(
      <ErpGridProvider rowIds={["p1"]} colKeys={["dias"]} onPaste={() => {}}>
        <NumberCell
          rowId="p1"
          colKey="dias"
          value="0"
          onChange={onChange}
          onInput={onInput}
        />
      </ErpGridProvider>,
    );

    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("17");
  });

  it("faz commit no blur sem exigir onInput, preservando compatibilidade", async () => {
    const onChange = vi.fn();
    renderCell({ value: "0", onChange });
    const input = screen.getByRole("textbox") as HTMLInputElement;

    input.focus();
    fireEvent.change(input, { target: { value: "23" } });
    expect(input.value).toBe("23");

    fireEvent.blur(input);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("23");
    });
  });

  it("não faz commit ao apenas focar e sair sem editar", async () => {
    const onChange = vi.fn();
    renderCell({ value: "8", onChange });
    const input = screen.getByRole("textbox") as HTMLInputElement;

    input.focus();
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
