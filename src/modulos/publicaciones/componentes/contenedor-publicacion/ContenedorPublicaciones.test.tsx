import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import type { FiltrosConsulta } from "../../../consulta-mercado/acciones/filtros-consulta";
import type { ResultadoPublicaciones } from "../../../consulta-mercado/acciones/PublicacionesOperador";
import ContenedorPublicaciones from "./ContenedorPublicaciones";

const { cargar, escuchar } = vi.hoisted(() => ({ cargar: vi.fn(), escuchar: vi.fn() }));

vi.mock("../../../consulta-mercado/acciones/ConsultarPublicacionOperador.action", () => ({ default: cargar }));
vi.mock("../../tiempo-real/use-actualizaciones-publicaciones", () => ({ useActualizacionesPublicaciones: escuchar }));
vi.mock("../listado-publicaciones/ListadoPublicaciones", () => ({ default: ({ publicaciones }: ResultadoPublicaciones) => <div data-testid="listado">{publicaciones.map((p) => <span key={p.id}>{p.especie} {p.precio}</span>)}</div> }));
vi.mock("../../filtros/FiltrosPublicaciones", () => ({
    default: function FiltrosSimulados({ alConsultar, especieFiltro, navesDisponibles }: { alConsultar: (consulta: FiltrosConsulta) => void; especieFiltro: string; navesDisponibles: string[] }) {
        useEffect(() => { alConsultar({ especie: especieFiltro, orden: "prioridad" }); }, [alConsultar, especieFiltro]);
        return (
            <>
                <button onClick={() => alConsultar({ especie: "Limón", orden: "precioAsc" })}>Filtrar limón</button>
                <button onClick={() => alConsultar({ especie: "Limón", nave: "A", orden: "precioAsc" })}>Filtrar nave A</button>
                <span data-testid="naves">{navesDisponibles.join(", ")}</span>
            </>
        );
    },
}));

function resultado(precio = 100, cantidad = 1): ResultadoPublicaciones {
    return {
        publicaciones: Array.from({ length: cantidad }, (_, indice) => ({ id: indice + 1, especie: "Tomate", precio, fecha: "2026-10-16T10:00:00Z", foto: null, variedad: "Perita", presentacion: "KG", categoria: "I", calibre: "M", codigoCalibre: "M", pais: "Uruguay", tipoPublicacion: "OPERADOR", operador: { id: 1, nombreFantasia: "Huerta", whatsApp: "" } })),
        opciones: [], naves: ["A", "B"], total: cantidad, totalCatalogo: cantidad,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    cargar.mockResolvedValue(resultado());
});

it("muestra todas las publicaciones sin paginación ni una consulta adicional al montar", () => {
    render(<ContenedorPublicaciones resultado={resultado(100, 35)} />);
    expect(screen.getByTestId("listado").children).toHaveLength(35);
    expect(screen.queryByRole("navigation", { name: "Páginas de publicaciones" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anterior" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument();
    expect(cargar).not.toHaveBeenCalled();
});

it("consulta los filtros y muestra todos los resultados coincidentes", async () => {
    cargar.mockResolvedValue(resultado(200, 36));
    render(<ContenedorPublicaciones resultado={resultado(100, 40)} />);
    fireEvent.click(screen.getByText("Filtrar limón"));
    await waitFor(() => expect(cargar).toHaveBeenCalledWith({ especie: "Limón", orden: "precioAsc" }));
    expect(screen.getByTestId("listado").children).toHaveLength(36);
    expect(screen.getByTestId("listado")).toHaveTextContent("200");
});

it("agrupa las notificaciones de tiempo real en una sola recarga", async () => {
    cargar.mockResolvedValue(resultado(250, 35));
    render(<ContenedorPublicaciones resultado={resultado()} />);
    act(() => {
        escuchar.mock.calls.at(-1)![0]();
        escuchar.mock.calls.at(-1)![0]();
        escuchar.mock.calls.at(-1)![0]();
    });
    await waitFor(() => expect(screen.getByTestId("listado")).toHaveTextContent("250"));
    expect(screen.getByTestId("listado").children).toHaveLength(35);
    expect(cargar).toHaveBeenCalledOnce();
});

it("mantiene la nave y los demás filtros al actualizar por tiempo real después de un resultado vacío", async () => {
    cargar.mockResolvedValueOnce(resultado(100, 0)).mockResolvedValue(resultado(250, 3));
    render(<ContenedorPublicaciones resultado={resultado()} />);
    expect(screen.getByTestId("naves")).toHaveTextContent("A, B");

    fireEvent.click(screen.getByText("Filtrar nave A"));
    await waitFor(() => expect(cargar).toHaveBeenCalledExactlyOnceWith({ especie: "Limón", nave: "A", orden: "precioAsc" }));
    await waitFor(() => expect(screen.getByTestId("listado").children).toHaveLength(0));
    expect(screen.getByTestId("naves")).toHaveTextContent("A, B");

    act(() => { void escuchar.mock.calls.at(-1)![0](); });
    await waitFor(() => expect(screen.getByTestId("listado").children).toHaveLength(3));
    expect(cargar).toHaveBeenLastCalledWith({ especie: "Limón", nave: "A", orden: "precioAsc" });
    expect(cargar).toHaveBeenCalledTimes(2);
});

it("no reemplaza datos nuevos con una respuesta vieja", async () => {
    let resolverAntigua: (dato: ResultadoPublicaciones) => void = () => {};
    cargar.mockImplementationOnce(() => new Promise((resolve) => { resolverAntigua = resolve; })).mockResolvedValue(resultado(400));
    render(<ContenedorPublicaciones resultado={resultado()} />);
    act(() => { void escuchar.mock.calls.at(-1)![0](); });
    await waitFor(() => expect(cargar).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText("Filtrar limón"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    expect(cargar).toHaveBeenCalledOnce();
    await act(async () => resolverAntigua(resultado(99)));
    await waitFor(() => expect(screen.getByTestId("listado")).toHaveTextContent("400"));
    expect(cargar).toHaveBeenLastCalledWith({ especie: "Limón", orden: "precioAsc" });
});

it("reconsulta los filtros vigentes cuando cambia la respuesta del servidor", async () => {
    const vista = render(<ContenedorPublicaciones resultado={resultado()} />);
    fireEvent.click(screen.getByText("Filtrar limón"));
    await waitFor(() => expect(cargar).toHaveBeenCalledOnce());
    cargar.mockClear();
    vista.rerender(<ContenedorPublicaciones resultado={resultado(999)} />);
    await waitFor(() => expect(cargar).toHaveBeenCalledWith({ especie: "Limón", orden: "precioAsc" }));
});

it("mantiene los datos disponibles y permite reintentar un error", async () => {
    cargar.mockRejectedValueOnce(new Error("sin red")).mockResolvedValue(resultado(300));
    render(<ContenedorPublicaciones resultado={resultado()} />);
    act(() => { void escuchar.mock.calls.at(-1)![0](); });
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron actualizar");
    expect(screen.getByTestId("listado")).toHaveTextContent("100");
    fireEvent.click(screen.getByText("Reintentar"));
    await waitFor(() => expect(screen.getByTestId("listado")).toHaveTextContent("300"));
});

it("cancela la recarga pendiente al desmontarse", async () => {
    const vista = render(<ContenedorPublicaciones resultado={resultado()} />);
    act(() => { void escuchar.mock.calls.at(-1)![0](); });
    vista.unmount();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(cargar).not.toHaveBeenCalled();
});

it("confirma la actualización de tiempo real después de recibir los datos", async () => {
    let resolver: (dato: ResultadoPublicaciones) => void = () => {};
    cargar.mockImplementationOnce(() => new Promise((resolve) => { resolver = resolve; }));
    render(<ContenedorPublicaciones resultado={resultado()} />);
    const confirmado = vi.fn();
    let finalizacion: Promise<boolean>;
    act(() => {
        finalizacion = escuchar.mock.calls.at(-1)![0]();
        void finalizacion.then(confirmado);
    });
    await waitFor(() => expect(cargar).toHaveBeenCalledOnce());
    expect(confirmado).not.toHaveBeenCalled();
    await act(async () => {
        resolver(resultado(500));
        await expect(finalizacion).resolves.toBe(true);
    });
    expect(confirmado).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByTestId("listado")).toHaveTextContent("500");
});

it("informa el fallo al suscriptor para que pueda reintentar la misma versión", async () => {
    cargar.mockRejectedValueOnce(new Error("sin red"));
    render(<ContenedorPublicaciones resultado={resultado()} />);
    let finalizacion: Promise<boolean>;
    act(() => { finalizacion = escuchar.mock.calls.at(-1)![0](); });
    await act(async () => { await expect(finalizacion).resolves.toBe(false); });
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron actualizar");
    expect(screen.getByTestId("listado")).toHaveTextContent("100");
});

it("espera la consulta vigente si los filtros cambian durante una actualización", async () => {
    let resolverAntigua: (dato: ResultadoPublicaciones) => void = () => {};
    let resolverVigente: (dato: ResultadoPublicaciones) => void = () => {};
    cargar.mockImplementationOnce(() => new Promise((resolve) => { resolverAntigua = resolve; }))
        .mockImplementationOnce(() => new Promise((resolve) => { resolverVigente = resolve; }));
    render(<ContenedorPublicaciones resultado={resultado()} />);
    const confirmado = vi.fn();
    let finalizacion: Promise<boolean>;
    act(() => {
        finalizacion = escuchar.mock.calls.at(-1)![0]();
        void finalizacion.then(confirmado);
    });
    await waitFor(() => expect(cargar).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByText("Filtrar nave A"));
    await act(async () => { resolverAntigua(resultado(99)); });
    expect(confirmado).not.toHaveBeenCalled();
    await waitFor(() => expect(cargar).toHaveBeenCalledTimes(2));
    expect(cargar).toHaveBeenLastCalledWith({ especie: "Limón", nave: "A", orden: "precioAsc" });
    await act(async () => {
        resolverVigente(resultado(600));
        await expect(finalizacion).resolves.toBe(true);
    });
    expect(confirmado).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByTestId("listado")).toHaveTextContent("600");
});
