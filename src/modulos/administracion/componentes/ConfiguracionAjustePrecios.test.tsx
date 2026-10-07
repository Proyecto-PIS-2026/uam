import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContenedorConfiguracion from "./ContenedorConfiguracion";
import ConfiguracionAjustePrecios from "./ConfiguracionAjustePrecios";
import { guardarConfiguracionAjustePrecios } from "../acciones-ajuste-precios";

vi.mock("../acciones-ajuste-precios", () => ({ guardarConfiguracionAjustePrecios: vi.fn() }));

describe("BP-18.2: configuración del ajuste rápido", () => {
    beforeEach(() => vi.resetAllMocks());

    it("muestra el importe vigente utilizando la clave de configuración existente", () => {
        render(<ContenedorConfiguracion configuracion={{ incremento_precio: "15" }} />);
        expect(screen.getByLabelText("Importe de ajuste ($)")).toHaveValue("15");
        expect(screen.getByText("Importe vigente: $15")).toBeInTheDocument();
    });

    it.each(["", "0", "-1", "1.5", "1,5", "abc", "1e2"])("impide guardar %j", async (valor) => {
        render(<ConfiguracionAjustePrecios valorInicial="10" />);
        fireEvent.change(screen.getByLabelText("Importe de ajuste ($)"), { target: { value: valor } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("entero mayor que cero");
        expect(guardarConfiguracionAjustePrecios).not.toHaveBeenCalled();
        expect(screen.getByText("Importe vigente: $10")).toBeInTheDocument();
    });

    it("cancela la edición y restaura el último importe guardado", () => {
        render(<ConfiguracionAjustePrecios valorInicial="10" />);
        fireEvent.change(screen.getByLabelText("Importe de ajuste ($)"), { target: { value: "25" } });
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(screen.getByLabelText("Importe de ajuste ($)")).toHaveValue("10");
        expect(guardarConfiguracionAjustePrecios).not.toHaveBeenCalled();
    });

    it("actualiza el importe vigente únicamente tras guardar correctamente", async () => {
        vi.mocked(guardarConfiguracionAjustePrecios).mockResolvedValue({ ok: true, importe: "25" });
        render(<ConfiguracionAjustePrecios valorInicial="10" />);
        fireEvent.change(screen.getByLabelText("Importe de ajuste ($)"), { target: { value: "25" } });
        expect(screen.getByText("Importe vigente: $10")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByRole("status")).toHaveTextContent("guardado correctamente");
        expect(guardarConfiguracionAjustePrecios).toHaveBeenCalledExactlyOnceWith("25");
        expect(screen.getByText("Importe vigente: $25")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Importe de ajuste ($)"), { target: { value: "30" } });
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(screen.getByLabelText("Importe de ajuste ($)")).toHaveValue("25");
    });

    it.each(["respuesta", "conexión"])("conserva la configuración anterior ante un fallo de %s", async (fallo) => {
        if (fallo === "respuesta") {
            vi.mocked(guardarConfiguracionAjustePrecios).mockResolvedValue({ ok: false, error: "No se pudo guardar el importe." });
        } else {
            vi.mocked(guardarConfiguracionAjustePrecios).mockRejectedValue(new Error("Sin conexión"));
        }
        render(<ConfiguracionAjustePrecios valorInicial="10" />);
        fireEvent.change(screen.getByLabelText("Importe de ajuste ($)"), { target: { value: "25" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar");
        expect(screen.getByText("Importe vigente: $10")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(screen.getByLabelText("Importe de ajuste ($)")).toHaveValue("10");
    });

    it("bloquea guardados duplicados mientras espera la respuesta", async () => {
        let terminar!: (valor: { ok: true; importe: string }) => void;
        vi.mocked(guardarConfiguracionAjustePrecios).mockReturnValue(new Promise((resolver) => { terminar = resolver; }));
        render(<ConfiguracionAjustePrecios valorInicial="10" />);
        fireEvent.change(screen.getByLabelText("Importe de ajuste ($)"), { target: { value: "25" } });
        const guardar = screen.getByRole("button", { name: "Guardar" });
        fireEvent.click(guardar);
        fireEvent.click(guardar);
        expect(guardar).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
        expect(guardarConfiguracionAjustePrecios).toHaveBeenCalledOnce();
        terminar({ ok: true, importe: "25" });
        await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled());
    });
});
