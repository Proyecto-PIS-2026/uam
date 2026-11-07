import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/test-utils";
import Formulario from "./FormularioCambioContrasena";
import { cambiarMiContrasena } from "./cambiarMiContrasena";
const m = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("./cambiarMiContrasena", () => ({ cambiarMiContrasena: vi.fn() }));
const accion = vi.mocked(cambiarMiContrasena);
function completar() {
    fireEvent.change(screen.getByLabelText("Contraseña actual", { exact: true }), { target: { value: "Anterior123" } });
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña/), { target: { value: "Nueva1234" } });
    fireEvent.change(screen.getByLabelText(/^Confirmar nueva contraseña/), { target: { value: "Nueva1234" } });
}
function guardar() { fireEvent.submit(screen.getByRole("form", { name: "Cambio de contraseña" })); }

describe("formulario independiente en mi perfil", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        accion.mockResolvedValue({ esValido: true, mensaje: "Tu contraseña se actualizó correctamente." });
    });
    it("presenta tres campos privados con autocompletado adecuado", () => {
        render(<Formulario volver="/mi-perfil/productor" />);
        const actual = screen.getByLabelText("Contraseña actual", { exact: true });
        expect(actual).toHaveAttribute("type", "password");
        expect(actual).toHaveAttribute("autocomplete", "current-password");
        for (const nombre of [/^Nueva contraseña/, /^Confirmar nueva contraseña/]) {
            const campo = screen.getByLabelText(nombre);
            expect(campo).toHaveAttribute("type", "password");
            expect(campo).toHaveAttribute("autocomplete", "new-password");
        }
    });
    it("valida antes de enviar", () => {
        render(<Formulario volver="/mi-perfil/productor" />);
        guardar();
        expect(screen.getByRole("alert")).toHaveTextContent("Ingresá tu contraseña actual.");
        expect(accion).not.toHaveBeenCalled();
    });
    it("informa confirmación distinta sin guardar", () => {
        render(<Formulario volver="/mi-perfil/productor" />);
        completar();
        fireEvent.change(screen.getByLabelText(/^Confirmar nueva contraseña/), { target: { value: "Distinta123" } });
        guardar();
        expect(screen.getByRole("alert")).toHaveTextContent("no coincide");
        expect(accion).not.toHaveBeenCalled();
    });
    it("envía únicamente contraseñas y borra los campos al confirmar el éxito", async () => {
        render(<Formulario volver="/mi-perfil/productor" />);
        completar(); guardar();
        expect(accion).toHaveBeenCalledExactlyOnceWith({ actual: "Anterior123", nueva: "Nueva1234", confirmacion: "Nueva1234" });
        expect(await screen.findByRole("status")).toHaveTextContent("se actualizó correctamente");
        expect(screen.getByLabelText("Contraseña actual", { exact: true })).toHaveValue("");
        expect(screen.getByLabelText(/^Nueva contraseña/)).toHaveValue("");
        expect(screen.getByLabelText(/^Confirmar nueva contraseña/)).toHaveValue("");
    });
    it("muestra el rechazo del servidor", async () => {
        accion.mockResolvedValue({ esValido: false, errores: ["La contraseña actual no es válida."] });
        render(<Formulario volver="/mi-perfil/productor" />);
        completar(); guardar();
        expect(await screen.findByRole("alert")).toHaveTextContent("La contraseña actual no es válida.");
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    it("permite reintentar después de una excepción", async () => {
        accion.mockRejectedValueOnce(new Error("sin conexión"));
        render(<Formulario volver="/mi-perfil/productor" />);
        completar(); guardar();
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cambiar");
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
        guardar();
        expect(await screen.findByRole("status")).toBeInTheDocument();
    });
    it("cancelar vuelve al perfil sin invocar el guardado", () => {
        render(<Formulario volver="/mi-perfil/productor" />);
        completar(); fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(m.push).toHaveBeenCalledWith("/mi-perfil/productor");
        expect(accion).not.toHaveBeenCalled();
    });
    it("bloquea envíos repetidos y cancelar durante el guardado", async () => {
        let resolver!: (valor: Awaited<ReturnType<typeof cambiarMiContrasena>>) => void;
        accion.mockReturnValue(new Promise(resolve => { resolver = resolve; }));
        render(<Formulario volver="/mi-perfil" />);
        completar(); guardar(); guardar();
        expect(accion).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
        expect(screen.getByLabelText("Contraseña actual", { exact: true })).toBeDisabled();
        resolver({ esValido: true, mensaje: "Listo" });
        await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled());
    });
});
