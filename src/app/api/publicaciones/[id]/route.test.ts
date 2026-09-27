import { beforeEach, describe, expect, it, vi } from "vitest";

const bajaPublicacionOperadorMock = vi.hoisted(() => vi.fn());

vi.mock("@/modulos/publicaciones/bajaPublicacionOperador", () => ({
	bajaPublicacionOperador: bajaPublicacionOperadorMock,
}));

import { DELETE } from "./route";

describe("DELETE /api/publicaciones/[id]", () => {
    it("devuelve 404 si la publicación no pertenece al operador", async () => {
        bajaPublicacionOperadorMock.mockResolvedValue(false);

        const solicitud = new Request(
            "http://localhost/api/publicaciones/15?operadorId=3"
        );

        const respuesta = await DELETE(solicitud, {
            params: Promise.resolve({ id: "15" }),
        });

        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(404);

        expect(bajaPublicacionOperadorMock).toHaveBeenCalledWith(15, 3);

        expect(cuerpo).toEqual({
            errores: ["La publicación no pertenece al operador seleccionado."],
        });
    });
    
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("devuelve 400 si la publicación no es válida", async () => {
		const solicitud = new Request(
			"http://localhost/api/publicaciones/abc?operadorId=3"
		);

		const respuesta = await DELETE(solicitud, {
			params: Promise.resolve({ id: "abc" }),
		});

		const cuerpo = await respuesta.json();

		expect(respuesta.status).toBe(400);
		expect(cuerpo).toEqual({
			errores: ["La publicación o el operador no son válidos."],
		});
		expect(bajaPublicacionOperadorMock).not.toHaveBeenCalled();
	});

    it("devuelve 200 si la publicación se elimina correctamente", async () => {
        bajaPublicacionOperadorMock.mockResolvedValue(true);

        const solicitud = new Request(
            "http://localhost/api/publicaciones/15?operadorId=3"
        );

        const respuesta = await DELETE(solicitud, {
            params: Promise.resolve({ id: "15" }),
        });

        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(200);

        expect(bajaPublicacionOperadorMock).toHaveBeenCalledWith(15, 3);

        expect(cuerpo).toEqual({
            mensaje: "Publicación eliminada.",
        });
    });

    it("devuelve 500 si ocurre un error inesperado", async () => {
        bajaPublicacionOperadorMock.mockRejectedValue(new Error("Error inesperado"));

        const solicitud = new Request(
            "http://localhost/api/publicaciones/15?operadorId=3"
        );

        const respuesta = await DELETE(solicitud, {
            params: Promise.resolve({ id: "15" }),
        });

        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(500);

        expect(bajaPublicacionOperadorMock).toHaveBeenCalledWith(15, 3);

        expect(cuerpo).toEqual({
            errores: ["No se pudo eliminar la publicación."],
        });
    });

});