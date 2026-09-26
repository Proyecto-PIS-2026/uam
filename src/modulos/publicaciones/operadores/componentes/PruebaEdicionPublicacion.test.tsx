import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CambiosPublicacionOperador } from "../modificar-publicacion";
import type DrawerEditarPublicacion from "./DrawerEditarPublicacion";
import PruebaEdicionPublicacion from "./PruebaEdicionPublicacion";

// ESTOS ARCHIVOS SE VAN A BORRAR, ES SOLO PARA PROBAR EL DRAWER MIENTRAS NO ESTA LA VISTA

type PropsDrawer = ComponentProps<typeof DrawerEditarPublicacion>;

const mocks = vi.hoisted(() => ({
    drawer: vi.fn(),
    cambios: null as CambiosPublicacionOperador | null,
    foto: null as File | null,
    crearFoto: vi.fn(),
    borrarFoto: vi.fn(),
}));

vi.mock("./DrawerEditarPublicacion", () => ({
    default: function DrawerMock(props: PropsDrawer) {
        mocks.drawer(props);
        if (!props.abierto || !props.publicacion) return null;

        async function guardar() {
            if (!props.publicacion) return;
            const { precio, foto, categoriaId, calibreId, presentacionId, disponible } = props.publicacion;
            await props.alGuardar(props.publicacion.publicacionOperadorId, mocks.cambios ?? {
                precio, foto, categoriaId, calibreId, presentacionId, disponible,
            }, mocks.foto);
            props.alCerrar();
        }

        return (
            <section role="dialog" aria-label="Editar publicación">
                <button onClick={props.alCerrar}>Cerrar edición</button>
                <button onClick={() => void guardar()}>Guardar demo</button>
            </section>
        );
    },
}));

async function guardarDemo() {
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar demo" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

describe("PruebaEdicionPublicacion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.cambios = null;
        mocks.foto = null;
        mocks.crearFoto.mockReset();
        class UrlConFotosTemporales extends URL {
            static createObjectURL = mocks.crearFoto;
            static revokeObjectURL = mocks.borrarFoto;
        }
        vi.stubGlobal("URL", UrlConFotosTemporales);
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it("muestra la tarjeta inicial y abre y cierra el drawer desde Editar", () => {
        render(<PruebaEdicionPublicacion />);

        expect(screen.getByRole("heading", { name: "Mis publicaciones" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Manzana · Gala" })).toBeInTheDocument();
        expect(screen.getByText("$ 180.00")).toBeInTheDocument();
        expect(screen.getByText("Cajon · I · G - GRANDE")).toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cerrar edición" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("actualiza precio y nombres según los IDs y conserva los cambios al reabrir", async () => {
        mocks.cambios = {
            precio: "220", foto: null, categoriaId: 2, calibreId: 9, presentacionId: 262, disponible: false,
        };
        render(<PruebaEdicionPublicacion />);
        await guardarDemo();

        expect(screen.getByRole("heading", { name: "Pera · Williams" })).toBeInTheDocument();
        expect(screen.getByText("Cajon · II · SV - SIN VARIACION")).toBeInTheDocument();
        expect(screen.getByText("$ 220")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Los cambios se aplicaron a esta vista de prueba.");

        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(mocks.drawer).toHaveBeenLastCalledWith(expect.objectContaining({
            abierto: true,
            publicacion: expect.objectContaining({ especieId: 52, variedadId: 122, disponible: false, precio: "220" }),
        }));
    });

    it("muestra Sin precio y vuelve a los datos iniciales al montar otra vez", async () => {
        mocks.cambios = {
            precio: null, foto: null, categoriaId: 1, calibreId: 7, presentacionId: 250, disponible: true,
        };
        const { unmount } = render(<PruebaEdicionPublicacion />);
        await guardarDemo();

        expect(screen.getByText("Sin precio")).toBeInTheDocument();
        unmount();
        render(<PruebaEdicionPublicacion />);

        expect(screen.getByText("$ 180.00")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("muestra las fotos locales y libera sus URLs al reemplazarlas y desmontar", async () => {
        mocks.crearFoto.mockReturnValueOnce("blob:foto-demo-1").mockReturnValueOnce("blob:foto-demo-2");
        mocks.foto = new File(["primera foto"], "primera.jpg", { type: "image/jpeg" });
        const { unmount } = render(<PruebaEdicionPublicacion />);
        await guardarDemo();

        expect(screen.getByAltText("Foto de Manzana Gala")).toHaveAttribute("src", "blob:foto-demo-1");
        expect(mocks.crearFoto).toHaveBeenCalledWith(mocks.foto);

        mocks.foto = new File(["segunda foto"], "segunda.jpg", { type: "image/jpeg" });
        await guardarDemo();
        expect(screen.getByAltText("Foto de Manzana Gala")).toHaveAttribute("src", "blob:foto-demo-2");
        expect(mocks.borrarFoto).toHaveBeenCalledWith("blob:foto-demo-1");

        unmount();
        expect(mocks.borrarFoto).toHaveBeenCalledWith("blob:foto-demo-2");
    });

    it("ofrece combinaciones activas con los nombres y relaciones del catálogo usado por el seed", () => {
        const rutaCatalogo = resolve(process.cwd(), "src/infraestructura/persistencia/prisma/data/catalogo-uam.csv");
        const filas = parse(readFileSync(rutaCatalogo, "utf8"), {
            columns: true, skip_empty_lines: true, trim: true,
        }) as Record<string, string>[];
        render(<PruebaEdicionPublicacion />);
        const opciones = mocks.drawer.mock.calls[mocks.drawer.mock.calls.length - 1][0] as PropsDrawer;

        for (const presentacion of opciones.presentaciones) {
            const variedad = opciones.variedades.find((opcion) => opcion.id === presentacion.variedadId);
            const especie = opciones.especies.find((opcion) => opcion.id === variedad?.especieId);
            expect(variedad).toBeDefined();
            expect(especie).toBeDefined();
            expect(filas.some((fila) =>
                fila.presentacion_id === String(presentacion.id)
                && fila.presentacion === presentacion.nombre
                && fila.variedad_id === String(variedad?.id)
                && fila.variedad === variedad?.nombre
                && fila.especie_id === String(especie?.id)
                && fila.especie === especie?.nombre
                && fila.especie_activa === "1"
                && fila.variedad_activa === "1"
                && fila.presentacion_activa === "1",
            )).toBe(true);
        }
        expect(opciones.variedades.every((variedad) => opciones.presentaciones.some((opcion) => opcion.variedadId === variedad.id))).toBe(true);
        expect(opciones.categorias.map((opcion) => opcion.nombre)).toEqual(["I", "II", "E", "-"]);
        expect(opciones.categorias.every((opcion) => opcion.especieId === null)).toBe(true);
    });
});
