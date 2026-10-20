import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import PerfilProductorAdmin from "./PerfilProductorAdmin";
import type { PerfilAdminProductor } from "../../consultas-perfil-productor-admin";

const mocks = vi.hoisted(() => ({
    propsCatalogo: vi.fn(),
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
});
