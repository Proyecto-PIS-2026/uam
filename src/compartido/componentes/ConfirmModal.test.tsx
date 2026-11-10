import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmModal } from "./ConfirmModal";

afterEach(cleanup);

describe("ConfirmModal", () => {
    it.each([false, true])("aísla Escape del diálogo padre y respeta procesando=%s", (procesando) => {
        const teclaPadre = vi.fn();
        const cerrarPadre = vi.fn();
        const cancelar = vi.fn();
        render(<Dialog open onKeyDown={teclaPadre} onClose={cerrarPadre} aria-label="Publicación">
            <ConfirmModal abierto titulo="Eliminar publicación" descripcion="Confirmar baja" procesando={procesando} alConfirmar={vi.fn()} alCancelar={cancelar} />
        </Dialog>);

        fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });

        expect(teclaPadre).not.toHaveBeenCalled();
        expect(cerrarPadre).not.toHaveBeenCalled();
        expect(cancelar).toHaveBeenCalledTimes(procesando ? 0 : 1);
    });

    it.each([false, true])("el clic fuera solo cancela la confirmación si procesando=%s lo permite", (procesando) => {
        const clicPadre = vi.fn();
        const cancelar = vi.fn();
        render(<div onClick={clicPadre}>
            <ConfirmModal abierto titulo="Eliminar publicación" descripcion="Confirmar baja" procesando={procesando} alConfirmar={vi.fn()} alCancelar={cancelar} />
        </div>);

        const fondo = screen.getByRole("alertdialog").parentElement!;
        fireEvent.mouseDown(fondo);
        fireEvent.click(fondo);

        expect(clicPadre).not.toHaveBeenCalled();
        expect(cancelar).toHaveBeenCalledTimes(procesando ? 0 : 1);
    });

    it("describe la acción y permite confirmar sin activar la cancelación ni el padre", () => {
        const confirmar = vi.fn();
        const cancelar = vi.fn();
        const clicPadre = vi.fn();
        render(<div onClick={clicPadre}>
            <ConfirmModal abierto titulo="Eliminar publicación" descripcion="Se eliminará esta publicación" textoConfirmar="Eliminar" alConfirmar={confirmar} alCancelar={cancelar} />
        </div>);

        const confirmacion = screen.getByRole("alertdialog", { name: "Eliminar publicación" });
        expect(confirmacion).toHaveAccessibleDescription("Se eliminará esta publicación");
        expect(confirmacion).toHaveAttribute("aria-modal", "true");
        fireEvent.mouseDown(confirmacion);
        fireEvent.click(confirmacion);
        expect(cancelar).not.toHaveBeenCalled();
        fireEvent.click(within(confirmacion).getByRole("button", { name: "Eliminar" }));

        expect(confirmar).toHaveBeenCalledOnce();
        expect(cancelar).not.toHaveBeenCalled();
        expect(clicPadre).not.toHaveBeenCalled();
    });

    it("deshabilita ambas acciones mientras procesa", () => {
        const confirmar = vi.fn();
        const cancelar = vi.fn();
        render(<ConfirmModal abierto procesando titulo="Eliminar publicación" descripcion="Confirmar baja" alConfirmar={confirmar} alCancelar={cancelar} />);

        const botonCancelar = screen.getByRole("button", { name: "Cancelar" });
        const botonConfirmar = screen.getByRole("button", { name: "Eliminando..." });
        expect(botonCancelar).toBeDisabled();
        expect(botonConfirmar).toBeDisabled();
        fireEvent.click(botonCancelar);
        fireEvent.click(botonConfirmar);
        expect(confirmar).not.toHaveBeenCalled();
        expect(cancelar).not.toHaveBeenCalled();
    });

    it("enfoca Cancelar al abrir y devuelve el foco al disparador cuando se cierra", async () => {
        function Ejemplo() {
            const [abierto, setAbierto] = useState(false);
            return <>
                <button onClick={() => setAbierto(true)}>Solicitar eliminación</button>
                <ConfirmModal abierto={abierto} titulo="Eliminar publicación" descripcion="Confirmar baja" alConfirmar={vi.fn()} alCancelar={() => setAbierto(false)} />
            </>;
        }
        render(<Ejemplo />);
        const disparador = screen.getByRole("button", { name: "Solicitar eliminación" });
        disparador.focus();
        fireEvent.click(disparador);

        await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus());
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        expect(disparador).toHaveFocus();
    });
});
