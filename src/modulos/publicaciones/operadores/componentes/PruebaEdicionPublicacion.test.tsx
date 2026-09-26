import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpcionesEdicionPublicacion } from "../consultas-edicion-publicacion";
import type { CambiosPublicacionOperador } from "../modificar-publicacion";
import type DrawerEditarPublicacion from "./DrawerEditarPublicacion";
import PruebaEdicionPublicacion from "./PruebaEdicionPublicacion";

// ESTOS ARCHIVOS SE VAN A BORRAR, ES SOLO PARA PROBAR EL DRAWER MIENTRAS NO ESTA LA VISTA

type PropsDrawer = ComponentProps<typeof DrawerEditarPublicacion>;

const mocks = vi.hoisted(() => ({
    drawer: vi.fn<(props: PropsDrawer) => void>(),
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

function crearOpciones(): OpcionesEdicionPublicacion {
    return {
        especies: [
            { id: 501, nombre: "Manzana" },
            { id: 502, nombre: "Pera" },
            { id: 503, nombre: "Tomate" },
        ],
        variedades: [
            { id: 601, nombre: "Gala", especieId: 501 },
            { id: 602, nombre: "Williams", especieId: 502 },
            { id: 603, nombre: "Cherry", especieId: 503 },
        ],
        presentaciones: [
            { id: 701, nombre: "Cajon", variedadId: 601 },
            { id: 702, nombre: "Cajon", variedadId: 602 },
            { id: 703, nombre: "Plancha Chica", variedadId: 603 },
        ],
        categorias: [
            { id: 801, nombre: "I", especieId: null },
            { id: 802, nombre: "II", especieId: null },
            { id: 803, nombre: "E", especieId: 503 },
        ],
        calibres: [
            { id: 901, nombre: "G - GRANDE" },
            { id: 902, nombre: "SV - SIN VARIACION" },
        ],
    };
}

function ultimoDrawer(): PropsDrawer {
    const llamada = mocks.drawer.mock.lastCall;
    if (!llamada) throw new Error("No se renderizó el drawer");
    return llamada[0];
}

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

    it("muestra la tarjeta inicial con IDs del catálogo y abre y cierra el drawer", () => {
        render(<PruebaEdicionPublicacion opciones={crearOpciones()} />);

        expect(screen.getByRole("heading", { name: "Mis publicaciones" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Manzana · Gala" })).toBeInTheDocument();
        expect(screen.getByText("$ 180.00")).toBeInTheDocument();
        expect(screen.getByText("Cajon · I · G - GRANDE")).toBeInTheDocument();
        expect(ultimoDrawer().publicacion).toEqual(expect.objectContaining({
            publicacionId: 52,
            publicacionOperadorId: 13,
            especieId: 501,
            variedadId: 601,
            presentacionId: 701,
            categoriaId: 801,
            calibreId: 901,
            foto: null,
            disponible: true,
        }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cerrar edición" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("entrega al drawer todo el catálogo recibido, incluidas las otras especies y categorías específicas", () => {
        const opciones = crearOpciones();
        render(<PruebaEdicionPublicacion opciones={opciones} />);

        const drawer = ultimoDrawer();
        expect(drawer.especies).toEqual(opciones.especies);
        expect(drawer.variedades).toEqual(opciones.variedades);
        expect(drawer.presentaciones).toEqual(opciones.presentaciones);
        expect(drawer.categorias).toEqual(opciones.categorias);
        expect(drawer.calibres).toEqual(opciones.calibres);
    });

    it("prefiere Manzana, Gala, Cajon, I y G - GRANDE aunque otras opciones aparezcan primero", () => {
        const opciones = crearOpciones();
        render(<PruebaEdicionPublicacion opciones={{
            especies: [...opciones.especies].reverse(),
            variedades: [...opciones.variedades].reverse(),
            presentaciones: [...opciones.presentaciones].reverse(),
            categorias: [...opciones.categorias].reverse(),
            calibres: [...opciones.calibres].reverse(),
        }} />);

        expect(screen.getByRole("heading", { name: "Manzana · Gala" })).toBeInTheDocument();
        expect(screen.getByText("Cajon · I · G - GRANDE")).toBeInTheDocument();
    });

    it("actualiza precio y nombres según los IDs y conserva los cambios al reabrir", async () => {
        mocks.cambios = {
            precio: "220", foto: null, categoriaId: 802, calibreId: 902, presentacionId: 702, disponible: false,
        };
        render(<PruebaEdicionPublicacion opciones={crearOpciones()} />);
        await guardarDemo();

        expect(screen.getByRole("heading", { name: "Pera · Williams" })).toBeInTheDocument();
        expect(screen.getByText("Cajon · II · SV - SIN VARIACION")).toBeInTheDocument();
        expect(screen.getByText("$ 220")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Los cambios se aplicaron a esta vista de prueba.");

        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(ultimoDrawer()).toEqual(expect.objectContaining({
            abierto: true,
            publicacion: expect.objectContaining({ especieId: 502, variedadId: 602, disponible: false, precio: "220" }),
        }));
    });

    it("permite aplicar una categoría específica al cambiar a otra especie", async () => {
        mocks.cambios = {
            precio: "90", foto: null, categoriaId: 803, calibreId: 902, presentacionId: 703, disponible: true,
        };
        render(<PruebaEdicionPublicacion opciones={crearOpciones()} />);
        await guardarDemo();

        expect(screen.getByRole("heading", { name: "Tomate · Cherry" })).toBeInTheDocument();
        expect(screen.getByText("Plancha Chica · E · SV - SIN VARIACION")).toBeInTheDocument();
        expect(ultimoDrawer().publicacion).toEqual(expect.objectContaining({
            especieId: 503, variedadId: 603, categoriaId: 803, presentacionId: 703,
        }));
    });

    it("muestra Sin precio y vuelve a los datos iniciales al montar otra vez", async () => {
        mocks.cambios = {
            precio: null, foto: null, categoriaId: 801, calibreId: 901, presentacionId: 701, disponible: true,
        };
        const { unmount } = render(<PruebaEdicionPublicacion opciones={crearOpciones()} />);
        await guardarDemo();

        expect(screen.getByText("Sin precio")).toBeInTheDocument();
        unmount();
        render(<PruebaEdicionPublicacion opciones={crearOpciones()} />);

        expect(screen.getByText("$ 180.00")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("muestra las fotos locales y libera sus URLs al reemplazarlas y desmontar", async () => {
        mocks.crearFoto.mockReturnValueOnce("blob:foto-demo-1").mockReturnValueOnce("blob:foto-demo-2");
        mocks.foto = new File(["primera foto"], "primera.jpg", { type: "image/jpeg" });
        const { unmount } = render(<PruebaEdicionPublicacion opciones={crearOpciones()} />);
        await guardarDemo();

        expect(screen.getByAltText("Foto de Manzana Gala")).toHaveAttribute("src", "blob:foto-demo-1");
        expect(mocks.crearFoto).toHaveBeenCalledWith(mocks.foto);

        mocks.foto = new File(["segunda foto"], "segunda.jpg", { type: "image/jpeg" });
        await guardarDemo();
        expect(screen.getByAltText("Foto de Manzana Gala")).toHaveAttribute("src", "blob:foto-demo-2");
        expect(mocks.borrarFoto).toHaveBeenCalledExactlyOnceWith("blob:foto-demo-1");

        mocks.foto = null;
        await guardarDemo();
        expect(screen.getByAltText("Foto de Manzana Gala")).toHaveAttribute("src", "blob:foto-demo-2");
        expect(mocks.crearFoto).toHaveBeenCalledTimes(2);
        expect(mocks.borrarFoto).toHaveBeenCalledTimes(1);

        unmount();
        expect(mocks.borrarFoto).toHaveBeenLastCalledWith("blob:foto-demo-2");
        expect(mocks.borrarFoto).toHaveBeenCalledTimes(2);
    });

    it("rechaza guardar si el callback recibe otra publicación", () => {
        render(<PruebaEdicionPublicacion opciones={crearOpciones()} />);
        const drawer = ultimoDrawer();
        const cambios: CambiosPublicacionOperador = {
            precio: "90", foto: null, categoriaId: 801, calibreId: 901, presentacionId: 701, disponible: true,
        };

        expect(() => drawer.alGuardar(999, cambios, null)).toThrow("La publicación seleccionada cambió.");
        expect(screen.getByText("$ 180.00")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it.each(["especies", "variedades", "presentaciones", "categorias", "calibres"] as const)(
        "explica que el catálogo está incompleto si no tiene %s y no renderiza el drawer",
        (campo) => {
            const opciones = crearOpciones();
            opciones[campo] = [];
            render(<PruebaEdicionPublicacion opciones={opciones} />);

            expect(screen.getByText("No hay opciones suficientes en el catálogo para probar la edición.")).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
            expect(mocks.drawer).not.toHaveBeenCalled();
        },
    );

    it("no inventa relaciones cuando ninguna presentación corresponde a una variedad del catálogo", () => {
        const opciones = crearOpciones();
        opciones.presentaciones = [{ id: 700, nombre: "Caja", variedadId: 999 }];
        render(<PruebaEdicionPublicacion opciones={opciones} />);

        expect(screen.getByText("No hay opciones suficientes en el catálogo para probar la edición.")).toBeInTheDocument();
        expect(mocks.drawer).not.toHaveBeenCalled();
    });

    it("sin Manzana utiliza una combinación válida de otra especie y salta las que están incompletas", () => {
        const opciones = crearOpciones();
        render(<PruebaEdicionPublicacion opciones={{
            especies: opciones.especies.filter((opcion) => opcion.id !== 501),
            variedades: opciones.variedades.filter((opcion) => opcion.id !== 601),
            presentaciones: opciones.presentaciones.filter((opcion) => opcion.id === 703),
            categorias: opciones.categorias.filter((opcion) => opcion.id === 803),
            calibres: opciones.calibres.filter((opcion) => opcion.id === 902),
        }} />);

        expect(screen.getByRole("heading", { name: "Tomate · Cherry" })).toBeInTheDocument();
        expect(screen.getByText("Plancha Chica · E · SV - SIN VARIACION")).toBeInTheDocument();
        expect(ultimoDrawer().publicacion).toEqual(expect.objectContaining({
            especieId: 503, variedadId: 603, presentacionId: 703, categoriaId: 803, calibreId: 902,
        }));
    });
});
