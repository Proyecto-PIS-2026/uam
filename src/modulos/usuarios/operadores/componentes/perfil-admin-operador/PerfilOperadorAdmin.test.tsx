import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import PerfilOperadorAdmin from "./PerfilOperadorAdmin";
import type { PerfilAdminOperador } from "../../consultas-perfil-admin";
import type { OpcionesEdicionPublicacion } from "../../../../publicaciones/operadores/tipos";

const mocks = vi.hoisted(() => ({
    propsCatalogo: vi.fn(),
    propsNuevaPublicacion: vi.fn(),
    refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("./CatalogoOperadorAdmin", () => ({
    default: (props: unknown) => {
        mocks.propsCatalogo(props);
        return <div data-testid="catalogo" />;
    },
}));

// Reemplaza el drawer de alta por botones que simulan crear o cerrar
vi.mock("@/modulos/publicaciones/operadores/componentes/NuevaPublicacion", () => ({
    default: (props: { operadorId: number; abierto: boolean; alCerrar: () => void; alCrear: (mensaje: string) => void }) => {
        mocks.propsNuevaPublicacion(props);
        return (
            <div data-testid="nueva-publicacion">
                <button type="button" onClick={() => props.alCrear("Publicación creada correctamente.")}>Simular alta</button>
                <button type="button" onClick={props.alCerrar}>Simular cierre</button>
            </div>
        );
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

        expect(screen.getByRole("link", { name: /Volver al listado de operadores/ })).toHaveAttribute("href", "/administracion#usuarios");
    });

    it("ofrece editar el operador", () => {
        render(<PerfilOperadorAdmin operador={operadorBase} opciones={opciones} />);

        expect(screen.getByRole("link", { name: "Editar operador" })).toHaveAttribute(
            "href",
            `/gestion-operadores/${operadorBase.id}/editar`,
        );
    });

    it("ofrece agregar un producto para el operador", () => {
        render(<PerfilOperadorAdmin operador={operadorBase} opciones={opciones} />);

        expect(screen.getByRole("button", { name: "Agregar Producto" })).toBeInTheDocument();
    });

    // El drawer de alta solo aparece al tocar el botón, y para este operador
    it("abre el alta de publicación del operador al tocar Agregar Producto", () => {
        render(<PerfilOperadorAdmin operador={operadorBase} opciones={opciones} />);

        expect(screen.queryByTestId("nueva-publicacion")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Agregar Producto" }));

        expect(screen.getByTestId("nueva-publicacion")).toBeInTheDocument();
        expect(mocks.propsNuevaPublicacion).toHaveBeenLastCalledWith(
            expect.objectContaining({ operadorId: operadorBase.id, abierto: true }),
        );
    });

    // Al crear se cierra el drawer, se muestra el aviso y se refrescan los datos
    it("cierra el alta, muestra el aviso y refresca la página al crear una publicación", () => {
        render(<PerfilOperadorAdmin operador={operadorBase} opciones={opciones} />);

        fireEvent.click(screen.getByRole("button", { name: "Agregar Producto" }));
        fireEvent.click(screen.getByRole("button", { name: "Simular alta" }));

        expect(screen.queryByTestId("nueva-publicacion")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Publicación creada correctamente.");
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    // Al cerrar sin crear no hay aviso ni refresco
    it("cierra el alta sin aviso ni refresco cuando se cancela", () => {
        render(<PerfilOperadorAdmin operador={operadorBase} opciones={opciones} />);

        fireEvent.click(screen.getByRole("button", { name: "Agregar Producto" }));
        fireEvent.click(screen.getByRole("button", { name: "Simular cierre" }));

        expect(screen.queryByTestId("nueva-publicacion")).not.toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    // Al volver a abrir el alta se borra el aviso anterior
    it("borra el aviso anterior al volver a abrir el alta", () => {
        render(<PerfilOperadorAdmin operador={operadorBase} opciones={opciones} />);

        fireEvent.click(screen.getByRole("button", { name: "Agregar Producto" }));
        fireEvent.click(screen.getByRole("button", { name: "Simular alta" }));
        expect(screen.getByRole("status")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Agregar Producto" }));

        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.getByTestId("nueva-publicacion")).toBeInTheDocument();
    });

    // Muestra la cantidad de publicaciones y le pasa los datos al catálogo
    it("muestra la cantidad de publicaciones y le pasa publicaciones y opciones al catálogo", () => {
        const publicaciones = [{ id: 101 }, { id: 102 }] as PerfilAdminOperador["publicaciones"];
        render(<PerfilOperadorAdmin operador={{ ...operadorBase, publicaciones }} opciones={opciones} />);

        expect(screen.getByRole("heading", { name: "Publicaciones (2)" })).toBeInTheDocument();
        expect(screen.getByTestId("catalogo")).toBeInTheDocument();
        expect(mocks.propsCatalogo).toHaveBeenLastCalledWith({ operadorId: operadorBase.id, publicaciones, opciones });
    });
});
