import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import CatalogoOperadorAdmin from "./CatalogoOperadorAdmin";
import type { PublicacionPerfilAdmin } from "../../consultas-perfil-admin";
import type { OpcionesEdicionPublicacion } from "../../../../publicaciones/operadores/consultas-edicion-publicacion";

const mocks = vi.hoisted(() => ({
    propsDrawer: vi.fn(),
}));

vi.mock("../../../../publicaciones/operadores/componentes/DrawerEditarPublicacion", () => ({
    default: (props: { abierto: boolean; publicacion: { especie: string } | null }) => {
        mocks.propsDrawer(props);
        return props.abierto && props.publicacion ? (
            <div role="dialog" aria-label="Detalle de publicación">{props.publicacion.especie}</div>
        ) : null;
    },
}));

// Devuelve las props de la última vez que se dibujó el drawer
function ultimasPropsDrawer() {
    return mocks.propsDrawer.mock.lastCall?.[0];
}

const publicacionBase: PublicacionPerfilAdmin = {
    id: 101,
    publicacionOperadorId: 15,
    especieId: 1,
    variedadId: 11,
    presentacionId: 111,
    categoriaId: 3,
    calibreId: 4,
    paisId: 44,
    foto: null,
    precio: "120.00",
    disponible: true,
    especie: "Tomate",
    variedad: "Perita",
    presentacion: "Cajón",
    categoria: "Extra",
    calibre: "Grande",
    codigoCalibre: "G",
    pais: "Uruguay",
};

const opciones: OpcionesEdicionPublicacion = {
    especies: [{ id: 1, nombre: "Tomate" }],
    variedades: [{ id: 11, nombre: "Perita", especieId: 1 }],
    presentaciones: [{ id: 111, nombre: "Cajón", variedadId: 11 }],
    categorias: [{ id: 3, nombre: "Extra", especieId: null }],
    calibres: [{ id: 4, nombre: "G - Grande" }],
    paises: [{ id: 44, nombre: "Uruguay" }],
};

describe("CatalogoOperadorAdmin", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    // Sin publicaciones se informa y no hay tarjetas
    it("informa cuando el operador no tiene publicaciones", () => {
        render(<CatalogoOperadorAdmin publicaciones={[]} opciones={opciones} />);

        expect(screen.getByText("El operador no tiene publicaciones.")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    // Una tarjeta por publicación
    it("muestra una tarjeta por cada publicación", () => {
        render(
            <CatalogoOperadorAdmin
                publicaciones={[publicacionBase, { ...publicacionBase, id: 102, especie: "Lechuga", variedad: "-" }]}
                opciones={opciones}
            />
        );

        expect(screen.getByRole("button", { name: "Ver detalles de Tomate - Perita" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ver detalles de Lechuga" })).toBeInTheDocument();
    });

    // El drawer arranca cerrado
    it("no muestra el drawer hasta que se toca una tarjeta", () => {
        render(<CatalogoOperadorAdmin publicaciones={[publicacionBase]} opciones={opciones} />);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(ultimasPropsDrawer()?.abierto).toBe(false);
    });

    // Al tocar una tarjeta se abre el drawer con esa publicación, en consulta y sin acciones
    it("abre el drawer en consulta con la publicación tocada y sin editar ni eliminar", () => {
        render(<CatalogoOperadorAdmin publicaciones={[publicacionBase]} opciones={opciones} />);

        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tomate - Perita" }));

        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toHaveTextContent("Tomate");

        const props = ultimasPropsDrawer();
        expect(props.abierto).toBe(true);
        expect(props.modoInicial).toBe("consulta");
        expect(props.alGuardar).toBeUndefined();
        expect(props.alEliminar).toBeUndefined();
        expect(props.publicacion).toEqual(expect.objectContaining({
            publicacionOperadorId: 15,
            publicacionId: 101,
            especieId: 1,
            variedadId: 11,
            presentacionId: 111,
            categoriaId: 3,
            calibreId: 4,
            paisId: 44,
            disponible: true,
        }));
        expect(props.especies).toBe(opciones.especies);
        expect(props.paises).toBe(opciones.paises);
    });

    // Al cerrarlo, el drawer desaparece
    it("cierra el drawer cuando se llama a alCerrar", () => {
        render(<CatalogoOperadorAdmin publicaciones={[publicacionBase]} opciones={opciones} />);
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tomate - Perita" }));

        act(() => {
            ultimasPropsDrawer().alCerrar();
        });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(ultimasPropsDrawer().abierto).toBe(false);
    });
});

