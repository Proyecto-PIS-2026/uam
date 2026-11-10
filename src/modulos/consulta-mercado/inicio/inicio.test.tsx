import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Inicio from "./inicio";

type PropsInicio = ComponentProps<typeof Inicio>;

const mocks = vi.hoisted(() => ({
    autorizado: vi.fn(),
    notificar: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/permisos", () => ({
    autorizado: mocks.autorizado,
}));

vi.mock("@/compartido/componentes/NotificacionToast", () => ({
    useNotificacionToast: () => ({ notificar: mocks.notificar }),
}));

vi.mock("next/image", () => ({
    default: () => null,
}));

vi.mock("@/compartido/HojasDecorativas", () => ({
    default: () => null,
}));

vi.mock("./tarjetaProducto", () => ({
    default: ({ nombre, operadores, imagen }: { nombre: string; operadores: number; imagen: string | null }) => (
        <article data-testid="tarjeta-especie" data-operadores={operadores} data-imagen={imagen ?? ""}>{nombre}</article>
    ),
}));

const especies = [
    { nombreEspecie: "Tomate", fotoGenerica: "/tomate.webp", cantidadOperadores: 3 },
    { nombreEspecie: "Ají", fotoGenerica: null, cantidadOperadores: 2 },
    { nombreEspecie: "Papa", fotoGenerica: "/papa.webp", cantidadOperadores: 5 },
    { nombreEspecie: "Banana", fotoGenerica: null, cantidadOperadores: 4 },
];

function preparar(cambios: Partial<PropsInicio> = {}) {
    const props: PropsInicio = {
        especies,
        urlListaInteligente: "https://uam.com.uy/lista.pdf",
        ordenamientoHabilitado: true,
        ordenPredeterminado: "nombre_asc",
        ...cambios,
    };

    return { ...render(<Inicio {...props} />), props };
}

function nombresVisibles() {
    return screen.queryAllByTestId("tarjeta-especie").map((tarjeta) => tarjeta.textContent);
}

function tarjetaEspecie(nombre: string) {
    return screen.getAllByTestId("tarjeta-especie").find((tarjeta) => tarjeta.textContent === nombre);
}

function crearMuchasEspecies() {
    return Array.from({ length: 25 }, (_, indice) => ({
        nombreEspecie: `Especie ${String(indice + 1).padStart(2, "0")}`,
        fotoGenerica: null,
        cantidadOperadores: 1,
    }));
}

async function elegirOrden(nombre: string) {
    fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: nombre }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.autorizado.mockReturnValue(true);
});

afterEach(cleanup);

describe("Inicio", () => {
    it("muestra las especies ordenadas de A-Z por defecto", () => {
        preparar();
        expect(nombresVisibles()).toEqual(["Ají", "Banana", "Papa", "Tomate"]);
        expect(screen.getByText("4 especies con operadores")).toBeInTheDocument();
    });

    it("aplica el orden predeterminado Z-A", () => {
        preparar({ ordenPredeterminado: "nombre_desc" });
        expect(nombresVisibles()).toEqual(["Tomate", "Papa", "Banana", "Ají"]);
    });

    it("aplica la prioridad configurada como Más vendidas", () => {
        preparar({ ordenPredeterminado: "mas_vendidas" });
        expect(nombresVisibles()).toEqual(["Papa", "Banana", "Tomate", "Ají"]);
    });

    it("entrega las imágenes y cantidades a las tarjetas", () => {
        preparar();
        expect(tarjetaEspecie("Tomate")).toHaveAttribute("data-operadores", "3");
        expect(tarjetaEspecie("Tomate")).toHaveAttribute("data-imagen", "/tomate.webp");
    });

    it("entrega a la tarjeta la imagen personalizada recibida", () => {
        const actualizadas = especies.map((especie) => especie.nombreEspecie === "Tomate" ? { ...especie, fotoGenerica: "/imagenes/foto-personalizada.webp" } : especie);
        preparar({ especies: actualizadas });
        expect(tarjetaEspecie("Tomate")).toHaveAttribute("data-imagen", "/imagenes/foto-personalizada.webp");
    });

    it("actualiza la imagen cuando recibe nuevos datos de la especie", () => {
        const { rerender, props } = preparar();
        const actualizadas = especies.map((especie) => especie.nombreEspecie === "Tomate" ? { ...especie, fotoGenerica: "/tomate-nuevo.webp" } : especie);
        rerender(<Inicio {...props} especies={actualizadas} />);
        expect(tarjetaEspecie("Tomate")).toHaveAttribute("data-imagen", "/tomate-nuevo.webp");
    });

    it("deja de enviar una imagen cuando la foto recibida es nula", () => {
        const { rerender, props } = preparar();
        const actualizadas = especies.map((especie) => especie.nombreEspecie === "Tomate" ? { ...especie, fotoGenerica: null } : especie);
        rerender(<Inicio {...props} especies={actualizadas} />);
        expect(tarjetaEspecie("Tomate")).toHaveAttribute("data-imagen", "");
    });

    it("no modifica el orden del arreglo recibido", () => {
        const copia = especies.map((especie) => ({ ...especie }));
        preparar({ especies: copia, ordenPredeterminado: "nombre_desc" });
        expect(copia).toEqual(especies);
    });

    it("oculta Ordenar por cuando el switch está apagado", () => {
        preparar({ ordenamientoHabilitado: false, ordenPredeterminado: "nombre_desc" });
        expect(screen.queryByRole("button", { name: "Ordenar por" })).not.toBeInTheDocument();
        expect(nombresVisibles()).toEqual(["Tomate", "Papa", "Banana", "Ají"]);
    });

    it("ofrece Por defecto, A-Z y Z-A en el menú público", async () => {
        preparar({ ordenPredeterminado: "mas_vendidas" });
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        expect(await screen.findByRole("menuitemradio", { name: "A-Z" })).toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: "Z-A" })).toBeInTheDocument();
        expect(screen.queryByRole("menuitemradio", { name: "Más vendidas" })).not.toBeInTheDocument();
        expect(screen.queryByRole("menuitemradio", { name: "Menor Precio" })).not.toBeInTheDocument();
        expect(screen.queryByRole("menuitemradio", { name: "Mayor Precio" })).not.toBeInTheDocument();
        expect(screen.queryByRole("menuitemradio", { name: "Más actualizadas" })).not.toBeInTheDocument();
        expect(screen.getByRole("menuitemradio", { name: "Por defecto" })).toHaveAttribute("aria-checked", "true");
        expect(screen.getAllByRole("menuitemradio")).toHaveLength(3);
    });

    it("permite cambiar el orden de A-Z a Z-A", async () => {
        preparar();
        await elegirOrden("Z-A");
        expect(nombresVisibles()).toEqual(["Tomate", "Papa", "Banana", "Ají"]);
    });

    it("permite cambiar desde Más vendidas a A-Z", async () => {
        preparar({ ordenPredeterminado: "mas_vendidas" });
        await elegirOrden("A-Z");
        expect(nombresVisibles()).toEqual(["Ají", "Banana", "Papa", "Tomate"]);
    });

    it.each(["mas_vendidas", "nombre_desc"] as const)("Por defecto restaura el orden administrativo %s", async (ordenPredeterminado) => {
        preparar({ ordenPredeterminado });
        const iniciales = nombresVisibles();
        await elegirOrden("A-Z");
        expect(nombresVisibles()).not.toEqual(iniciales);
        await elegirOrden("Por defecto");
        expect(nombresVisibles()).toEqual(iniciales);
    });

    it("al deshabilitar el ordenamiento ignora la elección local y aplica el predeterminado", async () => {
        const { rerender, props } = preparar();
        await elegirOrden("Z-A");
        rerender(<Inicio {...props} ordenamientoHabilitado={false} />);
        expect(screen.queryByRole("button", { name: "Ordenar por" })).not.toBeInTheDocument();
        expect(nombresVisibles()).toEqual(["Ají", "Banana", "Papa", "Tomate"]);
    });

    it("busca ignorando mayúsculas, tildes y espacios exteriores", () => {
        preparar();
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar especies" }), { target: { value: "  AJI  " } });
        expect(nombresVisibles()).toEqual(["Ají"]);
    });

    it("permite buscar por una parte del nombre", () => {
        preparar();
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar especies" }), { target: { value: "mat" } });
        expect(nombresVisibles()).toEqual(["Tomate"]);
    });

    it("restaura todas las especies al limpiar la búsqueda", () => {
        preparar();
        const buscador = screen.getByRole("searchbox", { name: "Buscar especies" });
        fireEvent.change(buscador, { target: { value: "tom" } });
        expect(nombresVisibles()).toEqual(["Tomate"]);
        fireEvent.change(buscador, { target: { value: "" } });
        expect(nombresVisibles()).toEqual(["Ají", "Banana", "Papa", "Tomate"]);
    });

    it("muestra un mensaje cuando no hay coincidencias", () => {
        preparar();
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar especies" }), { target: { value: "inexistente" } });
        expect(screen.getByText("No hay especies que coincidan con la búsqueda.")).toBeInTheDocument();
        expect(nombresVisibles()).toEqual([]);
    });

    it("muestra el estado vacío cuando no existen especies", () => {
        preparar({ especies: [] });
        expect(screen.getByText("Todavía no hay especies disponibles")).toBeInTheDocument();
        expect(screen.queryByRole("navigation", { name: "Páginas de especies" })).not.toBeInTheDocument();
    });

    it("pagina los resultados de 20 en 20", () => {
        preparar({ especies: crearMuchasEspecies() });
        expect(nombresVisibles()).toHaveLength(20);
        expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        expect(nombresVisibles()).toHaveLength(5);
        expect(nombresVisibles()[0]).toBe("Especie 21");
        expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
        expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
        expect(nombresVisibles()[0]).toBe("Especie 01");
    });

    it("vuelve a la primera página al buscar", () => {
        preparar({ especies: crearMuchasEspecies() });
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar especies" }), { target: { value: "Especie" } });
        expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
        expect(nombresVisibles()[0]).toBe("Especie 01");
    });

    it("vuelve a la primera página al cambiar el orden", async () => {
        preparar({ especies: crearMuchasEspecies() });
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        await elegirOrden("Z-A");
        expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
        expect(nombresVisibles()[0]).toBe("Especie 25");
    });

    it("ajusta la página visible si disminuye la cantidad de especies", () => {
        const { rerender, props } = preparar({ especies: crearMuchasEspecies() });
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        rerender(<Inicio {...props} especies={especies} />);
        expect(nombresVisibles()).toHaveLength(4);
        expect(screen.queryByRole("navigation", { name: "Páginas de especies" })).not.toBeInTheDocument();
    });

    it("muestra los enlaces de acceso autorizados", () => {
        preparar();
        expect(screen.getByRole("link", { name: "Ver Mercado Virtual" })).toHaveAttribute("href", "/publicaciones");
        expect(screen.getByRole("link", { name: "Ver operadores" })).toHaveAttribute("href", "/operadores");
        expect(screen.getByRole("link", { name: "Precios de referencia" })).toHaveAttribute("href", "/precios-referencia");
        expect(screen.getByRole("link", { name: "Lista inteligente" })).toHaveAttribute("href", "https://uam.com.uy/lista.pdf");
    });

    it("abre la Lista Inteligente en otra pestaña", () => {
        preparar();
        const enlace = screen.getByRole("link", { name: "Lista inteligente" });
        expect(enlace).toHaveAttribute("target", "_blank");
        expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("avisa cuando la Lista Inteligente no está disponible", () => {
        preparar({ urlListaInteligente: null });
        fireEvent.click(screen.getByRole("button", { name: "Lista inteligente" }));
        expect(mocks.notificar).toHaveBeenCalledExactlyOnceWith("La Lista Inteligente no está disponible", "warning");
    });

    it("oculta los accesos que no están autorizados", () => {
        mocks.autorizado.mockReturnValue(false);
        preparar();
        expect(screen.queryByRole("link", { name: "Ver Mercado Virtual" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Ver operadores" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Lista inteligente" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Lista inteligente" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Precios de referencia" })).not.toBeInTheDocument();
    });
});
