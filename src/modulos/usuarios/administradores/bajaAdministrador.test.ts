import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bajaAdministrador } from "./bajaAdministrador";

const mocks = vi.hoisted(() => ({
	exigirAdministrador: vi.fn(),
	transaction: vi.fn(),
	execute: vi.fn(),
	revalidatePath: vi.fn(),
	administrador: {
		where: vi.fn().mockReturnThis(),
		first: vi.fn(),
		delete: vi.fn(),
	},
	usuario: {
		where: vi.fn().mockReturnThis(),
		delete: vi.fn(),
	},
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
	exigirAdministrador: mocks.exigirAdministrador,
}));

vi.mock("next/cache", () => ({
	revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
	db: {
		transaction: mocks.transaction,
		raw: {
			sql: (partes: TemplateStringsArray, ...valores: unknown[]) => ({
				returnsRow: () => ({
					build: () => ({
						texto: partes.join("?"),
						valores,
					}),
				}),
			}),
		},
	},
}));

describe("baja de administrador", () => {
	let administradorActualExiste: boolean;
	let administradorSeleccionadoExiste: boolean;
	let administradorSeleccionadoUsuarioId: number;
	let administradorExiste: boolean;
	let usuarioExiste: boolean;

	beforeEach(() => {
		vi.clearAllMocks();

		mocks.exigirAdministrador.mockResolvedValue({ usuarioId: 90 });

		administradorActualExiste = true;
		administradorSeleccionadoExiste = true;
		administradorSeleccionadoUsuarioId = 91;
		administradorExiste = true;
		usuarioExiste = true;

		mocks.administrador.first.mockImplementation(async () => {
			const seleccion = mocks.administrador.where.mock.lastCall?.[0] as
				| { id?: number; usuarioId?: number }
				| undefined;

			if (seleccion?.usuarioId === 90) {
				return administradorActualExiste
					? { id: 13, usuarioId: 90 }
					: null;
			}

			if (seleccion?.id === 14) {
				return administradorSeleccionadoExiste
					? {
							id: 14,
							usuarioId: administradorSeleccionadoUsuarioId,
						}
					: null;
			}

			return null;
		});

		mocks.administrador.delete.mockImplementation(async () => {
			administradorExiste = false;
		});

		mocks.usuario.delete.mockImplementation(async () => {
			usuarioExiste = false;
		});

		mocks.transaction.mockImplementation(
			async (operacion: (tx: unknown) => Promise<unknown>) => {
				const copia = {
					administradorExiste,
					usuarioExiste,
				};

				try {
					return await operacion({
						execute: mocks.execute,
						orm: {
							public: {
								Administrador: mocks.administrador,
								Usuario: mocks.usuario,
							},
						},
					});
				} catch (error) {
					administradorExiste = copia.administradorExiste;
					usuarioExiste = copia.usuarioExiste;
					throw error;
				}
			},
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("impide la baja cuando falta el permiso administrativo", async () => {
		mocks.exigirAdministrador.mockRejectedValueOnce(
			new Error("No autorizado"),
		);

		await expect(
			bajaAdministrador({ administradorId: 14 }),
		).rejects.toThrow("No autorizado");

		expect(mocks.transaction).not.toHaveBeenCalled();
		expect(mocks.administrador.first).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("devuelve los errores del validador cuando los datos son inválidos", async () => {
		const resultado = await bajaAdministrador(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la baja no son válidos."],
		});

		expect(mocks.transaction).not.toHaveBeenCalled();
	});

	it("elimina correctamente el administrador y su usuario", async () => {
		const resultado = await bajaAdministrador({
			administradorId: 14,
		});

		expect(resultado).toEqual({
			esValido: true,
			mensaje: "Administrador eliminado correctamente.",
		});

		expect(administradorExiste).toBe(false);
		expect(usuarioExiste).toBe(false);

		expect(mocks.administrador.delete).toHaveBeenCalledOnce();
		expect(mocks.usuario.delete).toHaveBeenCalledOnce();

		expect(mocks.revalidatePath).toHaveBeenCalledWith(
			"/administracion",
		);
		expect(mocks.revalidatePath).toHaveBeenCalledWith(
			"/administracion/administradores",
		);
	});

	it("espera el bloqueo antes de consultar los administradores", async () => {
		let liberar!: () => void;

		mocks.execute.mockReturnValueOnce(
			new Promise<void>((resolve) => {
				liberar = resolve;
			}),
		);

		const baja = bajaAdministrador({ administradorId: 14 });

		await vi.waitFor(() =>
			expect(mocks.execute).toHaveBeenCalledOnce(),
		);

		expect(mocks.execute).toHaveBeenCalledWith({
			texto: expect.stringContaining("pg_advisory_xact_lock(1721, 0)"),
			valores: [],
		});

		expect(mocks.administrador.first).not.toHaveBeenCalled();

		liberar();

		await expect(baja).resolves.toEqual({
			esValido: true,
			mensaje: "Administrador eliminado correctamente.",
		});
	});

	it("rechaza la baja cuando la cuenta del administrador actual ya no existe", async () => {
		administradorActualExiste = false;

		const resultado = await bajaAdministrador({
			administradorId: 14,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Tu cuenta de administrador ya no existe."],
		});

		expect(mocks.administrador.delete).not.toHaveBeenCalled();
		expect(mocks.usuario.delete).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("rechaza la baja cuando el administrador seleccionado no existe", async () => {
		administradorSeleccionadoExiste = false;

		const resultado = await bajaAdministrador({
			administradorId: 14,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: ["El administrador seleccionado ya no existe."],
		});

		expect(mocks.administrador.delete).not.toHaveBeenCalled();
		expect(mocks.usuario.delete).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("impide que un administrador elimine su propia cuenta", async () => {
		administradorSeleccionadoUsuarioId = 90;

		const resultado = await bajaAdministrador({
			administradorId: 14,
		});

		expect(resultado).toEqual({
			esValido: false,
			errores: [
				"No podés dar de baja tu propia cuenta de administrador.",
			],
		});

		expect(mocks.administrador.delete).not.toHaveBeenCalled();
		expect(mocks.usuario.delete).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("revierte la transacción si falla la eliminación del usuario", async () => {
		mocks.usuario.delete.mockRejectedValueOnce(
			new Error("Fallo de base"),
		);

		await expect(
			bajaAdministrador({ administradorId: 14 }),
		).rejects.toThrow("Fallo de base");

		expect(administradorExiste).toBe(true);
		expect(usuarioExiste).toBe(true);

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});
});