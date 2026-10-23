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
    default: function FiltrosSimulados({ alConsultar, especieFiltro }: { alConsultar: (consulta: FiltrosConsulta) => void; especieFiltro: string }) {
        useEffect(() => { alConsultar({ especie: especieFiltro, orden: "prioridad" }); }, [alConsultar, especieFiltro]);
        return <button onClick={() => alConsultar({ especie: "Limón", orden: "precioAsc" })}>Filtrar limón</button>;
    },
}));

function resultado(precio = 100, cantidad = 1): ResultadoPublicaciones {
    return {
        publicaciones: Array.from({ length: cantidad }, (_, indice) => ({ id: indice + 1, especie: "Tomate", precio, fecha: "2026-10-16T10:00:00Z", foto: null, variedad: "Perita", presentacion: "KG", categoria: "I", calibre: "M", codigoCalibre: "M", pais: "Uruguay", tipoPublicacion: "OPERADOR", operador: { id: 1, nombreFantasia: "Huerta", whatsApp: "" } })),
        opciones: [], total: cantidad, totalCatalogo: cantidad,
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

it("no reemplaza datos nuevos con una respuesta vieja", async () => {
    let resolverAntigua: (dato: ResultadoPublicaciones) => void = () => {};
    cargar.mockImplementationOnce(() => new Promise((resolve) => { resolverAntigua = resolve; })).mockResolvedValue(resultado(400));
    render(<ContenedorPublicaciones resultado={resultado()} />);
    act(() => escuchar.mock.calls.at(-1)![0]());
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
    act(() => escuchar.mock.calls.at(-1)![0]());
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron actualizar");
    expect(screen.getByTestId("listado")).toHaveTextContent("100");
    fireEvent.click(screen.getByText("Reintentar"));
    await waitFor(() => expect(screen.getByTestId("listado")).toHaveTextContent("300"));
});

it("cancela la recarga pendiente al desmontarse", async () => {
    const vista = render(<ContenedorPublicaciones resultado={resultado()} />);
    act(() => escuchar.mock.calls.at(-1)![0]());
    vista.unmount();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(cargar).not.toHaveBeenCalled();
});
