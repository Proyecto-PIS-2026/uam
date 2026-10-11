import { obtenerSesion, type RolUsuario } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { actualizarConfiguracion, obtenerConfiguracion } from "@/modulos/administracion/ConsultaConfiguracion";
import { GET, PATCH } from "./route";

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: vi.fn() }));
vi.mock("@/modulos/administracion/ConsultaConfiguracion", () => ({
    actualizarConfiguracion: vi.fn(),
    obtenerConfiguracion: vi.fn(),
}));

const sesionMock = vi.mocked(obtenerSesion);
const actualizarMock = vi.mocked(actualizarConfiguracion);
const obtenerMock = vi.mocked(obtenerConfiguracion);

function solicitud(valor: string) {
    return new Request("http://localhost/api/configuracion/incremento_precio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor }),
    });
}

const contexto = { params: Promise.resolve({ nombre: "incremento_precio" }) };

describe("configuración general por API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sesionMock.mockResolvedValue(null);
        actualizarMock.mockImplementation(async (_nombre, valor) => valor);
        obtenerMock.mockResolvedValue("25");
    });

    it.each([
        { rol: null, estado: 401 },
        { rol: "OPERADOR", estado: 403 },
        { rol: "PRODUCTOR", estado: 403 },
    ] as const)("rechaza PATCH con rol $rol antes de leer o modificar datos", async ({ rol, estado }) => {
        if (rol) sesionMock.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });
        const request = solicitud("25");
        const leerCuerpo = vi.spyOn(request, "json");

        const respuesta = await PATCH(request, contexto);

        expect(respuesta.status).toBe(estado);
        expect(leerCuerpo).not.toHaveBeenCalled();
        expect(actualizarMock).not.toHaveBeenCalled();
        expect(obtenerMock).not.toHaveBeenCalled();
    });

    it("permite guardar la configuración con sesión de administrador", async () => {
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });

        const respuesta = await PATCH(solicitud("25"), contexto);

        expect(respuesta.status).toBe(200);
        expect(actualizarMock).toHaveBeenCalledWith("incremento_precio", "25");
        expect(await respuesta.json()).toMatchObject({ nombre: "incremento_precio", valor: "25" });
    });

    it("conserva la validación del incremento luego de autorizar al administrador", async () => {
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });

        const respuesta = await PATCH(solicitud("0"), contexto);

        expect(respuesta.status).toBe(400);
        expect(actualizarMock).not.toHaveBeenCalled();
    });

    it.each([null, "OPERADOR"] as (RolUsuario | null)[])(
        "mantiene disponible la consulta pública con rol %s",
        async (rol) => {
            if (rol) sesionMock.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });

            const respuesta = await GET(new Request("http://localhost/api/configuracion/incremento_precio"), contexto);

            expect(respuesta.status).toBe(200);
            expect(obtenerMock).toHaveBeenCalledWith("incremento_precio");
            expect(actualizarMock).not.toHaveBeenCalled();
        },
    );
});