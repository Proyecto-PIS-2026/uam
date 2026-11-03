import { cleanup, fireEvent, render, screen } from "@/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import FormularioSegundoFactor from "./formularioSegundoFactor";

vi.mock("./acciones", () => ({ verificarSegundoFactor: vi.fn(async () => ({})), cancelarVerificacion: vi.fn() }));

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
    it("copia la clave y confirma la operación", async () => {
        const copiar = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copiar } });
        render(<FormularioSegundoFactor {...props} />);
        fireEvent.click(screen.getByText("¿No podés escanearlo?"));
        fireEvent.click(screen.getByRole("button", { name: "Copiar clave" }));
        expect(await screen.findByText("Clave copiada.")).toBeInTheDocument();
        expect(copiar).toHaveBeenCalledWith(props.secreto);
    });
});
