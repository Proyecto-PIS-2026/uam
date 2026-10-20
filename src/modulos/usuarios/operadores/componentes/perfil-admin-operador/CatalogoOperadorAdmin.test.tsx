import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import CatalogoOperadorAdmin from "./CatalogoOperadorAdmin";
import type { PublicacionPerfilAdmin } from "../../consultas-perfil-admin";
import type { OpcionesEdicionPublicacion } from "../../../../publicaciones/operadores/consultas-edicion-publicacion";

const mocks = vi.hoisted(() => ({
    propsDrawer: vi.fn(),
    refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("../../../../publicaciones/operadores/componentes/DrawerEditarPublicacion", () => ({
    default: (props: { abierto: boolean; publicacion: { especie: string } | null; children?: ReactNode }) => {
        mocks.propsDrawer(props);
        return props.abierto && props.publicacion ? (
            <div role="dialog" aria-label="Detalle de publicación">
                {props.publicacion.especie}
                {props.children}
            </div>
        ) : null;
    },
}));

vi.mock("../../../../../compartido/componentes/ConfirmModal", () => ({
    ConfirmModal: ({ abierto, alConfirmar, alCancelar, procesando }: {
        abierto: boolean;
        alConfirmar: () => void;
        alCancelar: () => void;
        procesando: boolean;
    }) => abierto ? (
        <div role="alertdialog" aria-label="Confirmar eliminación">
            <button type="button" onClick={alConfirmar} disabled={procesando}>Confirmar baja</button>
            <button type="button" onClick={alCancelar} disabled={procesando}>Cancelar baja</button>
        </div>
    ) : null,
}));

// Devuelve las props de la última vez que se dibujó el drawer
function ultimasPropsDrawer() {
    return mocks.propsDrawer.mock.lastCall?.[0];
}

function responderFetch(cuerpo: unknown, status = 200) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status })));
}

const operadorId = 12;

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
    cantidadUnidades: 20,
    fecha: "2026-10-01T12:00:00Z",
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

const cambios = {
    precio: "130",
    cantidadUnidades: 20,
    categoriaId: 3,
    calibreId: 4,
    presentacionId: 111,
    paisId: 44,
    disponible: true,
};

// Dibuja el catálogo con una publicación y abre su drawer
function abrirPublicacion() {
    render(<CatalogoOperadorAdmin operadorId={operadorId} publicaciones={[publicacionBase]} opciones={opciones} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tomate - Perita" }));
}

describe("CatalogoOperadorAdmin", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    // Sin publicaciones se informa y no hay tarjetas
    it("informa cuando el operador no tiene publicaciones", () => {
        render(<CatalogoOperadorAdmin operadorId={operadorId} publicaciones={[]} opciones={opciones} />);

        expect(screen.getByText("El operador no tiene publicaciones.")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    // Una tarjeta por publicación
    it("muestra una tarjeta por cada publicación", () => {
        render(
            <CatalogoOperadorAdmin
                operadorId={operadorId}
                publicaciones={[publicacionBase, { ...publicacionBase, id: 102, especie: "Lechuga", variedad: "-" }]}
                opciones={opciones}
            />
        );

        expect(screen.getByRole("button", { name: "Ver detalles de Tomate - Perita" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ver detalles de Lechuga" })).toBeInTheDocument();
    });

    it("no muestra el drawer hasta que se toca una tarjeta", () => {
        render(<CatalogoOperadorAdmin operadorId={operadorId} publicaciones={[publicacionBase]} opciones={opciones} />);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(ultimasPropsDrawer()?.abierto).toBe(false);
    });

    it("abre el drawer en consulta con la publicación tocada y permite editar y eliminar", () => {
        abrirPublicacion();

        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toHaveTextContent("Tomate");

        const props = ultimasPropsDrawer();
        expect(props.abierto).toBe(true);
        expect(props.modoInicial).toBe("consulta");
        expect(props.alGuardar).toEqual(expect.any(Function));
        expect(props.alEliminar).toEqual(expect.any(Function));
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
            cantidadUnidades: 20,
        }));
        expect(props.especies).toBe(opciones.especies);
        expect(props.paises).toBe(opciones.paises);
    });

    it("cierra el drawer cuando se llama a alCerrar", () => {
        abrirPublicacion();

        act(() => {
            ultimasPropsDrawer().alCerrar();
        });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(ultimasPropsDrawer().abierto).toBe(false);
    });

    it("guarda los cambios con PATCH para el operador y refresca la página", async () => {
        responderFetch({ mensaje: "Publicación modificada correctamente." });
        abrirPublicacion();

        await ultimasPropsDrawer().alGuardar(15, cambios, null);

        expect(fetch).toHaveBeenCalledExactlyOnceWith(
            "/api/publicaciones/101?operadorId=12",
            expect.objectContaining({ method: "PATCH" }),
        );
        const cuerpo = vi.mocked(fetch).mock.calls[0][1]?.body as FormData;
        expect(cuerpo.get("cambios")).toBe(JSON.stringify(cambios));
        expect(cuerpo.get("fotografia")).toBeNull();
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("devuelve el error de la API al guardar sin refrescar la página", async () => {
        responderFetch({ errores: ["Los cambios no son válidos."] }, 400);
        abrirPublicacion();

        await expect(ultimasPropsDrawer().alGuardar(15, cambios, null)).rejects.toThrow("Los cambios no son válidos.");
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it("pide confirmación y elimina con DELETE para el operador", async () => {
        responderFetch({ mensaje: "Publicación eliminada." });
        abrirPublicacion();

        act(() => {
            ultimasPropsDrawer().alEliminar();
        });

        expect(screen.getByRole("alertdialog", { name: "Confirmar eliminación" })).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Confirmar baja" }));

        await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
        expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/publicaciones/101?operadorId=12", { method: "DELETE" });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Cancelar la confirmación no elimina nada
    it("cancela la baja sin llamar a la API", () => {
        responderFetch({ mensaje: "Publicación eliminada." });
        abrirPublicacion();

        act(() => {
            ultimasPropsDrawer().alEliminar();
        });
        fireEvent.click(screen.getByRole("button", { name: "Cancelar baja" }));

        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });

    it("muestra el error de la baja y mantiene el drawer abierto", async () => {
        responderFetch({ errores: ["La publicación no pertenece al operador seleccionado."] }, 404);
        abrirPublicacion();

        act(() => {
            ultimasPropsDrawer().alEliminar();
        });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar baja" }));

        await waitFor(() => expect(ultimasPropsDrawer().errorConsulta).toBe("La publicación no pertenece al operador seleccionado."));
        expect(ultimasPropsDrawer().abierto).toBe(true);
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(mocks.refresh).not.toHaveBeenCalled();
    });
});