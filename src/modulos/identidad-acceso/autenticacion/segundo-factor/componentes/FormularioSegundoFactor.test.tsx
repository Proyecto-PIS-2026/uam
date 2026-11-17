import { cleanup, fireEvent, render, screen, waitFor } from "@/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import FormularioSegundoFactor from "./FormularioSegundoFactor";

vi.mock("../acciones", () => ({ verificarSegundoFactor: vi.fn(async () => ({})), cancelarVerificacion: vi.fn() }));

const props = { vinculacion: true, correo: "admin@example.com", secreto: "JBSWY3DPEHPK3PXP", qr: "data:image/png;base64,iVBORw0KGgo=", expiraEn: Math.floor(Date.now() / 1000) + 600, intentosRestantes: 5 };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("formulario del segundo factor", () => {
    it("explica la vinculación, muestra el QR y ofrece una clave manual", () => {
        render(<FormularioSegundoFactor {...props} />);
        expect(screen.getByText(/Google Authenticator u otra aplicación compatible/)).toBeInTheDocument();
        expect(screen.getByAltText(/Código QR para vincular/)).toBeInTheDocument();
        fireEvent.click(screen.getByText("¿No podés escanearlo?"));
        expect(screen.getByText(props.secreto)).toBeVisible();
        expect(screen.getByText(/Basada en tiempo/)).toBeInTheDocument();
        expect(screen.getByLabelText("Código de verificación")).toHaveAttribute("autoComplete", "one-time-code");
        expect(screen.getByRole("button", { name: "Confirmar e ingresar" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /desactivar/i })).not.toBeInTheDocument();
    });

    it("la verificación posterior no muestra el QR ni la clave vinculada", () => {
        render(<FormularioSegundoFactor {...props} vinculacion={false} secreto={null} qr={null} />);
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.queryByText("Copiar clave")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Verificar e ingresar" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cancelar y volver al inicio de sesión" })).toHaveAttribute("formNoValidate");
    });
    it("acumula hasta tres confirmaciones al copiar la clave repetidamente", async () => {
        const copiar = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copiar } });
        render(<FormularioSegundoFactor {...props} />);
        fireEvent.click(screen.getByText("¿No podés escanearlo?"));
        let anteriores: HTMLElement[] = [];
        for (let intento = 1; intento <= 4; intento += 1) {
            fireEvent.click(screen.getByRole("button", { name: "Copiar clave" }));
            await waitFor(() => {
                const avisos = screen.getAllByRole("status");
                expect(avisos).toHaveLength(Math.min(intento, 3));
                anteriores.slice(-2).forEach((aviso, indice) => expect(avisos[indice]).toBe(aviso));
                expect(anteriores).not.toContain(avisos.at(-1));
            });
            anteriores = screen.getAllByRole("status");
            anteriores.forEach((aviso) => {
                expect(aviso).toHaveTextContent("Clave copiada.");
                expect(screen.getByRole("region", { name: "Notificaciones" })).toContainElement(aviso);
            });
        }
        expect(screen.getByText(props.secreto)).toBeVisible();
        expect(copiar).toHaveBeenCalledTimes(4);
        expect(copiar).toHaveBeenCalledWith(props.secreto);
    });
});
