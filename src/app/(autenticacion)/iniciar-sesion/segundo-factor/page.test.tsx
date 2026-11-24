import { cleanup, render, screen } from "@/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaginaSegundoFactor from "./page";

const mocks = vi.hoisted(() => ({
    obtenerToken: vi.fn(), obtenerPendiente: vi.fn(), obtenerUri: vi.fn(), generarQr: vi.fn(), redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("qrcode", () => ({ default: { toDataURL: mocks.generarQr } }));
vi.mock("@/modulos/identidad-acceso/autenticacion/segundo-factor/cookie-segundo-factor", () => ({ obtenerTokenSegundoFactor: mocks.obtenerToken }));
vi.mock("@/modulos/identidad-acceso/autenticacion/segundo-factor/segundo-factor", () => ({ obtenerSegundoFactorPendiente: mocks.obtenerPendiente }));
vi.mock("@/modulos/identidad-acceso/autenticacion/segundo-factor/segundo-factor-criptografia", () => ({ obtenerUriVinculacion: mocks.obtenerUri }));
vi.mock("../../../../modulos/identidad-acceso/autenticacion/segundo-factor/componentes/FormularioSegundoFactor", () => ({
    default: ({ correo, qr }: { correo: string; qr: string | null }) => (
        <div data-testid="formulario-segundo-factor" data-qr={qr ?? ""}>{correo}</div>
    ),
}));

const pendiente = {
    vinculacion: true,
    correo: "admin@example.com",
    secreto: "secreto-solo-de-prueba",
    expiraEn: 2_000_000_000,
    intentosRestantes: 5,
};

describe("PaginaSegundoFactor", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.obtenerToken.mockResolvedValue("token-servidor");
        mocks.obtenerPendiente.mockResolvedValue(pendiente);
        mocks.obtenerUri.mockReturnValue("uri-de-vinculacion");
        mocks.generarQr.mockResolvedValue("imagen-qr");
        mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    });
    afterEach(cleanup);

    it("informa que faltan los datos al no recibir la cookie sin consultar un pendiente", async () => {
        mocks.obtenerToken.mockResolvedValue("");

        await expect(PaginaSegundoFactor()).rejects.toThrow("NEXT_REDIRECT");

        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/iniciar-sesion?segundoFactor=sin-datos");
        expect(mocks.obtenerPendiente).not.toHaveBeenCalled();
        expect(mocks.generarQr).not.toHaveBeenCalled();
    });

    it("informa que el intento dejó de estar disponible cuando el token ya no tiene un pendiente", async () => {
        mocks.obtenerPendiente.mockResolvedValue(null);

        await expect(PaginaSegundoFactor()).rejects.toThrow("NEXT_REDIRECT");

        expect(mocks.obtenerPendiente).toHaveBeenCalledExactlyOnceWith("token-servidor");
        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/iniciar-sesion?segundoFactor=interrumpido");
        expect(mocks.generarQr).not.toHaveBeenCalled();
    });

    it("interrumpe una vinculación incompleta sin generar un QR", async () => {
        mocks.obtenerPendiente.mockResolvedValue({ ...pendiente, secreto: null });

        await expect(PaginaSegundoFactor()).rejects.toThrow("NEXT_REDIRECT");

        expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/iniciar-sesion?segundoFactor=interrumpido");
        expect(mocks.obtenerUri).not.toHaveBeenCalled();
        expect(mocks.generarQr).not.toHaveBeenCalled();
    });

    it("muestra la vinculación y genera el QR con los datos recuperados del servidor", async () => {
        render(await PaginaSegundoFactor());

        expect(screen.getByRole("heading", { name: "Configurá la verificación en dos pasos" })).toBeInTheDocument();
        expect(screen.getByTestId("formulario-segundo-factor")).toHaveTextContent(pendiente.correo);
        expect(screen.getByTestId("formulario-segundo-factor")).toHaveAttribute("data-qr", "imagen-qr");
        expect(mocks.obtenerUri).toHaveBeenCalledExactlyOnceWith(pendiente.secreto, pendiente.correo);
        expect(mocks.generarQr).toHaveBeenCalledExactlyOnceWith("uri-de-vinculacion", { width: 256, margin: 4 });
        expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("muestra la verificación de una cuenta vinculada sin generar otro QR", async () => {
        mocks.obtenerPendiente.mockResolvedValue({ ...pendiente, vinculacion: false, secreto: null });

        render(await PaginaSegundoFactor());

        expect(screen.getByRole("heading", { name: "Verificá tu identidad" })).toBeInTheDocument();
        expect(screen.getByTestId("formulario-segundo-factor")).toHaveAttribute("data-qr", "");
        expect(mocks.obtenerUri).not.toHaveBeenCalled();
        expect(mocks.generarQr).not.toHaveBeenCalled();
        expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("no convierte una falla del servidor en un aviso de vencimiento", async () => {
        const error = new Error("No se pudo consultar la verificación.");
        mocks.obtenerPendiente.mockRejectedValue(error);

        await expect(PaginaSegundoFactor()).rejects.toBe(error);

        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(mocks.generarQr).not.toHaveBeenCalled();
    });
});
