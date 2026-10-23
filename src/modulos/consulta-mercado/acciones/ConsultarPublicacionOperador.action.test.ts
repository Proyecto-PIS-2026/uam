import obtenerPublicaciones from "./ConsultarPublicacionOperador.action";
import { consultarPublicaciones } from "./PublicacionesOperador";

const obtenerSesionMock = vi.hoisted(() => vi.fn());

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: obtenerSesionMock,
}));

vi.mock("./PublicacionesOperador", () => ({
    consultarPublicaciones: vi.fn(),
}));

describe("obtenerPublicaciones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        obtenerSesionMock.mockResolvedValue(null);
    });

    it.each([null, "ADMINISTRADOR"] as const)("devuelve las publicaciones obtenidas para %s", async (rol) => {
        obtenerSesionMock.mockResolvedValue(rol ? { usuarioId: 10, rol, expiraEn: 2000000000 } : null);
        const resultado = {
            opciones: [], total: 1, totalCatalogo: 1,
            publicaciones: [
                {
                    id: 1,
                    precio: 150,
                    foto: "/tomate.jpg",
                    fecha: "2026-10-03T15:00:00.000Z",
                    especie: "Tomate",
                    variedad: "Perita",
                    presentacion: "Cajón",
                    categoria: "Primera",
                    calibre: "Mediano",
                    codigoCalibre: "M",
                    pais: "Uruguay",
                    tipoPublicacion: "OPERADOR" as const,
                    operador: {
                        id: 10,
                        nombreFantasia: "Huerta Sur",
                        whatsApp: "099123456",
                    },
                },
            ],
        };

        vi.mocked(consultarPublicaciones).mockResolvedValue(resultado);

        const respuesta = await obtenerPublicaciones();

        expect(respuesta).toEqual(resultado);
        expect(consultarPublicaciones).toHaveBeenCalledTimes(1);
    });

    it.each(["OPERADOR", "PRODUCTOR"] as const)("rechaza la consulta de %s antes de cargar publicaciones ajenas", async (rol) => {
        obtenerSesionMock.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });

        await expect(obtenerPublicaciones()).rejects.toMatchObject({ name: "ErrorAutorizacion", status: 403 });
        expect(consultarPublicaciones).not.toHaveBeenCalled();
    });

    it("propaga el error de consultarPublicaciones", async () => {
        const error = new Error("Error al consultar publicaciones");

        vi.mocked(consultarPublicaciones).mockRejectedValue(error);

        await expect(obtenerPublicaciones()).rejects.toBe(error);
    });
});
