import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bajaProductor } from "./bajaProductor";

const mocks = vi.hoisted(() => ({
	exigirAdministrador: vi.fn(),
	transaction: vi.fn(),
	execute: vi.fn(),
	revalidatePath: vi.fn(),
	eliminarImagen: vi.fn(),
	eliminarPerfil: vi.fn(),
	productor: {
		where: vi.fn().mockReturnThis(),
		first: vi.fn(),
		delete: vi.fn(),
	},
	usuario: {
		where: vi.fn().mockReturnThis(),
		delete: vi.fn(),
	},
	relacion: {
		where: vi.fn().mockReturnThis(),
		all: vi.fn(),
		deleteAll: vi.fn(),
	},
	publicacion: {
		where: vi.fn().mockReturnThis(),
		first: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/modulos/identidad-acceso/autorizacion/controles")>()),
	exigirAdministrador: mocks.exigirAdministrador,
}));

vi.mock("next/cache", () => ({
	revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/modulos/publicaciones/operadores/imagenes-publicacion", () => ({
	eliminarImagenPublicacionGestionada: mocks.eliminarImagen,
}));

vi.mock("@/infraestructura/imagenes/almacenamiento-postgres", () => ({
	AlmacenamientoImagenesPostgres: class {
		eliminar = mocks.eliminarPerfil;
	},
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
	db: {
		transaction: mocks.transaction,
		raw: { sql: (partes: TemplateStringsArray, ...valores: unknown[]) => ({
			returnsRow: () => ({ build: () => ({ texto: partes.join("?"), valores }) }),
		}) },
	},
}));

describe("baja de productor", () => {
	let relaciones: { publicacionId: number }[];
	let publicaciones: number[];
	let productorExiste: boolean;
	let usuarioExiste: boolean;

	beforeEach(() => {
		vi.clearAllMocks();

		mocks.exigirAdministrador.mockResolvedValue(undefined);
		mocks.eliminarImagen.mockResolvedValue(undefined);
		mocks.eliminarPerfil.mockResolvedValue(undefined);

		relaciones = [
			{ publicacionId: 20 },
			{ publicacionId: 21 },
		];

		publicaciones = [20, 21];
		productorExiste = true;
		usuarioExiste = true;

		mocks.productor.first.mockImplementation(async () =>
			productorExiste ? { id: 14, usuarioId: 90, fotoPerfil: null } : null
		);

		mocks.relacion.all.mockImplementation(async () => [...relaciones]);

		mocks.relacion.deleteAll.mockImplementation(async () => {
			relaciones = [];
		});

		mocks.publicacion.first.mockResolvedValue({ foto: null });

		mocks.publicacion.delete.mockImplementation(async () => {
			const seleccion = mocks.publicacion.where.mock.lastCall?.[0] as {
				id: number;
			};

			publicaciones = publicaciones.filter(
				(id) => id !== seleccion.id
			);
		});

		mocks.productor.delete.mockImplementation(async () => {
			productorExiste = false;
		});

		mocks.usuario.delete.mockImplementation(async () => {
			usuarioExiste = false;
		});

		mocks.transaction.mockImplementation(
			async (operacion: (tx: unknown) => Promise<unknown>) => {
				const copia = {
					relaciones: [...relaciones],
					publicaciones: [...publicaciones],
					productorExiste,
					usuarioExiste,
				};

				try {
					return await operacion({
						execute: mocks.execute,
						orm: {
							public: {
								Productor: mocks.productor,
								Usuario: mocks.usuario,
								PublicacionProductor: mocks.relacion,
								Publicacion: mocks.publicacion,
							},
						},
					});
				} catch (error) {
					relaciones = copia.relaciones;
					publicaciones = copia.publicaciones;
					productorExiste = copia.productorExiste;
					usuarioExiste = copia.usuarioExiste;
					throw error;
				}
			}
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("impide la baja cuando falta el permiso administrativo", async () => {
		mocks.exigirAdministrador.mockRejectedValueOnce(
			new Error("No autorizado")
		);

		await expect(
			bajaProductor({ productorId: 14 })
		).rejects.toThrow("No autorizado");

		expect(mocks.transaction).not.toHaveBeenCalled();
		expect(mocks.productor.first).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("devuelve los errores del validador cuando los datos son inválidos", async () => {
		const resultado = await bajaProductor(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la baja no son válidos."],
		});

		expect(mocks.transaction).not.toHaveBeenCalled();
	});

	it("elimina el productor, su usuario y sus publicaciones", async () => {
		const resultado = await bajaProductor({ productorId: 14 });

		expect(resultado).toEqual({
			esValido: true,
			mensaje: "Productor eliminado correctamente.",
		});

		expect(relaciones).toEqual([]);
		expect(publicaciones).toEqual([]);
		expect(productorExiste).toBe(false);
		expect(usuarioExiste).toBe(false);

		expect(mocks.productor.delete).toHaveBeenCalledOnce();
		expect(mocks.usuario.delete).toHaveBeenCalledOnce();

		expect(mocks.revalidatePath).toHaveBeenCalledWith("/administracion");
		expect(mocks.revalidatePath).toHaveBeenCalledWith("/productores");
	});

	it("espera la reserva del productor antes de leerlo o eliminar sus publicaciones", async () => {
		let liberar!: () => void;
		mocks.execute.mockReturnValueOnce(new Promise<void>((resolve) => { liberar = resolve; }));
		const baja = bajaProductor({ productorId: 14 });
		await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
		expect(mocks.execute).toHaveBeenCalledWith({
			texto: expect.stringContaining("pg_advisory_xact_lock(1720, ?)"), valores: [14],
		});
		expect(mocks.productor.first).not.toHaveBeenCalled();
		expect(mocks.relacion.deleteAll).not.toHaveBeenCalled();
		liberar();
		await expect(baja).resolves.toEqual({ esValido: true, mensaje: "Productor eliminado correctamente." });
	});

	it("rechaza la baja cuando el productor no existe", async () => {
		productorExiste = false;

		const resultado = await bajaProductor({ productorId: 14 });

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El productor seleccionado ya no existe."],
		});

		expect(mocks.productor.delete).not.toHaveBeenCalled();
		expect(mocks.usuario.delete).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("elimina las fotos de las publicaciones después de confirmar la baja", async () => {
		const clavePerfil = "productores/14/12345678-1234-4234-8234-123456789abc.webp";
		mocks.productor.first.mockResolvedValueOnce({ id: 14, usuarioId: 90, fotoPerfil: `/api/imagenes/${clavePerfil}` });
		const foto20 =
			"/api/publicaciones/imagenes/20/12345678-1234-4234-8234-123456789abc.png";
		const foto21 =
			"/api/publicaciones/imagenes/21/12345678-1234-4234-8234-123456789abc.png";

		mocks.publicacion.first
			.mockResolvedValueOnce({ foto: foto20 })
			.mockResolvedValueOnce({ foto: foto21 });

		let transaccionTerminada = false;

		const transaccionOriginal = mocks.transaction.getMockImplementation()!;

		mocks.transaction.mockImplementation(async (...argumentos) => {
			const resultado = await transaccionOriginal(...argumentos);
			transaccionTerminada = true;
			return resultado;
		});

		mocks.eliminarImagen.mockImplementation(async () => {
			expect(transaccionTerminada).toBe(true);
		});
		mocks.eliminarPerfil.mockImplementation(async () => {
			expect(transaccionTerminada).toBe(true);
		});

		const resultado = await bajaProductor({ productorId: 14 });

		expect(resultado.esValido).toBe(true);

		expect(mocks.eliminarImagen.mock.calls).toEqual([
			[foto20, 20],
			[foto21, 21],
		]);
		expect(mocks.eliminarPerfil).toHaveBeenCalledExactlyOnceWith(clavePerfil);
	});

	it.each([null, "/productores/perfil-predeterminado.webp", "https://example.com/productor.webp"])("no elimina recursos estáticos o externos del perfil %s", async (fotoPerfil) => {
		mocks.productor.first.mockResolvedValueOnce({ id: 14, usuarioId: 90, fotoPerfil });
		const resultado = await bajaProductor({ productorId: 14 });
		expect(resultado.esValido).toBe(true);
		expect(mocks.eliminarPerfil).not.toHaveBeenCalled();
	});

	it("registra un fallo al limpiar el perfil sin revertir la baja confirmada", async () => {
		mocks.productor.first.mockResolvedValueOnce({ id: 14, usuarioId: 90, fotoPerfil: "/api/imagenes/productores/14/12345678-1234-4234-8234-123456789abc.webp" });
		const error = new Error("Fallo al eliminar imagen de PostgreSQL");
		mocks.eliminarPerfil.mockRejectedValueOnce(error);
		const registrarError = vi.spyOn(console, "error").mockImplementation(() => undefined);

		const resultado = await bajaProductor({ productorId: 14 });

		expect(resultado.esValido).toBe(true);
		expect(productorExiste).toBe(false);
		expect(usuarioExiste).toBe(false);
		expect(registrarError).toHaveBeenCalledExactlyOnceWith("No se pudo eliminar la foto de perfil del productor dado de baja.", error);
		expect(mocks.revalidatePath).toHaveBeenCalledWith("/administracion");
	});

	it("continúa la baja si no se puede eliminar una imagen", async () => {
		mocks.publicacion.first
			.mockResolvedValueOnce({
				foto: "/api/publicaciones/imagenes/20/12345678-1234-4234-8234-123456789abc.png",
			})
			.mockResolvedValueOnce({
				foto: "/api/publicaciones/imagenes/21/12345678-1234-4234-8234-123456789abc.png",
			});

		mocks.eliminarImagen
			.mockRejectedValueOnce(new Error("Archivo bloqueado"))
			.mockResolvedValueOnce(undefined);

		const registrarError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		const resultado = await bajaProductor({ productorId: 14 });

		expect(resultado.esValido).toBe(true);
		expect(productorExiste).toBe(false);
		expect(usuarioExiste).toBe(false);
		expect(mocks.eliminarImagen).toHaveBeenCalledTimes(2);
		expect(registrarError).toHaveBeenCalledOnce();
		expect(mocks.revalidatePath).toHaveBeenCalledWith("/administracion");
	});

	it("revierte la transacción si falla la eliminación del usuario", async () => {
		mocks.productor.first.mockResolvedValueOnce({ id: 14, usuarioId: 90, fotoPerfil: "/api/imagenes/productores/14/12345678-1234-4234-8234-123456789abc.webp" });
		mocks.usuario.delete.mockRejectedValueOnce(
			new Error("Fallo de base")
		);

		await expect(
			bajaProductor({ productorId: 14 })
		).rejects.toThrow("Fallo de base");

		expect(relaciones).toEqual([
			{ publicacionId: 20 },
			{ publicacionId: 21 },
		]);

		expect(publicaciones).toEqual([20, 21]);
		expect(productorExiste).toBe(true);
		expect(usuarioExiste).toBe(true);

		expect(mocks.eliminarImagen).not.toHaveBeenCalled();
		expect(mocks.eliminarPerfil).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});
});
