import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionPerfilProductor } from "@/modulos/usuarios/productores/acciones/consultas-perfil-por-operador";
import type { PublicacionProductorListado } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";
import CatalogoProductor from "./CatalogoProductor";

// Reemplaza Image de Next por un img comun
vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({src, alt}: {src: string; alt: string}) => createElement("img", {src, alt}),
    };
});

// Reemplaza el Drawer real para probar solamente el comportamiento del catalogo
vi.mock("../drawer-publicacion/DrawerPublicacion", () => ({
    DrawerPublicacion: ({ publicacion, open }: {
        publicacion: PublicacionProductorListado | null;
        open: boolean;
    }) =>
        open && publicacion
            ? <div data-testid="drawer">{publicacion.especie}</div>
            : null,
}));

// Datos de prueba
const tomate: PublicacionPerfilProductor = {
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
    cantidadUnidades: null,
    ubicaciones: [],
};

const tomateCherry: PublicacionPerfilProductor = {
    ...tomate,
    id: 2,
    precio: "150",
    variedad: "Cherry",
};

const manzana: PublicacionPerfilProductor = {
    ...tomate,
    id: 3,
    precio: null,
    especie: "Manzana",
    variedad: "-",
};

const papa: PublicacionPerfilProductor = {...tomate, id: 4, especie: "Papa", variedad: "Blanca"};
const acelga: PublicacionPerfilProductor = {...tomate, id: 5, especie: "Acelga", variedad: "-"};

function nombresDeGrupos() {
    return screen.getAllByRole("heading", {level: 3}).filter((titulo) => !titulo.closest("button")).map((titulo) => titulo.textContent);
}

describe("CatalogoProductor", () => {
    it("muestra el mensaje de vacío cuando no hay publicaciones", () => {
        render(<CatalogoProductor publicaciones={[]}/>);
        expect(screen.getByRole("heading", {name: "Publicaciones"})).toBeInTheDocument();
        expect(screen.getByRole("searchbox", {name: "Buscar publicaciones"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Agrupar por especie"})).toBeInTheDocument();
        expect(screen.getByText("No hay publicaciones disponibles.")).toBeInTheDocument();
        expect(screen.queryAllByRole("button", {name: /Ver detalles de/})).toHaveLength(0);
    });

    it("muestra una tarjeta por cada publicación", () => {
        render(<CatalogoProductor publicaciones={[tomate, manzana]}/>);
        expect(screen.getAllByRole("button", {name: /Ver detalles de/})).toHaveLength(2);
        expect(screen.getByText("Tomate - Perita")).toBeInTheDocument();
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.queryByText("No hay publicaciones disponibles.")).not.toBeInTheDocument();
    });

    it("muestra primero las especies prioritarias presentes y después el resto en orden alfabético", () => {
        render(<CatalogoProductor publicaciones={[acelga, tomate, manzana, tomateCherry, papa]}/>);
        expect(screen.getAllByRole("button", {name: /Ver detalles de/}).map((boton) => boton.getAttribute("aria-label"))).toEqual([
            "Ver detalles de Papa - Blanca",
            "Ver detalles de Manzana",
            "Ver detalles de Tomate - Cherry",
            "Ver detalles de Tomate - Perita",
            "Ver detalles de Acelga",
        ]);
    });

    it("ofrece en el selector solo las especies publicadas por el operador y respeta la prioridad", () => {
        render(<CatalogoProductor publicaciones={[acelga, tomate, papa]}/>);
        fireEvent.mouseDown(screen.getByRole("combobox", {name: "Especie"}));
        expect(screen.getAllByRole("option").map((opcion) => opcion.textContent)).toEqual(["Todas", "Papa", "Tomate", "Acelga"]);
    });

    it("respeta la prioridad al agrupar y aplica A-Z cuando se elige explícitamente", () => {
        render(<CatalogoProductor publicaciones={[acelga, tomate, manzana, papa]}/>);
        fireEvent.click(screen.getByRole("button", {name: "Agrupar por especie"}));
        expect(nombresDeGrupos()).toEqual(["Papa", "Manzana", "Tomate", "Acelga"]);

        fireEvent.click(screen.getByRole("button", {name: "Ordenar por"}));
        fireEvent.click(screen.getByRole("button", {name: "A-Z"}));
        expect(nombresDeGrupos()).toEqual(["Acelga", "Manzana", "Papa", "Tomate"]);
    });

    it("mantiene el orden prioritario de los grupos cuando se ordenan sus publicaciones por precio", () => {
        render(<CatalogoProductor publicaciones={[{...acelga, precio: "10"}, {...papa, precio: "300"}, {...tomate, precio: "200"}, {...tomateCherry, precio: "50"}]}/>);
        fireEvent.click(screen.getByRole("button", {name: "Agrupar por especie"}));
        fireEvent.click(screen.getByRole("button", {name: "Ordenar por"}));
        fireEvent.click(screen.getByRole("button", {name: "Menor Precio"}));

        expect(nombresDeGrupos()).toEqual(["Papa", "Tomate", "Acelga"]);
        expect(screen.getAllByRole("button", {name: /Ver detalles de/}).map((boton) => boton.getAttribute("aria-label"))).toEqual([
            "Ver detalles de Papa - Blanca",
            "Ver detalles de Tomate - Cherry",
            "Ver detalles de Tomate - Perita",
            "Ver detalles de Acelga",
        ]);
    });

    it("agrupa las publicaciones por especie", () => {
        render(<CatalogoProductor publicaciones={[tomate, tomateCherry, manzana]}/>);
        const botonAgrupar = screen.getByRole("button", {name: "Agrupar por especie"});
        expect(botonAgrupar).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(botonAgrupar);
        expect(screen.getByRole("button", {name: "Desagrupar"})).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("heading", {name: "Tomate", level: 3})).toBeInTheDocument();
        expect(screen.getAllByRole("heading", {name: "Manzana", level: 3})).toHaveLength(2);
        expect(screen.getAllByRole("button", {name: /Ver detalles de/})).toHaveLength(3);
    });

    it("muestra la cantidad de publicaciones de cada especie", () => {
        render(<CatalogoProductor publicaciones={[tomate, tomateCherry, manzana]}/>);
        fireEvent.click(screen.getByRole("button", {name: "Agrupar por especie"}));
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText("productos")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("producto")).toBeInTheDocument();
    });

    it("permite desagrupar las publicaciones", () => {
        render(<CatalogoProductor publicaciones={[tomate, manzana]}/>);
        fireEvent.click(screen.getByRole("button", {name: "Agrupar por especie"}));
        expect(screen.getByRole("heading", {name: "Tomate", level: 3})).toBeInTheDocument();
        expect(screen.getAllByRole("heading", {name: "Manzana", level: 3})).toHaveLength(2);
        fireEvent.click(screen.getByRole("button", {name: "Desagrupar"}));
        expect(screen.getByRole("button", {name: "Agrupar por especie"})).toHaveAttribute("aria-pressed", "false");
        expect(screen.queryByRole("heading", {name: "Tomate", level: 3})).not.toBeInTheDocument();
        expect(screen.getAllByRole("heading", {name: "Manzana", level: 3})).toHaveLength(1);
        expect(screen.getAllByRole("button", {name: /Ver detalles de/})).toHaveLength(2);
    });

    it("abre el drawer con la publicación seleccionada", () => {
        render(<CatalogoProductor publicaciones={[tomate]}/>);
        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Ver detalles de Tomate - Perita"}));
        expect(screen.getByTestId("drawer")).toBeInTheDocument();
        expect(screen.getByTestId("drawer")).toHaveTextContent("Tomate");
    });

    it("abre el drawer desde una publicación agrupada", () => {
        render(<CatalogoProductor publicaciones={[tomate]}/>);
        fireEvent.click(screen.getByRole("button", {name: "Agrupar por especie"}));
        fireEvent.click(screen.getByRole("button", {name: "Ver detalles de Tomate - Perita"}));
        expect(screen.getByTestId("drawer")).toBeInTheDocument();
        expect(screen.getByTestId("drawer")).toHaveTextContent("Tomate");
    });

    it("muestra la sección de filtros", () => {
        render(<CatalogoProductor publicaciones={[tomate]}/>);
        expect(screen.getByRole("searchbox", {name: "Buscar publicaciones"})).toBeInTheDocument();
    });

    it("ordena los grupos de Z-A cuando se selecciona ese orden", () => {
        render(<CatalogoProductor publicaciones={[acelga, tomate, manzana, papa]} />);
        fireEvent.click(screen.getByRole("button", { name: "Agrupar por especie" }));
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("button", { name: "Z-A" }));
        expect(nombresDeGrupos()).toEqual(["Tomate", "Papa", "Manzana", "Acelga"]);
    });

    it("informa cuando una búsqueda no tiene resultados y permite recuperarlos", () => {
        render(<CatalogoProductor publicaciones={[tomate, manzana]} />);
        const buscador = screen.getByRole("searchbox", {name: "Buscar publicaciones"});
        fireEvent.change(buscador, {target: { value: "Inexistente" }});
        expect(screen.getByText("No hay publicaciones que coincidan con la búsqueda.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Ver detalles de/ })).not.toBeInTheDocument();
        fireEvent.change(buscador, { target: { value: "" } });
        expect(screen.getAllByRole("button", { name: /Ver detalles de/ })).toHaveLength(2);
    });

    it("quita el detalle cuando la publicación seleccionada deja de existir", () => {
        const { rerender } = render(<CatalogoProductor publicaciones={[tomate, manzana]} />);
        fireEvent.click(screen.getByRole("button", {name: "Ver detalles de Tomate - Perita"}));
        expect(screen.getByTestId("drawer")).toHaveTextContent("Tomate");
        rerender(<CatalogoProductor publicaciones={[manzana]} />);
        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Ver detalles de Tomate - Perita"})).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ver detalles de Manzana" })).toBeInTheDocument();
    });
});
