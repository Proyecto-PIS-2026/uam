import { describe, expect, it, vi } from "vitest";
import { obtenerPublicaciones } from "./consultarPublicacion.action";
import { consultarPublicaciones } from "./publicaciones";

vi.mock("./publicaciones", () => ({
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
                    especie: "Tomate",
                    variedad: "Perita",
                    presentacion: "Cajón",
                    categoria: "Primera",
                    calibre: "Mediano",
                    codigoCalibre: "M",
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