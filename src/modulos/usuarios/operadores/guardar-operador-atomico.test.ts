import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardarOperadorAtomico } from "./guardar-operador-atomico";
import { guardarUsuarioAtomico } from "../guardar-usuario-atomico";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), consultas: [] as string[] }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: {
    transaction: mocks.transaction,
    raw: { sql: (partes: TemplateStringsArray, ...valores: unknown[]) => ({
        returnsRow: () => ({ build: () => ({ texto: partes.join("?"), valores }) }),
    }) },
} }));

type Consulta = { texto: string; valores: unknown[] };
type TxFalsa = { execute: (consulta: Consulta) => Promise<void> };

describe("guardado atómico de operadores", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.consultas.length = 0;
        const bloqueos = new Map<string, Promise<void>>();
        mocks.transaction.mockImplementation(async (guardar: (tx: TxFalsa) => Promise<unknown>) => {
            const liberar: (() => void)[] = [];
            try {
                return await guardar({ execute: async (consulta) => {
                    mocks.consultas.push(consulta.texto);
                    const clave = consulta.texto + JSON.stringify(consulta.valores);
                    const anterior = bloqueos.get(clave) ?? Promise.resolve();
                    bloqueos.set(clave, new Promise<void>((resolve) => liberar.push(resolve)));
                    await anterior;
                } });
            } finally {
                liberar.forEach((soltar) => soltar());
            }
        });
    });

    it("solo acepta el primer guardado de datos únicos aunque las transacciones se superpongan", async () => {
        let usado = false;
        const guardar = async () => {
            if (usado) return "Ya existe un operador con ese nombre.";
            await Promise.resolve();
            usado = true;
            return 7;
        };
        const resultados = await Promise.all([
            guardarOperadorAtomico(guardar),
            guardarOperadorAtomico(guardar, 10),
        ]);
        expect(resultados).toEqual([7, "Ya existe un operador con ese nombre."]);
        expect(mocks.transaction).toHaveBeenCalledTimes(2);
    });

    it("libera la reserva después de una transacción fallida", async () => {
        const primero = guardarOperadorAtomico(async () => { throw new Error("Guardado fallido"); });
        const segundo = guardarOperadorAtomico(async () => 9);
        await expect(primero).rejects.toThrow("Guardado fallido");
        await expect(segundo).resolves.toBe(9);
    });

    it("serializa una reserva de nombre de usuario entre operador y productor", async () => {
        let usado = false;
        const guardar = async () => {
            if (usado) return "Ya existe un usuario con ese nombre de usuario.";
            await Promise.resolve();
            usado = true;
            return 7;
        };
        const resultados = await Promise.all([
            guardarOperadorAtomico(guardar),
            guardarUsuarioAtomico(guardar, "productor"),
        ]);
        expect(resultados).toEqual([7, "Ya existe un usuario con ese nombre de usuario."]);
    });

    it.each([
        ["23505", "productor_nombreFantasia_key", "Ya existe un productor con ese nombre."],
        ["23505", "usuario_username_key", "Ya existe un usuario con ese nombre de usuario."],
        ["23503", undefined, "Los datos seleccionados cambiaron mientras se guardaba el productor. Actualizá el formulario."],
    ])("devuelve el conflicto %s de un productor sin perder el error de negocio", async (code, constraint, mensaje) => {
        mocks.transaction.mockRejectedValueOnce(new Error("Transacción fallida", { cause: { code, constraint } }));
        await expect(guardarUsuarioAtomico(async () => 7, "productor")).resolves.toBe(mensaje);
    });

    it("comparte el bloqueo por operador con la baja antes de modificar", async () => {
        await guardarOperadorAtomico(async () => 13, 13);
        expect(mocks.consultas).toHaveLength(2);
        expect(mocks.consultas[1]).toContain("pg_advisory_xact_lock(1719,");
    });

    it.each([
        ["usuario_username_key", "Ya existe un usuario con ese nombre de usuario."],
        ["operador_nombreFantasia_key", "Ya existe un operador con ese nombre."],
        ["local_numeroLocal_naveId_key", "Alguno de los locales seleccionados ya pertenece a otro operador. Actualizá el formulario."],
    ])("convierte la restricción %s en un resultado controlado", async (constraint, mensaje) => {
        mocks.transaction.mockRejectedValueOnce(Object.assign(new Error("conflicto"), { sqlState: "23505", constraint }));
        await expect(guardarOperadorAtomico(async () => 7)).resolves.toBe(mensaje);
    });

    it("reconoce el error original envuelto por la transacción", async () => {
        mocks.transaction.mockRejectedValueOnce(new Error("Transacción fallida", { cause: {
            code: "23505", constraint: "usuario_username_key",
        } }));
        await expect(guardarOperadorAtomico(async () => 7)).resolves.toBe("Ya existe un usuario con ese nombre de usuario.");
    });

    it("devuelve un conflicto si desaparece una nave durante el guardado", async () => {
        mocks.transaction.mockRejectedValueOnce({ sqlState: "23503" });
        await expect(guardarOperadorAtomico(async () => 7)).resolves.toContain("Actualizá el formulario.");
    });

    it("no oculta errores ajenos a las restricciones de los datos", async () => {
        const error = new Error("No hay conexión");
        mocks.transaction.mockRejectedValueOnce(error);
        await expect(guardarOperadorAtomico(async () => 7)).rejects.toBe(error);
    });
});
