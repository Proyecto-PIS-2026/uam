
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

import BloqueEstadisticaComparativa from "./BloqueEstadisticaComparativa";

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
        formatter?: (value: unknown, name: string) => unknown;
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
                    {JSON.stringify(
                        formatter?.(123, "Publicaciones"),
                    )}
                </output>

                <output data-testid="tooltip-cantidad-vacia">
                    {JSON.stringify(
                        formatter?.(undefined, "WhatsApp"),
                    )}
                </output>
            </div>
        );
    },

    Line: ({
        dataKey,
        name,
        stroke,
        strokeDasharray,
    }: {
        dataKey: string;
        name: string;
        stroke: string;
        strokeDasharray?: string;
    }) => (
        <span
            data-testid={`linea-${dataKey}`}
            data-name={name}
            data-stroke={stroke}
            data-dasharray={strokeDasharray ?? ""}
        />
    ),
}));

interface DatoEstadistica {
    fecha: Date | string;
    cantidad: number;
    username?: string;
}

const fechaLocal = (
    anio: number,
    mes: number,
    dia: number,
) => new Date(anio, mes - 1, dia, 12);

const fechasEstadisticas = {
    septiembre19: fechaLocal(2026, 9, 19),
    septiembre20: fechaLocal(2026, 9, 20),
    octubre13: fechaLocal(2026, 10, 13),
    octubre19: fechaLocal(2026, 10, 19),
    octubre20: fechaLocal(2026, 10, 20),
};

const datosContactos: DatoEstadistica[] = [
    {
        fecha: fechasEstadisticas.septiembre19,
        cantidad: 100,
        username: "usuario1",
    },
    {
        fecha: fechasEstadisticas.septiembre20,
        cantidad: 4,
        username: "usuario1",
    },
    {
        fecha: fechasEstadisticas.octubre19,
        cantidad: 2,
        username: "usuario1",
    },
    {
        fecha: fechasEstadisticas.octubre20,
        cantidad: 5,
        username: "usuario1",
    },
    {
        fecha: fechasEstadisticas.octubre20,
        cantidad: 3,
        username: "usuario2",
    },
];

const datosPublicaciones: DatoEstadistica[] = [
    {
        fecha: fechasEstadisticas.septiembre20,
        cantidad: 7,
        username: "usuario1",
    },
    {
        fecha: fechasEstadisticas.octubre20,
        cantidad: 11,
        username: "usuario1",
    },
    {
        fecha: fechasEstadisticas.octubre20,
        cantidad: 13,
        username: "usuario2",
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
    contactos = datosContactos,
    publicaciones = datosPublicaciones,
    opciones = opcionesFiltroEspecifico,
}: {
    contactos?: DatoEstadistica[];
    publicaciones?: DatoEstadistica[];
    opciones?: Array<{
        valor: string;
        etiqueta: string;
    }>;
} = {}) {
    return render(
        <BloqueEstadisticaComparativa
            contactos={contactos}
            publicaciones={publicaciones}
            opcionesFiltroEspecifico={opciones}
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
        contactos: number;
        publicaciones: number;
    }>;
}

function obtenerTicksEjeX() {
    return JSON.parse(
        screen.getByTestId("ticks-eje-x").textContent ?? "[]",
    ) as number[];
}

describe("BloqueEstadisticaComparativa", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(fechaLocal(2026, 10, 20));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("muestra el encabezado, la descripción y los filtros", () => {
        renderizarBloque();

        expect(
            screen.getByRole("heading", {
                name: "Publicaciones y Contactos",
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "Visualización estadística de la cantidad de Publicaciones y Contactos de WhatsApp",
            ),
        ).toBeInTheDocument();

        expect(screen.getByLabelText("Usuario")).toBeInTheDocument();
        expect(screen.getByLabelText("Período")).toBeInTheDocument();
    });

    it("muestra las dos estadísticas en las tarjetas de hoy", () => {
        renderizarBloque();

        const tarjeta = obtenerTarjeta("Total de Hoy");

        expect(
            within(tarjeta).getByText("Publicaciones"),
        ).toBeInTheDocument();

        expect(
            within(tarjeta).getByText("Contactos de WhatsApp"),
        ).toBeInTheDocument();

        expect(within(tarjeta).getByText("24")).toBeInTheDocument();
        expect(within(tarjeta).getByText("8")).toBeInTheDocument();
    });

    it("muestra los totales de ambas estadísticas para el rango seleccionado", () => {
        renderizarBloque();

        const tarjeta = obtenerTarjeta(
            "Total del Rango Seleccionado",
        );

        expect(within(tarjeta).getByText("31")).toBeInTheDocument();
        expect(within(tarjeta).getByText("14")).toBeInTheDocument();
    });

    it("muestra ambas líneas y su leyenda correspondiente", () => {
        renderizarBloque();

        expect(
            screen.getByTestId("linea-publicaciones"),
        ).toBeInTheDocument();

        expect(
            screen.getByTestId("linea-contactos"),
        ).toBeInTheDocument();

        expect(
            screen.getByTestId("linea-publicaciones"),
        ).toHaveAttribute("data-name", "Publicaciones");

        expect(
            screen.getByTestId("linea-contactos"),
        ).toHaveAttribute("data-name", "WhatsApp");

        expect(
            screen.getByTestId("linea-publicaciones"),
        ).toHaveAttribute(
            "data-stroke",
            "var(--color-secondary, #005d29)",
        );

        expect(
            screen.getByTestId("linea-contactos"),
        ).toHaveAttribute(
            "data-stroke",
            "var(--color-primary, #16a34a)",
        );

        expect(
            screen.getByTestId("linea-publicaciones"),
        ).toHaveAttribute("data-dasharray", "");

        expect(
            screen.getByTestId("linea-contactos"),
        ).toHaveAttribute("data-dasharray", "3 3");

        expect(
            screen.getByText("WhatsApp", {
                exact: true,
            }),
        ).toBeInTheDocument();
    });

    it("genera una única serie temporal compartida por ambas estadísticas", () => {
        renderizarBloque();

        const datos = obtenerDatosGrafica();

        expect(datos).toHaveLength(31);

        expect(datos[0]).toEqual({
            fecha: fechaLocal(2026, 9, 20).setHours(0, 0, 0, 0),
            contactos: 4,
            publicaciones: 7,
        });

        expect(datos[1]).toEqual({
            fecha: fechaLocal(2026, 9, 21).setHours(0, 0, 0, 0),
            contactos: 0,
            publicaciones: 0,
        });

        expect(datos[30]).toEqual({
            fecha: fechaLocal(2026, 10, 20).setHours(0, 0, 0, 0),
            contactos: 8,
            publicaciones: 24,
        });
    });

    it("acumula correctamente varios registros de la misma fecha", () => {
        const contactos: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 2,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 3,
                username: "usuario1",
            },
        ];

        const publicaciones: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 4,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 5,
                username: "usuario1",
            },
        ];

        renderizarBloque({
            contactos,
            publicaciones,
        });

        const ultimoDia = obtenerDatosGrafica().at(-1);

        expect(ultimoDia?.contactos).toBe(5);
        expect(ultimoDia?.publicaciones).toBe(9);

        const tarjetaHoy = obtenerTarjeta("Total de Hoy");

        expect(within(tarjetaHoy).getByText("5")).toBeInTheDocument();
        expect(within(tarjetaHoy).getByText("9")).toBeInTheDocument();
    });

    it("completa con cero los días sin registros de ambas estadísticas", () => {
        renderizarBloque();

        const datos = obtenerDatosGrafica();

        expect(datos[1].contactos).toBe(0);
        expect(datos[1].publicaciones).toBe(0);

        expect(datos[2].contactos).toBe(0);
        expect(datos[2].publicaciones).toBe(0);
    });

    it("excluye los registros anteriores al inicio del rango", () => {
        renderizarBloque();

        const datos = obtenerDatosGrafica();

        expect(datos[0].contactos).toBe(4);
        expect(datos[0].publicaciones).toBe(7);

        expect(
            datos.reduce((acc, item) => acc + item.contactos, 0),
        ).toBe(14);

        expect(
            datos.reduce((acc, item) => acc + item.publicaciones, 0),
        ).toBe(31);
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
            renderizarBloque();

            fireEvent.change(screen.getByLabelText("Período"), {
                target: {
                    value: rango,
                },
            });

            const fechaEsperada = new Date(
                `${fecha}T00:00:00`,
            ).getTime();

            expect(obtenerDatosGrafica()[0].fecha).toBe(
                fechaEsperada,
            );
        },
    );

    it("calcula los últimos siete días de ambas estadísticas", () => {
        const contactos: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 10, 12),
                cantidad: 100,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 13),
                cantidad: 9,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 5,
                username: "usuario1",
            },
        ];

        const publicaciones: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 10, 12),
                cantidad: 200,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 13),
                cantidad: 3,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 7,
                username: "usuario1",
            },
        ];

        renderizarBloque({
            contactos,
            publicaciones,
        });

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "1s",
            },
        });

        const datos = obtenerDatosGrafica();

        expect(datos).toHaveLength(8);

        expect(datos[0].contactos).toBe(9);
        expect(datos[0].publicaciones).toBe(3);

        expect(datos[7].contactos).toBe(5);
        expect(datos[7].publicaciones).toBe(7);

        const tarjeta = obtenerTarjeta(
            "Total del Rango Seleccionado",
        );

        expect(within(tarjeta).getByText("14")).toBeInTheDocument();
        expect(within(tarjeta).getByText("10")).toBeInTheDocument();
    });

    it("genera cinco marcas equiespaciadas para el rango semanal", () => {
        renderizarBloque();

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "1s",
            },
        });

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

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "personalizado",
            },
        });

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

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "personalizado",
            },
        });

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

    it("no genera marcas cuando no hay fechas en el rango", () => {
        renderizarBloque();

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "personalizado",
            },
        });

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
    });

    it("inicializa las fechas personalizadas con el último mes", () => {
        renderizarBloque();

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "personalizado",
            },
        });

        expect(screen.getByLabelText("Desde")).toHaveValue(
            "2026-09-20",
        );

        expect(screen.getByLabelText("Hasta")).toHaveValue(
            "2026-10-20",
        );
    });

    it("ajusta el día inicial al último día del mes anterior cuando no existe ese día", () => {
        vi.setSystemTime(fechaLocal(2026, 3, 31));

        renderizarBloque();

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "personalizado",
            },
        });

        expect(screen.getByLabelText("Desde")).toHaveValue(
            "2026-02-28",
        );

        expect(screen.getByLabelText("Hasta")).toHaveValue(
            "2026-03-31",
        );
    });

    it("filtra ambas estadísticas utilizando fechas personalizadas", () => {
        const contactos: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 9, 20),
                cantidad: 100,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 9, 25),
                cantidad: 2,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 19),
                cantidad: 3,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 5,
                username: "usuario1",
            },
        ];

        const publicaciones: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 9, 20),
                cantidad: 200,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 9, 25),
                cantidad: 7,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 11,
                username: "usuario1",
            },
        ];

        renderizarBloque({
            contactos,
            publicaciones,
        });

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "personalizado",
            },
        });

        fireEvent.change(screen.getByLabelText("Desde"), {
            target: {
                value: "2026-09-25",
            },
        });

        fireEvent.change(screen.getByLabelText("Hasta"), {
            target: {
                value: "2026-10-19",
            },
        });

        const datos = obtenerDatosGrafica();

        expect(datos).toHaveLength(25);
        expect(datos[0].contactos).toBe(2);
        expect(datos[0].publicaciones).toBe(7);
        expect(datos.at(-1)?.contactos).toBe(3);
        expect(datos.at(-1)?.publicaciones).toBe(0);

        const tarjeta = obtenerTarjeta(
            "Total del Rango Seleccionado",
        );

        expect(within(tarjeta).getByText("5")).toBeInTheDocument();
        expect(within(tarjeta).getByText("7")).toBeInTheDocument();

        const tarjetaHoy = obtenerTarjeta("Total de Hoy");

        expect(within(tarjetaHoy).getByText("5")).toBeInTheDocument();
        expect(within(tarjetaHoy).getByText("11")).toBeInTheDocument();
    });

    it("filtra los registros que se encuentran fuera del rango personalizado", () => {
        const contactos: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 10, 17),
                cantidad: 100,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 18),
                cantidad: 5,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 200,
                username: "usuario1",
            },
        ];

        const publicaciones: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 10, 17),
                cantidad: 300,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 18),
                cantidad: 7,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 400,
                username: "usuario1",
            },
        ];

        renderizarBloque({
            contactos,
            publicaciones,
        });

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "personalizado",
            },
        });

        fireEvent.change(screen.getByLabelText("Desde"), {
            target: {
                value: "2026-10-18",
            },
        });

        fireEvent.change(screen.getByLabelText("Hasta"), {
            target: {
                value: "2026-10-19",
            },
        });

        const datos = obtenerDatosGrafica();

        expect(datos).toHaveLength(2);
        expect(datos[0].contactos).toBe(5);
        expect(datos[0].publicaciones).toBe(7);
        expect(datos[1].contactos).toBe(0);
        expect(datos[1].publicaciones).toBe(0);
    });

    it("filtra los registros por usuario al seleccionar una opción", () => {
        renderizarBloque();

        fireEvent.change(screen.getByLabelText("Usuario"), {
            target: {
                value: "usuario1",
            },
        });

        const tarjetaHoy = obtenerTarjeta("Total de Hoy");
        const tarjetaRango = obtenerTarjeta(
            "Total del Rango Seleccionado",
        );

        expect(within(tarjetaHoy).getByText("5")).toBeInTheDocument();
        expect(within(tarjetaHoy).getByText("11")).toBeInTheDocument();

        expect(within(tarjetaRango).getByText("11")).toBeInTheDocument();
        expect(within(tarjetaRango).getByText("18")).toBeInTheDocument();

        const ultimoDia = obtenerDatosGrafica().at(-1);

        expect(ultimoDia?.contactos).toBe(5);
        expect(ultimoDia?.publicaciones).toBe(11);
    });

    it("filtra las estadísticas para un segundo usuario", () => {
        renderizarBloque();

        fireEvent.change(screen.getByLabelText("Usuario"), {
            target: {
                value: "usuario2",
            },
        });

        const tarjetaHoy = obtenerTarjeta("Total de Hoy");
        const tarjetaRango = obtenerTarjeta(
            "Total del Rango Seleccionado",
        );

        expect(within(tarjetaHoy).getByText("3")).toBeInTheDocument();
        expect(within(tarjetaHoy).getByText("13")).toBeInTheDocument();

        expect(within(tarjetaRango).getByText("3")).toBeInTheDocument();
        expect(within(tarjetaRango).getByText("13")).toBeInTheDocument();

        const ultimoDia = obtenerDatosGrafica().at(-1);

        expect(ultimoDia?.contactos).toBe(3);
        expect(ultimoDia?.publicaciones).toBe(13);
    });

    it("restablece ambas estadísticas cuando se selecciona Todos", () => {
        renderizarBloque();

        fireEvent.change(screen.getByLabelText("Usuario"), {
            target: {
                value: "usuario1",
            },
        });

        fireEvent.change(screen.getByLabelText("Usuario"), {
            target: {
                value: "todos",
            },
        });

        const tarjetaHoy = obtenerTarjeta("Total de Hoy");

        expect(within(tarjetaHoy).getByText("8")).toBeInTheDocument();
        expect(within(tarjetaHoy).getByText("24")).toBeInTheDocument();
    });

    it("muestra cero cuando el usuario seleccionado no tiene registros", () => {
        const contactos: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 5,
                username: "usuario1",
            },
        ];

        const publicaciones: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 7,
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
            contactos,
            publicaciones,
            opciones,
        });

        fireEvent.change(screen.getByLabelText("Usuario"), {
            target: {
                value: "usuario3",
            },
        });

        const tarjetaHoy = obtenerTarjeta("Total de Hoy");
        const tarjetaRango = obtenerTarjeta(
            "Total del Rango Seleccionado",
        );

        expect(within(tarjetaHoy).getAllByText("0")).toHaveLength(2);
        expect(within(tarjetaRango).getAllByText("0")).toHaveLength(2);

        const ultimoDia = obtenerDatosGrafica().at(-1);

        expect(ultimoDia?.contactos).toBe(0);
        expect(ultimoDia?.publicaciones).toBe(0);
    });

    it("calcula el histórico total utilizando el registro más antiguo de ambas estadísticas", () => {
        const contactos: DatoEstadistica[] = [
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

        const publicaciones: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2025, 2, 1),
                cantidad: 200,
                username: "usuario2",
            },
            {
                fecha: fechaLocal(2026, 5, 15),
                cantidad: 8,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 11,
                username: "usuario1",
            },
        ];

        renderizarBloque({
            contactos,
            publicaciones,
        });

        fireEvent.change(screen.getByLabelText("Usuario"), {
            target: {
                value: "usuario1",
            },
        });

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "todo",
            },
        });

        const datos = obtenerDatosGrafica();

        expect(datos[0].fecha).toBe(
            fechaLocal(2026, 5, 15).setHours(0, 0, 0, 0),
        );

        expect(datos[0].contactos).toBe(0);
        expect(datos[0].publicaciones).toBe(8);

        expect(datos.at(-1)?.contactos).toBe(5);
        expect(datos.at(-1)?.publicaciones).toBe(11);

        const tarjeta = obtenerTarjeta(
            "Total del Rango Seleccionado",
        );

        expect(within(tarjeta).getByText("11")).toBeInTheDocument();
        expect(within(tarjeta).getByText("19")).toBeInTheDocument();
    });

    it("actualiza el histórico cuando cambia el usuario seleccionado", () => {
        const contactos: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2025, 5, 1),
                cantidad: 10,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 7, 1),
                cantidad: 20,
                username: "usuario2",
            },
        ];

        const publicaciones: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2025, 3, 1),
                cantidad: 30,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 6, 1),
                cantidad: 40,
                username: "usuario2",
            },
        ];

        renderizarBloque({
            contactos,
            publicaciones,
        });

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "todo",
            },
        });

        fireEvent.change(screen.getByLabelText("Usuario"), {
            target: {
                value: "usuario1",
            },
        });

        expect(obtenerDatosGrafica()[0].fecha).toBe(
            fechaLocal(2025, 3, 1).setHours(0, 0, 0, 0),
        );

        fireEvent.change(screen.getByLabelText("Usuario"), {
            target: {
                value: "usuario2",
            },
        });

        expect(obtenerDatosGrafica()[0].fecha).toBe(
            fechaLocal(2026, 6, 1).setHours(0, 0, 0, 0),
        );
    });

    it("utiliza hoy como inicio del histórico cuando ningún registro coincide con el usuario", () => {
        const contactos: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 6, 1),
                cantidad: 6,
                username: "usuario1",
            },
        ];

        const publicaciones: DatoEstadistica[] = [
            {
                fecha: fechaLocal(2026, 7, 1),
                cantidad: 8,
                username: "usuario1",
            },
        ];

        renderizarBloque({
            contactos,
            publicaciones,
        });

        fireEvent.change(screen.getByLabelText("Usuario"), {
            target: {
                value: "usuario2",
            },
        });

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "todo",
            },
        });

        const datos = obtenerDatosGrafica();

        expect(datos).toHaveLength(1);
        expect(datos[0].contactos).toBe(0);
        expect(datos[0].publicaciones).toBe(0);
    });

    it("ignora las fechas inválidas al calcular el histórico y acumular los registros", () => {
        const contactos: DatoEstadistica[] = [
            {
                fecha: "fecha-invalida",
                cantidad: 100,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 5,
                username: "usuario1",
            },
        ];

        const publicaciones: DatoEstadistica[] = [
            {
                fecha: "fecha-invalida",
                cantidad: 200,
                username: "usuario1",
            },
            {
                fecha: fechaLocal(2026, 10, 20),
                cantidad: 7,
                username: "usuario1",
            },
        ];

        renderizarBloque({
            contactos,
            publicaciones,
        });

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "todo",
            },
        });

        const datos = obtenerDatosGrafica();

        expect(datos).toHaveLength(1);
        expect(datos[0].contactos).toBe(5);
        expect(datos[0].publicaciones).toBe(7);

        const tarjeta = obtenerTarjeta("Total de Hoy");

        expect(within(tarjeta).getByText("5")).toBeInTheDocument();
        expect(within(tarjeta).getByText("7")).toBeInTheDocument();
    });

    it("acepta fechas recibidas como strings ISO", () => {
        const contactos: DatoEstadistica[] = [
            {
                fecha: "2026-10-20T12:00:00.000Z",
                cantidad: 15,
                username: "usuario1",
            },
        ];

        const publicaciones: DatoEstadistica[] = [
            {
                fecha: "2026-10-20T12:00:00.000Z",
                cantidad: 25,
                username: "usuario1",
            },
        ];

        renderizarBloque({
            contactos,
            publicaciones,
        });

        const tarjetaHoy = obtenerTarjeta("Total de Hoy");

        expect(within(tarjetaHoy).getByText("15")).toBeInTheDocument();
        expect(within(tarjetaHoy).getByText("25")).toBeInTheDocument();

        const ultimoDia = obtenerDatosGrafica().at(-1);

        expect(ultimoDia?.contactos).toBe(15);
        expect(ultimoDia?.publicaciones).toBe(25);
    });

    it("acepta fechas recibidas como strings con formato YYYY-MM-DD", () => {
        const contactos: DatoEstadistica[] = [
            {
                fecha: "2026-10-20",
                cantidad: 15,
                username: "usuario1",
            },
        ];

        const publicaciones: DatoEstadistica[] = [
            {
                fecha: "2026-10-20",
                cantidad: 25,
                username: "usuario1",
            },
        ];

        renderizarBloque({
            contactos,
            publicaciones,
        });

        const tarjetaHoy = obtenerTarjeta("Total de Hoy");

        expect(within(tarjetaHoy).getByText("15")).toBeInTheDocument();
        expect(within(tarjetaHoy).getByText("25")).toBeInTheDocument();

        const ultimoDia = obtenerDatosGrafica().at(-1);

        expect(ultimoDia?.contactos).toBe(15);
        expect(ultimoDia?.publicaciones).toBe(25);
    });

    it("devuelve cero cuando ambas fuentes no tienen registros", () => {
        renderizarBloque({
            contactos: [],
            publicaciones: [],
        });

        const tarjetaHoy = obtenerTarjeta("Total de Hoy");
        const tarjetaRango = obtenerTarjeta(
            "Total del Rango Seleccionado",
        );

        expect(within(tarjetaHoy).getAllByText("0")).toHaveLength(2);
        expect(within(tarjetaRango).getAllByText("0")).toHaveLength(2);

        const datos = obtenerDatosGrafica();

        expect(datos).toHaveLength(31);

        expect(
            datos.every(
                (item) =>
                    item.contactos === 0 &&
                    item.publicaciones === 0,
            ),
        ).toBe(true);
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
        ).toContain("Fecha: 20/10/2026");

        expect(
            screen.getByTestId("tooltip-fecha-invalida").textContent,
        ).toBe("");
    });

    it("formatea cantidades y conserva el nombre de cada serie en el Tooltip", () => {
        renderizarBloque();

        expect(
            JSON.parse(
                screen.getByTestId("tooltip-cantidad").textContent ?? "null",
            ),
        ).toEqual([
            new Intl.NumberFormat("es-UY").format(123),
            "Publicaciones",
        ]);

        expect(
            JSON.parse(
                screen.getByTestId("tooltip-cantidad-vacia").textContent ?? "null",
            ),
        ).toEqual([
            "0",
            "WhatsApp",
        ]);
    });

    it("oculta las fechas personalizadas al volver a seleccionar un período predefinido", () => {
        renderizarBloque();

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "personalizado",
            },
        });

        expect(screen.getByLabelText("Desde")).toBeInTheDocument();
        expect(screen.getByLabelText("Hasta")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Período"), {
            target: {
                value: "3m",
            },
        });

        expect(
            screen.queryByLabelText("Desde"),
        ).not.toBeInTheDocument();

        expect(
            screen.queryByLabelText("Hasta"),
        ).not.toBeInTheDocument();

        expect(obtenerDatosGrafica()).toHaveLength(93);
    });
});
