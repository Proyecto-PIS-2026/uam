import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import PerfilOperadorAdmin from "./PerfilOperadorAdmin";
import type { PerfilAdminOperador } from "../../consultas-perfil-admin";
import type { OpcionesEdicionPublicacion } from "../../../../publicaciones/operadores/consultas-edicion-publicacion";

const mocks = vi.hoisted(() => ({
    propsCatalogo: vi.fn(),
}));

vi.mock("./CatalogoOperadorAdmin", () => ({
    default: (props: unknown) => {
        mocks.propsCatalogo(props);
        return <div data-testid="catalogo" />;
    },
}));

const opciones: OpcionesEdicionPublicacion = {
    especies: [],
    variedades: [],
    presentaciones: [],
    categorias: [],
    calibres: [],
    paises: [],
};

const operadorBase: PerfilAdminOperador = {
    id: 12,
    nombreFantasia: "Mercado Rural Los Olivos",
    fotoPerfil: null,
    whatsApp: "+59899100012",
    locales: [
        { numeroLocal: "180", nombreNave: "A", finContrato: "2029-03-31" },
        { numeroLocal: "160", nombreNave: "D", finContrato: null },
    ],
    publicaciones: [],
};

describe("PerfilOperadorAdmin", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    // Muestra la identidad del operador
    it("muestra el nombre, la inicial y el WhatsApp del operador", () => {
        render(<PerfilOperadorAdmin operador={operadorBase} opciones={opciones} />);

        expect(screen.getByRole("heading", { level: 1, name: "Mercado Rural Los Olivos" })).toBeInTheDocument();
        expect(screen.getByText("M")).toBeInTheDocument();
        expect(screen.getByText("+59899100012")).toBeInTheDocument();
    });

    // Cada local con su fecha de fin de contrato en formato dd/mm/aaaa, o sin fecha
    it("muestra los locales con su fecha de fin de contrato o la ausencia de fecha", () => {
        render(<PerfilOperadorAdmin operador={operadorBase} opciones={opciones} />);

        expect(screen.getByText(/Local 180/)).toBeInTheDocument();
        expect(screen.getByText(/31\/03\/2029/)).toBeInTheDocument();
        expect(screen.getByText(/Local 160/)).toBeInTheDocument();
        expect(screen.getByText(/Sin fecha de fin/)).toBeInTheDocument();
    });

     // Sin locales se informa
    it("informa cuando el operador no tiene locales", () => {
        render(<PerfilOperadorAdmin operador={{ ...operadorBase, locales: [] }} opciones={opciones} />);

        expect(screen.getByText("El operador no tiene locales registrados.")).toBeInTheDocument();
    });

    // El enlace de volver lleva al listado de operadores
    it("ofrece volver al listado de operadores", () => {
        render(<PerfilOperadorAdmin operador={operadorBase} opciones={opciones} />);

        expect(screen.getByRole("link", { name: /Volver al listado de operadores/ })).toHaveAttribute("href", "/gestion-operadores");
    });

    // Muestra la cantidad de publicaciones y le pasa los datos al catálogo
    it("muestra la cantidad de publicaciones y le pasa publicaciones y opciones al catálogo", () => {
        const publicaciones = [{ id: 101 }, { id: 102 }] as PerfilAdminOperador["publicaciones"];
        render(<PerfilOperadorAdmin operador={{ ...operadorBase, publicaciones }} opciones={opciones} />);

        expect(screen.getByRole("heading", { name: "Publicaciones (2)" })).toBeInTheDocument();
        expect(screen.getByTestId("catalogo")).toBeInTheDocument();
        expect(mocks.propsCatalogo).toHaveBeenLastCalledWith({ publicaciones, opciones });
    });
});
