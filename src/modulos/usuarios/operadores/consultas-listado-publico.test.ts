import { Temporal } from "@js-temporal/polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerOperadoresPublicos } from "./consultas-listado-publico";
import "temporal-polyfill/full/global";

const { allMock, selectMock, includeMock, whereMock } = vi.hoisted(() => ({
    allMock: vi.fn(),
    selectMock: vi.fn(),
    includeMock: vi.fn(),
    whereMock: vi.fn(),
}));

vi.mock("../../../infraestructura/persistencia/prisma/db", () => {
    const consulta = {
        where: whereMock,
        select: selectMock,
        include: includeMock,
        all: allMock,
    };

    selectMock.mockReturnValue(consulta);
    whereMock.mockReturnValue(consulta);
    includeMock.mockImplementation(
        (_relacion: string, configurar: (subconsulta: typeof consulta) => unknown) => {
            configurar(consulta);
            return consulta;
        }
    );

    return { db: { orm: { public: { Operador: consulta } } } };
});

function relacionPublicacion(
    publicacionActiva: boolean,
    publicacionDisponible: boolean,
    tipoPublicacion: "OPERADOR" | "PRODUCTOR",
    fechaVigencia: Temporal.Instant | null = null
) {
    return {
        publicacion: {
            publicacionActiva,
            publicacionDisponible,
            tipoPublicacion,
            fechaVigencia,
        },
    };
}

describe("obtenerOperadoresPublicos", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        allMock.mockReset();
        vi.spyOn(Temporal.Now, "plainDateISO").mockReturnValue(Temporal.PlainDate.from("2026-09-24"));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("restringe el listado a usuarios habilitados", async () => {
        allMock.mockResolvedValue([]);
        await obtenerOperadoresPublicos();
        const predicado = whereMock.mock.calls[0][0];
        const evaluar = (estado: boolean) => predicado({
            usuario: { some: (condicion: (usuario: { habilitado: { eq: (valor: boolean) => boolean } }) => boolean) =>
                condicion({ habilitado: { eq: (valor) => estado === valor } }) },
        });

        expect(evaluar(false)).toBe(false);
        expect(evaluar(true)).toBe(true);
    });

    it("devuelve una lista vacía cuando no hay operadores", async () => {
        allMock.mockResolvedValue([]);
        expect(await obtenerOperadoresPublicos()).toEqual([]);
        expect(allMock).toHaveBeenCalledOnce();
        expect(selectMock).toHaveBeenCalledWith("id", "nombreFantasia", "fotoPerfil", "enLicencia");
        expect(selectMock).toHaveBeenCalledWith("numeroLocal", "finContrato");
        expect(selectMock).toHaveBeenCalledWith("nombreNave");
        expect(selectMock).toHaveBeenCalledWith("publicacionActiva", "publicacionDisponible", "tipoPublicacion", "fechaVigencia");
    });

    it("incluye locales sin fecha de fin, vigentes hoy y futuros", async () => {
        allMock.mockResolvedValue([{
            id: 1,
            nombreFantasia: "Frutas del Norte",
            fotoPerfil: null,
            locales: [
                { numeroLocal: "10", finContrato: null, nave: { nombreNave: "A" } },
                {
                    numeroLocal: "20",
                    finContrato: Temporal.Instant.from("2026-09-24T12:00:00Z"),
                    nave: { nombreNave: "B" },
                },
                {
                    numeroLocal: "30",
                    finContrato: Temporal.Instant.from("2026-09-25T12:00:00Z"),
                    nave: { nombreNave: "C" },
                },
                {
                    numeroLocal: "40",
                    finContrato: Temporal.Instant.from("2026-09-23T12:00:00Z"),
                    nave: { nombreNave: "D" },
                },
            ],
            publicacionesOperador: [],
        }]);

        expect(await obtenerOperadoresPublicos()).toEqual([{
            id: 1,
            nombreFantasia: "Frutas del Norte",
            fotoPerfil: null,
            cantidadProductos: 0,
            locales: [
                { numeroLocal: "10", nombreNave: "A" },
                { numeroLocal: "20", nombreNave: "B" },
                { numeroLocal: "30", nombreNave: "C" },
            ],
        }]);
    });

    it("excluye operadores que no tienen locales vigentes", async () => {
        allMock.mockResolvedValue([
            {
                id: 1,
                nombreFantasia: "Sin locales",
                fotoPerfil: null,
                locales: [],
                publicacionesOperador: [],
            },
            {
                id: 2,
                nombreFantasia: "Contrato vencido",
                fotoPerfil: null,
                locales: [{
                    numeroLocal: "5",
                    finContrato: Temporal.Instant.from("2026-09-23T12:00:00Z"),
                    nave: { nombreNave: "A" },
                }],
                publicacionesOperador: [],
            },
        ]);

        expect(await obtenerOperadoresPublicos()).toEqual([]);
    });

    it("cuenta solo productos visibles del operador y ordena por nombre", async () => {
        const localVigente = {
            numeroLocal: "1",
            finContrato: null,
            nave: { nombreNave: "A" },
        };

        allMock.mockResolvedValue([
            {
                id: 2,
                nombreFantasia: "Zeta",
                fotoPerfil: "/zeta.jpg",
                locales: [localVigente],
                publicacionesOperador: [
                    relacionPublicacion(true, true, "OPERADOR"),
                    relacionPublicacion(true, false, "OPERADOR"),
                    relacionPublicacion(false, true, "OPERADOR"),
                    relacionPublicacion(true, true, "PRODUCTOR"),
                    relacionPublicacion(true, true, "OPERADOR"),
                ],
            },
            {
                id: 1,
                nombreFantasia: "Álamos",
                fotoPerfil: null,
                locales: [localVigente],
                publicacionesOperador: [],
            },
        ]);

        const operadores = await obtenerOperadoresPublicos();

        expect(operadores.map((operador) => operador.nombreFantasia)).toEqual(["Álamos", "Zeta"]);
        expect(operadores[0].fotoPerfil).toBeNull();
        expect(operadores[1].cantidadProductos).toBe(2);
    });

    it("propaga un error de la consulta", async () => {
        allMock.mockRejectedValue(new Error("Falló la base de datos"));
        await expect(obtenerOperadoresPublicos()).rejects.toThrow("Falló la base de datos");
    });
    describe("vigencia de las publicaciones", () => {
        const DIA = 86_400_000;
        const enDias = (dias: number) =>
            Temporal.Instant.fromEpochMilliseconds(Date.now() + dias * DIA);

        const operadorConPublicaciones = (publicacionesOperador: unknown[]) => ({
            id: 1,
            nombreFantasia: "Frutas del Norte",
            fotoPerfil: null,
            locales: [{ numeroLocal: "1", finContrato: null, nave: { nombreNave: "A" } }],
            publicacionesOperador,
        });

        it("excluye publicaciones con fechaVigencia vencida del conteo de productos del operador", async () => {
            allMock.mockResolvedValue([
                operadorConPublicaciones([relacionPublicacion(true, true, "OPERADOR", enDias(-3))]),
            ]);

            const operadores = await obtenerOperadoresPublicos();

            expect(operadores[0].cantidadProductos).toBe(0);
        });

        it("incluye publicaciones con fechaVigencia futura en el conteo", async () => {
            allMock.mockResolvedValue([
                operadorConPublicaciones([relacionPublicacion(true, true, "OPERADOR", enDias(15))]),
            ]);

            const operadores = await obtenerOperadoresPublicos();

            expect(operadores[0].cantidadProductos).toBe(1);
        });

        it("incluye publicaciones sin fechaVigencia (null) en el conteo", async () => {
            allMock.mockResolvedValue([
                operadorConPublicaciones([relacionPublicacion(true, true, "OPERADOR", null)]),
            ]);

            const operadores = await obtenerOperadoresPublicos();

            expect(operadores[0].cantidadProductos).toBe(1);
        });

        it("cuenta solo las vigentes cuando conviven con una vencida", async () => {
            allMock.mockResolvedValue([
                operadorConPublicaciones([
                    relacionPublicacion(true, true, "OPERADOR", enDias(-3)),
                    relacionPublicacion(true, true, "OPERADOR", enDias(15)),
                    relacionPublicacion(true, true, "OPERADOR", null),
                ]),
            ]);

            const operadores = await obtenerOperadoresPublicos();

            expect(operadores[0].cantidadProductos).toBe(2);
        });

        it("mantiene al operador en el listado aunque todas sus publicaciones estén vencidas", async () => {
            allMock.mockResolvedValue([
                operadorConPublicaciones([relacionPublicacion(true, true, "OPERADOR", enDias(-1))]),
            ]);

            const operadores = await obtenerOperadoresPublicos();

            expect(operadores).toEqual([
                expect.objectContaining({ nombreFantasia: "Frutas del Norte", cantidadProductos: 0 }),
            ]);
        });
    });
});
