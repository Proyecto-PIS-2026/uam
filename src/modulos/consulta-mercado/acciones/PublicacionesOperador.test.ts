import { consultarPublicaciones } from "./PublicacionesOperador";
import { normalizarFiltros } from "./filtros-consulta";

const { query, sql, autorizado } = vi.hoisted(() => ({
    query: vi.fn(),
    sql: vi.fn((partes: TemplateStringsArray, ...valores: unknown[]) => ({
        returnsRow: () => ({ build: () => ({ texto: partes.join("?"), valores }) }),
    })),
    autorizado: vi.fn(() => true),
}));

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({ db: { raw: { sql }, runtime: () => ({ query }) } }));
vi.mock("../../identidad-acceso/autorizacion/permisos", () => ({ autorizado }));

const resultado = { publicaciones: [], opciones: [], naves: [], total: 0, totalCatalogo: 0 };

beforeEach(() => {
    vi.clearAllMocks();
    autorizado.mockReturnValue(true);
    query.mockResolvedValue([{ resultado: JSON.stringify(resultado) }]);
});

it("consulta todas las publicaciones coincidentes sin limitar ni desplazar resultados", async () => {
    expect(await consultarPublicaciones()).toEqual(resultado);
    expect(query).toHaveBeenCalledOnce();
    const plan = query.mock.calls[0][0];
    expect(plan.texto).not.toMatch(/\b(?:LIMIT|OFFSET)\b/);
    expect(plan.texto).toContain('p."publicacionActiva" = true');
    expect(plan.texto).toContain("p.\"tipoPublicacion\" = 'OPERADOR'");
    expect(plan.texto).toContain('p."publicacionDisponible" = true');
    expect(plan.texto).toContain("America/Montevideo");
    expect(plan.texto).toContain('FROM "publicacionOperador"');
    expect(plan.texto).not.toContain('FROM "publicacionProductor"');
});

it("parametriza filtros y orden sin interpolar SQL recibido del cliente", async () => {
    const busqueda = "tomate '; drop table publicacion; --";
    const nave = "A' OR 1=1 --";
    await consultarPublicaciones({ busqueda, especie: "Tomate", nave, precioMinimo: "12", precioMaximo: "80", orden: "precioDesc" });
    const plan = query.mock.calls[0][0];
    expect(plan.texto).not.toContain(busqueda);
    expect(plan.valores).toContain(busqueda);
    expect(plan.texto).not.toContain(nave);
    expect(plan.valores).toContain(nave);
    expect(plan.valores).toContain(12);
    expect(plan.valores).toContain("Tomate");
    expect(plan.valores).toContain("precioDesc");
    expect(plan.valores).not.toContain(null);
});

it("conserva las naves disponibles al devolver un catálogo filtrado vacío", async () => {
    const vacio = { ...resultado, naves: ["A", "B"], totalCatalogo: 2 };
    query.mockResolvedValue([{ resultado: JSON.stringify(vacio) }]);

    expect(await consultarPublicaciones({ nave: "Desconocida" })).toEqual(vacio);
});

it("rechaza filtros inválidos antes de consultar la base", async () => {
    await expect(consultarPublicaciones({ precioMinimo: "-1" })).rejects.toThrow("precio");
    expect(query).not.toHaveBeenCalled();
});

it("no consulta la base cuando no está autorizado", async () => {
    autorizado.mockReturnValue(false);
    await expect(consultarPublicaciones()).rejects.toThrow("permisos");
    expect(query).not.toHaveBeenCalled();
});

it("no oculta una falla de la base como si fuera un catálogo vacío", async () => {
    query.mockRejectedValue(new Error("sin conexión"));
    await expect(consultarPublicaciones()).rejects.toThrow("sin conexión");
});

it("normaliza tildes, filtros vacíos y valores por defecto", () => {
    expect(normalizarFiltros({ busqueda: "  LIMÓN Ñandú ", especie: "Todas" })).toMatchObject({ busqueda: "limon nandu", especie: "", nave: "", orden: "prioridad", precioMinimo: null });
});

it.each([undefined, "", "   ", "Todas"])("interpreta nave %j como todas las naves", (nave) => {
    expect(normalizarFiltros({ nave }).nave).toBe("");
});

it("recorta la nave sin alterar el nombre exacto", () => {
    expect(normalizarFiltros({ nave: "  Nave A  " }).nave).toBe("Nave A");
});

it.each([{ precioMinimo: "0" }, { precioMinimo: "000" }, { precioMaximo: "12.50" }, { precioMinimo: "-1" }, { precioMaximo: "1e9" }, { busqueda: "x".repeat(201) }, { orden: "SQL" }, { nave: "x".repeat(101) }, { nave: 1 }])("rechaza parámetros fuera de contrato %j", (entrada) => {
    expect(() => normalizarFiltros(entrada as Parameters<typeof normalizarFiltros>[0])).toThrow();
});

it("interpreta ambos límites vacíos como ausencia de restricción de precio", () => {
    expect(normalizarFiltros({ precioMinimo: "", precioMaximo: "   " })).toMatchObject({ precioMinimo: null, precioMaximo: null });
});
