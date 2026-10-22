import { beforeEach, describe, expect, it, vi } from "vitest";
import { modificarProductor } from "./modificarProductor";

const autorizacion = vi.hoisted(() => ({ exigirAdministrador: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => autorizacion);
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);

const mockDb = vi.hoisted(() => ({
    productor: {
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        first: vi.fn(),
        update: vi.fn(),
    },
    usuario: {
        where: vi.fn().mockReturnThis(),
        update: vi.fn(),
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
                Productor: mockDb.productor,
                Usuario: mockDb.usuario,
            },
        },
        transaction: mockDb.transaction,
    },
}));

vi.mock("argon2", () => ({
    default: mockArgon2,
}));

type EstadoBase = {
    productor: { id: number; usuarioId: number } | null; // El productor a modificar
    productorConEseNombre: { id: number } | null; // Un productor que ya usa el nombre nuevo
};

const estadoPorDefecto: EstadoBase = {
    productor: { id: 2, usuarioId: 60 },
    productorConEseNombre: null,
};

// Deja la base falsa en un estado conocido. Cada prueba cambia solo lo que necesita.
function prepararBase(cambios: Partial<EstadoBase> = {}) {
    const estado = { ...estadoPorDefecto, ...cambios };
 
    mockDb.productor.first
        .mockReset()
        .mockResolvedValueOnce(estado.productor)
        .mockResolvedValueOnce(estado.productorConEseNombre);
}

const datosValidos = {
    productorId: 2,
    nombre: "Granja Los Álamos",
    codigoPais: "+598",
    telefono: "99200002",
    contraseña: "",
    confirmacionContraseña: "",
};

describe("modificarProductor", () => {
 
    beforeEach(() => {
        vi.clearAllMocks();
        autorizacion.exigirAdministrador.mockResolvedValue(undefined);
        prepararBase();
        mockArgon2.hash.mockResolvedValue("hash-falso");
 
        mockDb.transaction.mockImplementation(
            async (operaciones: (tx: unknown) => unknown) =>
                operaciones({
                    orm: {
                        public: {
                            Productor: mockDb.productor,
                            Usuario: mockDb.usuario,
                        },
                    },
                })
        );
    });

    it("rechaza usuarios sin permiso antes de consultar o actualizar datos", async () => {
        autorizacion.exigirAdministrador.mockRejectedValueOnce(new Error("No autorizado"));

        await expect(modificarProductor(datosValidos)).rejects.toThrow("No autorizado");
        expect(mockDb.transaction).not.toHaveBeenCalled();
        expect(mockArgon2.hash).not.toHaveBeenCalled();
    });

    it("devuelve los errores de validación sin tocar la base", async () => {
        const resultado = await modificarProductor({ ...datosValidos, nombre: "" });
 
        expect(resultado).toEqual({
            esValido: false,
            errores: ["El nombre es obligatorio."],
        });
        expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("rechaza la modificación si el productor ya no existe", async () => {
        prepararBase({ productor: null });
 
        const resultado = await modificarProductor(datosValidos);
 
        expect(resultado).toEqual({
            esValido: false,
            errores: ["El productor ya no existe."],
        });
        expect(mockDb.productor.update).not.toHaveBeenCalled();
    });

    it("rechaza la modificación si otro productor ya usa ese nombre", async () => {
        prepararBase({ productorConEseNombre: { id: 99 } });
 
        const resultado = await modificarProductor(datosValidos);
 
        expect(resultado).toEqual({
            esValido: false,
            errores: ["Ya existe un productor con ese nombre."],
        });
        expect(mockDb.productor.update).not.toHaveBeenCalled();
    });

    // Si el nombre que encuentra es el del mismo productor, no es un nombre repetido
    it("permite guardar sin cambiar el nombre", async () => {
        prepararBase({ productorConEseNombre: { id: 2 } });
 
        const resultado = await modificarProductor(datosValidos);
 
        expect(resultado).toEqual({
            esValido: true,
            id: 2,
            mensaje: "Productor modificado correctamente.",
        });
        expect(mockDb.productor.update).toHaveBeenCalledOnce();
    });

    it("guarda el nombre y el WhatsApp del productor", async () => {
        const resultado = await modificarProductor(datosValidos);
 
        expect(resultado).toEqual({
            esValido: true,
            id: 2,
            mensaje: "Productor modificado correctamente.",
        });
        expect(mockDb.productor.where).toHaveBeenCalledWith({ id: 2 });
        expect(mockDb.productor.update).toHaveBeenCalledWith({
            nombreFantasia: "Granja Los Álamos",
            whatsApp: "+59899200002",
        });
    });

    it("no cambia la contraseña si los campos quedan vacíos", async () => {
        await modificarProductor(datosValidos);
 
        expect(mockArgon2.hash).not.toHaveBeenCalled();
        expect(mockDb.usuario.update).not.toHaveBeenCalled();
    });

    it("guarda el hash de la contraseña nueva en el usuario del productor", async () => {
        await modificarProductor({
            ...datosValidos,
            contraseña: "contraseña123",
            confirmacionContraseña: "contraseña123",
        });
 
        expect(mockArgon2.hash).toHaveBeenCalledWith("contraseña123", { type: 2 });
        expect(mockDb.usuario.where).toHaveBeenCalledWith({ id: 60 });
        expect(mockDb.usuario.update).toHaveBeenCalledWith({ passwordHash: "hash-falso" });
    });
    
    // Las páginas que muestran al productor se vuelven a armar con los datos nuevos
    it("refresca las páginas que muestran datos del productor", async () => {
        await modificarProductor(datosValidos);

        expect(cache.revalidatePath).toHaveBeenCalledWith("/gestion-productores/[id]", "page");
        expect(cache.revalidatePath).toHaveBeenCalledWith("/publicaciones-productor");
    });

    // Si la modificación se rechaza, no hay datos nuevos que mostrar
    it("no refresca ninguna página si no se guardó nada", async () => {
        prepararBase({ productorConEseNombre: { id: 99 } });

        await modificarProductor(datosValidos);

        expect(cache.revalidatePath).not.toHaveBeenCalled();
    });
});