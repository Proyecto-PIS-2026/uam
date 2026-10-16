import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import type { FiltrosConsulta } from "../../../consulta-mercado/acciones/filtros-consulta";
import type { ResultadoPublicaciones } from "../../../consulta-mercado/acciones/Publicaciones";
import ContenedorPublicaciones from "./ContenedorPublicaciones";

const { cargar, escuchar } = vi.hoisted(() => ({ cargar: vi.fn(), escuchar: vi.fn() }));

vi.mock("../../../consulta-mercado/acciones/ConsultarPublicacion.action", () => ({ default: cargar }));
vi.mock("../../tiempo-real/use-actualizaciones-publicaciones", () => ({ useActualizacionesPublicaciones: escuchar }));
vi.mock("../listado-publicaciones/ListadoPublicacionesUnificado", () => ({ default: ({ publicaciones }: ResultadoPublicaciones) => <div data-testid="listado">{publicaciones.map((p) => <span key={p.id}>{p.especie} {p.precio}</span>)}</div> }));
vi.mock("../../filtros/FiltrosPublicaciones", () => ({
    default: function FiltrosSimulados({ alConsultar, especieFiltro }: { alConsultar: (consulta: FiltrosConsulta) => void; especieFiltro: string }) {
        useEffect(() => { alConsultar({ especie: especieFiltro, orden: "prioridad" }); }, [alConsultar, especieFiltro]);
        return <button onClick={() => alConsultar({ especie: "Limón", orden: "precioAsc" })}>Filtrar limón</button>;
    },
}));

function resultado(pagina = 1, precio = 100): ResultadoPublicaciones {
    return {
        publicaciones: [{ id: pagina, especie: "Tomate", precio, fecha: "2026-10-16T10:00:00Z", foto: null, variedad: "Perita", presentacion: "KG", categoria: "I", calibre: "M", codigoCalibre: "M", pais: "Uruguay", operador: { id: 1, nombreFantasia: "Huerta", whatsApp: "" } }],
        opciones: [], total: 35, totalCatalogo: 35, pagina, tamanoPagina: 30,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    cargar.mockResolvedValue(resultado());
});

it("muestra la página inicial sin pedir de nuevo el catálogo al montar", () => {
    render(<ContenedorPublicaciones resultado={resultado()} />);
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(cargar).not.toHaveBeenCalled();
});

it("pide la página siguiente y actualiza el listado", async () => {
    cargar.mockResolvedValue(resultado(2, 200));
    render(<ContenedorPublicaciones resultado={resultado()} />);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(screen.getByText("Página 2 de 2")).toBeInTheDocument());
    expect(cargar).toHaveBeenCalledWith({ especie: "", orden: "prioridad", pagina: 2 });
    expect(screen.getByTestId("listado")).toHaveTextContent("200");
});

it("consulta los filtros sobre el catálogo completo y vuelve a la primera página", async () => {
    render(<ContenedorPublicaciones resultado={resultado(2)} />);
    fireEvent.click(screen.getByText("Filtrar limón"));
    await waitFor(() => expect(cargar).toHaveBeenCalledWith({ especie: "Limón", orden: "precioAsc", pagina: 1 }));
});

it("agrupa las notificaciones de tiempo real en una sola recarga", async () => {
    cargar.mockResolvedValue(resultado(1, 250));
    render(<ContenedorPublicaciones resultado={resultado()} />);
    act(() => {
        escuchar.mock.calls.at(-1)![0]();
        escuchar.mock.calls.at(-1)![0]();
        escuchar.mock.calls.at(-1)![0]();
    });
    await waitFor(() => expect(screen.getByTestId("listado")).toHaveTextContent("250"));
    expect(cargar).toHaveBeenCalledOnce();
});

it("no reemplaza datos nuevos con una respuesta vieja", async () => {
    let resolverAntigua: (dato: ResultadoPublicaciones) => void = () => {};
    cargar.mockImplementationOnce(() => new Promise((resolve) => { resolverAntigua = resolve; })).mockResolvedValue(resultado(1, 400));
    render(<ContenedorPublicaciones resultado={resultado()} />);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(screen.getByText("Filtrar limón"));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    expect(cargar).toHaveBeenCalledOnce();
    await act(async () => resolverAntigua(resultado(2, 99)));
    await waitFor(() => expect(screen.getByTestId("listado")).toHaveTextContent("400"));
    expect(screen.getByTestId("listado")).toHaveTextContent("400");
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
});

it("reconsulta los filtros vigentes cuando cambia la respuesta del servidor", async () => {
    const vista = render(<ContenedorPublicaciones resultado={resultado()} />);
    fireEvent.click(screen.getByText("Filtrar limón"));
    await waitFor(() => expect(cargar).toHaveBeenCalledOnce());
    cargar.mockClear();
    vista.rerender(<ContenedorPublicaciones resultado={resultado(1, 999)} />);
    await waitFor(() => expect(cargar).toHaveBeenCalledWith({ especie: "Limón", orden: "precioAsc", pagina: 1 }));
});

it("mantiene los datos disponibles y permite reintentar un error", async () => {
    cargar.mockRejectedValueOnce(new Error("sin red")).mockResolvedValue(resultado(2, 300));
    render(<ContenedorPublicaciones resultado={resultado()} />);
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
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
