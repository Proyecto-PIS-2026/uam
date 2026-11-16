import { act, cleanup, fireEvent, render, screen, within } from "@/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicacionProductorListado } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";
import MercadoProduccion from "./MercadoProduccion";

const mocks = vi.hoisted(() => ({ cargar: vi.fn(), escuchar: vi.fn() }));
vi.mock("@/modulos/consulta-mercado/acciones/ConsultarPublicacionProductor.action", () => ({ default: mocks.cargar }));
vi.mock("@/modulos/consulta-mercado/acciones/ConsultarPublicacionOperador.action", () => ({ default: vi.fn() }));
vi.mock("../../tiempo-real/use-actualizaciones-publicaciones", () => ({ useActualizacionesPublicaciones: mocks.escuchar }));
vi.mock("@/compartido/EncabezadoPagina", () => ({
    default: ({ titulo, cantidad }: { titulo: string; cantidad: number }) => <header><h1>{titulo}</h1><span data-testid="cantidad">{cantidad}</span></header>,
}));
vi.mock("../tarjetas-publicacion/TarjetaPublicacionConProductor", () => ({
    default: ({ publicacion, onClick }: { publicacion: PublicacionProductorListado; onClick: () => void }) => <button data-testid="tarjeta" onClick={onClick}>Publicación {publicacion.id} precio {publicacion.precio}</button>,
}));
vi.mock("../tarjetas-publicacion/TarjetaPublicacionSinProductor", () => ({
    default: ({ publicacion, onClick }: { publicacion: PublicacionProductorListado; onClick: () => void }) => <button data-testid="tarjeta" onClick={onClick}>Publicación {publicacion.id} precio {publicacion.precio}</button>,
}));
vi.mock("../drawer-publicacion/DrawerPublicacion", () => ({
    DrawerPublicacion: ({ publicacion, open }: { publicacion: PublicacionProductorListado; open: boolean }) => open ? <div role="dialog">Precio {publicacion.precio}</div> : null,
}));

function publicacion(id: number): PublicacionProductorListado {
    return {
        id, especie: "Papa", variedad: "Blanca", precio: id, fecha: "2026-11-16T12:00:00Z", foto: null,
        envase: "Cajón", kilos: "20", categoria: "Primera", calibre: "Mediano", codigoCalibre: "M", pais: "Uruguay",
        tipoPublicacion: "PRODUCTOR", productor: { id: 1, nombreFantasia: "Huerta Sur", whatsApp: "099123456", fotoPerfil: null }, ubicaciones: [],
    };
}

function actualizar(): Promise<boolean> {
    return (mocks.escuchar.mock.calls.at(-1)![0] as () => Promise<boolean>)();
}

function seleccionar(etiqueta: string, opcion: string) {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: etiqueta }));
    fireEvent.click(screen.getByRole("option", { name: opcion }));
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.cargar.mockResolvedValue({ publicaciones: [] });
});
afterEach(cleanup);

describe("MercadoProduccion en tiempo real", () => {
    it("se suscribe al canal de productores y actualiza el encabezado y las altas sin recargar", async () => {
        render(<MercadoProduccion publicaciones={[]} />);
        expect(mocks.escuchar).toHaveBeenLastCalledWith(expect.any(Function), { tipo: "PRODUCTOR" });
        expect(screen.getByTestId("cantidad")).toHaveTextContent("0");
        mocks.cargar.mockResolvedValue({ publicaciones: [publicacion(1)] });
        await act(async () => { expect(await actualizar()).toBe(true) });
        expect(screen.getByTestId("cantidad")).toHaveTextContent("1");
        expect(screen.getByRole("button", { name: "Publicación 1 precio 1" })).toBeInTheDocument();
    });

    it("conserva búsqueda, orden, página y agrupación mientras actualiza también el drawer abierto", async () => {
        const iniciales = Array.from({ length: 45 }, (_, indice) => publicacion(indice + 1));
        render(<MercadoProduccion publicaciones={iniciales} />);
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar publicaciones" }), { target: { value: "Huerta" } });
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("menuitemradio", { name: "Menor Precio" }));
        fireEvent.click(screen.getByRole("button", { name: "Página 2" }));
        fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
        fireEvent.click(screen.getByRole("button", { name: "Publicación 21 precio 21" }));

        mocks.cargar.mockResolvedValue({ publicaciones: [...iniciales.map((fila) => fila.id === 21 ? { ...fila, precio: 0 } : fila), publicacion(46)] });
        await act(async () => { expect(await actualizar()).toBe(true) });

        expect(screen.getByRole("searchbox", { name: "Buscar publicaciones" })).toHaveValue("Huerta");
        expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Desagrupar" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByTestId("cantidad")).toHaveTextContent("46");
        expect(screen.getAllByTestId("tarjeta")[0]).toHaveTextContent("Publicación 20 precio 20");
        expect(within(screen.getByRole("dialog")).getByText("Precio 0")).toBeInTheDocument();
    });

    it("retira publicaciones y el drawer eliminado, y ajusta la página cuando deja de existir", async () => {
        render(<MercadoProduccion publicaciones={Array.from({ length: 45 }, (_, indice) => publicacion(indice + 1))} ordenInicial="precioAsc" />);
        fireEvent.click(screen.getByRole("button", { name: "Página 3" }));
        fireEvent.click(screen.getByRole("button", { name: "Publicación 45 precio 45" }));
        mocks.cargar.mockResolvedValue({ publicaciones: [publicacion(1)] });
        await act(async () => { await actualizar() });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("navigation", { name: "Paginación de publicaciones" })).not.toBeInTheDocument();
        expect(screen.getAllByTestId("tarjeta")).toHaveLength(1);
        expect(screen.getByRole("button", { name: "Publicación 1 precio 1" })).toBeInTheDocument();
        expect(screen.getByTestId("cantidad")).toHaveTextContent("1");
    });

    it("conserva las opciones seleccionadas aunque desaparezcan del catálogo y vuelve a mostrar coincidencias nuevas", async () => {
        render(<MercadoProduccion publicaciones={[publicacion(1)]} especie="Papa" />);
        fireEvent.click(screen.getByRole("button", { name: "Más filtros" }));
        seleccionar("Variedad", "Blanca");
        seleccionar("Empaquetado", "Cajón");
        seleccionar("Kilos", "20 kg");
        seleccionar("Categoría", "Primera");
        seleccionar("Calibre", "Mediano");
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar publicaciones" }), { target: { value: "Huerta" } });
        const banana = { ...publicacion(2), especie: "Banana", variedad: "Cavendish", envase: "Caja", kilos: "10", categoria: "Segunda", calibre: "Chico" };
        mocks.cargar.mockResolvedValue({ publicaciones: [banana] });
        await act(async () => { await actualizar() });
        for (const [etiqueta, opcion] of [["Especie", "Papa"], ["Variedad", "Blanca"], ["Empaquetado", "Cajón"], ["Kilos", "20 kg"], ["Categoría", "Primera"], ["Calibre", "Mediano"]]) {
            expect(screen.getByRole("combobox", { name: etiqueta })).toHaveTextContent(opcion);
        }
        expect(screen.getByRole("searchbox", { name: "Buscar publicaciones" })).toHaveValue("Huerta");
        expect(screen.queryAllByTestId("tarjeta")).toHaveLength(0);

        mocks.cargar.mockResolvedValue({ publicaciones: [banana, publicacion(3)] });
        await act(async () => { await actualizar() });
        expect(screen.getAllByTestId("tarjeta")).toHaveLength(1);
        expect(screen.getByRole("button", { name: "Publicación 3 precio 3" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        expect(screen.getAllByTestId("tarjeta")).toHaveLength(2);
    });

    it("conserva los últimos datos al fallar y permite reintentar", async () => {
        render(<MercadoProduccion publicaciones={[publicacion(1)]} />);
        mocks.cargar.mockRejectedValueOnce(new Error("Sin conexión"));
        await act(async () => { expect(await actualizar()).toBe(false) });
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron actualizar las publicaciones.");
        expect(screen.getByRole("button", { name: "Publicación 1 precio 1" })).toBeInTheDocument();
        mocks.cargar.mockResolvedValue({ publicaciones: [publicacion(2)] });
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reintentar" })) });
        expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Publicación 2 precio 2" })).toBeInTheDocument();
    });

    it("serializa las recargas y vuelve a consultar si llega otro aviso durante una consulta", async () => {
        render(<MercadoProduccion publicaciones={[publicacion(1)]} />);
        let resolver!: (resultado: { publicaciones: PublicacionProductorListado[] }) => void;
        mocks.cargar.mockImplementationOnce(() => new Promise((resolve) => { resolver = resolve }));
        mocks.cargar.mockResolvedValueOnce({ publicaciones: [publicacion(3)] });
        await act(async () => {
            const primera = actualizar();
            const segunda = actualizar();
            expect(mocks.cargar).toHaveBeenCalledOnce();
            resolver({ publicaciones: [publicacion(2)] });
            await Promise.all([primera, segunda]);
        });
        expect(mocks.cargar).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("button", { name: "Publicación 3 precio 3" })).toBeInTheDocument();
    });

    it("descarta respuestas pendientes al desmontar", async () => {
        const vista = render(<MercadoProduccion publicaciones={[publicacion(1)]} />);
        let resolver!: (resultado: { publicaciones: PublicacionProductorListado[] }) => void;
        mocks.cargar.mockImplementationOnce(() => new Promise((resolve) => { resolver = resolve }));
        let carga!: Promise<boolean>;
        act(() => { carga = actualizar() });
        vista.unmount();
        resolver({ publicaciones: [publicacion(2)] });
        await expect(carga).resolves.toBe(false);
        expect(screen.queryByTestId("tarjeta")).not.toBeInTheDocument();
    });
});
