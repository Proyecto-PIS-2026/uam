import type { ComponentProps } from "react";
import type { DrawerProps } from "@mui/material/Drawer";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DrawerEditarPublicacion from "./DrawerEditarPublicacion";

const mocks = vi.hoisted(() => ({
    mediaQuery: vi.fn(),
    guardar: vi.fn(),
    cerrar: vi.fn(),
    crearVistaPrevia: vi.fn(),
    borrarVistaPrevia: vi.fn(),
}));

vi.mock("@mui/material/useMediaQuery", () => ({ default: mocks.mediaQuery }));
vi.mock("@mui/material/Drawer", () => ({
    default: ({ anchor, open, onClose, children }: DrawerProps) => open ? (
        <section role="dialog" aria-label="Editar publicación" data-anchor={anchor}>
            {children}
            <button type="button" aria-label="Cerrar desde fondo" onClick={(evento) => onClose?.(evento, "backdropClick")} />
        </section>
    ) : null,
}));

type PropsDrawer = ComponentProps<typeof DrawerEditarPublicacion>;

const publicacionInicial: NonNullable<PropsDrawer["publicacion"]> = {
    publicacionOperadorId: 15,
    publicacionId: 41,
    especieId: 1,
    variedadId: 11,
    especie: "Manzana",
    variedad: "Red Delicious",
    precio: "100",
    foto: null,
    categoriaId: 3,
    calibreId: 4,
    presentacionId: 111,
    disponible: true,
};

const props: PropsDrawer = {
    abierto: true,
    alGuardar: mocks.guardar,
    alCerrar: mocks.cerrar,
    publicacion: publicacionInicial,
    especies: [{ id: 1, nombre: "Manzana" }, { id: 2, nombre: "Pera" }],
    variedades: [
        { id: 11, nombre: "Red Delicious", especieId: 1 },
        { id: 12, nombre: "Golden", especieId: 1 },
        { id: 21, nombre: "Williams", especieId: 2 },
    ],
    presentaciones: [
        { id: 111, nombre: "Bandeja", variedadId: 11 },
        { id: 112, nombre: "Plancha", variedadId: 11 },
        { id: 121, nombre: "Bolsa", variedadId: 12 },
        { id: 211, nombre: "Cajón", variedadId: 21 },
    ],
    categorias: [
        { id: 3, nombre: "Primera", especieId: 1 },
        { id: 5, nombre: "Segunda", especieId: 2 },
        { id: 6, nombre: "General", especieId: null },
    ],
    calibres: [{ id: 4, nombre: "Grande" }, { id: 7, nombre: "Mediano" }],
};

async function seleccionar(campo: string, opcion: string) {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: campo }));
    fireEvent.click(await screen.findByRole("option", { name: opcion }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

function confirmar() {
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const dialogo = screen.getByRole("dialog", { name: "¿Guardar los cambios?" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));
}

function solicitarGuardado() {
    const formulario = screen.getByRole("button", { name: "Guardar cambios" }).closest("form");
    if (!formulario) throw new Error("No se encontró el formulario de edición.");
    fireEvent.submit(formulario);
}

function seleccionarFoto(foto: File) {
    fireEvent.change(screen.getByLabelText("Seleccionar foto del producto"), { target: { files: [foto] } });
}

describe("DrawerEditarPublicacion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mediaQuery.mockReturnValue(false);
        mocks.guardar.mockReset().mockResolvedValue(undefined);
        mocks.crearVistaPrevia.mockReset().mockReturnValue("blob:foto-publicacion");
        class UrlConVistaPrevia extends URL {
            static createObjectURL = mocks.crearVistaPrevia;
            static revokeObjectURL = mocks.borrarVistaPrevia;
        }
        vi.stubGlobal("URL", UrlConVistaPrevia);
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it.each([
        { esWeb: false, anchor: "bottom" },
        { esWeb: true, anchor: "right" },
    ])("abre desde $anchor según el tamaño de pantalla", ({ esWeb, anchor }) => {
        mocks.mediaQuery.mockReturnValue(esWeb);
        render(<DrawerEditarPublicacion {...props} />);

        expect(mocks.mediaQuery).toHaveBeenCalledWith("(min-width: 768px)");
        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toHaveAttribute("data-anchor", anchor);
        const entradaFoto = screen.getByLabelText("Seleccionar foto del producto");
        if (esWeb) expect(entradaFoto).not.toHaveAttribute("capture");
        else expect(entradaFoto).toHaveAttribute("capture", "environment");
    });

    it.each([
        { abierto: false, publicacion: props.publicacion },
        { abierto: true, publicacion: null },
    ])("no muestra el drawer cerrado o sin publicación", ({ abierto, publicacion }) => {
        render(<DrawerEditarPublicacion {...props} abierto={abierto} publicacion={publicacion} />);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("requiere confirmación y guarda el precio y la disponibilidad actualizados", async () => {
        render(<DrawerEditarPublicacion {...props} />);

        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: "150.25" } });
        const disponibilidad = screen.getByRole("switch", { name: "Publicación disponible" });
        expect(disponibilidad).toBeChecked();
        fireEvent.click(disponibilidad);
        expect(disponibilidad).not.toBeChecked();
        expect(screen.getByText("No disponible")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        expect(mocks.guardar).not.toHaveBeenCalled();
        const dialogo = screen.getByRole("dialog", { name: "¿Guardar los cambios?" });
        fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, {
            precio: "150.25", foto: null, categoriaId: 3, calibreId: 4, presentacionId: 111, disponible: false,
        }, null));
        await waitFor(() => expect(mocks.cerrar).toHaveBeenCalledOnce());
    });

    it.each(["12,50", "-1", "10000000000", "1.234"])("rechaza el precio inválido %s antes de confirmar", (precio) => {
        render(<DrawerEditarPublicacion {...props} />);

        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: precio } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        expect(screen.getByRole("alert")).toHaveTextContent("El precio debe tener hasta 10 dígitos enteros y 2 decimales.");
        expect(screen.queryByRole("dialog", { name: "¿Guardar los cambios?" })).not.toBeInTheDocument();
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("permite guardar sin precio", async () => {
        render(<DrawerEditarPublicacion {...props} />);

        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: " " } });
        confirmar();

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({ precio: null }), null));
    });

    it("filtra las variedades por especie y actualiza la presentación al cambiar variedad", async () => {
        render(<DrawerEditarPublicacion {...props} />);

        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Variedad" }));
        expect(await screen.findByRole("option", { name: "Golden" })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Williams" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("option", { name: "Golden" }));
        await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
        expect(screen.getByRole("combobox", { name: "Presentación" })).toHaveTextContent("Bolsa");
        confirmar();

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({ presentacionId: 121 }), null));
    });

    it("selecciona una variedad, presentación y categoría compatibles al cambiar especie", async () => {
        render(<DrawerEditarPublicacion {...props} variedades={[{ id: 20, nombre: "Beurré d'Anjou", especieId: 2 }, ...props.variedades]} />);

        await seleccionar("Especie", "Pera");
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Williams");
        expect(screen.getByRole("combobox", { name: "Presentación" })).toHaveTextContent("Cajón");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("Segunda");
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Variedad" }));
        expect(await screen.findByRole("option", { name: "Beurré d'Anjou" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("option", { name: "Williams" }));
        await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
        confirmar();

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({
            presentacionId: 211, categoriaId: 5,
        }), null));
    });

    it("permite cancelar la confirmación y seguir editando", async () => {
        render(<DrawerEditarPublicacion {...props} />);

        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        const dialogo = screen.getByRole("dialog", { name: "¿Guardar los cambios?" });
        fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

        await waitFor(() => expect(screen.queryByRole("dialog", { name: "¿Guardar los cambios?" })).not.toBeInTheDocument());
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
    });

    it("cierra desde el botón o el fondo cuando no está guardando", () => {
        render(<DrawerEditarPublicacion {...props} />);

        fireEvent.click(screen.getByRole("button", { name: "Cerrar edición" }));
        fireEvent.click(screen.getByRole("button", { name: "Cerrar desde fondo" }));

        expect(mocks.cerrar).toHaveBeenCalledTimes(2);
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("muestra el error del guardado y conserva el drawer abierto", async () => {
        mocks.guardar.mockRejectedValue(new Error("La publicación no está disponible para editar."));
        render(<DrawerEditarPublicacion {...props} />);
        confirmar();

        expect(await screen.findByRole("alert")).toHaveTextContent("La publicación no está disponible para editar.");
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    });

    it("envía el archivo seleccionado y libera su vista previa al cerrar", async () => {
        const { unmount } = render(<DrawerEditarPublicacion {...props} />);
        const foto = new File(["imagen"], "publicacion.jpg", { type: "image/jpeg" });

        fireEvent.change(screen.getByLabelText("Seleccionar foto del producto"), { target: { files: [foto] } });
        expect(mocks.crearVistaPrevia).toHaveBeenCalledWith(foto);
        expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", "blob:foto-publicacion");
        confirmar();

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({ foto: null }), foto));
        unmount();
        expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:foto-publicacion");
    });

    it("carga el precio, disponibilidad, foto y opciones de la publicación existente", () => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, precio: null, foto: "/foto-existente.png", disponible: false }} />);

        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("");
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).not.toBeChecked();
        expect(screen.getByText("No disponible")).toBeInTheDocument();
        expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", "/foto-existente.png");
        expect(screen.getByRole("combobox", { name: "Especie" })).toHaveTextContent("Manzana");
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Red Delicious");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("Primera");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("Grande");
    });

    it.each([
        { inicial: "100", boton: "Aumentar precio en 10", esperado: "110" },
        { inicial: "100", boton: "Disminuir precio en 10", esperado: "90" },
        { inicial: "5", boton: "Disminuir precio en 10", esperado: "0" },
        { inicial: "9999999999.99", boton: "Aumentar precio en 10", esperado: "9999999999.99" },
        { inicial: "0.29", boton: "Aumentar precio en 10", esperado: "10.29" },
        { inicial: "", boton: "Aumentar precio en 10", esperado: "10" },
        { inicial: "texto", boton: "Aumentar precio en 10", esperado: "texto" },
    ])("ajusta el precio de $inicial a $esperado respetando sus límites", ({ inicial, boton, esperado }) => {
        render(<DrawerEditarPublicacion {...props} />);
        const entradaPrecio = screen.getByLabelText("Precio en pesos");

        fireEvent.change(entradaPrecio, { target: { value: inicial } });
        fireEvent.click(screen.getByRole("button", { name: boton }));

        expect(entradaPrecio).toHaveValue(esperado);
    });

    it("envía las opciones elegidas manualmente", async () => {
        render(<DrawerEditarPublicacion {...props} />);

        await seleccionar("Presentación", "Plancha");
        await seleccionar("Calibre", "Mediano");
        await seleccionar("Categoría", "General");
        confirmar();
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({
            presentacionId: 112, calibreId: 7, categoriaId: 6,
        }), null));
    });

    it("conserva una categoría general al cambiar especie", async () => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, categoriaId: 6 }} />);
        await seleccionar("Especie", "Pera");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("General");
        expect(screen.getByRole("combobox", { name: "Presentación" })).toHaveTextContent("Cajón");
        confirmar();
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({
            presentacionId: 211, categoriaId: 6,
        }), null));
    });

    it.each([
        { nombre: "sin variedades", opciones: { variedades: [] } },
        { nombre: "sin presentaciones", opciones: { presentaciones: [] } },
        { nombre: "sin categorías", opciones: { categorias: [] } },
        { nombre: "sin calibres", opciones: { calibres: [] } },
    ])("impide guardar un catálogo $nombre", ({ opciones }) => {
        render(<DrawerEditarPublicacion {...props} {...opciones} />);
        solicitarGuardado();

        expect(screen.getByRole("alert")).toHaveTextContent("Elegí una especie, variedad, presentación, categoría y calibre válidos.");
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog", { name: "¿Guardar los cambios?" })).not.toBeInTheDocument();
    });

    it("descarta los cambios sin guardar al cerrar y reabrir", () => {
        const { rerender } = render(<DrawerEditarPublicacion {...props} />);
        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: "200" } });
        seleccionarFoto(new File(["imagen"], "foto.jpg", { type: "image/jpeg" }));

        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        rerender(<DrawerEditarPublicacion {...props} abierto={false} />);
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:foto-publicacion");
        rerender(<DrawerEditarPublicacion {...props} />);

        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("100");
        expect(screen.getByText("Sin foto")).toBeInTheDocument();
    });

    it("bloquea la edición y el cierre desde el fondo mientras guarda, y evita un segundo envío", async () => {
        let terminarGuardado: () => void = () => { throw new Error("El guardado no comenzó."); };
        mocks.guardar.mockImplementation(() => new Promise<void>((resolve) => { terminarGuardado = resolve; }));
        render(<DrawerEditarPublicacion {...props} />);
        confirmar();

        await waitFor(() => expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled());
        expect(screen.getByLabelText("Precio en pesos")).toBeDisabled();
        expect(screen.getByLabelText("Seleccionar foto del producto")).toBeDisabled();
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Editar foto" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cerrar edición" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
        expect(screen.getByRole("combobox", { name: "Especie" })).toHaveAttribute("aria-disabled", "true");
        fireEvent.click(screen.getByRole("button", { name: "Cerrar desde fondo" }));
        const formulario = screen.getByRole("button", { name: "Guardando..." }).closest("form");
        if (!formulario) throw new Error("No se encontró el formulario de edición.");
        fireEvent.submit(formulario);
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(mocks.guardar).toHaveBeenCalledOnce();

        await act(async () => { terminarGuardado(); });
        expect(mocks.cerrar).toHaveBeenCalledOnce();
    });

    it("muestra un error genérico ante un rechazo sin mensaje y permite volver a guardar", async () => {
        mocks.guardar.mockRejectedValueOnce(null);
        render(<DrawerEditarPublicacion {...props} />);
        confirmar();

        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron guardar los cambios. Intentá de nuevo.");
        expect(screen.getByLabelText("Precio en pesos")).toBeEnabled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        confirmar();
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(mocks.cerrar).toHaveBeenCalledOnce());
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("abre el selector de archivos desde Editar foto", () => {
        render(<DrawerEditarPublicacion {...props} />);
        const entradaFoto = screen.getByLabelText("Seleccionar foto del producto");
        const abrirArchivos = vi.spyOn(entradaFoto, "click");

        fireEvent.click(screen.getByRole("button", { name: "Editar foto" }));

        expect(abrirArchivos).toHaveBeenCalledOnce();
        expect(entradaFoto).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    });

    it.each([
        { nombre: "un formato no admitido", foto: new File(["imagen"], "foto.gif", { type: "image/gif" }) },
        { nombre: "un archivo vacío", foto: new File([], "foto.png", { type: "image/png" }) },
        { nombre: "un archivo mayor a 5 MB", foto: new File([new Uint8Array(5 * 1024 * 1024 + 1)], "foto.webp", { type: "image/webp" }) },
    ])("rechaza $nombre sin reemplazar la foto existente", ({ foto }) => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, foto: "/foto-existente.png" }} />);
        seleccionarFoto(foto);

        expect(screen.getByRole("alert")).toHaveTextContent("Seleccioná una imagen JPEG, PNG o WebP de hasta 5 MB.");
        expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", "/foto-existente.png");
        expect(mocks.crearVistaPrevia).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("no cambia la imagen cuando se cancela la selección de archivos", () => {
        render(<DrawerEditarPublicacion {...props} />);
        fireEvent.change(screen.getByLabelText("Seleccionar foto del producto"), { target: { files: [] } });

        expect(screen.getByText("Sin foto")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(mocks.crearVistaPrevia).not.toHaveBeenCalled();
    });

    it("libera la vista previa anterior al elegir otra foto y envía solamente la última", async () => {
        mocks.crearVistaPrevia.mockReturnValueOnce("blob:primera-foto").mockReturnValueOnce("blob:segunda-foto");
        const primeraFoto = new File(["primera"], "primera.png", { type: "image/png" });
        const segundaFoto = new File(["segunda"], "segunda.webp", { type: "image/webp" });
        const { unmount } = render(<DrawerEditarPublicacion {...props} />);

        seleccionarFoto(primeraFoto);
        seleccionarFoto(segundaFoto);
        expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:primera-foto");
        expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", "blob:segunda-foto");
        confirmar();
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.any(Object), segundaFoto));

        unmount();
        expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:segunda-foto");
    });

    it("descarta el archivo nuevo al borrar la foto y envía null", async () => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, foto: "/foto-existente.png" }} />);
        seleccionarFoto(new File(["nueva"], "nueva.jpg", { type: "image/jpeg" }));
        fireEvent.click(screen.getByRole("button", { name: "Borrar foto" }));

        expect(screen.getByText("Sin foto")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Borrar foto" })).not.toBeInTheDocument();
        expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:foto-publicacion");
        confirmar();
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({ foto: null }), null));
    });

    it("borra una foto existente sin crear ni revocar una URL temporal", async () => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, foto: "/foto-existente.png" }} />);
        fireEvent.click(screen.getByRole("button", { name: "Borrar foto" }));
        confirmar();

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({ foto: null }), null));
        expect(mocks.crearVistaPrevia).not.toHaveBeenCalled();
        expect(mocks.borrarVistaPrevia).not.toHaveBeenCalled();
    });

    it("limpia el error de una imagen inválida al seleccionar una imagen válida", () => {
        render(<DrawerEditarPublicacion {...props} />);
        seleccionarFoto(new File(["imagen"], "foto.gif", { type: "image/gif" }));
        expect(screen.getByRole("alert")).toBeInTheDocument();
        seleccionarFoto(new File(["imagen"], "foto.png", { type: "image/png" }));

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", "blob:foto-publicacion");
    });
});
