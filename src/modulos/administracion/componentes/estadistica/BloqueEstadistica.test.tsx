
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import {
    fireEvent,
    render,
    screen,
    within,
} from "@testing-library/react";
import {
    isValidElement,
    type ChangeEvent,
    type ReactNode,
} from "react";
import type { TipoSeccionEstadistica } from "./Tipos";
import BloqueEstadistica from "./BloqueEstadistica";

vi.mock("@mui/material", () => ({
    TextField: ({
        select,
        label,
        value,
        onChange,
        type,
        children,
        slotProps,
    }: {
        select?: boolean;
        label?: string;
        value?: string;
        onChange?: (
            event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
        ) => void;
        type?: string;
        children?: ReactNode;
        slotProps?: {
            htmlInput?: {
                min?: string;
                max?: string;
            };
        };
    }) => (
        <label>
            {label}
            {select ? (
                <select
                    aria-label={label}
                    value={value ?? ""}
                    onChange={onChange}
                >
                    {children}
                </select>
            ) : (
                <input
                    aria-label={label}
                    type={type ?? "text"}
                    value={value ?? ""}
                    min={slotProps?.htmlInput?.min}
                    max={slotProps?.htmlInput?.max}
                    onChange={onChange}
                />
            )}
        </label>
    ),

    MenuItem: ({
        value,
        children,
    }: {
        value: string;
        children?: ReactNode;
    }) => (
        <option value={value}>
            {children}
        </option>
    ),

    Autocomplete: ({
        options,
        value,
        onChange,
        renderInput,
    }: {
        options: Array<{
            valor: string;
            etiqueta: string;
        }>;
        value: {
            valor: string;
            etiqueta: string;
        } | null;
        onChange: (
            event: null,
            newValue: {
                valor: string;
                etiqueta: string;
            } | null,
        ) => void;
        renderInput: (params: Record<string, unknown>) => ReactNode;
    }) => {
        const entrada = renderInput({});
        const etiqueta = isValidElement<{ label?: string }>(entrada)
            ? entrada.props.label ?? "Filtro"
            : "Filtro";

        return (
            <label>
                {etiqueta}
                <select
                    aria-label={etiqueta}
                    value={value?.valor ?? "todos"}
                    onChange={(event) => {
                        const nuevaOpcion = options.find(
                            (op) => op.valor === event.target.value,
                        ) ?? null;

                        onChange(null, nuevaOpcion);
                    }}
                >
                    <option value="todos">
                        Todos
                    </option>

                    {options.map((op) => (
                        <option key={op.valor} value={op.valor}>
                            {op.etiqueta}
                        </option>
                    ))}
                </select>
            </label>
        );
    },
}));

vi.mock("recharts", () => ({
    ResponsiveContainer: ({
        children,
    }: {
        children?: ReactNode;
    }) => (
        <div>
            {children}
        </div>
    ),

    LineChart: ({
        data,
        children,
    }: {
        data: unknown[];
        children?: ReactNode;
    }) => (
        <div data-testid="grafica">
            <output data-testid="datos-grafica">
                {JSON.stringify(data)}
            </output>
            {children}
        </div>
    ),

    CartesianGrid: () => null,

    XAxis: ({
        tickFormatter,
        ticks,
    }: {
        tickFormatter?: (value: unknown) => string;
        ticks?: number[];
    }) => {
        const fecha = new Date(2026, 9, 20).getTime();

        return (
            <div data-testid="eje-x">
                <output data-testid="ticks-eje-x">
                    {JSON.stringify(ticks ?? [])}
                </output>

                <output data-testid="tick-numerico">
                    {tickFormatter?.(fecha) ?? ""}
                </output>

                <output data-testid="tick-no-numerico">
                    {tickFormatter?.("fecha-invalida") ?? ""}
                </output>
            </div>
        );
    },

    YAxis: () => null,

    Tooltip: ({
        labelFormatter,
        formatter,
    }: {
        labelFormatter?: (label: unknown) => string;
        formatter?: (value: unknown) => unknown;
    }) => {
        const fecha = new Date(2026, 9, 20).getTime();

        return (
            <div data-testid="tooltip">
                <output data-testid="tooltip-fecha">
                    {labelFormatter?.(fecha) ?? ""}
                </output>

                <output data-testid="tooltip-fecha-invalida">
                    {labelFormatter?.("fecha-invalida") ?? ""}
                </output>

                <output data-testid="tooltip-cantidad">
                    {JSON.stringify(formatter?.(123))}
                </output>

                <output data-testid="tooltip-cantidad-vacia">
                    {JSON.stringify(formatter?.(undefined))}
                </output>
            </div>
        );
    },

    Line: ({
        dataKey,
    }: {
        dataKey: string;
    }) => (
        <span data-testid={`linea-${dataKey}`} />
    ),
}));

type DatoEstadistica = {
    fecha: Date | string;
    cantidad: number;
    tipoVisitante?: string;
    username?: string;
    especie?: string;
};

const fechaLocal = (
    anio: number,
    mes: number,
    dia: number,
) => new Date(anio, mes - 1, dia, 12);

const datosVisitas: DatoEstadistica[] = [
    {
        fecha: fechaLocal(2026, 9, 19),
        cantidad: 100,
        tipoVisitante: "comprador",
    },
    {
        fecha: fechaLocal(2026, 9, 20),
        cantidad: 4,
        tipoVisitante: "comprador",
    },
    {
        fecha: fechaLocal(2026, 10, 19),
        cantidad: 2,
        tipoVisitante: "comprador",
    },
    {
        fecha: fechaLocal(2026, 10, 20),
        cantidad: 5,
        tipoVisitante: "comprador",
    },
    {
        fecha: fechaLocal(2026, 10, 20),
        cantidad: 3,
        tipoVisitante: "operador",
    },
];

function renderizarBloque({
    titulo = "Visitas",
    tipo = "visitas",
    datos = datosVisitas,
}: {
    titulo?: string;
    tipo?: TipoSeccionEstadistica;
    datos?: DatoEstadistica[];
} = {}) {
    return render(
        <BloqueEstadistica
            titulo={titulo}
            tipo={tipo}
            datos={datos}
        />,
    );
}

function obtenerTarjeta(titulo: string) {
    const elemento = screen.getByText(titulo);
    const tarjeta = elemento.parentElement;

    if (!tarjeta) {
        throw new Error(`No se encontró la tarjeta: ${titulo}`);
    }

    return tarjeta;
}

function obtenerDatosGrafica() {
    return JSON.parse(
        screen.getByTestId("datos-grafica").textContent ?? "[]",
    ) as Array<{
        fecha: number;
        cantidad: number;
    }>;
}

function obtenerTicksEjeX() {
    return JSON.parse(
        screen.getByTestId("ticks-eje-x").textContent ?? "[]",
    ) as number[];
}

function obtenerOpciones(filtro: string) {
    const elemento = screen.getByLabelText(filtro) as HTMLSelectElement;

    return Array.from(elemento.options).map((opcion) => opcion.value);
}

describe("BloqueEstadistica", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(fechaLocal(2026, 10, 20));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("visitas", () => {
        it("muestra el título, la descripción y los filtros correspondientes", () => {
            renderizarBloque();

            expect(
                screen.getByRole("heading", {
                    name: "Visitas",
                }),
            ).toBeInTheDocument();

            expect(
                screen.getByText(
                    "Visualización estadística de visitas",
                ),
            ).toBeInTheDocument();

            expect(
                screen.getByLabelText("Tipo de Visitante"),
            ).toBeInTheDocument();

            expect(
                screen.getByLabelText("Período"),
            ).toBeInTheDocument();

            expect(
                screen.queryByLabelText("Usuario"),
            ).not.toBeInTheDocument();
        });

        it("muestra los totales de hoy y del rango seleccionado", () => {
            renderizarBloque();

            const tarjetaHoy = obtenerTarjeta("Total de Hoy");
            const tarjetaRango = obtenerTarjeta(
                "Total del Rango Seleccionado",
            );

            expect(
                within(tarjetaHoy).getByText("Visitas"),
            ).toBeInTheDocument();

            expect(
                within(tarjetaHoy).getByText("8"),
            ).toBeInTheDocument();

            expect(
                within(tarjetaRango).getByText("Visitas"),
            ).toBeInTheDocument();

            expect(
                within(tarjetaRango).getByText("14"),
            ).toBeInTheDocument();
        });

        it("genera los datos diarios y completa los días sin registros", () => {
            renderizarBloque();

            const datos = obtenerDatosGrafica();

            expect(datos).toHaveLength(31);

            expect(datos[0]).toEqual({
                fecha: fechaLocal(2026, 9, 20).setHours(0, 0, 0, 0),
                cantidad: 4,
            });

            expect(datos[1].cantidad).toBe(0);
            expect(datos[29].cantidad).toBe(2);
            expect(datos[30].cantidad).toBe(8);

            expect(
                screen.getByTestId("linea-cantidad"),
            ).toBeInTheDocument();
        });

        it("acumula los registros que pertenecen al mismo día", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 2,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 3,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 4,
                    tipoVisitante: "operador",
                },
            ];

            renderizarBloque({ datos });

            expect(obtenerDatosGrafica().at(-1)?.cantidad).toBe(9);

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("9"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("9"),
            ).toBeInTheDocument();
        });

        it("filtra las visitas por tipo de visitante y actualiza las métricas", () => {
            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Tipo de Visitante"),
                {
                    target: { value: "comprador" },
                },
            );

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("5"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("11"),
            ).toBeInTheDocument();

            expect(obtenerDatosGrafica()[30].cantidad).toBe(5);
        });

        it("filtra el tipo de visitante sin distinguir mayúsculas y minúsculas", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 5,
                    tipoVisitante: "COMPRADOR",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 3,
                    tipoVisitante: "Operador",
                },
            ];

            renderizarBloque({ datos });

            fireEvent.change(
                screen.getByLabelText("Tipo de Visitante"),
                {
                    target: { value: "comprador" },
                },
            );

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("5"),
            ).toBeInTheDocument();

            expect(obtenerDatosGrafica().at(-1)?.cantidad).toBe(5);
        });

        it("muestra cero cuando el tipo de visitante seleccionado no tiene registros", () => {
            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Tipo de Visitante"),
                {
                    target: { value: "productor" },
                },
            );

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("0"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("0"),
            ).toBeInTheDocument();

            expect(
                obtenerDatosGrafica().every((item) => item.cantidad === 0),
            ).toBe(true);
        });

        it("conserva el usuario seleccionado al quitar el filtro de especie", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 2,
                    username: "usuario1",
                    especie: "Tomate",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 3,
                    username: "usuario1",
                    especie: "Manzana",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 4,
                    username: "usuario2",
                    especie: "Tomate",
                },
            ];

            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos,
            });

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "usuario1" },
            });

            fireEvent.change(screen.getByLabelText("Especie"), {
                target: { value: "Manzana" },
            });

            expect(screen.getByLabelText("Usuario")).toHaveValue("usuario1");

            fireEvent.change(screen.getByLabelText("Especie"), {
                target: { value: "todos" },
            });

            expect(screen.getByLabelText("Usuario")).toHaveValue("usuario1");

            expect(obtenerOpciones("Especie")).toEqual([
                "todos",
                "Manzana",
                "Tomate",
            ]);
        });
    });

    describe("períodos y fechas", () => {
        it.each([
            { rango: "1s", fecha: "2026-10-13" },
            { rango: "1m", fecha: "2026-09-20" },
            { rango: "3m", fecha: "2026-07-20" },
            { rango: "6m", fecha: "2026-04-20" },
            { rango: "1y", fecha: "2025-10-20" },
        ])("calcula correctamente el rango $rango", ({ rango, fecha }) => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2025, 10, 20),
                    cantidad: 1,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 4, 20),
                    cantidad: 2,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 7, 20),
                    cantidad: 3,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 9, 20),
                    cantidad: 4,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 10, 13),
                    cantidad: 5,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 6,
                    tipoVisitante: "comprador",
                },
            ];

            renderizarBloque({ datos });

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: rango },
                },
            );

            const fechaEsperada = new Date(
                `${fecha}T00:00:00`,
            ).getTime();

            expect(obtenerDatosGrafica()[0].fecha).toBe(fechaEsperada);
        });

        it("calcula correctamente los últimos siete días sin incluir registros anteriores", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 10, 12),
                    cantidad: 90,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 10, 13),
                    cantidad: 9,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 10, 19),
                    cantidad: 2,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 5,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 3,
                    tipoVisitante: "operador",
                },
            ];

            renderizarBloque({ datos });

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "1s" },
                },
            );

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("19"),
            ).toBeInTheDocument();

            const datosGrafica = obtenerDatosGrafica();

            expect(datosGrafica).toHaveLength(8);
            expect(datosGrafica[0].cantidad).toBe(9);
            expect(datosGrafica[7].cantidad).toBe(8);
        });

        it("genera cinco marcas equiespaciadas para el rango semanal", () => {
            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "1s" },
                },
            );

            const datos = obtenerDatosGrafica();
            const ticks = obtenerTicksEjeX();

            expect(ticks).toHaveLength(5);
            expect(ticks[0]).toBe(datos[0].fecha);
            expect(ticks.at(-1)).toBe(datos.at(-1)?.fecha);

            const separaciones = ticks.slice(1).map(
                (tick, indice) => tick - ticks[indice],
            );

            separaciones.forEach((separacion) => {
                expect(separacion).toBeCloseTo(separaciones[0], 5);
            });
        });

        it("genera una marca por cada fecha cuando el rango tiene menos de cinco días", () => {
            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "personalizado" },
                },
            );

            fireEvent.change(screen.getByLabelText("Desde"), {
                target: { value: "2026-10-18" },
            });

            fireEvent.change(screen.getByLabelText("Hasta"), {
                target: { value: "2026-10-20" },
            });

            const datos = obtenerDatosGrafica();
            const ticks = obtenerTicksEjeX();

            expect(datos).toHaveLength(3);
            expect(ticks).toHaveLength(3);
            expect(ticks).toEqual(datos.map((item) => item.fecha));
        });

        it("no permite seleccionar el mismo día como Desde y Hasta", () => {
            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "personalizado" },
                },
            );

            const campoDesde = screen.getByLabelText(
                "Desde",
            ) as HTMLInputElement;

            const campoHasta = screen.getByLabelText(
                "Hasta",
            ) as HTMLInputElement;

            fireEvent.change(campoDesde, {
                target: { value: "2026-10-20" },
            });

            expect(campoDesde).toHaveValue("2026-09-20");

            fireEvent.change(campoHasta, {
                target: { value: "2026-09-20" },
            });

            expect(campoHasta).toHaveValue("2026-10-20");

            expect(obtenerDatosGrafica()).toHaveLength(31);
        });

        it("no permite que Desde sea posterior a Hasta", () => {
            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "personalizado" },
                },
            );

            const campoDesde = screen.getByLabelText(
                "Desde",
            ) as HTMLInputElement;

            fireEvent.change(campoDesde, {
                target: { value: "2026-10-21" },
            });

            expect(campoDesde).toHaveValue("2026-09-20");
            expect(obtenerDatosGrafica()).toHaveLength(31);
        });

        it("no permite que Hasta sea anterior a Desde", () => {
            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "personalizado" },
                },
            );

            const campoHasta = screen.getByLabelText(
                "Hasta",
            ) as HTMLInputElement;

            fireEvent.change(campoHasta, {
                target: { value: "2026-09-19" },
            });

            expect(campoHasta).toHaveValue("2026-10-20");
            expect(obtenerDatosGrafica()).toHaveLength(31);
        });

        it("establece correctamente los límites mínimos y máximos de los campos de fecha", () => {
            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "personalizado" },
                },
            );

            const campoDesde = screen.getByLabelText(
                "Desde",
            ) as HTMLInputElement;

            const campoHasta = screen.getByLabelText(
                "Hasta",
            ) as HTMLInputElement;

            expect(campoDesde).toHaveAttribute("max", "2026-10-19");
            expect(campoHasta).toHaveAttribute("min", "2026-09-21");

            fireEvent.change(campoDesde, {
                target: { value: "2026-10-10" },
            });

            expect(campoDesde).toHaveValue("2026-10-10");
            expect(campoDesde).toHaveAttribute("max", "2026-10-19");
            expect(campoHasta).toHaveAttribute("min", "2026-10-11");

            fireEvent.change(campoHasta, {
                target: { value: "2026-10-15" },
            });

            expect(campoHasta).toHaveValue("2026-10-15");
            expect(campoDesde).toHaveAttribute("max", "2026-10-14");
            expect(campoHasta).toHaveAttribute("min", "2026-10-11");
        });

        it("mantiene el rango válido al rechazar fechas iguales o anteriores", () => {
            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "personalizado" },
                },
            );

            const campoDesde = screen.getByLabelText(
                "Desde",
            ) as HTMLInputElement;

            const campoHasta = screen.getByLabelText(
                "Hasta",
            ) as HTMLInputElement;

            fireEvent.change(campoDesde, {
                target: { value: "2026-10-10" },
            });

            fireEvent.change(campoHasta, {
                target: { value: "2026-10-15" },
            });

            fireEvent.change(campoDesde, {
                target: { value: "2026-10-15" },
            });

            expect(campoDesde).toHaveValue("2026-10-10");

            fireEvent.change(campoHasta, {
                target: { value: "2026-10-10" },
            });

            expect(campoHasta).toHaveValue("2026-10-15");

            fireEvent.change(campoHasta, {
                target: { value: "2026-10-09" },
            });

            expect(campoHasta).toHaveValue("2026-10-15");

            expect(obtenerDatosGrafica()).toHaveLength(6);
        });

        it("inicializa las fechas personalizadas con el último mes", () => {
            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "personalizado" },
                },
            );

            expect(screen.getByLabelText("Desde")).toHaveValue("2026-09-20");
            expect(screen.getByLabelText("Hasta")).toHaveValue("2026-10-20");
        });

        it("ajusta el día inicial al último día del mes anterior cuando no existe ese día", () => {
            vi.setSystemTime(fechaLocal(2026, 3, 31));

            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "personalizado" },
                },
            );

            expect(screen.getByLabelText("Desde")).toHaveValue("2026-02-28");
            expect(screen.getByLabelText("Hasta")).toHaveValue("2026-03-31");
        });

        it("filtra correctamente los registros utilizando fechas personalizadas", () => {
            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "personalizado" },
                },
            );

            fireEvent.change(screen.getByLabelText("Desde"), {
                target: { value: "2026-09-20" },
            });

            fireEvent.change(screen.getByLabelText("Hasta"), {
                target: { value: "2026-10-19" },
            });

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("8"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("6"),
            ).toBeInTheDocument();

            const datos = obtenerDatosGrafica();

            expect(datos).toHaveLength(30);
            expect(datos.at(-1)?.fecha).toBe(
                fechaLocal(2026, 10, 19).setHours(0, 0, 0, 0),
            );
        });

        it("oculta las fechas personalizadas al volver a seleccionar un período predefinido", () => {
            renderizarBloque();

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "personalizado" },
                },
            );

            expect(screen.getByLabelText("Desde")).toBeInTheDocument();
            expect(screen.getByLabelText("Hasta")).toBeInTheDocument();

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "3m" },
                },
            );

            expect(screen.queryByLabelText("Desde")).not.toBeInTheDocument();
            expect(screen.queryByLabelText("Hasta")).not.toBeInTheDocument();

            expect(obtenerDatosGrafica()).toHaveLength(93);
        });

        it("calcula el histórico desde el registro más antiguo independientemente del filtro", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2025, 1, 1),
                    cantidad: 90,
                    tipoVisitante: "operador",
                },
                {
                    fecha: fechaLocal(2026, 6, 1),
                    cantidad: 6,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 5,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 3,
                    tipoVisitante: "operador",
                },
            ];

            renderizarBloque({ datos });

            fireEvent.change(
                screen.getByLabelText("Tipo de Visitante"),
                {
                    target: { value: "comprador" },
                },
            );

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "todo" },
                },
            );

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("5"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("11"),
            ).toBeInTheDocument();

            const datosGrafica = obtenerDatosGrafica();

            expect(datosGrafica[0].fecha).toBe(
                fechaLocal(2025, 1, 1).setHours(0, 0, 0, 0),
            );

            expect(datosGrafica[0].cantidad).toBe(0);

            expect(datosGrafica.find((item) => item.cantidad > 0)).toEqual({
                fecha: fechaLocal(2026, 6, 1).setHours(0, 0, 0, 0),
                cantidad: 6,
            });

            expect(datosGrafica.at(-1)?.cantidad).toBe(5);
        });

        it("utiliza la fecha de hoy cuando ningún registro cumple el filtro histórico", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 6, 1),
                    cantidad: 6,
                    tipoVisitante: "comprador",
                },
            ];

            renderizarBloque({ datos });

            fireEvent.change(
                screen.getByLabelText("Tipo de Visitante"),
                {
                    target: { value: "operador" },
                },
            );

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: { value: "todo" },
                },
            );

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("0"),
            ).toBeInTheDocument();

            const datosGrafica = obtenerDatosGrafica();

            expect(datosGrafica[0].fecha).toBe(
                fechaLocal(2026, 6, 1).setHours(0, 0, 0, 0),
            );

            expect(
                datosGrafica.every((item) => item.cantidad === 0),
            ).toBe(true);
        });
    });

    describe("contactos por perfil y publicaciones modificadas", () => {
        it.each([
            {
                tipo: "contactos" as const,
                titulo: "Contactos por perfil",
            },
            {
                tipo: "publicaciones" as const,
                titulo: "Publicaciones modificadas",
            },
        ])("filtra $tipo por usuario", ({ tipo, titulo }) => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 9, 19),
                    cantidad: 50,
                    username: "usuario1",
                },
                {
                    fecha: fechaLocal(2026, 9, 20),
                    cantidad: 3,
                    username: "usuario1",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 2,
                    username: "usuario1",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 7,
                    username: "usuario2",
                },
            ];

            renderizarBloque({ tipo, titulo, datos });

            expect(screen.getByLabelText("Usuario")).toBeInTheDocument();
            expect(screen.queryByLabelText("Tipo de Visitante")).not.toBeInTheDocument();

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("9"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("12"),
            ).toBeInTheDocument();

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "usuario1" },
            });

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("2"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("5"),
            ).toBeInTheDocument();

            expect(obtenerDatosGrafica().at(-1)?.cantidad).toBe(2);
        });

        it("obtiene únicamente los usuarios existentes y los ordena alfabéticamente", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 5,
                    username: "usuario2",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 3,
                    username: "usuario1",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 2,
                    username: "usuario2",
                },
            ];

            renderizarBloque({
                tipo: "contactos",
                titulo: "Contactos por perfil",
                datos,
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario1",
                "usuario2",
            ]);
        });

        it("restablece el filtro de usuario al seleccionar Todos", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 2,
                    username: "usuario1",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 7,
                    username: "usuario2",
                },
            ];

            renderizarBloque({
                tipo: "contactos",
                titulo: "Contactos por perfil",
                datos,
            });

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "usuario1" },
            });

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("2"),
            ).toBeInTheDocument();

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "todos" },
            });

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("9"),
            ).toBeInTheDocument();
        });

        it("calcula el histórico desde el registro más antiguo independientemente del usuario seleccionado", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2025, 1, 1),
                    cantidad: 100,
                    username: "usuario2",
                },
                {
                    fecha: fechaLocal(2026, 6, 1),
                    cantidad: 6,
                    username: "usuario1",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 5,
                    username: "usuario1",
                },
            ];

            renderizarBloque({
                tipo: "contactos",
                titulo: "Contactos por perfil",
                datos,
            });

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "usuario1" },
            });

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "todo" },
            });

            const datosGrafica = obtenerDatosGrafica();

            expect(datosGrafica[0].fecha).toBe(
                fechaLocal(2025, 1, 1).setHours(0, 0, 0, 0),
            );

            expect(datosGrafica[0].cantidad).toBe(0);

            expect(datosGrafica.find((item) => item.cantidad > 0)).toEqual({
                fecha: fechaLocal(2026, 6, 1).setHours(0, 0, 0, 0),
                cantidad: 6,
            });

            expect(datosGrafica.at(-1)?.cantidad).toBe(5);

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("11"),
            ).toBeInTheDocument();
        });

        it.each([
            {
                tipo: "contactos" as const,
                titulo: "Contactos por perfil",
            },
            {
                tipo: "publicaciones" as const,
                titulo: "Publicaciones modificadas",
            },
        ])("actualiza las opciones de usuarios según el período en $tipo", ({ tipo, titulo }) => {
            const datosPorPeriodo: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 8, 1),
                    cantidad: 10,
                    username: "usuario1",
                },
                {
                    fecha: fechaLocal(2026, 9, 19),
                    cantidad: 5,
                    username: "usuario2",
                },
                {
                    fecha: fechaLocal(2026, 9, 25),
                    cantidad: 3,
                    username: "usuario3",
                },
                {
                    fecha: fechaLocal(2026, 10, 15),
                    cantidad: 7,
                    username: "usuario4",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 9,
                    username: "usuario5",
                },
            ];

            renderizarBloque({ tipo, titulo, datos: datosPorPeriodo });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario3",
                "usuario4",
                "usuario5",
            ]);

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "1s" },
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario4",
                "usuario5",
            ]);

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "3m" },
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario1",
                "usuario2",
                "usuario3",
                "usuario4",
                "usuario5",
            ]);
        });

        it.each([
            {
                tipo: "contactos" as const,
                titulo: "Contactos por perfil",
            },
            {
                tipo: "publicaciones" as const,
                titulo: "Publicaciones modificadas",
            },
        ])("restablece temporalmente el filtro cuando el usuario no tiene registros en el período de $tipo", ({ tipo, titulo }) => {
            const datosPorPeriodo: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 9, 25),
                    cantidad: 2,
                    username: "usuario3",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 7,
                    username: "usuario4",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 9,
                    username: "usuario5",
                },
            ];

            renderizarBloque({ tipo, titulo, datos: datosPorPeriodo });

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "usuario3" },
            });

            expect(screen.getByLabelText("Usuario")).toHaveValue("usuario3");

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "1s" },
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario4",
                "usuario5",
            ]);

            expect(screen.getByLabelText("Usuario")).toHaveValue("todos");

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("16"),
            ).toBeInTheDocument();

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "3m" },
            });

            expect(screen.getByLabelText("Usuario")).toHaveValue("usuario3");
        });
    });

    describe("contactos por publicación", () => {
        const datos: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 2,
                username: "usuario1",
                especie: "Tomate",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 3,
                username: "usuario1",
                especie: "Manzana",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 4,
                username: "usuario2",
                especie: "Tomate",
            },
            {
                fecha: fechaLocal(2026, 10, 19),
                cantidad: 5,
                username: "usuario3",
                especie: "Pera",
            },
        ];

        it("muestra los filtros de usuario y especie", () => {
            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos,
            });

            expect(screen.getByLabelText("Usuario")).toBeInTheDocument();
            expect(screen.getByLabelText("Especie")).toBeInTheDocument();
            expect(screen.getByLabelText("Período")).toBeInTheDocument();

            expect(
                screen.queryByLabelText("Tipo de Visitante"),
            ).not.toBeInTheDocument();
        });

        it("ordena alfabéticamente las especies y elimina duplicados", () => {
            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos,
            });

            expect(obtenerOpciones("Especie")).toEqual([
                "todos",
                "Manzana",
                "Pera",
                "Tomate",
            ]);
        });

        it("obtiene únicamente los usuarios que tienen contactos por publicación", () => {
            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos,
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario1",
                "usuario2",
                "usuario3",
            ]);
        });

        it("filtra los usuarios disponibles según la especie seleccionada", () => {
            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos,
            });

            fireEvent.change(screen.getByLabelText("Especie"), {
                target: { value: "Manzana" },
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario1",
            ]);
        });

        it("filtra las especies disponibles según el usuario seleccionado", () => {
            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos,
            });

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "usuario1" },
            });

            expect(obtenerOpciones("Especie")).toEqual([
                "todos",
                "Manzana",
                "Tomate",
            ]);
        });

        it("aplica simultáneamente los filtros de usuario y especie", () => {
            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos,
            });

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "usuario1" },
            });

            fireEvent.change(screen.getByLabelText("Especie"), {
                target: { value: "Manzana" },
            });

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("3"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("3"),
            ).toBeInTheDocument();

            expect(obtenerDatosGrafica().at(-1)?.cantidad).toBe(3);
        });

        it("actualiza las métricas al quitar el filtro de especie", () => {
            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos,
            });

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "usuario1" },
            });

            fireEvent.change(screen.getByLabelText("Especie"), {
                target: { value: "Manzana" },
            });

            fireEvent.change(screen.getByLabelText("Especie"), {
                target: { value: "todos" },
            });

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("5"),
            ).toBeInTheDocument();
        });

        it("mantiene la combinación compatible seleccionada aunque existan otras combinaciones", () => {
            const datosSinCoincidencia: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 5,
                    username: "usuario1",
                    especie: "Tomate",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 3,
                    username: "usuario2",
                    especie: "Manzana",
                },
            ];

            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos: datosSinCoincidencia,
            });

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "usuario1" },
            });

            fireEvent.change(screen.getByLabelText("Especie"), {
                target: { value: "Tomate" },
            });

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("5"),
            ).toBeInTheDocument();

            expect(obtenerDatosGrafica().at(-1)?.cantidad).toBe(5);
        });

        it("ignora especies vacías al generar las opciones", () => {
            const datosConEspecieVacia: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 2,
                    username: "usuario1",
                    especie: "Tomate",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 3,
                    username: "usuario2",
                    especie: "",
                },
            ];

            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos: datosConEspecieVacia,
            });

            expect(obtenerOpciones("Especie")).toEqual([
                "todos",
                "Tomate",
            ]);
        });

        it("actualiza las opciones de ambos filtros al cambiar el período", () => {
            const datosPorPeriodo: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 2,
                    username: "usuario1",
                    especie: "Tomate",
                },
                {
                    fecha: fechaLocal(2026, 10, 15),
                    cantidad: 3,
                    username: "usuario2",
                    especie: "Manzana",
                },
                {
                    fecha: fechaLocal(2026, 10, 10),
                    cantidad: 5,
                    username: "usuario3",
                    especie: "Pera",
                },
                {
                    fecha: fechaLocal(2026, 9, 1),
                    cantidad: 7,
                    username: "usuario4",
                    especie: "Naranja",
                },
            ];

            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos: datosPorPeriodo,
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario1",
                "usuario2",
                "usuario3",
            ]);

            expect(obtenerOpciones("Especie")).toEqual([
                "todos",
                "Manzana",
                "Pera",
                "Tomate",
            ]);

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "1s" },
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario1",
                "usuario2",
            ]);

            expect(obtenerOpciones("Especie")).toEqual([
                "todos",
                "Manzana",
                "Tomate",
            ]);

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "3m" },
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario1",
                "usuario2",
                "usuario3",
                "usuario4",
            ]);

            expect(obtenerOpciones("Especie")).toEqual([
                "todos",
                "Manzana",
                "Naranja",
                "Pera",
                "Tomate",
            ]);
        });

        it("actualiza las opciones de usuario y especie al modificar las fechas personalizadas", () => {
            const datosPorPeriodo: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 9, 15),
                    cantidad: 7,
                    username: "usuario1",
                    especie: "Manzana",
                },
                {
                    fecha: fechaLocal(2026, 10, 15),
                    cantidad: 3,
                    username: "usuario2",
                    especie: "Pera",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 2,
                    username: "usuario3",
                    especie: "Tomate",
                },
            ];

            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos: datosPorPeriodo,
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario2",
                "usuario3",
            ]);

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "personalizado" },
            });

            fireEvent.change(screen.getByLabelText("Desde"), {
                target: { value: "2026-10-10" },
            });

            fireEvent.change(screen.getByLabelText("Hasta"), {
                target: { value: "2026-10-16" },
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario2",
            ]);

            expect(obtenerOpciones("Especie")).toEqual([
                "todos",
                "Pera",
            ]);
        });

        it("deja de aplicar las selecciones que no existen en el nuevo período y las recupera al volver a un período compatible", () => {
            const datosPorPeriodo: DatoEstadistica[] = [
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 2,
                    username: "usuario1",
                    especie: "Tomate",
                },
                {
                    fecha: fechaLocal(2026, 10, 15),
                    cantidad: 3,
                    username: "usuario2",
                    especie: "Manzana",
                },
                {
                    fecha: fechaLocal(2026, 10, 10),
                    cantidad: 5,
                    username: "usuario3",
                    especie: "Pera",
                },
                {
                    fecha: fechaLocal(2026, 9, 1),
                    cantidad: 7,
                    username: "usuario4",
                    especie: "Naranja",
                },
            ];

            renderizarBloque({
                tipo: "contactosPorPublicacion",
                titulo: "Contactos por publicación",
                datos: datosPorPeriodo,
            });

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "usuario3" },
            });

            fireEvent.change(screen.getByLabelText("Especie"), {
                target: { value: "Pera" },
            });

            expect(screen.getByLabelText("Usuario")).toHaveValue("usuario3");
            expect(screen.getByLabelText("Especie")).toHaveValue("Pera");

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "1s" },
            });

            expect(screen.getByLabelText("Usuario")).toHaveValue("todos");
            expect(screen.getByLabelText("Especie")).toHaveValue("todos");

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario1",
                "usuario2",
            ]);

            expect(obtenerOpciones("Especie")).toEqual([
                "todos",
                "Manzana",
                "Tomate",
            ]);

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("2"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("5"),
            ).toBeInTheDocument();

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "3m" },
            });

            expect(screen.getByLabelText("Usuario")).toHaveValue("usuario3");
            expect(screen.getByLabelText("Especie")).toHaveValue("Pera");

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario3",
            ]);

            expect(obtenerOpciones("Especie")).toEqual([
                "todos",
                "Pera",
            ]);

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("0"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("5"),
            ).toBeInTheDocument();
        });
    });

    describe("cantidad de publicaciones", () => {
        const datos: DatoEstadistica[] = [
            {
                fecha: "2026-09-10",
                cantidad: 10,
                username: "usuario1",
            },
            {
                fecha: "2026-09-15",
                cantidad: 5,
                username: "usuario2",
            },
            {
                fecha: "2026-10-05",
                cantidad: 12,
                username: "usuario1",
            },
            {
                fecha: "2026-10-12",
                cantidad: 7,
                username: "usuario2",
            },
        ];

        it("muestra el último valor conocido durante los días sin registros", () => {
            renderizarBloque({
                tipo: "cantidadPublicaciones",
                titulo: "Cantidad de publicaciones",
                datos,
            });

            const grafica = obtenerDatosGrafica();

            expect(grafica).toHaveLength(31);

            expect(grafica[0].cantidad).toBe(15);
            expect(grafica[14].cantidad).toBe(15);
            expect(grafica[15].cantidad).toBe(17);
            expect(grafica[22].cantidad).toBe(19);
            expect(grafica[30].cantidad).toBe(19);
        });

        it("muestra la cantidad actual y la variación neta del rango", () => {
            renderizarBloque({
                tipo: "cantidadPublicaciones",
                titulo: "Cantidad de publicaciones",
                datos,
            });

            expect(
                within(obtenerTarjeta("Cantidad actual")).getByText("19"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Variación en el rango"),
                ).getByText("+4"),
            ).toBeInTheDocument();
        });

        it("filtra la cantidad acumulada y su variación por usuario", () => {
            renderizarBloque({
                tipo: "cantidadPublicaciones",
                titulo: "Cantidad de publicaciones",
                datos,
            });

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "usuario1" },
            });

            expect(
                within(obtenerTarjeta("Cantidad actual")).getByText("12"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Variación en el rango"),
                ).getByText("+2"),
            ).toBeInTheDocument();

            expect(obtenerDatosGrafica().at(-1)?.cantidad).toBe(12);
        });

        it("conserva los valores anteriores al inicio del rango personalizado", () => {
            renderizarBloque({
                tipo: "cantidadPublicaciones",
                titulo: "Cantidad de publicaciones",
                datos,
            });

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "personalizado" },
            });

            fireEvent.change(screen.getByLabelText("Desde"), {
                target: { value: "2026-10-10" },
            });

            fireEvent.change(screen.getByLabelText("Hasta"), {
                target: { value: "2026-10-20" },
            });

            const grafica = obtenerDatosGrafica();

            expect(grafica).toHaveLength(11);
            expect(grafica[0].cantidad).toBe(17);
            expect(grafica[2].cantidad).toBe(19);
            expect(grafica.at(-1)?.cantidad).toBe(19);

            expect(
                within(
                    obtenerTarjeta("Variación en el rango"),
                ).getByText("+2"),
            ).toBeInTheDocument();
        });

        it("excluye los cambios registrados durante el día Desde", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: "2026-10-01",
                    cantidad: 10,
                    username: "usuario1",
                },
                {
                    fecha: "2026-10-03",
                    cantidad: 14,
                    username: "usuario1",
                },
            ];

            renderizarBloque({
                tipo: "cantidadPublicaciones",
                titulo: "Cantidad de publicaciones",
                datos,
            });

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "personalizado" },
            });

            fireEvent.change(screen.getByLabelText("Desde"), {
                target: { value: "2026-10-03" },
            });

            fireEvent.change(screen.getByLabelText("Hasta"), {
                target: { value: "2026-10-04" },
            });

            const grafica = obtenerDatosGrafica();

            expect(grafica).toHaveLength(2);
            expect(grafica[0].cantidad).toBe(14);
            expect(grafica[1].cantidad).toBe(14);

            expect(
                within(
                    obtenerTarjeta("Variación en el rango"),
                ).getByText("0"),
            ).toBeInTheDocument();
        });

        it("incluye las altas y bajas posteriores a Desde en la variación neta", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: "2026-10-01",
                    cantidad: 5,
                    username: "usuario1",
                },
                {
                    fecha: "2026-10-03",
                    cantidad: 9,
                    username: "usuario1",
                },
                {
                    fecha: "2026-10-04",
                    cantidad: 7,
                    username: "usuario1",
                },
            ];

            renderizarBloque({
                tipo: "cantidadPublicaciones",
                titulo: "Cantidad de publicaciones",
                datos,
            });

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "personalizado" },
            });

            fireEvent.change(screen.getByLabelText("Desde"), {
                target: { value: "2026-10-03" },
            });

            fireEvent.change(screen.getByLabelText("Hasta"), {
                target: { value: "2026-10-04" },
            });

            const grafica = obtenerDatosGrafica();

            expect(grafica[0].cantidad).toBe(9);
            expect(grafica[1].cantidad).toBe(7);

            expect(
                within(
                    obtenerTarjeta("Variación en el rango"),
                ).getByText("-2"),
            ).toBeInTheDocument();
        });

        it("muestra cero cuando no hubo cambios entre Desde y Hasta", () => {
            const datosSinCambios: DatoEstadistica[] = [
                {
                    fecha: "2026-09-01",
                    cantidad: 15,
                    username: "usuario1",
                },
            ];

            renderizarBloque({
                tipo: "cantidadPublicaciones",
                titulo: "Cantidad de publicaciones",
                datos: datosSinCambios,
            });

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "personalizado" },
            });

            fireEvent.change(screen.getByLabelText("Desde"), {
                target: { value: "2026-10-10" },
            });

            fireEvent.change(screen.getByLabelText("Hasta"), {
                target: { value: "2026-10-20" },
            });

            expect(
                within(
                    obtenerTarjeta("Variación en el rango"),
                ).getByText("0"),
            ).toBeInTheDocument();
        });

        it("comienza en cero antes del primer registro de un usuario", () => {
            const datosUsuario: DatoEstadistica[] = [
                {
                    fecha: "2026-10-05",
                    cantidad: 12,
                    username: "usuario1",
                },
            ];

            renderizarBloque({
                tipo: "cantidadPublicaciones",
                titulo: "Cantidad de publicaciones",
                datos: datosUsuario,
            });

            const grafica = obtenerDatosGrafica();

            expect(grafica[0].cantidad).toBe(0);
            expect(grafica[14].cantidad).toBe(0);
            expect(grafica[15].cantidad).toBe(12);
            expect(grafica.at(-1)?.cantidad).toBe(12);

            expect(
                within(
                    obtenerTarjeta("Variación en el rango"),
                ).getByText("+12"),
            ).toBeInTheDocument();
        });

        it("utiliza el valor más reciente cuando existen varios registros históricos", () => {
            const datosUsuario: DatoEstadistica[] = [
                {
                    fecha: "2026-08-01",
                    cantidad: 5,
                    username: "usuario1",
                },
                {
                    fecha: "2026-09-01",
                    cantidad: 8,
                    username: "usuario1",
                },
                {
                    fecha: "2026-10-01",
                    cantidad: 14,
                    username: "usuario1",
                },
            ];

            renderizarBloque({
                tipo: "cantidadPublicaciones",
                titulo: "Cantidad de publicaciones",
                datos: datosUsuario,
            });

            expect(
                within(obtenerTarjeta("Cantidad actual")).getByText("14"),
            ).toBeInTheDocument();

            expect(obtenerDatosGrafica()[0].cantidad).toBe(8);
            expect(obtenerDatosGrafica().at(-1)?.cantidad).toBe(14);

            expect(
                within(
                    obtenerTarjeta("Variación en el rango"),
                ).getByText("+6"),
            ).toBeInTheDocument();
        });

        it("devuelve cero cuando no existen registros", () => {
            renderizarBloque({
                tipo: "cantidadPublicaciones",
                titulo: "Cantidad de publicaciones",
                datos: [],
            });

            expect(
                within(obtenerTarjeta("Cantidad actual")).getByText("0"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Variación en el rango"),
                ).getByText("0"),
            ).toBeInTheDocument();

            expect(
                obtenerDatosGrafica().every((item) => item.cantidad === 0),
            ).toBe(true);
        });

        it("permite seleccionar un usuario y volver a mostrar el total de todos", () => {
            renderizarBloque({
                tipo: "cantidadPublicaciones",
                titulo: "Cantidad de publicaciones",
                datos,
            });

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "usuario1" },
            });

            expect(
                within(obtenerTarjeta("Cantidad actual")).getByText("12"),
            ).toBeInTheDocument();

            fireEvent.change(screen.getByLabelText("Usuario"), {
                target: { value: "todos" },
            });

            expect(
                within(obtenerTarjeta("Cantidad actual")).getByText("19"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Variación en el rango"),
                ).getByText("+4"),
            ).toBeInTheDocument();
        });

        it("actualiza las opciones de usuarios según el período seleccionado", () => {
            const datosPorPeriodo: DatoEstadistica[] = [
                {
                    fecha: "2026-08-01",
                    cantidad: 10,
                    username: "usuario1",
                },
                {
                    fecha: "2026-09-19",
                    cantidad: 5,
                    username: "usuario2",
                },
                {
                    fecha: "2026-09-25",
                    cantidad: 8,
                    username: "usuario3",
                },
                {
                    fecha: "2026-10-15",
                    cantidad: 12,
                    username: "usuario4",
                },
                {
                    fecha: "2026-10-20",
                    cantidad: 15,
                    username: "usuario5",
                },
            ];

            renderizarBloque({
                tipo: "cantidadPublicaciones",
                titulo: "Cantidad de publicaciones",
                datos: datosPorPeriodo,
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario3",
                "usuario4",
                "usuario5",
            ]);

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "1s" },
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario4",
                "usuario5",
            ]);

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "3m" },
            });

            expect(obtenerOpciones("Usuario")).toEqual([
                "todos",
                "usuario1",
                "usuario2",
                "usuario3",
                "usuario4",
                "usuario5",
            ]);
        });
    });

    describe("fechas y formato", () => {
        it("ignora los registros con fechas inválidas", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: "fecha-invalida",
                    cantidad: 100,
                    tipoVisitante: "comprador",
                },
                {
                    fecha: fechaLocal(2026, 10, 20),
                    cantidad: 5,
                    tipoVisitante: "comprador",
                },
            ];

            renderizarBloque({ datos });

            fireEvent.change(screen.getByLabelText("Período"), {
                target: { value: "todo" },
            });

            const datosGrafica = obtenerDatosGrafica();

            expect(datosGrafica).toHaveLength(1);
            expect(datosGrafica[0].cantidad).toBe(5);

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("5"),
            ).toBeInTheDocument();
        });

        it("acepta fechas recibidas como strings ISO", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: "2026-10-20T12:00:00.000Z",
                    cantidad: 15,
                    tipoVisitante: "comprador",
                },
            ];

            renderizarBloque({ datos });

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("15"),
            ).toBeInTheDocument();

            expect(obtenerDatosGrafica().at(-1)?.cantidad).toBe(15);
        });

        it("acepta fechas recibidas como strings YYYY-MM-DD", () => {
            const datos: DatoEstadistica[] = [
                {
                    fecha: "2026-10-20",
                    cantidad: 15,
                    tipoVisitante: "comprador",
                },
            ];

            renderizarBloque({ datos });

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("15"),
            ).toBeInTheDocument();

            expect(obtenerDatosGrafica().at(-1)?.cantidad).toBe(15);
        });

        it("formatea correctamente las fechas del eje X", () => {
            renderizarBloque();

            expect(
                screen.getByTestId("tick-numerico").textContent,
            ).toContain("20/10/26");

            expect(
                screen.getByTestId("tick-no-numerico").textContent,
            ).toBe("");
        });

        it("formatea correctamente la fecha del Tooltip", () => {
            renderizarBloque();

            expect(
                screen.getByTestId("tooltip-fecha").textContent,
            ).toContain("20/10/2026");

            expect(
                screen.getByTestId("tooltip-fecha-invalida").textContent,
            ).toBe("");
        });

        it("formatea las cantidades del Tooltip", () => {
            renderizarBloque();

            expect(
                JSON.parse(
                    screen.getByTestId("tooltip-cantidad").textContent ?? "null",
                ),
            ).toEqual([
                new Intl.NumberFormat("es-UY").format(123),
                "Cantidad",
            ]);

            expect(
                JSON.parse(
                    screen.getByTestId("tooltip-cantidad-vacia").textContent ?? "null",
                ),
            ).toEqual([
                "0",
                "Cantidad",
            ]);
        });
    });
});
