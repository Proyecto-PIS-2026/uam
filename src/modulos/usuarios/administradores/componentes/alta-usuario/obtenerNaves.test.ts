import { describe, expect, it } from "vitest";
import { obtenerNaves } from "./obtenerNaves";

describe("obtener naves", () => {
	it("devuelve las naves con id y nombre ordenadas alfabéticamente", async () => {
		const resultado = await obtenerNaves();

		expect(resultado).toEqual(
			expect.arrayContaining(
				resultado.map((nave) => ({
					id: nave.id,
					nombre: nave.nombre,
				})),
			),
		);

		for (const nave of resultado) {
			expect(nave).toHaveProperty("id");
			expect(nave).toHaveProperty("nombre");
			expect(typeof nave.id).toBe("number");
			expect(typeof nave.nombre).toBe("string");
		}

		for (let i = 1; i < resultado.length; i++) {
			expect(
				resultado[i - 1].nombre.localeCompare(resultado[i].nombre),
			).toBeLessThanOrEqual(0);
		}
	});
});

