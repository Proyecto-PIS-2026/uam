import { redirect } from "next/navigation";
import { obtenerSesion, type RolUsuario } from "../autenticacion/sesiones";
import {
    ErrorAutorizacion,
    exigirAdministrador,
    exigirOperador,
    exigirProductor,
    exigirConsultaMercadoPublico,
    redirigirOperadorAMiMercado,
    requerirAdministrador,
    requerirOperador,
    requerirProductor,
} from "./controles";

vi.mock("../autenticacion/sesiones", () => ({ obtenerSesion: vi.fn() }));
vi.mock("next/navigation", () => ({
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

const sesionMock = vi.mocked(obtenerSesion);

describe.each([
    { rol: "ADMINISTRADOR" as const, exigir: exigirAdministrador, requerir: requerirAdministrador },
    { rol: "OPERADOR" as const, exigir: exigirOperador, requerir: requerirOperador },
    { rol: "PRODUCTOR" as const, exigir: exigirProductor, requerir: requerirProductor },
])("autorización de $rol", ({ rol, exigir, requerir }) => {
    beforeEach(() => {
        vi.clearAllMocks();
        sesionMock.mockResolvedValue(null);
    });

    it("rechaza operaciones sin sesión con un estado 401", async () => {
        await expect(exigir()).rejects.toBeInstanceOf(ErrorAutorizacion);
        await expect(exigir()).rejects.toMatchObject({ status: 401 });
        expect(redirect).not.toHaveBeenCalled();
    });

    it.each(["ADMINISTRADOR", "OPERADOR", "PRODUCTOR"] as RolUsuario[])(
        "sólo acepta el rol autorizado frente a una sesión de %s",
        async (rolSesion) => {
            const sesion = { usuarioId: 10, rol: rolSesion, expiraEn: 2000000000 };
            sesionMock.mockResolvedValue(sesion);

            if (rolSesion === rol) {
                await expect(exigir()).resolves.toBe(sesion);
                await expect(requerir()).resolves.toBe(sesion);
            } else {
                await expect(exigir()).rejects.toMatchObject({ status: 403 });
                await expect(requerir()).rejects.toThrow("NEXT_REDIRECT");
                expect(redirect).toHaveBeenCalledWith(rolSesion === "OPERADOR" ? "/mi-mercado" : "/inicio");
            }
        },
    );

    it("envía las páginas a iniciar sesión cuando no hay sesión", async () => {
        await expect(requerir()).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledWith("/iniciar-sesion");
    });

    it("propaga errores de sesión sin tratarlos como una autorización válida", async () => {
        sesionMock.mockRejectedValue(new Error("Sesión no disponible"));
        await expect(requerir()).rejects.toThrow("Sesión no disponible");
        expect(redirect).not.toHaveBeenCalled();
    });
});

describe("acceso al mercado público", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sesionMock.mockResolvedValue(null);
    });

    it("redirige al operador a su mercado al abrir una página pública restringida", async () => {
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });

        await expect(redirigirOperadorAMiMercado()).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledExactlyOnceWith("/mi-mercado");
    });

    it("rechaza consultas públicas del operador con 403 sin redirigir la API", async () => {
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });

        await expect(exigirConsultaMercadoPublico()).rejects.toMatchObject({ name: "ErrorAutorizacion", status: 403 });
        expect(redirect).not.toHaveBeenCalled();
    });

    it.each([null, "ADMINISTRADOR", "PRODUCTOR"] as const)(
        "conserva las consultas y páginas públicas para %s",
        async (rol) => {
            sesionMock.mockResolvedValue(rol === null ? null : { usuarioId: 10, rol, expiraEn: 2000000000 });

            await expect(redirigirOperadorAMiMercado()).resolves.toBeUndefined();
            await expect(exigirConsultaMercadoPublico()).resolves.toBeUndefined();
            expect(redirect).not.toHaveBeenCalled();
        },
    );

    it("propaga los errores de sesión sin permitir consultar el mercado", async () => {
        sesionMock.mockRejectedValue(new Error("Sesión no disponible"));

        await expect(exigirConsultaMercadoPublico()).rejects.toThrow("Sesión no disponible");
        await expect(redirigirOperadorAMiMercado()).rejects.toThrow("Sesión no disponible");
        expect(redirect).not.toHaveBeenCalled();
    });
});

describe("acceso del productor a su mercado", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sesionMock.mockResolvedValue(null);
    });

    it("rechaza la consulta sin sesión", async () => {
        await expect(exigirProductor()).rejects.toMatchObject({ status: 401 });
        expect(redirect).not.toHaveBeenCalled();
    });

    it.each(["ADMINISTRADOR", "OPERADOR"] as const)("rechaza el rol %s", async (rol) => {
        sesionMock.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });

        await expect(exigirProductor()).rejects.toMatchObject({ status: 403 });
    });

    it("devuelve la sesión del productor autenticado", async () => {
        const sesion = { usuarioId: 10, rol: "PRODUCTOR" as const, expiraEn: 2000000000 };
        sesionMock.mockResolvedValue(sesion);

        await expect(exigirProductor()).resolves.toBe(sesion);
    });
});
