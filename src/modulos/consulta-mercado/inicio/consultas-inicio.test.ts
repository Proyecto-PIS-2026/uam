import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerEspeciesConPublicacionesActivas, obtenerEspeciesInicio, obtenerUrlListaInteligente } from "./consultas-inicio";
import { Temporal } from "@js-temporal/polyfill";
const mocks = vi.hoisted(() => ({
    query: vi.fn(),
    autorizado: vi.fn(),
    sql: vi.fn((fragmentos: TemplateStringsArray, ...valores: unknown[]) => ({
        returnsRow: () => ({
            build: () => ({ texto: fragmentos.join("?"), valores }),
        }),
    })),
}));

vi.mock("../../identidad-acceso/autorizacion/permisos", () => ({
    autorizado: mocks.autorizado,
}));

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        runtime: () => ({ query: mocks.query }),
        raw: { sql: mocks.sql },
        sql: {
            public: {
                especie: {
                    columns: {
                        nombreEspecie: "nombreEspecie",
                        fotoEspecie: "fotoEspecie",
                    },
                },
                configuracion: {
                    columns: {
                        valorConfiguracion: "valorConfiguracion",
                    },
                },
            },
        },
    },
}));

beforeEach(() => {
    vi.resetAllMocks();
    mocks.autorizado.mockReturnValue(true);
    mocks.query.mockResolvedValue([]);
});

describe("obtenerEspeciesConPublicacionesActivas", () => {
    it("devuelve las especies con sus fotos y cantidad de operadores", async () => {
        const especies = [
            { nombreEspecie: "Banana", fotoEspecie: "/generico/banana.webp", cantidadOperadores: 3 },
            { nombreEspecie: "Manzana", fotoEspecie: null, cantidadOperadores: 5 },
        ];
        mocks.query.mockResolvedValue(especies);
        expect(await obtenerEspeciesConPublicacionesActivas()).toEqual(especies);
        expect(mocks.query).toHaveBeenCalledOnce();
    });

    it("consulta la foto de la base y cuenta operadores distintos con publicaciones visibles y locales vigentes", async () => {
        await obtenerEspeciesConPublicacionesActivas();
        const sql = mocks.sql.mock.calls[0][0].join("?");
        expect(sql).toContain('e."fotoEspecie"');
        expect(sql).toContain('COUNT(DISTINCT po."operadorId")');
        expect(sql).toContain('p."publicacionDisponible" = true');
        expect(sql).toContain('p."publicacionActiva" = true');
        expect(sql).toContain('p."tipoPublicacion" = \'OPERADOR\'');
        expect(sql).toContain("AND EXISTS");
        expect(sql).toContain('l."operadorId" = po."operadorId"');
        expect(sql).toContain('l."finContrato" IS NULL');
        expect(sql).toContain("AT TIME ZONE 'America/Montevideo')::date >= ");
        expect(sql).toContain('GROUP BY e.id, e."nombreEspecie", e."fotoEspecie"');
        expect(sql).not.toContain("JOIN local");
    });

    it("incluye el filtro de usuarios habilitados en el conteo de operadores por especie", async () => {
        await obtenerEspeciesConPublicacionesActivas();
        const sql = mocks.sql.mock.calls[0][0].join("?");
        expect(sql).toContain('JOIN operador o ON o.id = po."operadorId"');
        expect(sql).toContain('JOIN usuario u ON u.id = o."usuarioId" AND u.habilitado = true');
    });

    it("rechaza la consulta cuando no tiene permisos", async () => {
        mocks.autorizado.mockReturnValue(false);
        await expect(obtenerEspeciesConPublicacionesActivas()).rejects.toThrow("No tiene permisos para consultar publicaciones de Operadores.");
        expect(mocks.query).not.toHaveBeenCalled();
    });

    it("propaga los errores de la base", async () => {
        mocks.query.mockRejectedValue(new Error("Sin conexión"));
        await expect(obtenerEspeciesConPublicacionesActivas()).rejects.toThrow("Sin conexión");
    });
});

describe("obtenerEspeciesInicio", () => {
    it("usa la fotografía guardada en la base aunque el nombre del archivo no coincida con la especie", async () => {
        mocks.query.mockResolvedValue([{ nombreEspecie: "Banana", fotoEspecie: "/imagenes/foto-personalizada.webp", cantidadOperadores: 3 }]);
        expect(await obtenerEspeciesInicio()).toEqual([{ nombreEspecie: "Banana", fotoGenerica: "/imagenes/foto-personalizada.webp", cantidadOperadores: 3 }]);
    });

    it("conserva una URL completa guardada en la base", async () => {
        const foto = "https://imagenes.example.com/especies/manzana.webp?v=2";
        mocks.query.mockResolvedValue([{ nombreEspecie: "Manzana", fotoEspecie: foto, cantidadOperadores: 5 }]);
        const resultado = await obtenerEspeciesInicio();
        expect(resultado[0].fotoGenerica).toBe(foto);
    });

    it("devuelve null cuando la especie no tiene fotografía", async () => {
        mocks.query.mockResolvedValue([{ nombreEspecie: "Banana", fotoEspecie: null, cantidadOperadores: 3 }]);
        expect(await obtenerEspeciesInicio()).toEqual([{ nombreEspecie: "Banana", fotoGenerica: null, cantidadOperadores: 3 }]);
    });

    it("refleja una fotografía actualizada en la siguiente consulta", async () => {
        mocks.query.mockResolvedValueOnce([{ nombreEspecie: "Tomate", fotoEspecie: "/foto-anterior.webp", cantidadOperadores: 2 }]);
        mocks.query.mockResolvedValueOnce([{ nombreEspecie: "Tomate", fotoEspecie: "/foto-nueva.webp", cantidadOperadores: 2 }]);
        expect((await obtenerEspeciesInicio())[0].fotoGenerica).toBe("/foto-anterior.webp");
        expect((await obtenerEspeciesInicio())[0].fotoGenerica).toBe("/foto-nueva.webp");
    });

    it("refleja la eliminación de la fotografía sin recuperar una imagen genérica", async () => {
        mocks.query.mockResolvedValueOnce([{ nombreEspecie: "Tomate", fotoEspecie: "/generico/tomate.webp", cantidadOperadores: 2 }]);
        mocks.query.mockResolvedValueOnce([{ nombreEspecie: "Tomate", fotoEspecie: null, cantidadOperadores: 2 }]);
        expect((await obtenerEspeciesInicio())[0].fotoGenerica).toBe("/generico/tomate.webp");
        expect((await obtenerEspeciesInicio())[0].fotoGenerica).toBeNull();
    });

    it("devuelve una lista vacía cuando no hay especies disponibles", async () => {
        expect(await obtenerEspeciesInicio()).toEqual([]);
    });

    it("propaga los errores de la consulta", async () => {
        mocks.query.mockRejectedValue(new Error("No se pudieron cargar las especies"));
        await expect(obtenerEspeciesInicio()).rejects.toThrow("No se pudieron cargar las especies");
    });
});

describe("obtenerUrlListaInteligente", () => {
    it("devuelve la URL guardada", async () => {
        const url = "https://uam.com.uy/lista-inteligente.pdf";
        mocks.query.mockResolvedValue([{ valorConfiguracion: url }]);
        expect(await obtenerUrlListaInteligente()).toBe(url);
        expect(mocks.query).toHaveBeenCalledOnce();
    });

    it("consulta la configuración de la Lista Inteligente", async () => {
        await obtenerUrlListaInteligente();
        const sql = mocks.sql.mock.calls[0][0].join("?");
        expect(sql).toContain("FROM public.configuracion");
        expect(sql).toContain("c.\"nombreConfiguracion\" = 'url_lista_inteligente'");
    });

    it("devuelve null cuando no existe la configuración", async () => {
        expect(await obtenerUrlListaInteligente()).toBeNull();
    });

    it("devuelve null cuando el valor guardado es nulo", async () => {
        mocks.query.mockResolvedValue([{ valorConfiguracion: null }]);
        expect(await obtenerUrlListaInteligente()).toBeNull();
    });

    it("rechaza la consulta cuando no tiene permisos", async () => {
        mocks.autorizado.mockReturnValue(false);
        await expect(obtenerUrlListaInteligente()).rejects.toThrow("No tiene permisos para consultar la Lista Inteligente.");
        expect(mocks.query).not.toHaveBeenCalled();
    });

    it("propaga los errores de la base", async () => {
        mocks.query.mockRejectedValue(new Error("Sin conexión"));
        await expect(obtenerUrlListaInteligente()).rejects.toThrow("Sin conexión");
    });

    it("excluye publicaciones con fechaVigencia vencida comparando contra la fecha de hoy en Montevideo", async () => {
        await obtenerEspeciesConPublicacionesActivas();
        const hoy = Temporal.Now.plainDateISO("America/Montevideo").toString();
        const sql = mocks.sql.mock.calls[0][0].join("?");
        expect(sql).toContain('(p."fechaVigencia" AT TIME ZONE \'America/Montevideo\')::date >= ?::date');
        expect(mocks.sql.mock.calls[0].slice(1)).toEqual([hoy, hoy]);
    });

    it("incluye publicaciones con fechaVigencia futura o que vence hoy", async () => {
        await obtenerEspeciesConPublicacionesActivas();
        const sql = mocks.sql.mock.calls[0][0].join("?");
        expect(sql).toMatch(/p\."fechaVigencia" AT TIME ZONE 'America\/Montevideo'\)::date >= \?::date/);
        expect(sql).not.toMatch(/p\."fechaVigencia" AT TIME ZONE 'America\/Montevideo'\)::date > \?::date/);
    });

    it("incluye publicaciones sin fechaVigencia (null) en el conteo", async () => {
        await obtenerEspeciesConPublicacionesActivas();
        const sql = mocks.sql.mock.calls[0][0].join("?");
        expect(sql).toContain('(p."fechaVigencia" IS NULL OR');
    });
});