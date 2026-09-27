import { beforeEach, describe, expect, it, vi } from "vitest";

const buscarRelacion = vi.hoisted(() => vi.fn());
const eliminarPublicacion = vi.hoisted(() => vi.fn());
const ejecutarTransaccion = vi.hoisted(() => vi.fn());

vi.mock("../../infraestructura/persistencia/prisma/db", () => ({
	db: { transaction: ejecutarTransaccion },
}));

import { bajaPublicacionOperador } from "./bajaPublicacionOperador";

function prepararTransaccion() {
	ejecutarTransaccion.mockImplementation(async (operacion: (tx: unknown) => Promise<boolean>) => operacion({
		orm: {
			public: {
				PublicacionOperador: { where: () => ({ first: buscarRelacion }) },
				Publicacion: { where: () => ({ delete: eliminarPublicacion }) },
			},
		},
	}));
}

describe("bajaPublicacionOperador", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		prepararTransaccion();
	});

	it("elimina una publicación que pertenece al operador", async () => {
		buscarRelacion.mockResolvedValue({ publicacionId: 15, operadorId: 3 });

		const resultado = await bajaPublicacionOperador(15, 3);

		expect(resultado).toBe(true);
		expect(eliminarPublicacion).toHaveBeenCalledOnce();
	});

	it("no elimina una publicación que pertenece a otro operador", async () => {
		buscarRelacion.mockResolvedValue(null);

		const resultado = await bajaPublicacionOperador(15, 8);

		expect(resultado).toBe(false);
		expect(eliminarPublicacion).not.toHaveBeenCalled();
	});

	it("no elimina una publicación inexistente", async () => {
		buscarRelacion.mockResolvedValue(null);

		const resultado = await bajaPublicacionOperador(999, 3);

		expect(resultado).toBe(false);
		expect(eliminarPublicacion).not.toHaveBeenCalled();
	});
});
