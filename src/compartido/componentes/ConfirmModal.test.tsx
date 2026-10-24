import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmModal } from "./ConfirmModal";

const showModalOriginal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");

describe("ConfirmModal dentro de otro diálogo", () => {
    beforeEach(() => {
        Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
            configurable: true,
            value: function (this: HTMLDialogElement) { this.open = true; },
        });
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        if (showModalOriginal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModalOriginal);
        else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    });

    it.each([false, true])("aísla Escape y respeta la cancelación con procesando=%s", (procesando) => {
        const teclaPadre = vi.fn();
        const cancelar = vi.fn();
        render(<dialog open onKeyDown={teclaPadre}>
            <ConfirmModal abierto titulo="Eliminar publicación" descripcion="Confirmar baja" procesando={procesando} alConfirmar={vi.fn()} alCancelar={cancelar} />
        </dialog>);

        const confirmacion = screen.getByRole("alertdialog");
        fireEvent.keyDown(confirmacion, { key: "Escape" });
        fireEvent(confirmacion, new Event("cancel", { cancelable: true }));

        expect(teclaPadre).not.toHaveBeenCalled();
        expect(cancelar).toHaveBeenCalledTimes(procesando ? 0 : 1);
    });

    it("el cierre nativo de la confirmación no cierra el diálogo padre", () => {
        const cerrarPadre = vi.fn();
        render(<dialog open onClose={cerrarPadre}>
            <ConfirmModal abierto titulo="Eliminar publicación" descripcion="Confirmar baja" alConfirmar={vi.fn()} alCancelar={vi.fn()} />
        </dialog>);

        fireEvent(screen.getByRole("alertdialog"), new Event("close"));

        expect(cerrarPadre).not.toHaveBeenCalled();
    });
});
