import { beforeEach, describe, expect, it, vi } from "vitest";

const buscarRelacion = vi.hoisted(() => vi.fn());
const buscarPublicacion = vi.hoisted(() => vi.fn());
const eliminarPublicacion = vi.hoisted(() => vi.fn());
const ejecutarTransaccion = vi.hoisted(() => vi.fn());
const ejecutarSql = vi.hoisted(() => vi.fn());
const consultaSql = vi.hoisted(() => vi.fn());

vi.mock("../../infraestructura/persistencia/prisma/db", () => ({
	db: {
		transaction: ejecutarTransaccion,
		raw: { sql: consultaSql },
	},
}));

import { bajaPublicacionOperador } from "./bajaPublicacionOperador";

function prepararTransaccion() {
	consultaSql.mockImplementation(() => ({
		returnsRow: () => ({ build: () => "bloqueo del operador" }),
	}));
	ejecutarTransaccion.mockImplementation(async (operacion: (tx: unknown) => Promise<boolean>) => operacion({
		execute: ejecutarSql,
		orm: {
			public: {
				PublicacionOperador: { where: () => ({ first: buscarRelacion }) },
				Publicacion: { where: () => ({ first: buscarPublicacion, delete: eliminarPublicacion }) },
			},
		},
	}));
}

describe("bajaPublicacionOperador", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		prepararTransaccion();
	});

	it("elimina una publicación que pertenece al operador bajo el bloqueo", async () => {
		buscarRelacion.mockResolvedValue({ publicacionId: 15, operadorId: 3 });

		const resultado = await bajaPublicacionOperador(15, 3);

		expect(resultado).toBe(true);
		expect(consultaSql).toHaveBeenCalledWith(expect.any(Array), 3);
		expect(consultaSql.mock.calls[0][0].join("")).toContain("pg_advisory_xact_lock(1719, ");
		expect(ejecutarSql).toHaveBeenCalledExactlyOnceWith("bloqueo del operador");
		expect(ejecutarSql.mock.invocationCallOrder[0]).toBeLessThan(buscarRelacion.mock.invocationCallOrder[0]);
		expect(buscarPublicacion).not.toHaveBeenCalled();
		expect(eliminarPublicacion).toHaveBeenCalledOnce();
	});

	it("no elimina una publicación que pertenece a otro operador", async () => {
		buscarRelacion.mockResolvedValue(null);
		buscarPublicacion.mockResolvedValue({ id: 15 });

		const resultado = await bajaPublicacionOperador(15, 8);

		expect(resultado).toBe(false);
		expect(buscarPublicacion).toHaveBeenCalledOnce();
		expect(eliminarPublicacion).not.toHaveBeenCalled();
	});

	it("acepta una baja repetida si la publicación ya no existe", async () => {
		buscarRelacion.mockResolvedValueOnce({ publicacionId: 15, operadorId: 3 }).mockResolvedValueOnce(null);
		buscarPublicacion.mockResolvedValue(null);

		expect(await bajaPublicacionOperador(15, 3)).toBe(true);
		expect(await bajaPublicacionOperador(15, 3)).toBe(true);
		expect(eliminarPublicacion).toHaveBeenCalledOnce();
		expect(ejecutarSql).toHaveBeenCalledTimes(2);
	});

	it("acepta una publicación inexistente sin intentar eliminarla", async () => {
		buscarRelacion.mockResolvedValue(null);
		buscarPublicacion.mockResolvedValue(null);

		const resultado = await bajaPublicacionOperador(999, 3);

		expect(resultado).toBe(true);
		expect(eliminarPublicacion).not.toHaveBeenCalled();
	});

	it("propaga errores de base de datos durante la baja", async () => {
		buscarRelacion.mockResolvedValue({ publicacionId: 15, operadorId: 3 });
		const error = new Error("falló la base de datos");
		eliminarPublicacion.mockRejectedValue(error);

		await expect(bajaPublicacionOperador(15, 3)).rejects.toBe(error);
	});
});
