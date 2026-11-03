import { redirect } from "next/navigation";
import { obtenerSesion, type RolUsuario } from "../autenticacion/sesiones";
import {
    ErrorAutorizacion,
    exigirAdministrador,
    exigirOperador,
    exigirProductor,
    exigirConsultaMercadoPublico,
    redirigirAMercadoPropio,
    redirigirProductorAMiMercado,
    requerirAdministrador,
    requerirOperador,
    exigirConsultaProductores,
    requerirConsultaProductores,
    exigirConsultaMercadoOperador,
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
                const destinos = { OPERADOR: "/mi-mercado", PRODUCTOR: "/mi-mercado/productor", ADMINISTRADOR: "/inicio" };
                expect(redirect).toHaveBeenCalledWith(destinos[rolSesion]);
            }
        },
    );

    it("envía las páginas a iniciar sesión cuando no hay sesión", async () => {
        await expect(requerir()).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledWith("/sesion-finalizada");
    });

    it("propaga fallas de sesión sin convertirlas en un 401 ni redirigir al inicio de sesión", async () => {
        const error = new Error("No pudimos verificar tu sesión. Intentá nuevamente.");
        sesionMock.mockRejectedValue(error);

        await expect(exigir()).rejects.toBe(error);
        await expect(requerir()).rejects.toBe(error);
        expect(redirect).not.toHaveBeenCalled();
    });
});

describe("acceso al mercado público", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sesionMock.mockResolvedValue(null);
    });

    it.each([
        { rol: "OPERADOR", destino: "/mi-mercado" },
        { rol: "PRODUCTOR", destino: "/mi-mercado/productor" },
    ] as const)("redirige a $rol a su mercado al abrir una página pública restringida", async ({ rol, destino }) => {
        sesionMock.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });

        await expect(redirigirAMercadoPropio()).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledExactlyOnceWith(destino);
        expect(sesionMock).toHaveBeenCalledOnce();
    });

    it.each(["OPERADOR", "PRODUCTOR"] as const)("rechaza consultas públicas de %s con 403 sin redirigir la API", async (rol) => {
        sesionMock.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });

        await expect(exigirConsultaMercadoPublico()).rejects.toMatchObject({ name: "ErrorAutorizacion", status: 403 });
        expect(redirect).not.toHaveBeenCalled();
    });

    it.each([null, "ADMINISTRADOR"] as const)(
        "conserva las consultas y páginas públicas para %s",
        async (rol) => {
            const sesion = rol === null ? null : { usuarioId: 10, rol, expiraEn: 2000000000 };
            sesionMock.mockResolvedValue(sesion);

            await expect(redirigirAMercadoPropio()).resolves.toBe(sesion);
            await expect(exigirConsultaMercadoPublico()).resolves.toBeUndefined();
            expect(redirect).not.toHaveBeenCalled();
        },
    );

    it("propaga los errores de sesión sin permitir consultar el mercado", async () => {
        sesionMock.mockRejectedValue(new Error("Sesión no disponible"));

        await expect(exigirConsultaMercadoPublico()).rejects.toThrow("Sesión no disponible");
        await expect(redirigirAMercadoPropio()).rejects.toThrow("Sesión no disponible");
        await expect(redirigirProductorAMiMercado()).rejects.toThrow("Sesión no disponible");
        expect(redirect).not.toHaveBeenCalled();
    });

    it("redirige al productor desde las páginas que conservan el acceso del operador", async () => {
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 });

        await expect(redirigirProductorAMiMercado()).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledExactlyOnceWith("/mi-mercado/productor");
        expect(sesionMock).toHaveBeenCalledOnce();
    });

    it.each([null, "ADMINISTRADOR", "OPERADOR"] as const)("la guarda exclusiva de productor conserva la sesión %s", async (rol) => {
        const sesion = rol === null ? null : { usuarioId: 10, rol, expiraEn: 2000000000 };
        sesionMock.mockResolvedValue(sesion);

        await expect(redirigirProductorAMiMercado()).resolves.toBe(sesion);
        expect(redirect).not.toHaveBeenCalled();
        expect(sesionMock).toHaveBeenCalledOnce();
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

describe("consulta de productores y sus publicaciones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sesionMock.mockResolvedValue(null);
    });

    it.each(["OPERADOR", "ADMINISTRADOR"] as const)("permite consultar al rol %s", async (rol) => {
            const sesion = {usuarioId: 10, rol, expiraEn: 2000000000};
            sesionMock.mockResolvedValue(sesion);
            await expect(exigirConsultaProductores()).resolves.toBe(sesion);
            await expect(requerirConsultaProductores()).resolves.toBe(sesion);
            await expect(exigirConsultaMercadoOperador()).resolves.toBeUndefined();
            expect(redirect).not.toHaveBeenCalled();
        },
    );

    it("rechaza consultas sin sesión con estado 401", async () => {
        await expect(exigirConsultaProductores()).rejects.toMatchObject({status: 401, message: "Iniciá sesión para continuar."});
        expect(redirect).not.toHaveBeenCalled();
    });

    it("redirige a iniciar sesión al acceder a una página sin sesión", async () => {
        await expect(requerirConsultaProductores()).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledExactlyOnceWith("/sesion-finalizada");
    });

    it.each([ "No tenés permiso para consultar productores.", "No tenés permiso para consultar el perfil del productor."])("rechaza al Productor con el mensaje: %s", async (mensaje) => {
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000});
        await expect(exigirConsultaProductores(mensaje)).rejects.toMatchObject({ status: 403, message: mensaje});
        expect(redirect).not.toHaveBeenCalled();
    });

    it("redirige al Productor a su mercado al acceder a una página restringida", async () => {
        sesionMock.mockResolvedValue({usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000});
        await expect(requerirConsultaProductores()).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledExactlyOnceWith("/mi-mercado/productor");
    });

    it("rechaza la consulta de publicaciones con su mensaje específico", async () => {
        sesionMock.mockResolvedValue({usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000});
        await expect(exigirConsultaMercadoOperador()).rejects.toMatchObject({status: 403, message: "No tenés permiso para consultar las publicaciones de productores."});
    });

    it("propaga errores al obtener la sesión", async () => {
        sesionMock.mockRejectedValue(new Error("Sesión no disponible"),);
        await expect(exigirConsultaProductores()).rejects.toThrow("Sesión no disponible");
        await expect(requerirConsultaProductores()).rejects.toThrow("Sesión no disponible");
        expect(redirect).not.toHaveBeenCalled();
    });
});
