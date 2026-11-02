
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
import type { ChangeEvent, ReactNode } from "react";
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
    }: {
        select?: boolean;
        label: string;
        value?: string;
        onChange?: (
            event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
        ) => void;
        type?: string;
        children?: ReactNode;
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
    }) => (
        <label>
            Usuario
            <select
                aria-label="Usuario"
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
    ),
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

const opcionesFiltroEspecifico = [
    {
        valor: "usuario1",
        etiqueta: "Usuario 1",
    },
    {
        valor: "usuario2",
        etiqueta: "Usuario 2",
    },
];

function renderizarBloque({
    titulo = "Visitas",
    tipo = "visitas",
    datos = datosVisitas,
    opcionesFiltroEspecifico = [],
}: {
    titulo?: string;
    tipo?: TipoSeccionEstadistica;
    datos?: DatoEstadistica[];
    opcionesFiltroEspecifico?: Array<{
        valor: string;
        etiqueta: string;
    }>;
} = {}) {
    return render(
        <BloqueEstadistica
            titulo={titulo}
            tipo={tipo}
            datos={datos}
            opcionesFiltroEspecifico={opcionesFiltroEspecifico}
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

describe("BloqueEstadistica", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(fechaLocal(2026, 10, 20));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("muestra el título, la descripción y los filtros correspondientes a visitas", () => {
        renderizarBloque();

        expect(
            screen.getByRole("heading", {
                name: "Visitas",
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "Visualización estadística de la cantidad de Visitas",
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

    it("genera correctamente los datos diarios de la gráfica y completa los días sin registros", () => {
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
                target: {
                    value: "comprador",
                },
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

        expect(
            obtenerDatosGrafica()[30].cantidad,
        ).toBe(5);
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
                target: {
                    value: "comprador",
                },
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
                target: {
                    value: "productor",
                },
            },
        );

        const tarjetaHoy = obtenerTarjeta("Total de Hoy");
        const tarjetaRango = obtenerTarjeta(
            "Total del Rango Seleccionado",
        );

        expect(
            within(tarjetaHoy).getByText("0"),
        ).toBeInTheDocument();

        expect(
            within(tarjetaRango).getByText("0"),
        ).toBeInTheDocument();

        expect(
            obtenerDatosGrafica().every(
                (item) => item.cantidad === 0,
            ),
        ).toBe(true);
    });

    it("restablece el filtro de visitas cuando se selecciona Todos", () => {
        renderizarBloque();

        fireEvent.change(
            screen.getByLabelText("Tipo de Visitante"),
            {
                target: {
                    value: "comprador",
                },
            },
        );

        expect(
            within(obtenerTarjeta("Total de Hoy")).getByText("5"),
        ).toBeInTheDocument();

        fireEvent.change(
            screen.getByLabelText("Tipo de Visitante"),
            {
                target: {
                    value: "todos",
                },
            },
        );

        expect(
            within(obtenerTarjeta("Total de Hoy")).getByText("8"),
        ).toBeInTheDocument();

        expect(
            within(
                obtenerTarjeta("Total del Rango Seleccionado"),
            ).getByText("14"),
        ).toBeInTheDocument();
    });

    it.each([
        {
            rango: "1s",
            fecha: "2026-10-13",
        },
        {
            rango: "1m",
            fecha: "2026-09-20",
        },
        {
            rango: "3m",
            fecha: "2026-07-20",
        },
        {
            rango: "6m",
            fecha: "2026-04-20",
        },
        {
            rango: "1y",
            fecha: "2025-10-20",
        },
    ])(
        "calcula correctamente el rango $rango",
        ({ rango, fecha }) => {
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
                    target: {
                        value: rango,
                    },
                },
            );

            const fechaEsperada = new Date(
                `${fecha}T00:00:00`,
            ).getTime();

            expect(
                obtenerDatosGrafica()[0].fecha,
            ).toBe(fechaEsperada);
        },
    );

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
                target: {
                    value: "1s",
                },
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
                target: {
                    value: "1s",
                },
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
            expect(separacion).toBeCloseTo(
                separaciones[0],
                5,
            );
        });
    });

    it("genera una marca por cada fecha cuando el rango tiene menos de cinco días", () => {
        renderizarBloque();

        fireEvent.change(
            screen.getByLabelText("Período"),
            {
                target: {
                    value: "personalizado",
                },
            },
        );

        fireEvent.change(screen.getByLabelText("Desde"), {
            target: {
                value: "2026-10-18",
            },
        });

        fireEvent.change(screen.getByLabelText("Hasta"), {
            target: {
                value: "2026-10-20",
            },
        });

        const datos = obtenerDatosGrafica();
        const ticks = obtenerTicksEjeX();

        expect(datos).toHaveLength(3);
        expect(ticks).toHaveLength(3);
        expect(ticks).toEqual(
            datos.map((item) => item.fecha),
        );
    });

    it("genera una única marca cuando el rango contiene una sola fecha", () => {
        renderizarBloque();

        fireEvent.change(
            screen.getByLabelText("Período"),
            {
                target: {
                    value: "personalizado",
                },
            },
        );

        fireEvent.change(screen.getByLabelText("Desde"), {
            target: {
                value: "2026-10-20",
            },
        });

        fireEvent.change(screen.getByLabelText("Hasta"), {
            target: {
                value: "2026-10-20",
            },
        });

        const datos = obtenerDatosGrafica();
        const ticks = obtenerTicksEjeX();

        expect(datos).toHaveLength(1);
        expect(ticks).toEqual([datos[0].fecha]);
    });

    it("no genera datos ni marcas cuando la fecha inicial es posterior a la final", () => {
        renderizarBloque();

        fireEvent.change(
            screen.getByLabelText("Período"),
            {
                target: {
                    value: "personalizado",
                },
            },
        );

        fireEvent.change(screen.getByLabelText("Desde"), {
            target: {
                value: "2026-10-21",
            },
        });

        fireEvent.change(screen.getByLabelText("Hasta"), {
            target: {
                value: "2026-10-20",
            },
        });

        expect(obtenerDatosGrafica()).toEqual([]);
        expect(obtenerTicksEjeX()).toEqual([]);

        expect(
            within(
                obtenerTarjeta("Total del Rango Seleccionado"),
            ).getByText("0"),
        ).toBeInTheDocument();
    });

    it("inicializa las fechas personalizadas con el último mes", () => {
        renderizarBloque();

        fireEvent.change(
            screen.getByLabelText("Período"),
            {
                target: {
                    value: "personalizado",
                },
            },
        );

        expect(
            screen.getByLabelText("Desde"),
        ).toHaveValue("2026-09-20");

        expect(
            screen.getByLabelText("Hasta"),
        ).toHaveValue("2026-10-20");
    });

    it("ajusta el día inicial al último día del mes anterior cuando no existe ese día", () => {
        vi.setSystemTime(fechaLocal(2026, 3, 31));

        renderizarBloque();

        fireEvent.change(
            screen.getByLabelText("Período"),
            {
                target: {
                    value: "personalizado",
                },
            },
        );

        expect(
            screen.getByLabelText("Desde"),
        ).toHaveValue("2026-02-28");

        expect(
            screen.getByLabelText("Hasta"),
        ).toHaveValue("2026-03-31");
    });

    it("filtra correctamente los registros utilizando fechas personalizadas", () => {
        renderizarBloque();

        fireEvent.change(
            screen.getByLabelText("Período"),
            {
                target: {
                    value: "personalizado",
                },
            },
        );

        fireEvent.change(screen.getByLabelText("Desde"), {
            target: {
                value: "2026-09-20",
            },
        });

        fireEvent.change(screen.getByLabelText("Hasta"), {
            target: {
                value: "2026-10-19",
            },
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
                target: {
                    value: "personalizado",
                },
            },
        );

        expect(
            screen.getByLabelText("Desde"),
        ).toBeInTheDocument();

        expect(
            screen.getByLabelText("Hasta"),
        ).toBeInTheDocument();

        fireEvent.change(
            screen.getByLabelText("Período"),
            {
                target: {
                    value: "3m",
                },
            },
        );

        expect(
            screen.queryByLabelText("Desde"),
        ).not.toBeInTheDocument();

        expect(
            screen.queryByLabelText("Hasta"),
        ).not.toBeInTheDocument();

        expect(obtenerDatosGrafica()).toHaveLength(93);
    });

    it("calcula el histórico desde el registro más antiguo que cumple el filtro", () => {
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
                target: {
                    value: "comprador",
                },
            },
        );

        fireEvent.change(
            screen.getByLabelText("Período"),
            {
                target: {
                    value: "todo",
                },
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
            fechaLocal(2026, 6, 1).setHours(0, 0, 0, 0),
        );

        expect(datosGrafica[0].cantidad).toBe(6);
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
                target: {
                    value: "operador",
                },
            },
        );

        fireEvent.change(
            screen.getByLabelText("Período"),
            {
                target: {
                    value: "todo",
                },
            },
        );

        expect(
            within(
                obtenerTarjeta("Total del Rango Seleccionado"),
            ).getByText("0"),
        ).toBeInTheDocument();

        const datosGrafica = obtenerDatosGrafica();

        expect(datosGrafica).toHaveLength(1);
        expect(datosGrafica[0].cantidad).toBe(0);
    });

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

        fireEvent.change(
            screen.getByLabelText("Período"),
            {
                target: {
                    value: "todo",
                },
            },
        );

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

        expect(
            obtenerDatosGrafica().at(-1)?.cantidad,
        ).toBe(15);
    });

    it("acepta fechas recibidas como strings con formato YYYY-MM-DD", () => {
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

        expect(
            obtenerDatosGrafica().at(-1)?.cantidad,
        ).toBe(15);
    });

    it("devuelve cero cuando no existen registros", () => {
        renderizarBloque({
            datos: [],
        });

        const tarjetaHoy = obtenerTarjeta("Total de Hoy");
        const tarjetaRango = obtenerTarjeta(
            "Total del Rango Seleccionado",
        );

        expect(
            within(tarjetaHoy).getByText("0"),
        ).toBeInTheDocument();

        expect(
            within(tarjetaRango).getByText("0"),
        ).toBeInTheDocument();

        const datos = obtenerDatosGrafica();

        expect(datos).toHaveLength(31);

        expect(
            datos.every((item) => item.cantidad === 0),
        ).toBe(true);
    });

    it.each([
        {
            tipo: "contactos" as const,
            titulo: "Contactos de WhatsApp",
        },
        {
            tipo: "publicaciones" as const,
            titulo: "Publicaciones y Ofertas",
        },
    ])(
        "utiliza el Autocomplete para filtrar $tipo por usuario",
        ({ tipo, titulo }) => {
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

            renderizarBloque({
                tipo,
                titulo,
                datos,
                opcionesFiltroEspecifico,
            });

            expect(
                screen.getByRole("heading", {
                    name: titulo,
                }),
            ).toBeInTheDocument();

            expect(
                screen.getByLabelText("Usuario"),
            ).toBeInTheDocument();

            expect(
                screen.queryByLabelText("Tipo de Visitante"),
            ).not.toBeInTheDocument();

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("9"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("12"),
            ).toBeInTheDocument();

            fireEvent.change(
                screen.getByLabelText("Usuario"),
                {
                    target: {
                        value: "usuario1",
                    },
                },
            );

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("2"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("5"),
            ).toBeInTheDocument();

            expect(
                obtenerDatosGrafica().at(-1)?.cantidad,
            ).toBe(2);
        },
    );

    it("restablece el filtro del usuario cuando se selecciona Todos", () => {
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
            titulo: "Contactos de WhatsApp",
            datos,
            opcionesFiltroEspecifico,
        });

        fireEvent.change(
            screen.getByLabelText("Usuario"),
            {
                target: {
                    value: "usuario1",
                },
            },
        );

        expect(
            within(obtenerTarjeta("Total de Hoy")).getByText("2"),
        ).toBeInTheDocument();

        fireEvent.change(
            screen.getByLabelText("Usuario"),
            {
                target: {
                    value: "todos",
                },
            },
        );

        expect(
            within(obtenerTarjeta("Total de Hoy")).getByText("9"),
        ).toBeInTheDocument();
    });

    it("muestra cero cuando el usuario seleccionado no tiene registros", () => {
        const datos: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 5,
                username: "usuario1",
            },
        ];

        const opciones = [
            ...opcionesFiltroEspecifico,
            {
                valor: "usuario3",
                etiqueta: "Usuario 3",
            },
        ];

        renderizarBloque({
            tipo: "contactos",
            titulo: "Contactos de WhatsApp",
            datos,
            opcionesFiltroEspecifico: opciones,
        });

        fireEvent.change(
            screen.getByLabelText("Usuario"),
            {
                target: {
                    value: "usuario3",
                },
            },
        );

        const tarjetaHoy = obtenerTarjeta("Total de Hoy");
        const tarjetaRango = obtenerTarjeta(
            "Total del Rango Seleccionado",
        );

        expect(
            within(tarjetaHoy).getByText("0"),
        ).toBeInTheDocument();

        expect(
            within(tarjetaRango).getByText("0"),
        ).toBeInTheDocument();

        expect(
            obtenerDatosGrafica().at(-1)?.cantidad,
        ).toBe(0);
    });

    it.each([
        "contactos",
        "publicaciones",
    ] as const)(
        "calcula el histórico utilizando el username cuando el tipo es %s",
        (tipo) => {
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
                tipo,
                titulo: tipo,
                datos,
                opcionesFiltroEspecifico,
            });

            fireEvent.change(
                screen.getByLabelText("Usuario"),
                {
                    target: {
                        value: "usuario1",
                    },
                },
            );

            fireEvent.change(
                screen.getByLabelText("Período"),
                {
                    target: {
                        value: "todo",
                    },
                },
            );

            const datosGrafica = obtenerDatosGrafica();

            expect(datosGrafica[0].fecha).toBe(
                fechaLocal(2026, 6, 1).setHours(0, 0, 0, 0),
            );

            expect(datosGrafica[0].cantidad).toBe(6);
            expect(datosGrafica.at(-1)?.cantidad).toBe(5);

            expect(
                within(obtenerTarjeta("Total de Hoy")).getByText("5"),
            ).toBeInTheDocument();

            expect(
                within(
                    obtenerTarjeta("Total del Rango Seleccionado"),
                ).getByText("11"),
            ).toBeInTheDocument();
        },
    );

    it("utiliza hoy como inicio del histórico cuando no hay registros del usuario seleccionado", () => {
        const datos: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 6, 1),
                cantidad: 6,
                username: "usuario1",
            },
        ];

        renderizarBloque({
            tipo: "contactos",
            titulo: "Contactos",
            datos,
            opcionesFiltroEspecifico,
        });

        fireEvent.change(
            screen.getByLabelText("Usuario"),
            {
                target: {
                    value: "usuario2",
                },
            },
        );

        fireEvent.change(
            screen.getByLabelText("Período"),
            {
                target: {
                    value: "todo",
                },
            },
        );

        const datosGrafica = obtenerDatosGrafica();

        expect(datosGrafica).toHaveLength(1);
        expect(datosGrafica[0].cantidad).toBe(0);

        expect(
            within(
                obtenerTarjeta("Total del Rango Seleccionado"),
            ).getByText("0"),
        ).toBeInTheDocument();
    });

    it("ignora las fechas inválidas al calcular el histórico y los totales", () => {
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

        fireEvent.change(
            screen.getByLabelText("Período"),
            {
                target: {
                    value: "todo",
                },
            },
        );

        const datosGrafica = obtenerDatosGrafica();

        expect(datosGrafica).toHaveLength(1);
        expect(datosGrafica[0].cantidad).toBe(5);

        expect(
            within(obtenerTarjeta("Total de Hoy")).getByText("5"),
        ).toBeInTheDocument();
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

    it("formatea cantidades y utiliza Cantidad como nombre de la serie en el Tooltip", () => {
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
