import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPerfilPublicoOperador } from "./consultas-perfil-publico";

// Sirve para construir una base de datos falsa, metodos falsos y simular las consultas
const mockDb = vi.hoisted(() => ({
    operador: {
        select: vi.fn().mockReturnThis(),
        include: vi.fn().mockReturnThis(),
        first: vi.fn(),
    },
    publicaciones: {
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        include: vi.fn().mockReturnThis(),
        all: vi.fn(),
    },
}));

// En el archivo original se hace un import de db
// Con esto reemplazamos ese import real por uno falso que creamos
vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Operador: mockDb.operador,
                PublicacionOperador: mockDb.publicaciones,
            },
        },
    },
}));

// Informacion de prueba de un operador
const operadorConLocal = {
    id: 13,
    nombreFantasia: "Frutas del Norte",
    fotoPerfil: "/operadores/frutas-del-norte.jpg",
    whatsApp: "+59899100001",
    locales: [
        {
            numeroLocal: "18",
            finContrato: null,
            nave: { nombreNave: "B" },
        },
    ],
};

describe("obtenerPerfilPublicoOperador", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.operador.first.mockResolvedValue(null); // Comportamientos por defecto
        mockDb.publicaciones.all.mockResolvedValue([]); // Comportamientos por defecto

        mockDb.operador.include.mockImplementation( // Configura como funciona el include
            (_relacion: string, construir?: (consulta: typeof mockDb.operador) => unknown) => {
                construir?.(mockDb.operador);
                return mockDb.operador;
            }
        );

        mockDb.publicaciones.include.mockImplementation( // Configura como funciona el include
            (_relacion: string, construir?: (consulta: typeof mockDb.publicaciones) => unknown) => {
                construir?.(mockDb.publicaciones);
                return mockDb.publicaciones;
            }
        );
    });

    // Verifica que IDs invalidos sean rechazados sin consultar la base de datos
    it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
        "rechaza el ID inválido %s sin consultar la base",
        async (id) => {
            const resultado = await obtenerPerfilPublicoOperador(id);

            expect(resultado).toBeNull();
            expect(mockDb.operador.first).not.toHaveBeenCalled();
        }
    );

    // Verifica que se devuelva null cuando no existe un operador con ese ID
    it("devuelve null si el operador no existe", async () => {
        const resultado = await obtenerPerfilPublicoOperador(13);

        expect(resultado).toBeNull();
        expect(mockDb.operador.first).toHaveBeenCalledWith({ id: 13 });
        expect(mockDb.publicaciones.all).not.toHaveBeenCalled();
    });

    // Verifica que un operador sin locales asociados no tenga perfil publico
    it("devuelve null si el operador no tiene locales", async () => {
        mockDb.operador.first.mockResolvedValue({
            ...operadorConLocal,
            locales: [],
        });

        const resultado = await obtenerPerfilPublicoOperador(13);

        expect(resultado).toBeNull();
        expect(mockDb.publicaciones.all).not.toHaveBeenCalled();
    });

    // Verifica que un operador sin contratos vigentes no tenga perfil publico
    it("devuelve null si todos los contratos vencieron", async () => {
        mockDb.operador.first.mockResolvedValue({
            ...operadorConLocal,
            locales: [
                {
                    numeroLocal: "18",
                    finContrato: Temporal.Instant.from("2000-01-01T12:00:00Z"),
                    nave: { nombreNave: "B" },
                },
            ],
        });

        const resultado = await obtenerPerfilPublicoOperador(13);

        expect(resultado).toBeNull();
        expect(mockDb.publicaciones.all).not.toHaveBeenCalled();
    });

    // Verifica que un local sin fecha de fin de contrato se considere vigente
    it("incluye un local sin fecha de fin aunque no haya publicaciones", async () => {
        mockDb.operador.first.mockResolvedValue(operadorConLocal);

        const resultado = await obtenerPerfilPublicoOperador(13);

        expect(resultado).toEqual({
            id: 13,
            nombreFantasia: "Frutas del Norte",
            fotoPerfil: "/operadores/frutas-del-norte.jpg",
            whatsApp: "+59899100001",
            locales: [{ numeroLocal: "18", nombreNave: "B" }],
            publicaciones: [],
        });
        expect(mockDb.publicaciones.where).toHaveBeenCalledWith({ operadorId: 13 });
    });

    // Verifica que un contrato que finaliza hoy sea valido y uno vencido sea excluido
    it("incluye un contrato que termina hoy y excluye uno vencido", async () => {
        const hoy = Temporal.Now.plainDateISO("America/Montevideo");
        const finHoy = hoy.toZonedDateTime({
            timeZone: "America/Montevideo",
            plainTime: "12:00",
        }).toInstant();

        mockDb.operador.first.mockResolvedValue({
            ...operadorConLocal,
            locales: [
                {
                    numeroLocal: "18",
                    finContrato: finHoy,
                    nave: { nombreNave: "B" },
                },
                {
                    numeroLocal: "19",
                    finContrato: Temporal.Instant.from("2000-01-01T12:00:00Z"),
                    nave: { nombreNave: "B" },
                },
            ],
        });

        const resultado = await obtenerPerfilPublicoOperador(13);

        expect(resultado?.locales).toEqual([
            { numeroLocal: "18", nombreNave: "B" },
        ]);
    });

    // Verifica que solo se devuelvan publicaciones activas, disponibles y de tipo OPERADOR
    it("devuelve solo las publicaciones visibles con sus datos", async () => {
        const publicacionVisible = {
            id: 101,
            foto: "/publicaciones/tomate.jpg",
            precio: "120.00",
            publicacionActiva: true,
            publicacionDisponible: true,
            tipoPublicacion: "OPERADOR",
            presentacion: {
                nombrePresentacion: "Cajón",
                variedad: {
                    nombreVariedad: "Perita",
                    especie: { nombreEspecie: "Tomate" },
                },
            },
            categoria: { nombreCategoria: "Extra" },
            calibre: { codigoCalibre: "A" },
        };

        mockDb.operador.first.mockResolvedValue(operadorConLocal);
        mockDb.publicaciones.all.mockResolvedValue([
            { publicacion: publicacionVisible },
            { publicacion: { ...publicacionVisible, id: 102, publicacionActiva: false } },
            { publicacion: { ...publicacionVisible, id: 103, publicacionDisponible: false } },
            { publicacion: { ...publicacionVisible, id: 104, tipoPublicacion: "PRODUCTOR" } },
        ]);

        const resultado = await obtenerPerfilPublicoOperador(13);

        expect(resultado?.publicaciones).toEqual([
            {
                id: 101,
                foto: "/publicaciones/tomate.jpg",
                precio: "120.00",
                especie: "Tomate",
                variedad: "Perita",
                presentacion: "Cajón",
                categoria: "Extra",
                calibre: "A",
            },
        ]);
    });
});