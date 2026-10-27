import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import PerfilProductorAdmin from "./PerfilProductorAdmin";
import type { PerfilAdminProductor } from "../../acciones/consultas-perfil-productor-admin";

const mocks = vi.hoisted(() => ({
    propsCatalogo: vi.fn(),
    propsDrawerAlta: vi.fn(),
    refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/modulos/publicaciones/productores/AltaPublicacionProductor", () => ({
    DrawerAltaPublicacionProductor: (props: { productorId: number; abierto: boolean; alCerrar: () => void; alCrear: (mensaje: string) => void }) => {
        mocks.propsDrawerAlta(props);
        return (
            <div data-testid="alta-publicacion">
                <button type="button" onClick={() => props.alCrear("Publicación creada correctamente.")}>Simular alta</button>
                <button type="button" onClick={props.alCerrar}>Simular cierre</button>
            </div>
        );
    },
}));

vi.mock("./CatalogoProductorAdmin", () => ({
    default: (props: unknown) => {
        mocks.propsCatalogo(props);
        return <div data-testid="catalogo" />;
    },
}));


const productorBase: PerfilAdminProductor = {
    id: 2,
    nombreFantasia: "Granja Los Álamos",
    fotoPerfil: null,
    whatsApp: "+59899200002",
    publicaciones: [],
};

describe("PerfilProductorAdmin", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    // Muestra la identidad del productor: nombre de fantasía, inicial y WhatsApp
    it("muestra el nombre de fantasía, la inicial y el WhatsApp del productor", () => {
        render(<PerfilProductorAdmin productor={productorBase} />);

        expect(screen.getByRole("heading", { level: 1, name: "Granja Los Álamos" })).toBeInTheDocument();
        expect(screen.getByText("G")).toBeInTheDocument();
        expect(screen.getByText("+59899200002")).toBeInTheDocument();
    });

    // Con foto, se muestra la foto en lugar de la inicial
    it("muestra la foto del productor cuando tiene", () => {
        render(<PerfilProductorAdmin productor={{ ...productorBase, fotoPerfil: "/productores/granja.jpg" }} />);

        expect(screen.getByRole("img", { name: "Foto de Granja Los Álamos" })).toBeInTheDocument();
        expect(screen.queryByText("G")).not.toBeInTheDocument();
    });

    // El enlace de volver lleva al listado de usuarios del panel de administración
    it("ofrece volver al listado de usuarios", () => {
        render(<PerfilProductorAdmin productor={productorBase} />);

        expect(screen.getByRole("link", { name: /Volver al listado de productores/ })).toHaveAttribute("href", "/administracion#usuarios");
    });

    it("ofrece editar el productor", () => {
        render(<PerfilProductorAdmin productor={productorBase} />);

        expect(screen.getByRole("link", { name: "Editar productor" })).toHaveAttribute(
            "href",
            `/gestion-productores/${productorBase.id}/editar`,
        );
    });

    // Muestra la cantidad de publicaciones y le pasa los datos al catálogo
    it("muestra la cantidad de publicaciones y se las pasa al catálogo", () => {
        const publicaciones = [{ id: 201 }, { id: 202 }] as PerfilAdminProductor["publicaciones"];
        render(<PerfilProductorAdmin productor={{ ...productorBase, publicaciones }} />);

        expect(screen.getByRole("heading", { name: "Publicaciones (2)" })).toBeInTheDocument();
        expect(screen.getByTestId("catalogo")).toBeInTheDocument();
        expect(mocks.propsCatalogo).toHaveBeenLastCalledWith({ publicaciones });
    });

    it("ofrece agregar un producto para el productor", () => {
        render(<PerfilProductorAdmin productor={productorBase} />);

        expect(screen.getByRole("button", { name: "Agregar Producto" })).toBeInTheDocument();
    });

    // El drawer de alta solo aparece al tocar el botón, y para este productor
    it("abre el alta de publicación del productor al tocar Agregar Producto", () => {
        render(<PerfilProductorAdmin productor={productorBase} />);

        expect(screen.queryByTestId("alta-publicacion")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Agregar Producto" }));

        expect(screen.getByTestId("alta-publicacion")).toBeInTheDocument();
        expect(mocks.propsDrawerAlta).toHaveBeenLastCalledWith(
            expect.objectContaining({ productorId: productorBase.id, abierto: true, disponibilidadInicial: false }),
        );
    });

    // Al crear se cierra el drawer, se muestra el aviso y se refrescan los datos
    it("cierra el alta, muestra el aviso y refresca la página al crear una publicación", () => {
        render(<PerfilProductorAdmin productor={productorBase} />);

        fireEvent.click(screen.getByRole("button", { name: "Agregar Producto" }));
        fireEvent.click(screen.getByRole("button", { name: "Simular alta" }));

        expect(screen.queryByTestId("alta-publicacion")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Publicación creada correctamente.");
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    // Al cerrar sin crear no hay aviso ni refresco
    it("cierra el alta sin aviso ni refresco cuando se cancela", () => {
        render(<PerfilProductorAdmin productor={productorBase} />);

        fireEvent.click(screen.getByRole("button", { name: "Agregar Producto" }));
        fireEvent.click(screen.getByRole("button", { name: "Simular cierre" }));

        expect(screen.queryByTestId("alta-publicacion")).not.toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    // Al volver a abrir el alta se borra el aviso anterior
    it("borra el aviso anterior al volver a abrir el alta", () => {
        render(<PerfilProductorAdmin productor={productorBase} />);

        fireEvent.click(screen.getByRole("button", { name: "Agregar Producto" }));
        fireEvent.click(screen.getByRole("button", { name: "Simular alta" }));
        expect(screen.getByRole("status")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Agregar Producto" }));

        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.getByTestId("alta-publicacion")).toBeInTheDocument();
    });
});
