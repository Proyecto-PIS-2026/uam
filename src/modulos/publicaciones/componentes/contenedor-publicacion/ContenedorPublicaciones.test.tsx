import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FiltrosConsulta } from "../../../consulta-mercado/acciones/filtros-consulta";
import type { ResultadoPublicaciones } from "../../../consulta-mercado/acciones/PublicacionesOperador";
import ContenedorPublicaciones from "./ContenedorPublicaciones";

const { cargar, escuchar } = vi.hoisted(() => ({
    cargar: vi.fn(),
    escuchar: vi.fn(),
}));

vi.mock("../../../consulta-mercado/acciones/ConsultarPublicacionOperador.action", () => ({
    default: cargar,
}));

vi.mock("../../tiempo-real/use-actualizaciones-publicaciones", () => ({
    useActualizacionesPublicaciones: escuchar,
}));

vi.mock("../listado-publicaciones/ListadoPublicaciones", () => ({
    default: ({ publicaciones }: Pick<ResultadoPublicaciones, "publicaciones">) => (
        <div data-testid="listado">
            {publicaciones.map((publicacion) => <span key={publicacion.id} data-id={publicacion.id}>{publicacion.especie} {publicacion.precio}</span>)}
        </div>
    ),
}));

vi.mock("../../filtros/FiltrosPublicaciones", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../filtros/FiltrosPublicaciones")>()),
    default: function FiltrosSimulados({ alConsultar, especieFiltro, navesDisponibles, ordenInicial = "prioridad", ordenamientoHabilitado = true }: {
        alConsultar: (consulta: FiltrosConsulta) => void;
        especieFiltro: string;
        navesDisponibles: string[];
        ordenInicial?: FiltrosConsulta["orden"];
        ordenamientoHabilitado?: boolean;
    }) {
        useEffect(() => {
            alConsultar({ especie: especieFiltro, orden: ordenInicial });
        }, [alConsultar, especieFiltro, ordenInicial]);

        return (
            <>
                <button onClick={() => alConsultar({ especie: "Limón", orden: ordenamientoHabilitado ? "precioAsc" : ordenInicial })}>Filtrar limón</button>
                <button onClick={() => alConsultar({ especie: "Limón", nave: "A", orden: ordenamientoHabilitado ? "precioAsc" : ordenInicial })}>Filtrar nave A</button>
                <button onClick={() => alConsultar({ especie: especieFiltro, orden: ordenamientoHabilitado ? "fechaDesc" : ordenInicial })}>Más actualizadas</button>
                <span data-testid="naves">{navesDisponibles.join(", ")}</span>
                <span data-testid="orden-inicial">{ordenInicial}</span>
                <span data-testid="ordenamiento-habilitado">{String(ordenamientoHabilitado)}</span>
            </>
        );
    },
}));

function resultado(precio = 100, cantidad = 1): ResultadoPublicaciones {
    return {
        publicaciones: Array.from({ length: cantidad }, (_, indice) => ({
            id: indice + 1,
            especie: "Tomate",
            precio,
            fecha: "2026-10-16T10:00:00Z",
            foto: null,
            variedad: "Perita",
            presentacion: "KG",
            categoria: "I",
            calibre: "M",
            codigoCalibre: "M",
            pais: "Uruguay",
            tipoPublicacion: "OPERADOR",
            operador: { id: 1, nombreFantasia: "Huerta", whatsApp: "" },
        })),
        opciones: [],
        naves: ["A", "B"],
        total: cantidad,
        totalCatalogo: cantidad,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    cargar.mockResolvedValue(resultado());
});

afterEach(cleanup);

describe("ContenedorPublicaciones remoto", () => {
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
        await waitFor(() => expect(screen.getByTestId("listado").children).toHaveLength(36));
        expect(screen.getByTestId("listado")).toHaveTextContent("200");
    });

    it("agrupa las notificaciones de tiempo real en una sola recarga", async () => {
        cargar.mockResolvedValue(resultado(250, 35));
        render(<ContenedorPublicaciones resultado={resultado()} />);
        act(() => {
            void escuchar.mock.calls.at(-1)![0]();
            void escuchar.mock.calls.at(-1)![0]();
            void escuchar.mock.calls.at(-1)![0]();
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

        act(() => { void escuchar.mock.calls.at(-1)![0]() });

        await waitFor(() => expect(screen.getByTestId("listado").children).toHaveLength(3));
        expect(cargar).toHaveBeenLastCalledWith({ especie: "Limón", nave: "A", orden: "precioAsc" });
        expect(cargar).toHaveBeenCalledTimes(2);
    });

    it("no reemplaza datos nuevos con una respuesta vieja", async () => {
        let resolverAntigua!: (dato: ResultadoPublicaciones) => void;
        cargar.mockImplementationOnce(() => new Promise<ResultadoPublicaciones>((resolve) => { resolverAntigua = resolve })).mockResolvedValue(resultado(400));
        render(<ContenedorPublicaciones resultado={resultado()} />);
        act(() => { void escuchar.mock.calls.at(-1)![0]() });
        await waitFor(() => expect(cargar).toHaveBeenCalledOnce());
        fireEvent.click(screen.getByText("Filtrar limón"));
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)) });
        expect(cargar).toHaveBeenCalledOnce();
        await act(async () => { resolverAntigua(resultado(99)) });
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
        act(() => { void escuchar.mock.calls.at(-1)![0]() });
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron actualizar");
        expect(screen.getByTestId("listado")).toHaveTextContent("100");
        fireEvent.click(screen.getByText("Reintentar"));
        await waitFor(() => expect(screen.getByTestId("listado")).toHaveTextContent("300"));
    });

    it("cancela la recarga pendiente al desmontarse", async () => {
        const vista = render(<ContenedorPublicaciones resultado={resultado()} />);
        act(() => { void escuchar.mock.calls.at(-1)![0]() });
        vista.unmount();
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(cargar).not.toHaveBeenCalled();
    });

    it("confirma la actualización de tiempo real después de recibir los datos", async () => {
        let resolver!: (dato: ResultadoPublicaciones) => void;
        cargar.mockImplementationOnce(() => new Promise<ResultadoPublicaciones>((resolve) => { resolver = resolve }));
        render(<ContenedorPublicaciones resultado={resultado()} />);
        const confirmado = vi.fn();
        let finalizacion!: Promise<boolean>;

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
        let finalizacion!: Promise<boolean>;
        act(() => { finalizacion = escuchar.mock.calls.at(-1)![0]() });
        await act(async () => { await expect(finalizacion).resolves.toBe(false) });
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron actualizar");
        expect(screen.getByTestId("listado")).toHaveTextContent("100");
    });

    it("espera la consulta vigente si los filtros cambian durante una actualización", async () => {
        let resolverAntigua!: (dato: ResultadoPublicaciones) => void;
        let resolverVigente!: (dato: ResultadoPublicaciones) => void;
        cargar.mockImplementationOnce(() => new Promise<ResultadoPublicaciones>((resolve) => { resolverAntigua = resolve }))
            .mockImplementationOnce(() => new Promise<ResultadoPublicaciones>((resolve) => { resolverVigente = resolve }));
        render(<ContenedorPublicaciones resultado={resultado()} />);
        const confirmado = vi.fn();
        let finalizacion!: Promise<boolean>;

        act(() => {
            finalizacion = escuchar.mock.calls.at(-1)![0]();
            void finalizacion.then(confirmado);
        });

        await waitFor(() => expect(cargar).toHaveBeenCalledOnce());
        fireEvent.click(screen.getByText("Filtrar nave A"));
        await act(async () => { resolverAntigua(resultado(99)) });
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

    it.each(["alfabeticoDesc", "fechaDesc"] as const)("entrega el orden configurado %s a los filtros sin consultar nuevamente al montar", (ordenInicial) => {
        render(<ContenedorPublicaciones resultado={resultado()} ordenInicial={ordenInicial} ordenamientoHabilitado={false} />);
        expect(screen.getByTestId("orden-inicial")).toHaveTextContent(ordenInicial);
        expect(screen.getByTestId("ordenamiento-habilitado")).toHaveTextContent("false");
        expect(cargar).not.toHaveBeenCalled();
    });

    it.each(["alfabeticoDesc", "fechaDesc"] as const)("conserva el orden configurado %s en las actualizaciones de tiempo real", async (ordenInicial) => {
        render(<ContenedorPublicaciones resultado={resultado()} especie="Tomate" ordenInicial={ordenInicial} ordenamientoHabilitado={false} />);
        act(() => { void escuchar.mock.calls.at(-1)![0]() });
        await waitFor(() => expect(cargar).toHaveBeenCalledExactlyOnceWith({ especie: "Tomate", orden: ordenInicial }));
    });

    it.each(["alfabeticoDesc", "fechaDesc"] as const)("mantiene el predeterminado %s al filtrar con el ordenamiento deshabilitado", async (ordenInicial) => {
        render(<ContenedorPublicaciones resultado={resultado()} ordenInicial={ordenInicial} ordenamientoHabilitado={false} />);
        fireEvent.click(screen.getByText("Filtrar limón"));
        await waitFor(() => expect(cargar).toHaveBeenCalledExactlyOnceWith({ especie: "Limón", orden: ordenInicial }));
    });

    it("permite enviar otro orden cuando el ordenamiento está habilitado", async () => {
        render(<ContenedorPublicaciones resultado={resultado()} ordenInicial="alfabeticoDesc" ordenamientoHabilitado />);
        expect(screen.getByTestId("ordenamiento-habilitado")).toHaveTextContent("true");
        fireEvent.click(screen.getByText("Filtrar limón"));
        await waitFor(() => expect(cargar).toHaveBeenCalledExactlyOnceWith({ especie: "Limón", orden: "precioAsc" }));
    });

    it.each(["alfabeticoAsc", "fechaDesc"] as const)("conserva el orden configurado %s al filtrar por nave con el switch apagado", async (ordenInicial) => {
        render(<ContenedorPublicaciones resultado={resultado()} ordenInicial={ordenInicial} ordenamientoHabilitado={false} />);
        fireEvent.click(screen.getByText("Filtrar nave A"));
        await waitFor(() => expect(cargar).toHaveBeenCalledExactlyOnceWith({ especie: "Limón", nave: "A", orden: ordenInicial }));
    });

    it("envía el orden por actualización cuando el usuario selecciona Más actualizadas", async () => {
        render(<ContenedorPublicaciones resultado={resultado()} especie="Papa" ordenInicial="precioAsc" ordenamientoHabilitado />);
        fireEvent.click(screen.getByRole("button", { name: "Más actualizadas" }));
        await waitFor(() => expect(cargar).toHaveBeenCalledExactlyOnceWith({ especie: "Papa", orden: "fechaDesc" }));
    });

    it("mantiene el orden por actualización elegido al recibir una notificación de tiempo real", async () => {
        render(<ContenedorPublicaciones resultado={resultado()} especie="Papa" ordenInicial="precioAsc" ordenamientoHabilitado />);
        fireEvent.click(screen.getByRole("button", { name: "Más actualizadas" }));
        await waitFor(() => expect(cargar).toHaveBeenCalledOnce());
        act(() => { void escuchar.mock.calls.at(-1)![0]() });
        await waitFor(() => expect(cargar).toHaveBeenCalledTimes(2));
        expect(cargar).toHaveBeenLastCalledWith({ especie: "Papa", orden: "fechaDesc" });
    });

    it("conserva el orden de publicaciones recibido del servidor", () => {
        const datos = resultado(100, 3);
        datos.publicaciones = [datos.publicaciones[2], datos.publicaciones[0], datos.publicaciones[1]];
        render(<ContenedorPublicaciones resultado={datos} ordenInicial="fechaDesc" />);
        const ids = Array.from(screen.getByTestId("listado").children).map((elemento) => elemento.getAttribute("data-id"));
        expect(ids).toEqual(["3", "1", "2"]);
    });
});