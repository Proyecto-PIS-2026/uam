// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";

const bajaPublicacionOperadorMock = vi.hoisted(() => vi.fn());
const obtenerSesionMock = vi.hoisted(() => vi.fn<() => Promise<DatosSesion | null>>(() => Promise.resolve({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 })));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: obtenerSesionMock }));
const obtenerOperadorAutorizadoMock = vi.hoisted(() => vi.fn());
const obtenerOperadorPorIdMock = vi.hoisted(() => vi.fn());
const vinculoPublicacionMock = vi.hoisted(() => ({
	select: vi.fn(),
	where: vi.fn(),
	first: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modulos/usuarios/operadores/operador-actual", () => ({
	obtenerOperadorAutorizado: obtenerOperadorAutorizadoMock,
	obtenerOperadorPorId: obtenerOperadorPorIdMock,
}));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
	db: { orm: { public: { PublicacionOperador: vinculoPublicacionMock } } },
}));
vi.mock("@/modulos/publicaciones/operadores/modificar-publicacion", () => ({
	modificarPublicacionOperador: vi.fn(),
	ErrorEdicionPublicacion: class extends Error {
		constructor(public readonly codigo: "DATOS_INVALIDOS" | "NO_ENCONTRADA", mensaje: string) {
			super(mensaje);
		}
	},
}));

vi.mock("@/modulos/publicaciones/bajaPublicacionOperador", () => ({
	bajaPublicacionOperador: bajaPublicacionOperadorMock,
}));

import { revalidatePath } from "next/cache";
import { obtenerOperadorAutorizado } from "@/modulos/usuarios/operadores/operador-actual";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { ErrorEdicionPublicacion, modificarPublicacionOperador } from "@/modulos/publicaciones/operadores/modificar-publicacion";
import { DELETE, PATCH } from "./route";

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
		obtenerSesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
		obtenerOperadorAutorizadoMock.mockResolvedValue({ id: 3, usuarioId: 10, nombreFantasia: "Operador 3" });
	});

    it.each([401, 403] as const)("devuelve %s sin eliminar cuando falla la autorización", async (status) => {
        obtenerOperadorAutorizadoMock.mockRejectedValue(new ErrorAutorizacion(status, "Acceso denegado."));
        const respuesta = await DELETE(new Request("http://localhost/api/publicaciones/15?operadorId=3"), { params: Promise.resolve({ id: "15" }) });
        expect(respuesta.status).toBe(status);
        expect(bajaPublicacionOperadorMock).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
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
        expect(obtenerOperadorAutorizado).toHaveBeenCalledExactlyOnceWith(3);
        expect(revalidatePath).toHaveBeenCalledWith("/mi-mercado/Operador%203");
        expect(revalidatePath).toHaveBeenCalledWith("/operadores/Operador%203");
    });

    it("confirma la eliminacion aunque falle una revalidacion posterior", async () => {
        bajaPublicacionOperadorMock.mockResolvedValue(true);
        vi.mocked(revalidatePath).mockImplementationOnce(() => { throw new Error("Fallo de cache"); });
        const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            const solicitud = new Request("http://localhost/api/publicaciones/15?operadorId=3");
            const respuesta = await DELETE(solicitud, { params: Promise.resolve({ id: "15" }) });

            expect(respuesta.status).toBe(200);
            expect(await respuesta.json()).toEqual({ mensaje: "Publicación eliminada." });
            expect(bajaPublicacionOperadorMock).toHaveBeenCalledExactlyOnceWith(15, 3);
            expect(revalidatePath).toHaveBeenCalledTimes(6);
            expect(revalidatePath).toHaveBeenCalledWith("/inicio");
            expect(registrarError).toHaveBeenCalledOnce();
        } finally {
            registrarError.mockRestore();
        }
    });

    it("usa el operador actual si no se indica un ID", async () => {
        bajaPublicacionOperadorMock.mockResolvedValue(true);
        const solicitud = new Request("http://localhost/api/publicaciones/15");

        const respuesta = await DELETE(solicitud, { params: Promise.resolve({ id: "15" }) });

        expect(respuesta.status).toBe(200);
        expect(obtenerOperadorAutorizado).toHaveBeenCalledOnce();
        expect(bajaPublicacionOperadorMock).toHaveBeenCalledWith(15, 3);
    });

    it("elimina usando el ID del operador propio indicado", async () => {
        obtenerOperadorAutorizadoMock.mockResolvedValue({ id: 7, usuarioId: 10, nombreFantasia: "Operador 7" });
        bajaPublicacionOperadorMock.mockResolvedValue(true);
        const solicitud = new Request("http://localhost/api/publicaciones/15?operadorId=7");

        const respuesta = await DELETE(solicitud, { params: Promise.resolve({ id: "15" }) });

        expect(respuesta.status).toBe(200);
        expect(obtenerOperadorAutorizado).toHaveBeenCalledExactlyOnceWith(7);
        expect(bajaPublicacionOperadorMock).toHaveBeenCalledWith(15, 7);
        expect(revalidatePath).toHaveBeenCalledWith("/mi-mercado/Operador%207");
        expect(revalidatePath).toHaveBeenCalledWith("/operadores/Operador%207");
    });

    it.each(["", "0", "-1", "1.5", "abc", "9007199254740992", "7&operadorId=8"])(
        "devuelve 400 para operadorId invalido: %s",
        async (operadorId) => {
            const solicitud = new Request(`http://localhost/api/publicaciones/15?operadorId=${operadorId}`);

            const respuesta = await DELETE(solicitud, { params: Promise.resolve({ id: "15" }) });

            expect(respuesta.status).toBe(400);
            expect(await respuesta.json()).toEqual({ errores: ["El operador no es válido."] });
            expect(obtenerOperadorAutorizado).not.toHaveBeenCalled();
            expect(bajaPublicacionOperadorMock).not.toHaveBeenCalled();
        },
    );

    it("devuelve 403 cuando el operador indicado es ajeno", async () => {
        obtenerOperadorAutorizadoMock.mockRejectedValue(new ErrorAutorizacion(403, "El operador no corresponde al usuario autenticado."));
        const solicitud = new Request("http://localhost/api/publicaciones/15?operadorId=7");

        const respuesta = await DELETE(solicitud, { params: Promise.resolve({ id: "15" }) });

        expect(respuesta.status).toBe(403);
        expect(await respuesta.json()).toEqual({ errores: ["El operador no corresponde al usuario autenticado."] });
        expect(bajaPublicacionOperadorMock).not.toHaveBeenCalled();
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

const cambiosEdicion = {
	precio: "125",
	foto: null,
	categoriaId: 4,
	calibreId: 2,
	presentacionId: 8,
	paisId: 218,
	disponible: true,
};

function solicitudEdicion(cambios: unknown = cambiosEdicion, fotografia?: File, operadorId?: string): Request {
	const formulario = new FormData();
	formulario.set("cambios", JSON.stringify(cambios));
	if (fotografia) formulario.set("fotografia", fotografia);
	const consulta = operadorId === undefined ? "" : `?operadorId=${operadorId}`;
	return new Request(`http://localhost/api/publicaciones/20${consulta}`, { method: "PATCH", body: formulario });
}

const contextoEdicion = { params: Promise.resolve({ id: "20" }) };

describe("PATCH /api/publicaciones/[id]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		obtenerSesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
		obtenerOperadorAutorizadoMock.mockResolvedValue({ id: 3, usuarioId: 10, nombreFantasia: "Operador 3" });
		vinculoPublicacionMock.select.mockReturnThis();
		vinculoPublicacionMock.where.mockReturnThis();
		vinculoPublicacionMock.first.mockResolvedValue({ id: 12 });
		vi.mocked(modificarPublicacionOperador).mockResolvedValue({ publicacionOperadorId: 12, publicacionId: 20 });
	});

    it.each([401, 403] as const)("devuelve %s sin modificar cuando falla la autorización", async (status) => {
        obtenerOperadorAutorizadoMock.mockRejectedValue(new ErrorAutorizacion(status, "Acceso denegado."));
        const respuesta = await PATCH(solicitudEdicion(), contextoEdicion);
        expect(respuesta.status).toBe(status);
        expect(vinculoPublicacionMock.first).not.toHaveBeenCalled();
        expect(modificarPublicacionOperador).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
    });

	it("propaga el país y el precio entero de los cambios multipart y actualiza las vistas", async () => {
		const respuesta = await PATCH(solicitudEdicion(), contextoEdicion);

		expect(respuesta.status).toBe(200);
		expect(await respuesta.json()).toEqual({
			publicacionOperadorId: 12,
			publicacionId: 20,
			mensaje: "Publicación modificada correctamente.",
		});
		expect(vinculoPublicacionMock.where).toHaveBeenCalledWith({ publicacionId: 20, operadorId: 3 });
		expect(modificarPublicacionOperador).toHaveBeenCalledExactlyOnceWith(10, 12, cambiosEdicion, null);
		expect(obtenerOperadorAutorizado).toHaveBeenCalledOnce();
		expect(revalidatePath).toHaveBeenCalledWith("/mi-mercado");
		expect(revalidatePath).toHaveBeenCalledWith("/mi-mercado/Operador%203");
		expect(revalidatePath).toHaveBeenCalledWith("/publicaciones");
		expect(revalidatePath).toHaveBeenCalledWith("/operadores/Operador%203");
		expect(revalidatePath).toHaveBeenCalledWith("/operadores");
		expect(revalidatePath).toHaveBeenCalledWith("/inicio");
	});

	it("confirma la edicion aunque falle una revalidacion posterior", async () => {
		vi.mocked(revalidatePath).mockImplementationOnce(() => { throw new Error("Fallo de cache"); });
		const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			const respuesta = await PATCH(solicitudEdicion(), contextoEdicion);

			expect(respuesta.status).toBe(200);
			expect(await respuesta.json()).toEqual({
				publicacionOperadorId: 12,
				publicacionId: 20,
				mensaje: "Publicación modificada correctamente.",
			});
			expect(modificarPublicacionOperador).toHaveBeenCalledOnce();
			expect(revalidatePath).toHaveBeenCalledTimes(6);
			expect(revalidatePath).toHaveBeenCalledWith("/inicio");
			expect(registrarError).toHaveBeenCalledOnce();
		} finally {
			registrarError.mockRestore();
		}
	});

	it("acepta la edición sin campo foto para conservar la imagen actual", async () => {
		const cambiosSinFoto = { precio: "125", categoriaId: 4, calibreId: 2, presentacionId: 8, paisId: 218, disponible: true };
		const respuesta = await PATCH(solicitudEdicion(cambiosSinFoto), contextoEdicion);
		expect(respuesta.status).toBe(200);
		expect(modificarPublicacionOperador).toHaveBeenCalledExactlyOnceWith(10, 12, cambiosSinFoto, null);
	});

	it("modifica la publicación usando el ID del operador propio indicado", async () => {
		obtenerOperadorAutorizadoMock.mockResolvedValue({ id: 7, usuarioId: 10, nombreFantasia: "Operador 7" });

		const respuesta = await PATCH(solicitudEdicion(cambiosEdicion, undefined, "7"), contextoEdicion);

		expect(respuesta.status).toBe(200);
		expect(obtenerOperadorAutorizado).toHaveBeenCalledExactlyOnceWith(7);
		expect(vinculoPublicacionMock.where).toHaveBeenCalledWith({ publicacionId: 20, operadorId: 7 });
		expect(modificarPublicacionOperador).toHaveBeenCalledExactlyOnceWith(10, 12, cambiosEdicion, null);
		expect(revalidatePath).toHaveBeenCalledWith("/mi-mercado/Operador%207");
		expect(revalidatePath).toHaveBeenCalledWith("/operadores/Operador%207");
	});

	it.each(["", "0", "-1", "1.5", "abc", "9007199254740992", "7&operadorId=8"])(
		"devuelve 400 para operadorId inválido: %s",
		async (operadorId) => {
			const respuesta = await PATCH(solicitudEdicion(cambiosEdicion, undefined, operadorId), contextoEdicion);

			expect(respuesta.status).toBe(400);
			expect(await respuesta.json()).toEqual({ errores: ["El operador no es válido."] });
			expect(obtenerOperadorAutorizado).not.toHaveBeenCalled();
			expect(modificarPublicacionOperador).not.toHaveBeenCalled();
		},
	);

	it("devuelve 403 cuando el operador indicado es ajeno", async () => {
		obtenerOperadorAutorizadoMock.mockRejectedValue(new ErrorAutorizacion(403, "El operador no corresponde al usuario autenticado."));
		const respuesta = await PATCH(solicitudEdicion(cambiosEdicion, undefined, "7"), contextoEdicion);

		expect(respuesta.status).toBe(403);
		expect(await respuesta.json()).toEqual({ errores: ["El operador no corresponde al usuario autenticado."] });
		expect(vinculoPublicacionMock.first).not.toHaveBeenCalled();
		expect(modificarPublicacionOperador).not.toHaveBeenCalled();
	});

	it("propaga la fotografía junto con el país seleccionado", async () => {
		const fotografia = new File(["foto simulada"], "nueva.jpg", { type: "image/jpeg" });
		const respuesta = await PATCH(solicitudEdicion(cambiosEdicion, fotografia), contextoEdicion);

		expect(respuesta.status).toBe(200);
		expect(modificarPublicacionOperador).toHaveBeenCalledExactlyOnceWith(
			10, 12, cambiosEdicion, expect.objectContaining({ name: "nueva.jpg", type: "image/jpeg", size: 13 }),
		);
	});

	it.each([undefined, null, "218", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
		"devuelve 400 para un país ausente o inválido: %s",
		async (paisId) => {
			const respuesta = await PATCH(solicitudEdicion({ ...cambiosEdicion, paisId }), contextoEdicion);

			expect(respuesta.status).toBe(400);
			expect(await respuesta.json()).toEqual({ errores: ["Los cambios no son válidos."] });
			expect(obtenerOperadorAutorizado).not.toHaveBeenCalled();
			expect(vinculoPublicacionMock.first).not.toHaveBeenCalled();
			expect(modificarPublicacionOperador).not.toHaveBeenCalled();
			expect(revalidatePath).not.toHaveBeenCalled();
		},
	);

	it("devuelve 400 cuando el país no existe", async () => {
		vi.mocked(modificarPublicacionOperador).mockRejectedValue(new ErrorEdicionPublicacion("DATOS_INVALIDOS", "El país no existe."));
		const respuesta = await PATCH(solicitudEdicion(), contextoEdicion);

		expect(respuesta.status).toBe(400);
		expect(await respuesta.json()).toEqual({ errores: ["El país no existe."] });
		expect(revalidatePath).not.toHaveBeenCalled();
	});

	it.each(["125.50", "125.00"])("devuelve el error de validación del precio decimal %s", async (precio) => {
		const mensaje = "El precio debe ser un número entero de hasta 10 dígitos, sin decimales.";
		vi.mocked(modificarPublicacionOperador).mockRejectedValue(new ErrorEdicionPublicacion("DATOS_INVALIDOS", mensaje));
		const respuesta = await PATCH(solicitudEdicion({ ...cambiosEdicion, precio }), contextoEdicion);

		expect(respuesta.status).toBe(400);
		expect(await respuesta.json()).toEqual({ errores: [mensaje] });
		expect(modificarPublicacionOperador).toHaveBeenCalledWith(10, 12, { ...cambiosEdicion, precio }, null);
		expect(revalidatePath).not.toHaveBeenCalled();
	});

	it("devuelve 404 si la publicación no pertenece al operador autenticado", async () => {
		vinculoPublicacionMock.first.mockResolvedValue(null);
		const respuesta = await PATCH(solicitudEdicion(), contextoEdicion);

		expect(respuesta.status).toBe(404);
		expect(await respuesta.json()).toEqual({ errores: ["La publicación no pertenece al operador seleccionado."] });
		expect(modificarPublicacionOperador).not.toHaveBeenCalled();
		expect(revalidatePath).not.toHaveBeenCalled();
	});
});

describe("autorización de cambios de publicaciones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        obtenerOperadorAutorizadoMock.mockResolvedValue({ id: 3, usuarioId: 10, nombreFantasia: "Operador 3" });
    });

    it.each(["DELETE", "PATCH"] as const)("%s rechaza solicitudes sin sesión", async (metodo) => {
        obtenerSesionMock.mockResolvedValue(null);
        const handler = metodo === "DELETE" ? DELETE : PATCH;
        const respuesta = await handler(new Request("http://localhost/api/publicaciones/15", { method: metodo }), {
            params: Promise.resolve({ id: "15" }),
        });
        expect(respuesta.status).toBe(401);
        expect(bajaPublicacionOperadorMock).not.toHaveBeenCalled();
        expect(modificarPublicacionOperador).not.toHaveBeenCalled();
    });

    it.each(["PRODUCTOR"] as const)("rechaza ambos cambios para %s", async (rol) => {
        obtenerSesionMock.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });
        for (const handler of [DELETE, PATCH]) {
            const respuesta = await handler(handler === PATCH ? solicitudEdicion() : new Request("http://localhost/api/publicaciones/15"), {
                params: Promise.resolve({ id: "15" }),
            });
            expect(respuesta.status).toBe(403);
        }
        expect(bajaPublicacionOperadorMock).not.toHaveBeenCalled();
        expect(modificarPublicacionOperador).not.toHaveBeenCalled();
    });

    it.each(["DELETE", "PATCH"] as const)("%s rechaza el ID de un operador ajeno", async (metodo) => {
        obtenerSesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        obtenerOperadorAutorizadoMock.mockResolvedValue({ id: 7, usuarioId: 70, nombreFantasia: "Otro" });
        const formulario = new FormData();
        formulario.set("cambios", JSON.stringify({ presentacionId: 1, categoriaId: 1, calibreId: 1, paisId: 1 }));
        const handler = metodo === "DELETE" ? DELETE : PATCH;
        const respuesta = await handler(new Request("http://localhost/api/publicaciones/15?operadorId=7", {
            method: metodo, ...(metodo === "PATCH" ? { body: formulario } : {}),
        }), { params: Promise.resolve({ id: "15" }) });
        expect(respuesta.status).toBe(403);
        expect(bajaPublicacionOperadorMock).not.toHaveBeenCalled();
        expect(modificarPublicacionOperador).not.toHaveBeenCalled();
        expect(vinculoPublicacionMock.first).not.toHaveBeenCalled();
    });
});

describe("gestión de publicaciones como administrador", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		obtenerSesionMock.mockResolvedValue({ usuarioId: 1, rol: "ADMINISTRADOR", expiraEn: 2000000000 });
		obtenerOperadorPorIdMock.mockResolvedValue({ id: 7, usuarioId: 70, nombreFantasia: "Operador 7" });
		vinculoPublicacionMock.select.mockReturnThis();
		vinculoPublicacionMock.where.mockReturnThis();
		vinculoPublicacionMock.first.mockResolvedValue({ id: 12 });
		vi.mocked(modificarPublicacionOperador).mockResolvedValue({ publicacionOperadorId: 12, publicacionId: 20 });
		bajaPublicacionOperadorMock.mockResolvedValue(true);
	});

	it("modifica la publicación del operador indicado usando el usuario de ese operador", async () => {
		const respuesta = await PATCH(solicitudEdicion(cambiosEdicion, undefined, "7"), contextoEdicion);

		expect(respuesta.status).toBe(200);
		expect(obtenerOperadorPorIdMock).toHaveBeenCalledExactlyOnceWith(7);
		expect(obtenerOperadorAutorizado).not.toHaveBeenCalled();
		expect(vinculoPublicacionMock.where).toHaveBeenCalledWith({ publicacionId: 20, operadorId: 7 });
		expect(modificarPublicacionOperador).toHaveBeenCalledExactlyOnceWith(70, 12, cambiosEdicion, null);
		expect(revalidatePath).toHaveBeenCalledWith("/mi-mercado/Operador%207");
	});

	it("elimina la publicación del operador indicado", async () => {
		const respuesta = await DELETE(new Request("http://localhost/api/publicaciones/15?operadorId=7", { method: "DELETE" }), {
			params: Promise.resolve({ id: "15" }),
		});

		expect(respuesta.status).toBe(200);
		expect(await respuesta.json()).toEqual({ mensaje: "Publicación eliminada." });
		expect(obtenerOperadorPorIdMock).toHaveBeenCalledExactlyOnceWith(7);
		expect(obtenerOperadorAutorizado).not.toHaveBeenCalled();
		expect(bajaPublicacionOperadorMock).toHaveBeenCalledExactlyOnceWith(15, 7);
		expect(revalidatePath).toHaveBeenCalledWith("/operadores/Operador%207");
	});

	it.each(["DELETE", "PATCH"] as const)("%s devuelve 400 si el administrador no indica el operador", async (metodo) => {
		const respuesta = metodo === "PATCH"
			? await PATCH(solicitudEdicion(), contextoEdicion)
			: await DELETE(new Request("http://localhost/api/publicaciones/15", { method: "DELETE" }), { params: Promise.resolve({ id: "15" }) });

		expect(respuesta.status).toBe(400);
		expect(await respuesta.json()).toEqual({ errores: ["Debe seleccionar un operador."] });
		expect(obtenerOperadorPorIdMock).not.toHaveBeenCalled();
		expect(bajaPublicacionOperadorMock).not.toHaveBeenCalled();
		expect(modificarPublicacionOperador).not.toHaveBeenCalled();
	});

	it.each(["DELETE", "PATCH"] as const)("%s devuelve 404 si el operador indicado no existe", async (metodo) => {
		obtenerOperadorPorIdMock.mockResolvedValue(null);
		const respuesta = metodo === "PATCH"
			? await PATCH(solicitudEdicion(cambiosEdicion, undefined, "99"), contextoEdicion)
			: await DELETE(new Request("http://localhost/api/publicaciones/15?operadorId=99", { method: "DELETE" }), { params: Promise.resolve({ id: "15" }) });

		expect(respuesta.status).toBe(404);
		expect(await respuesta.json()).toEqual({ errores: ["El operador no existe."] });
		expect(bajaPublicacionOperadorMock).not.toHaveBeenCalled();
		expect(modificarPublicacionOperador).not.toHaveBeenCalled();
		expect(revalidatePath).not.toHaveBeenCalled();
	});
});
