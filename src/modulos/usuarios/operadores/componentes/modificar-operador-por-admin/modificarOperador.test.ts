import "temporal-polyfill/global";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { modificarOperador } from "./modificarOperador";
 
const mockDb = vi.hoisted(() => ({
    nave: {
        where: vi.fn().mockReturnThis(),
        first: vi.fn(),
    },
    operador: {
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        first: vi.fn(),
        update: vi.fn(),
    },
    usuario: {
        where: vi.fn().mockReturnThis(),
        update: vi.fn(),
    },
    local: {
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        first: vi.fn(),
        all: vi.fn(),
        delete: vi.fn(),
        create: vi.fn(),
    },
    transaction: vi.fn(),
}));

const mockArgon2 = vi.hoisted(() => ({
    hash: vi.fn(),
    argon2id: 2,
}));
 
// Reemplaza el import real de db por la base falsa
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Nave: mockDb.nave,
                Operador: mockDb.operador,
                Usuario: mockDb.usuario,
                Local: mockDb.local,
            },
        },
        transaction: mockDb.transaction,
    },
}));

vi.mock("argon2", () => ({
    default: mockArgon2,
}));

type EstadoBase = {
    nave: { id: number } | null; // La nave elegida en el formulario
    operador: { id: number; usuarioId: number } | null; // El operador a modificar
    operadorConEseNombre: { id: number } | null; // Un operador que ya usa el nombre nuevo
    localEnEsaNave: { operadorId: number } | null; // Un local que ya existe con ese número en esa nave
    localesActuales: { id: number }[]; // Los locales que el operador tiene hoy
};

const estadoPorDefecto: EstadoBase = {
    nave: { id: 2 },
    operador: { id: 13, usuarioId: 50 },
    operadorConEseNombre: null,
    localEnEsaNave: null,
    localesActuales: [{ id: 100 }, { id: 101 }],
};

// Deja la base falsa en un estado conocido. Cada prueba cambia solo lo que necesita.
function prepararBase(cambios: Partial<EstadoBase> = {}) {
    const estado = { ...estadoPorDefecto, ...cambios };
 
    mockDb.nave.first.mockReset().mockResolvedValue(estado.nave);
    mockDb.operador.first
        .mockReset()
        .mockResolvedValueOnce(estado.operador) // 1era consulta: el operador a modificar
        .mockResolvedValueOnce(estado.operadorConEseNombre); // 2da consulta: quién usa ese nombre
    mockDb.local.first.mockReset().mockResolvedValue(estado.localEnEsaNave);
    mockDb.local.all.mockReset().mockResolvedValue(estado.localesActuales);
}

const datosValidos = {
    operadorId: 13,
    nombre: "Frutas del Norte",
    codigoPais: "+598",
    telefono: "99100001",
    contraseña: "",
    confirmacionContraseña: "",
    locales: [{ nombre: "18", naveId: 2, contrato: "" }],
};

describe("modificarOperador", () => {
 
    beforeEach(() => {
        vi.clearAllMocks();
        prepararBase();
        mockArgon2.hash.mockResolvedValue("hash-falso");
 
        mockDb.transaction.mockImplementation(
            async (operaciones: (tx: unknown) => unknown) =>
                operaciones({
                    orm: {
                        public: {
                            Nave: mockDb.nave,
                            Operador: mockDb.operador,
                            Usuario: mockDb.usuario,
                            Local: mockDb.local,
                        },
                    },
                })
        );
    });

    it("devuelve los errores de validación sin tocar la base", async () => {
        const resultado = await modificarOperador({ ...datosValidos, nombre: "" });
 
        expect(resultado).toEqual({
            esValido: false,
            errores: ["El nombre es obligatorio."],
        });
        expect(mockDb.nave.first).not.toHaveBeenCalled();
        expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("rechaza la modificación si alguna nave ya no existe", async () => {
        prepararBase({ nave: null });
 
        const resultado = await modificarOperador(datosValidos);
 
        expect(resultado).toEqual({
            esValido: false,
            errores: [
                "Alguna de las naves seleccionadas ya no está disponible. Actualizá el formulario.",
            ],
        });
        expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("rechaza la modificación si el operador ya no existe", async () => {
        prepararBase({ operador: null });
 
        const resultado = await modificarOperador(datosValidos);
 
        expect(resultado).toEqual({
            esValido: false,
            errores: ["El operador ya no existe."],
        });
        expect(mockDb.operador.update).not.toHaveBeenCalled();
    });

    it("rechaza la modificación si otro operador ya usa ese nombre", async () => {
        prepararBase({ operadorConEseNombre: { id: 99 } });
 
        const resultado = await modificarOperador(datosValidos);
 
        expect(resultado).toEqual({
            esValido: false,
            errores: ["Ya existe un operador con ese nombre."],
        });
        expect(mockDb.operador.update).not.toHaveBeenCalled();
    });

    it("rechaza la modificación si un local ya pertenece a otro operador", async () => {
        prepararBase({ localEnEsaNave: { operadorId: 99 } });
 
        const resultado = await modificarOperador(datosValidos);
 
        expect(resultado).toEqual({
            esValido: false,
            errores: ["El local 18 ya existe en la nave seleccionada."],
        });
        expect(mockDb.operador.update).not.toHaveBeenCalled();
    });

    it("guarda los datos del operador y reemplaza sus locales", async () => {
        const resultado = await modificarOperador(datosValidos);
 
        expect(resultado).toEqual({
            esValido: true,
            id: 13,
            mensaje: "Operador modificado correctamente.",
        });
        expect(mockDb.operador.update).toHaveBeenCalledWith({
            nombreFantasia: "Frutas del Norte",
            whatsApp: "+59899100001",
        });
        expect(mockDb.local.delete).toHaveBeenCalledTimes(2); // Tenía dos locales
        expect(mockDb.local.create).toHaveBeenCalledTimes(1); // Queda con uno
        expect(mockDb.local.create).toHaveBeenCalledWith({
            operadorId: 13,
            naveId: 2,
            numeroLocal: "18",
            finContrato: null,
        });
    });

    it("no cambia la contraseña si los campos quedan vacíos", async () => {
        await modificarOperador(datosValidos);
 
        expect(mockArgon2.hash).not.toHaveBeenCalled();
        expect(mockDb.usuario.update).not.toHaveBeenCalled();
    });

    it("guarda el hash de la contraseña nueva en el usuario del operador", async () => {
        await modificarOperador({
            ...datosValidos,
            contraseña: "contraseña123",
            confirmacionContraseña: "contraseña123",
        });
 
        expect(mockArgon2.hash).toHaveBeenCalledWith("contraseña123", { type: 2 });
        expect(mockDb.usuario.where).toHaveBeenCalledWith({ id: 50 });
        expect(mockDb.usuario.update).toHaveBeenCalledWith({ passwordHash: "hash-falso" });
    });
    
});
