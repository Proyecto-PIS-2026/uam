import obtenerPublicaciones from "./ConsultarPublicacion.action";
import { consultarPublicaciones } from "./Publicaciones";

vi.mock("./Publicaciones", () => ({
    consultarPublicaciones: vi.fn(),
}));

describe("obtenerPublicaciones", () => {
    it("devuelve las publicaciones obtenidas", async () => {
        const resultado = {
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

    it("propaga el error de consultarPublicaciones", async () => {
        const error = new Error("Error al consultar publicaciones");

        vi.mocked(consultarPublicaciones).mockRejectedValue(error);

        await expect(obtenerPublicaciones()).rejects.toBe(error);
    });
});
