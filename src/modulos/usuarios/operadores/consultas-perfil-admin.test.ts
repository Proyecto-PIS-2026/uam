import { Temporal } from "@js-temporal/polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPerfilAdminOperador } from "./consultas-perfil-admin";

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
    imagenes: {
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
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
                Imagen: mockDb.imagenes,
            },
        },
    },
}));

// Informacion de prueba de un operador
const operadorBase = {
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

const publicacionBase = {
    id: 101,
    version: 7,
    foto: null,
    precio: "120.00",
    cantidadUnidades: 20,
    fecha: Temporal.Instant.from("2026-10-01T12:00:00Z"),
    publicacionActiva: true,
    publicacionDisponible: true,
    tipoPublicacion: "OPERADOR",
    especie: { nombreEspecie: "Tomate" },
            variedad: { nombreVariedad: "Perita" },
            presentacion: { nombrePresentacion: "Cajón" },
    categoria: { nombreCategoria: "Extra" },
    calibre: { codigoCalibre: "A" },
};

describe("obtenerPerfilAdminOperador", () => {

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

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

    // Verifica que los ids inválidos sean rechazados sin consultar la base de datos
    it.each([0.5, -1, 0, NaN])(
        "rechaza el id inválido %s sin consultar la base",
        async (id) => {
            const resultado = await obtenerPerfilAdminOperador(id);

            expect(resultado).toBeNull();
            expect(mockDb.operador.first).not.toHaveBeenCalled();
        }
    );

    // Verifica que se devuelva null cuando no existe un operador con ese id
    it("devuelve null si el operador no existe", async () => {
        const resultado = await obtenerPerfilAdminOperador(13);

        expect(resultado).toBeNull();
        expect(mockDb.operador.first).toHaveBeenCalledWith({ id: 13 });
        expect(mockDb.publicaciones.all).not.toHaveBeenCalled();
    });

    // Un local sin fecha de fin se devuelve con finContrato null
    it("devuelve el perfil con un local sin fecha de fin", async () => {
        mockDb.operador.first.mockResolvedValue(operadorBase);

        const resultado = await obtenerPerfilAdminOperador(13);

        expect(resultado).toEqual({
            id: 13,
            nombreFantasia: "Frutas del Norte",
            fotoPerfil: "/operadores/frutas-del-norte.jpg",
            whatsApp: "+59899100001",
            locales: [
                {
                    numeroLocal: "18",
                    nombreNave: "B",
                    finContrato: null,
                },
            ],
            publicaciones: [],
        });
        expect(mockDb.publicaciones.where).toHaveBeenCalledWith({ operadorId: 13 });
    });

    // La fecha se convierte en la zona de Montevideo, no en UTC
    it("convierte la fecha de fin a la zona horaria de Montevideo", async () => {
        mockDb.operador.first.mockResolvedValue({
            ...operadorBase,
            locales: [
                {
                    numeroLocal: "18",
                    // 1 de enero 01:00 en UTC = 31 de diciembre 22:00 en Montevideo
                    finContrato: Temporal.Instant.from("2027-01-01T01:00:00Z"),
                    nave: { nombreNave: "B" },
                },
            ],
        });

        const resultado = await obtenerPerfilAdminOperador(13);

        expect(resultado?.locales[0].finContrato).toBe("2026-12-31");
    });

    // Diferencia con el perfil público: el admin ve también los contratos vencidos
    it("incluye los locales con contrato vencido", async () => {
        mockDb.operador.first.mockResolvedValue({
            ...operadorBase,
            locales: [
                {
                    numeroLocal: "19",
                    finContrato: Temporal.Instant.from("2000-01-01T12:00:00Z"),
                    nave: { nombreNave: "C" },
                },
            ],
        });

        const resultado = await obtenerPerfilAdminOperador(13);

        expect(resultado?.locales).toEqual([
            { numeroLocal: "19", nombreNave: "C", finContrato: "2000-01-01" },
        ]);
    });

    // Diferencia con el perfil público: el admin ve las publicaciones no disponibles, pero no las dadas de baja
    it("incluye las publicaciones no disponibles pero no incluye las dadas de baja", async () => {
        mockDb.operador.first.mockResolvedValue(operadorBase);
        mockDb.publicaciones.all.mockResolvedValue([
            { publicacion: publicacionBase, pais: { nombrePais: "URUGUAY" } },
            { publicacion: { ...publicacionBase, id: 102, publicacionDisponible: false }, pais: { nombrePais: "URUGUAY" } },
            { publicacion: { ...publicacionBase, id: 103, publicacionActiva: false }, pais: { nombrePais: "URUGUAY" } },
            { publicacion: { ...publicacionBase, id: 104, tipoPublicacion: "PRODUCTOR" }, pais: { nombrePais: "URUGUAY" } },
        ]);

        const resultado = await obtenerPerfilAdminOperador(13);

        expect(resultado?.publicaciones.map((p) => ({ id: p.id, disponible: p.disponible }))).toEqual([
            { id: 101, disponible: true },
            { id: 102, disponible: false },
        ]);
        expect(resultado?.publicaciones.map((p) => p.cantidadUnidades)).toEqual([20, 20]);
        expect(resultado?.publicaciones.map((p) => p.version)).toEqual([7, 7]);
        expect(mockDb.publicaciones.select.mock.calls.some((campos) => campos.includes("version"))).toBe(true);
    });

    // Los locales se ordenan por nave y, dentro de cada nave, por número de local
    it("ordena los locales por nave y por número de local", async () => {
        mockDb.operador.first.mockResolvedValue({
            ...operadorBase,
            locales: [
                { numeroLocal: "180", finContrato: null, nave: { nombreNave: "D" } },
                { numeroLocal: "10", finContrato: null, nave: { nombreNave: "A" } },
                { numeroLocal: "161", finContrato: null, nave: { nombreNave: "D" } },
                { numeroLocal: "9", finContrato: null, nave: { nombreNave: "A" } },
            ],
        });

        const resultado = await obtenerPerfilAdminOperador(13);

        expect(resultado?.locales.map((local) => `${local.nombreNave}-${local.numeroLocal}`)).toEqual([
            "A-9",
            "A-10",
            "D-161",
            "D-180",
        ]);
    });

    it("conserva la licencia y el comentario mientras oculta solo las fotos vencidas", async () => {
        vi.stubEnv("VIGENCIA_FOTOS_DIAS", "1");
        vi.spyOn(Temporal.Now, "instant").mockReturnValue(Temporal.Instant.from("2026-11-04T03:00:00Z"));
        const archivo = "12345678-1234-4123-8123-123456789abc.webp";
        const fotoVencida = `/api/publicaciones/imagenes/101/${archivo}`;
        const fotoVigente = `/api/publicaciones/imagenes/102/${archivo}`;
        mockDb.operador.first.mockResolvedValue({ ...operadorBase, enLicencia: true, comentario: "Retoma la actividad la semana siguiente." });
        mockDb.publicaciones.all.mockResolvedValue([
            { publicacion: { ...publicacionBase, foto: fotoVencida }, pais: null },
            { publicacion: { ...publicacionBase, id: 102, foto: fotoVigente }, pais: null },
        ]);
        mockDb.imagenes.all.mockResolvedValue([
            { clave: `publicaciones/101/${archivo}`, cargadaEn: Temporal.Instant.from("2026-11-03T03:00:00Z") },
            { clave: `publicaciones/102/${archivo}`, cargadaEn: Temporal.Instant.from("2026-11-03T03:00:01Z") },
        ]);

        const resultado = await obtenerPerfilAdminOperador(13);

        expect(resultado).toMatchObject({
            enLicencia: true,
            comentario: "Retoma la actividad la semana siguiente.",
            publicaciones: [
                { id: 101, foto: null, precio: "120.00" },
                { id: 102, foto: fotoVigente, precio: "120.00" },
            ],
        });
        expect(mockDb.imagenes.all).toHaveBeenCalledOnce();
    });

});
