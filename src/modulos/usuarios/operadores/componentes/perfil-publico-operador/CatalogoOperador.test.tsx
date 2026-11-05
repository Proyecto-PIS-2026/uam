import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import CatalogoOperador from "./CatalogoOperador";

const nombreBotonAgrupar = /^Agrupar(?:\s*por especie)?$/;

const tiempoReal = vi.hoisted(() => ({
    refresh: vi.fn(),
    suscribir: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: tiempoReal.refresh }),
}));

vi.mock("../../../../publicaciones/tiempo-real/use-actualizaciones-publicaciones", () => ({
    useActualizacionesPublicaciones: tiempoReal.suscribir,
}));

vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
    };
});

vi.mock("./DrawerPublicacionPerfil", () => ({
    DrawerPublicacionPerfil: ({ publicacion, open }: { publicacion: PublicacionPerfil | null; open: boolean }) => open && publicacion ? <div data-testid="drawer">{publicacion.especie} {publicacion.precio}</div> : null,
}));

const tomate: PublicacionPerfil = {
    id: 1,
    foto: null,
    precio: "120",
    fecha: "2026-10-03T15:00:00.000Z",
    especie: "Tomate",
    variedad: "Perita",
    presentacion: "Cajón",
    categoria: "Extra",
    calibre: "A",
    pais: "URUGUAY",
};

const tomateCherry: PublicacionPerfil = { ...tomate, id: 2, precio: "150", variedad: "Cherry" };
const manzana: PublicacionPerfil = { ...tomate, id: 3, precio: null, especie: "Manzana", variedad: "-" };
const papa: PublicacionPerfil = { ...tomate, id: 4, especie: "Papa", variedad: "Blanca" };
const acelga: PublicacionPerfil = { ...tomate, id: 5, especie: "Acelga", variedad: "-" };

function nombresDeGrupos() {
    return screen.getAllByRole("heading", { level: 3 }).filter((titulo) => !titulo.closest("button")).map((titulo) => titulo.textContent);
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(cleanup);

describe("CatalogoOperador", () => {
    it("recarga el perfil con el canal público del operador sin solicitar eventos privados", () => {
        render(<CatalogoOperador publicaciones={[tomate]} idOperador={13} />);
        const argumentos = tiempoReal.suscribir.mock.calls.at(-1)!;
        expect(argumentos[1]).toEqual({ operadorPublicoId: 13 });
        argumentos[0]();
        expect(tiempoReal.refresh).toHaveBeenCalledOnce();
    });

    it("actualiza el detalle abierto y mantiene búsqueda y agrupación al recibir precios nuevos", () => {
        const { rerender } = render(<CatalogoOperador publicaciones={[tomate, manzana]} />);
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar publicaciones" }), { target: { value: "tomate" } });
        fireEvent.click(screen.getByRole("button", { name: nombreBotonAgrupar }));
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tomate - Perita" }));
        expect(screen.getByTestId("drawer")).toHaveTextContent("120");
        rerender(<CatalogoOperador publicaciones={[{ ...tomate, precio: "175" }, manzana, papa]} />);
        expect(screen.getByTestId("drawer")).toHaveTextContent("175");
        expect(screen.getByRole("searchbox", { name: "Buscar publicaciones" })).toHaveValue("tomate");
        expect(screen.getByRole("button", { name: "Desagrupar" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getAllByRole("button", { name: /Ver detalles de/ })).toHaveLength(1);
    });

    it("deja de mostrar el detalle si la publicación seleccionada desaparece", () => {
        const { rerender } = render(<CatalogoOperador publicaciones={[tomate, manzana]} />);
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tomate - Perita" }));
        rerender(<CatalogoOperador publicaciones={[manzana]} />);
        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Ver detalles de Tomate - Perita" })).not.toBeInTheDocument();
    });

    it("muestra el mensaje de vacío cuando no hay publicaciones", () => {
        render(<CatalogoOperador publicaciones={[]} />);
        expect(screen.getByRole("heading", { name: "Publicaciones" })).toBeInTheDocument();
        expect(screen.getByRole("searchbox", { name: "Buscar publicaciones" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: nombreBotonAgrupar })).toBeInTheDocument();
        expect(screen.getByText("No hay publicaciones disponibles.")).toBeInTheDocument();
        expect(screen.queryAllByRole("button", { name: /Ver detalles de/ })).toHaveLength(0);
    });

    it("muestra el aviso y las fechas de licencia con su mensaje de recomendación", () => {
        render(
            <CatalogoOperador
                publicaciones={[]}
                enLicencia
                comentario={"Licencia: 2026-11-05 - 2026-11-12\n\nConsultar disponibilidad antes de comprar."}
            />,
        );

        expect(screen.getAllByRole("status")[0]).toHaveTextContent("Fecha: 05/11/2026 - 12/11/2026");
        expect(screen.queryByText("Mensaje de recomendación")).not.toBeInTheDocument();
        expect(screen.getByText("Consultar disponibilidad antes de comprar.")).toBeInTheDocument();
        expect(screen.getByText("Sin publicaciones, esta de licencia")).toBeInTheDocument();
    });

    it("indica que las fechas de licencia no están especificadas cuando el comentario no tiene formato", () => {
        render(<CatalogoOperador publicaciones={[]} enLicencia comentario="En licencia sin fechas"/>);

        expect(screen.getAllByRole("status")[0]).toHaveTextContent("Fechas no especificadas");
        expect(screen.getByText("En licencia sin fechas")).toBeInTheDocument();
    });

    it("muestra una tarjeta por cada publicación", () => {
        render(<CatalogoOperador publicaciones={[tomate, manzana]} />);
        expect(screen.getAllByRole("button", { name: /Ver detalles de/ })).toHaveLength(2);
        expect(screen.getByText("Tomate - Perita")).toBeInTheDocument();
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.queryByText("No hay publicaciones disponibles.")).not.toBeInTheDocument();
    });

    it("muestra primero las especies prioritarias y desempata publicaciones equivalentes por ID", () => {
        render(<CatalogoOperador publicaciones={[acelga, tomate, manzana, tomateCherry, papa]} />);
        expect(screen.getAllByRole("button", { name: /Ver detalles de/ }).map((boton) => boton.getAttribute("aria-label"))).toEqual([
            "Ver detalles de Papa - Blanca",
            "Ver detalles de Manzana",
            "Ver detalles de Tomate - Perita",
            "Ver detalles de Tomate - Cherry",
            "Ver detalles de Acelga",
        ]);
    });

    it("ofrece en el selector solo las especies publicadas por el operador y respeta la prioridad", () => {
        render(<CatalogoOperador publicaciones={[acelga, tomate, papa]} />);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Especie" }));
        expect(screen.getAllByRole("option").map((opcion) => opcion.textContent)).toEqual(["Todas", "Papa", "Tomate", "Acelga"]);
    });

    it("respeta la prioridad al agrupar y aplica A-Z cuando se elige explícitamente", () => {
        render(<CatalogoOperador publicaciones={[acelga, tomate, manzana, papa]} />);
        fireEvent.click(screen.getByRole("button", { name: nombreBotonAgrupar }));
        expect(nombresDeGrupos()).toEqual(["Papa", "Manzana", "Tomate", "Acelga"]);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("menuitemradio", { name: "A-Z" }));
        expect(nombresDeGrupos()).toEqual(["Acelga", "Manzana", "Papa", "Tomate"]);
    });

    it("mantiene el orden prioritario de los grupos cuando se ordenan sus publicaciones por precio", () => {
        render(<CatalogoOperador publicaciones={[{ ...acelga, precio: "10" }, { ...papa, precio: "300" }, { ...tomate, precio: "200" }, { ...tomateCherry, precio: "50" }]} />);
        fireEvent.click(screen.getByRole("button", { name: nombreBotonAgrupar }));
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("menuitemradio", { name: "Menor Precio" }));
        expect(nombresDeGrupos()).toEqual(["Papa", "Tomate", "Acelga"]);
        expect(screen.getAllByRole("button", { name: /Ver detalles de/ }).map((boton) => boton.getAttribute("aria-label"))).toEqual([
            "Ver detalles de Papa - Blanca",
            "Ver detalles de Tomate - Cherry",
            "Ver detalles de Tomate - Perita",
            "Ver detalles de Acelga",
        ]);
    });

    it("agrupa las publicaciones por especie", () => {
        render(<CatalogoOperador publicaciones={[tomate, tomateCherry, manzana]} />);
        const botonAgrupar = screen.getByRole("button", { name: nombreBotonAgrupar });
        expect(botonAgrupar).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(botonAgrupar);
        expect(screen.getByRole("button", { name: "Desagrupar" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("heading", { name: "Tomate", level: 3 })).toBeInTheDocument();
        expect(screen.getAllByRole("heading", { name: "Manzana", level: 3 })).toHaveLength(2);
        expect(screen.getAllByRole("button", { name: /Ver detalles de/ })).toHaveLength(3);
    });

    it("muestra la cantidad de publicaciones de cada especie", () => {
        render(<CatalogoOperador publicaciones={[tomate, tomateCherry, manzana]} />);
        fireEvent.click(screen.getByRole("button", { name: nombreBotonAgrupar }));
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText("productos")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("producto")).toBeInTheDocument();
    });

    it("permite desagrupar las publicaciones", () => {
        render(<CatalogoOperador publicaciones={[tomate, manzana]} />);
        fireEvent.click(screen.getByRole("button", { name: nombreBotonAgrupar }));
        expect(screen.getByRole("heading", { name: "Tomate", level: 3 })).toBeInTheDocument();
        expect(screen.getAllByRole("heading", { name: "Manzana", level: 3 })).toHaveLength(2);
        fireEvent.click(screen.getByRole("button", { name: "Desagrupar" }));
        expect(screen.getByRole("button", { name: nombreBotonAgrupar })).toHaveAttribute("aria-pressed", "false");
        expect(screen.queryByRole("heading", { name: "Tomate", level: 3 })).not.toBeInTheDocument();
        expect(screen.getAllByRole("heading", { name: "Manzana", level: 3 })).toHaveLength(1);
        expect(screen.getAllByRole("button", { name: /Ver detalles de/ })).toHaveLength(2);
    });

    it("abre el drawer con la publicación seleccionada", () => {
        render(<CatalogoOperador publicaciones={[tomate]} />);
        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tomate - Perita" }));
        expect(screen.getByTestId("drawer")).toBeInTheDocument();
        expect(screen.getByTestId("drawer")).toHaveTextContent("Tomate");
    });

    it("abre el drawer desde una publicación agrupada", () => {
        render(<CatalogoOperador publicaciones={[tomate]} />);
        fireEvent.click(screen.getByRole("button", { name: nombreBotonAgrupar }));
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tomate - Perita" }));
        expect(screen.getByTestId("drawer")).toBeInTheDocument();
        expect(screen.getByTestId("drawer")).toHaveTextContent("Tomate");
    });

    it("muestra la sección de filtros", () => {
        render(<CatalogoOperador publicaciones={[tomate]} />);
        expect(screen.getByRole("searchbox", { name: "Buscar publicaciones" })).toBeInTheDocument();
    });
});