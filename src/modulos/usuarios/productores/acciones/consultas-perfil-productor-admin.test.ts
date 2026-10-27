import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPerfilAdminProductor} from "./consultas-perfil-productor-admin";

// Sirve para construir una base de datos falsa, metodos falsos y simular las consultas
const mockDb = vi.hoisted(() => ({
    productor: {
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

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Productor: mockDb.productor,
                PublicacionProductor: mockDb.publicaciones,
            },
        },
    },
}));

// Informacion de prueba de un productor
const productorBase = {
    id: 2,
    nombreFantasia: "Granja Los Álamos",
    fotoPerfil: null,
    whatsApp: "+59899200002",
};

const publicacionBase = {
    id: 201,
    foto: null,
    precio: "90.00",
    cantidadUnidades: 15,
    fecha: Temporal.Instant.from("2026-10-01T12:00:00Z"),
    publicacionActiva: true,
    publicacionDisponible: true,
    presentacionId: 7,
    categoriaId: 3,
    calibreId: 4,
    tipoPublicacion: "PRODUCTOR",
    especie: { id: 5, nombreEspecie: "Manzana" },
            variedad: { id: 12, especieId: 5, nombreVariedad: "Red Delicious" },
            presentacion: { nombrePresentacion: "Cajón" },
    categoria: { nombreCategoria: "I" },
    calibre: { codigoCalibre: "G" },
};

const relacionBase = {
    id: 301,
    paisId: 1,
    pais: { nombrePais: "Uruguay"},
    ubicaciones: [
        { nombreUbicacion: "Ruta 3 km 500, Salto", urlMaps: "https://goo.gl/maps/salto1"}
    ],
    publicacion: publicacionBase,
};

describe("obtenerPerfilAdminProductor", () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.productor.first.mockResolvedValue(null); // Comportamientos por defecto
        mockDb.publicaciones.all.mockResolvedValue([]); // Comportamientos por defecto

        mockDb.productor.include.mockImplementation( // Configura como funciona el include
            (_relacion: string, construir?: (consulta: typeof mockDb.productor) => unknown) => {
                construir?.(mockDb.productor);
                return mockDb.productor;
            }
        );

        mockDb.publicaciones.include.mockImplementation( // Configura como funciona el include
            (_relacion: string, construir?: (consulta: typeof mockDb.publicaciones) => unknown) => {
                construir?.(mockDb.publicaciones);
                return mockDb.publicaciones;
            }
        );
    });

    // Verifica que los ids inválidos sean rechazados sin consultar la base de datos
    it.each([0.5, -1, 0, NaN])(
        "rechaza el id inválido %s sin consultar la base",
        async (id) => {
            const resultado = await obtenerPerfilAdminProductor(id);

            expect(resultado).toBeNull();
            expect(mockDb.productor.first).not.toHaveBeenCalled();
        }
    );

    // Verifica que se devuelva null cuando no existe un productor con ese id
    it("devuelve null si el productor no existe", async () => {
        const resultado = await obtenerPerfilAdminProductor(2);

        expect(resultado).toBeNull();
        expect(mockDb.productor.first).toHaveBeenCalledWith({ id: 2 });
        expect(mockDb.publicaciones.all).not.toHaveBeenCalled();
    });

    // El perfil trae el nombre de fantasía, y el Whatsapp del productor
    it("devuelve el perfil con el nombre de fantasía, la foto y el Whatsapp", async () => {
        mockDb.productor.first.mockResolvedValue(productorBase);

        const resultado = await obtenerPerfilAdminProductor(2);

        expect(resultado).toEqual({
            id: 2,
            nombreFantasia: "Granja Los Álamos",
            fotoPerfil: null,
            whatsApp: "+59899200002",
            publicaciones: [],
        });
        expect(mockDb.publicaciones.where).toHaveBeenCalledWith({ productorId: 2 });
    });

    it("devuelve cada publicación con su país y sus ubicaciones", async () => {
        mockDb.productor.first.mockResolvedValue(productorBase);
        mockDb.publicaciones.all.mockResolvedValue([relacionBase]);
 
        const resultado = await obtenerPerfilAdminProductor(2);
 
        expect(resultado?.publicaciones).toEqual([
            {
                id: 201,
                publicacionProductorId: 301,
                especieId: 5,
                variedadId: 12,
                presentacionId: 7,
                categoriaId: 3,
                calibreId: 4,
                paisId: 1,
                foto: null,
                precio: "90.00",
                cantidadUnidades: 15,
                fecha: "2026-10-01T12:00:00Z",
                disponible: true,
                especie: "Manzana",
                variedad: "Red Delicious",
                presentacion: "Cajón",
                categoria: "I",
                calibre: "G",
                codigoCalibre: "G",
                pais: "Uruguay",
                ubicaciones: [
                    { nombre: "Ruta 3 km 500, Salto", urlMaps: "https://goo.gl/maps/salto1" },
                ],
            },
        ]);
    });

    it("incluye las publicaciones no disponibles pero no incluye las dadas de baja", async () => {
        mockDb.productor.first.mockResolvedValue(productorBase);
        mockDb.publicaciones.all.mockResolvedValue([
            relacionBase,
            { ...relacionBase, publicacion: { ...publicacionBase, id: 202, publicacionDisponible: false } },
            { ...relacionBase, publicacion: { ...publicacionBase, id: 203, publicacionActiva: false } },
            { ...relacionBase, publicacion: { ...publicacionBase, id: 204, tipoPublicacion: "OPERADOR" } },
        ]);
 
        const resultado = await obtenerPerfilAdminProductor(2);
 
        expect(resultado?.publicaciones.map((p) => ({ id: p.id, disponible: p.disponible }))).toEqual([
            { id: 201, disponible: true },
            { id: 202, disponible: false },
        ]);
    });
 
});
