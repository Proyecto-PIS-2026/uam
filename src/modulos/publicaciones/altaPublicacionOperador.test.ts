// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { altaPublicacionOperador } from "./altaPublicacionOperador";

const mocks = vi.hoisted(() => ({
	validarAltaPublicacionOperador: vi.fn(),
	Operador: { where: vi.fn() },
	Variedad: { where: vi.fn() },
	Presentacion: { where: vi.fn() },
	Categoria: { where: vi.fn() },
	Calibre: { where: vi.fn() },
	Pais: { where: vi.fn() },
	Especie: { where: vi.fn() },
	Publicacion: { where: vi.fn() },
	PublicacionOperador: { where: vi.fn() },
	transaction: vi.fn(),
	execute: vi.fn(),
	createPublicacion: vi.fn(),
	createPublicacionOperador: vi.fn(), // 👈 Referencia al mock de creación de la relación
}));

vi.mock("./validarAltaPublicacionOperador", () => ({
	validarAltaPublicacionOperador: mocks.validarAltaPublicacionOperador,
}));

vi.mock("../../infraestructura/persistencia/prisma/db", () => ({
	db: {
		transaction: (callback: (tx: unknown) => Promise<unknown>) => {
			const txMock = {
				execute: mocks.execute,
				orm: {
					public: {
						PublicacionOperador: {
							where: mocks.PublicacionOperador.where,
							create: mocks.createPublicacionOperador, // 👈 SOLUCIÓN: Agregado para resolver el TypeError
						},
						Publicacion: {
							create: mocks.createPublicacion,
							where: mocks.Publicacion.where,
						},
					},
				},
			};
			return callback(txMock);
		},
		orm: {
			public: {
				Operador: mocks.Operador,
				Variedad: mocks.Variedad,
				Presentacion: mocks.Presentacion,
				Categoria: mocks.Categoria,
				Calibre: mocks.Calibre,
				Pais: mocks.Pais,
				Especie: mocks.Especie,
			},
		},
		raw: {
			sql: () => ({ returnsRow: () => ({ build: () => ({}) }) }),
		},
	},
}));

describe("altaPublicacionOperador", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	const payloadEntradaValido = {
		operadorId: 1,
		especieId: 10,
		variedadId: 20,
		presentacionId: 30,
		categoriaId: 40,
		calibreId: 50,
		paisId: 60,
		disponibilidad: true,
		precio: "1500",
		cantidadUnidades: 5,
		fotografia: "base64_img",
	};

	function mockChainBase(mockEntidad: typeof mocks.Operador, valorResuelto: Record<string, unknown>) {
		mockEntidad.where.mockReturnValue({
			first: vi.fn().mockResolvedValue(valorResuelto),
			all: vi.fn().mockResolvedValue(Array.isArray(valorResuelto) ? valorResuelto : [valorResuelto]),
		});
	}

	it("devuelve los errores del validador estructural si la entrada es inválida", async () => {
		mocks.validarAltaPublicacionOperador.mockReturnValue({
			esValido: false,
			errores: ["Los datos de la publicación no son válidos."],
		});

		const resultado = await altaPublicacionOperador(null);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Los datos de la publicación no son válidos."],
		});
		expect(mocks.Operador.where).not.toHaveBeenCalled();
	});

	it("rechaza la operación si un elemento del catálogo está inactivo o desasociado", async () => {
		mocks.validarAltaPublicacionOperador.mockReturnValue({ esValido: true, datos: payloadEntradaValido });

		mockChainBase(mocks.Operador, { id: 1 });
		mockChainBase(mocks.Variedad, { id: 20, especieId: 10, variedadActiva: false });
		mockChainBase(mocks.Presentacion, { id: 30, variedadId: 20, presentacionActiva: true });
		mockChainBase(mocks.Categoria, { id: 40, especieId: 10 });
		mockChainBase(mocks.Calibre, { id: 50 });
		mockChainBase(mocks.Pais, { id: 60 });

		const resultado = await altaPublicacionOperador(payloadEntradaValido);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["La selección contiene datos que ya no están disponibles. Actualizá el formulario."],
		});
	});

	it("crea una publicación correctamente si se superan las reglas de negocio", async () => {
		mocks.validarAltaPublicacionOperador.mockReturnValue({ esValido: true, datos: payloadEntradaValido });

		mockChainBase(mocks.Operador, { id: 1 });
		mockChainBase(mocks.Variedad, { id: 20, especieId: 10, variedadActiva: true });
		mockChainBase(mocks.Presentacion, { id: 30, variedadId: 20, presentacionActiva: true });
		mockChainBase(mocks.Categoria, { id: 40, especieId: 10 });
		mockChainBase(mocks.Calibre, { id: 50 });
		mockChainBase(mocks.Pais, { id: 60 });
		mockChainBase(mocks.Especie, { id: 10, especieActiva: true });

		mocks.PublicacionOperador.where = vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue([]) });
		mocks.createPublicacion.mockResolvedValue({ id: 777 });
		mocks.createPublicacionOperador.mockResolvedValue({ id: 888 }); // Simula inserción relacional exitosa

		const resultado = await altaPublicacionOperador(payloadEntradaValido);

		expect(resultado).toEqual({
			esValido: true,
			id: 777,
			mensaje: "Publicación creada correctamente.",
		});
		expect(mocks.createPublicacion).toHaveBeenCalledWith(
			expect.objectContaining({
				cantidadUnidades: 5,
				precio: "1500",
			})
		);
		expect(mocks.createPublicacionOperador).toHaveBeenCalled();
	});

	it("rechaza el alta si detecta que el operador ya posee una publicación con idénticos catálogos", async () => {
		mocks.validarAltaPublicacionOperador.mockReturnValue({ esValido: true, datos: payloadEntradaValido });

		mockChainBase(mocks.Operador, { id: 1 });
		mockChainBase(mocks.Variedad, { id: 20, especieId: 10, variedadActiva: true });
		mockChainBase(mocks.Presentacion, { id: 30, variedadId: 20, presentacionActiva: true });
		mockChainBase(mocks.Categoria, { id: 40, especieId: 10 });
		mockChainBase(mocks.Calibre, { id: 50 });
		mockChainBase(mocks.Pais, { id: 60 });
		mockChainBase(mocks.Especie, { id: 10, especieActiva: true });

		mocks.PublicacionOperador.where = vi.fn().mockReturnValue({
			all: vi.fn().mockResolvedValue([{ publicacionId: 444, operadorId: 1 }]),
		});
		mocks.Publicacion.where.mockReturnValue({
			select: vi.fn().mockReturnThis(),
			all: vi.fn().mockResolvedValue([{ id: 444 }]),
		});

		const resultado = await altaPublicacionOperador(payloadEntradaValido);

		expect(resultado).toEqual({
			esValido: false,
			errores: ["Este operador ya tiene una publicación con la misma especie, variedad, presentación, categoría y calibre."],
		});
	});
});
