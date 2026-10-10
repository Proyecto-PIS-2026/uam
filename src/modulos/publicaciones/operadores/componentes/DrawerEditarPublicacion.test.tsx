import type { ComponentProps } from "react";
import type { DrawerProps } from "@mui/material/Drawer";
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DrawerEditarPublicacion from "./DrawerEditarPublicacion";

const mocks = vi.hoisted(() => ({
    mediaQuery: vi.fn(),
    guardar: vi.fn(),
    cerrar: vi.fn(),
    eliminar: vi.fn(),
    crearVistaPrevia: vi.fn(),
    borrarVistaPrevia: vi.fn(),
}));

vi.mock("@mui/material/useMediaQuery", () => ({ default: mocks.mediaQuery }));
vi.mock("@mui/material/Drawer", () => ({
    default: ({ anchor, open, onClose, children }: DrawerProps) => open ? (
        <section role="dialog" aria-label="Drawer de publicación" data-anchor={anchor}>
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
    fecha: "2026-10-03T15:00:00.000Z",
    foto: null,
    categoriaId: 3,
    calibreId: 4,
    presentacionId: 111,
    paisId: 44,
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
    paises: [{ id: 44, nombre: "Uruguay" }, { id: 55, nombre: "Brasil" }],
};

async function seleccionar(campo: string, opcion: string) {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: campo }));
    fireEvent.click(await screen.findByRole("option", { name: opcion }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

function guardarDesdeBoton() {
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
}

function solicitarGuardado() {
    const formulario = screen.getByRole("button", { name: "Guardar" }).closest("form");
    if (!formulario) throw new Error("No se encontró el formulario de edición.");
    fireEvent.submit(formulario);
}

function seleccionarFoto(foto: File) {
    fireEvent.change(screen.getByLabelText("Seleccionar foto del producto"), { target: { files: [foto] } });
}

describe("DrawerEditarPublicacion", () => {
    it.each(["modificar", "eliminar"] as const)("deshabilita únicamente la acción %s denegada", (accion) => {
        render(<DrawerEditarPublicacion {...props} modoInicial="consulta" alEliminar={mocks.eliminar} puedeModificar={accion !== "modificar"} puedeEliminar={accion !== "eliminar"} />);

        const editar = screen.getByRole("button", { name: "Editar" });
        const eliminar = screen.getByRole("button", { name: "Eliminar" });
        expect(editar).toHaveProperty("disabled", accion === "modificar");
        expect(eliminar).toHaveProperty("disabled", accion === "eliminar");
        fireEvent.click(accion === "modificar" ? editar : eliminar);
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.eliminar).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    });
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
        expect(screen.getByRole("dialog", { name: "Drawer de publicación" })).toHaveAttribute("data-anchor", anchor);
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

    it.each([false, true])("muestra los datos sin permitir modificarlos en consulta con web=%s", (esWeb) => {
        mocks.mediaQuery.mockReturnValue(esWeb);
        render(<DrawerEditarPublicacion {...props} modoInicial="consulta" alEliminar={mocks.eliminar} publicacion={{ ...publicacionInicial, foto: "/foto-existente.png" }} />);

        screen.getByText("Consultar publicación")
        const precio = screen.getByLabelText("Precio en pesos");
        expect(precio).toHaveValue("100");
        expect(precio).toHaveAttribute("readonly");
        expect(screen.queryByRole("switch", { name: "Publicación disponible" })).not.toBeInTheDocument();
        expect(screen.getByText("Disponible")).toBeInTheDocument();
        expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", expect.stringContaining("/foto-existente.png"));
        for (const campo of ["Especie", "Variedad", "Presentación", "País", "Categoría", "Calibre"]) {
            expect(screen.getByRole("combobox", { name: campo })).toHaveAttribute("aria-disabled", "true");
        }
        for (const boton of ["Disminuir precio en 10", "Aumentar precio en 10", esWeb ? "Editar foto" : "Cámara", "Galería", "Borrar foto"]) {
            expect(screen.queryByRole("button", { name: boton })).not.toBeInTheDocument();
        }
        expect(screen.queryByLabelText("Seleccionar foto del producto")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled();
        expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    });

    it.each([false, true])("Editar habilita el formulario sin enviar con web=%s", (esWeb) => {
        mocks.mediaQuery.mockReturnValue(esWeb);
        render(<DrawerEditarPublicacion {...props} modoInicial="consulta" alEliminar={mocks.eliminar} />);
        const editar = screen.getByRole("button", { name: "Editar" });
        const clic = createEvent.click(editar, { bubbles: true, cancelable: true });

        fireEvent(editar, clic);

        expect(clic.defaultPrevented).toBe(true);
        expect(screen.getByText("Editar publicación")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
    });

    it("muestra un error si la cantidad de unidades existente tiene un formato inválido", () => {
        render(
            <DrawerEditarPublicacion
                {...props}
                publicacion={{
                    ...publicacionInicial,
                    cantidadUnidades: 125.50,
                }}
            />,
        );
        guardarDesdeBoton();
        expect(screen.getByRole("alert")).toHaveTextContent(
            "La cantidad de unidades debe ser un número entero de hasta 10 dígitos.",
        );
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("vuelve a consulta tras guardar y permite una segunda edición en el mismo drawer", async () => {
        render(<DrawerEditarPublicacion {...props} modoInicial="consulta" alEliminar={mocks.eliminar} />);
        const drawer = screen.getByRole("dialog", { name: "Drawer de publicación" });
        const precio = screen.getByLabelText("Precio en pesos");
        const pais = screen.getByRole("combobox", { name: "País" });

        fireEvent.click(screen.getByRole("button", { name: "Editar" }));

        expect(screen.getByRole("dialog", { name: "Drawer de publicación" })).toBe(drawer);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(screen.getByRole("combobox", { name: "País" })).toBe(pais);
        expect(screen.getByText("Editar publicación")).toBeInTheDocument();
        expect(precio).not.toHaveAttribute("readonly");
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBeEnabled();
        expect(pais).not.toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Cámara" })).toBeEnabled();
        expect(screen.getByLabelText("Seleccionar foto del producto")).toBeEnabled();
        expect(screen.getByRole("button", { name: "Disminuir precio en 10" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Aumentar precio en 10" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
        expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
        expect(mocks.guardar).not.toHaveBeenCalled();
        fireEvent.change(precio, { target: { value: "200" } });
        await seleccionar("País", "Brasil");
        guardarDesdeBoton();

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({ precio: "200", paisId: 55 }), null));
        await waitFor(() => expect(screen.getByText("Consultar publicación")).toBeInTheDocument());
        expect(screen.getByRole("dialog", { name: "Drawer de publicación" })).toBe(drawer);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(screen.getByRole("combobox", { name: "País" })).toBe(pais);
        expect(precio).toHaveValue("200");
        expect(precio).toHaveAttribute("readonly");
        expect(pais).toHaveTextContent("Brasil");
        expect(pais).toHaveAttribute("aria-disabled", "true");
        expect(screen.queryByRole("switch", { name: "Publicación disponible" })).not.toBeInTheDocument();
        expect(screen.getByText("Disponible")).toBeInTheDocument();
        for (const boton of ["Disminuir precio en 10", "Aumentar precio en 10", "Cámara", "Galería", "Borrar foto"]) {
            expect(screen.queryByRole("button", { name: boton })).not.toBeInTheDocument();
        }
        expect(screen.queryByLabelText("Seleccionar foto del producto")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
        expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(mocks.eliminar).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(precio).toHaveValue("200");
        expect(pais).toHaveTextContent("Brasil");
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Aumentar precio en 10" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Cámara" })).toBeEnabled();
        expect(mocks.guardar).toHaveBeenCalledOnce();
        fireEvent.change(precio, { target: { value: "300" } });
        guardarDesdeBoton();

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledTimes(2));
        expect(mocks.guardar).toHaveBeenLastCalledWith(15, expect.objectContaining({ precio: "300", paisId: 55 }), null);
        await waitFor(() => expect(screen.getByText("Consultar publicación")).toBeInTheDocument());
        expect(screen.getByRole("dialog", { name: "Drawer de publicación" })).toBe(drawer);
        expect(precio).toHaveValue("300");
        expect(precio).toHaveAttribute("readonly");
        expect(mocks.cerrar).not.toHaveBeenCalled();
    });

    it("delega la eliminación desde consulta sin guardar cambios", () => {
        render(<DrawerEditarPublicacion {...props} modoInicial="consulta" alEliminar={mocks.eliminar} />);

        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

        expect(mocks.eliminar).toHaveBeenCalledOnce();
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("deshabilita Eliminar cuando no se proporciona una acción de eliminación", () => {
        render(<DrawerEditarPublicacion {...props} modoInicial="consulta" />);

        expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
    });

    it("deshabilita Editar cuando no se proporciona una acción de guardado", () => {
        render(<DrawerEditarPublicacion {...props} modoInicial="consulta" alGuardar={undefined} />);

        expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
        expect(screen.getByText("Consultar publicación")).toBeInTheDocument();
    });

    it("bloquea las acciones mientras se elimina la publicación", () => {
        render(<DrawerEditarPublicacion {...props} modoInicial="consulta" alEliminar={mocks.eliminar} eliminando />);

        expect(screen.getByRole("button", { name: /Eliminar|Eliminando/ })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
        expect(screen.getByLabelText("Precio en pesos")).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Cerrar desde fondo" }));

        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it("bloquea las acciones y el cierre mientras se actualizan los datos guardados", () => {
        render(<DrawerEditarPublicacion {...props} modoInicial="consulta" alEliminar={mocks.eliminar} actualizando />);

        expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cerrar consulta" })).toBeDisabled();
        expect(screen.getByLabelText("Precio en pesos")).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Cerrar desde fondo" }));

        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(mocks.eliminar).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

it("reemplaza la vista previa por la foto guardada y no reenvía el archivo al editar de nuevo", async () => {
    const { rerender } = render(<DrawerEditarPublicacion {...props}  modoInicial="consulta" alEliminar={mocks.eliminar} publicacion={{ ...publicacionInicial, foto: "/foto-anterior.png" }}/>);
    const drawer = screen.getByRole("dialog", { name: "Drawer de publicación" });
    const archivo = new File(["foto nueva"], "foto-nueva.webp", { type: "image/webp" });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    seleccionarFoto(archivo);
    guardarDesdeBoton();
    await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith( 15, expect.objectContaining({ precio: "100", foto: undefined }), archivo));
    await waitFor(() =>expect(screen.getByText("Consultar publicación")).toBeInTheDocument(),);
    expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", "blob:foto-publicacion",);
    expect(screen.queryByRole("button", { name: "Cámara" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrar foto" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Seleccionar foto del producto")).not.toBeInTheDocument();
    expect(mocks.cerrar).not.toHaveBeenCalled();
    rerender(<DrawerEditarPublicacion {...props} modoInicial="consulta" alEliminar={mocks.eliminar} publicacion={{ ...publicacionInicial, precio: "250", foto: "/uploads/publicaciones/41.webp"}}/>);
    expect(screen.getByRole("dialog", { name: "Drawer de publicación" })).toBe(drawer);
    expect(screen.getByText("Consultar publicación")).toBeInTheDocument();
    expect(screen.getByLabelText("Precio en pesos")).toHaveValue("250");
    expect(screen.getByLabelText("Precio en pesos")).toHaveAttribute("readonly");
    expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", expect.stringContaining("/uploads/publicaciones/41.webp"),);
    expect(screen.getByText("Disponible")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Publicación disponible" })).not.toBeInTheDocument();
    expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:foto-publicacion");
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("button", { name: "Cámara" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Borrar foto" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Precio en pesos"), {target: { value: "260" }});
    guardarDesdeBoton();
    await waitFor(() => expect(mocks.guardar).toHaveBeenCalledTimes(2));
    expect(mocks.guardar).toHaveBeenLastCalledWith(15, expect.objectContaining({ precio: "260", foto: undefined }), null);
    await waitFor(() => expect(screen.getByText("Consultar publicación")).toBeInTheDocument());
    expect(mocks.cerrar).not.toHaveBeenCalled();
    });

    it("al cancelar la edición vuelve a consulta con los datos originales", async () => {
        render(<DrawerEditarPublicacion {...props} modoInicial="consulta" alEliminar={mocks.eliminar} publicacion={{ ...publicacionInicial, foto: "/foto-existente.png" }} />);
        const drawer = screen.getByRole("dialog", { name: "Drawer de publicación" });
        const precio = screen.getByLabelText("Precio en pesos");
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(precio, { target: { value: "200" } });
        await seleccionar("País", "Brasil");
        fireEvent.click(screen.getByRole("switch", { name: "Publicación disponible" }));
        seleccionarFoto(new File(["foto nueva"], "foto-nueva.webp", { type: "image/webp" }));

        expect(precio).toHaveValue("200");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveTextContent("Brasil");
        expect(screen.getByText("No disponible")).toBeInTheDocument();
        expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", "blob:foto-publicacion");

        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        expect(screen.getByRole("dialog", { name: "Drawer de publicación" })).toBe(drawer);
        expect(screen.getByText("Consultar publicación")).toBeInTheDocument();
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(precio).toHaveValue("100");
        expect(precio).toHaveAttribute("readonly");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveTextContent("Uruguay");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByText("Disponible")).toBeInTheDocument();
        expect(screen.queryByRole("switch", { name: "Publicación disponible" })).not.toBeInTheDocument();
        expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", expect.stringContaining("/foto-existente.png"));
        expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled();
        expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
        expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:foto-publicacion");
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.eliminar).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        expect(precio).toHaveValue("100");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveTextContent("Uruguay");
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBeChecked();
        expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", expect.stringContaining("/foto-existente.png"));
    });

    it("ignora el envío del formulario mientras sigue en consulta", () => {
        render(<DrawerEditarPublicacion {...props} modoInicial="consulta" alEliminar={mocks.eliminar} />);
        const formulario = screen.getByLabelText("Precio en pesos").closest("form");
        if (!formulario) throw new Error("No se encontró el formulario de consulta.");

        fireEvent.submit(formulario);

        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(screen.getByText("Consultar publicación")).toBeInTheDocument();
    });

    it("conserva la edición y los datos ante un error después de consultar", async () => {
        mocks.guardar.mockRejectedValueOnce(new Error("No se pudo guardar la publicación."));
        render(<DrawerEditarPublicacion {...props} modoInicial="consulta" alEliminar={mocks.eliminar} />);
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: "200" } });
        guardarDesdeBoton();

        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la publicación.");
        expect(screen.getByText("Editar publicación")).toBeInTheDocument();
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("200");
        expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
    });

    it("guarda el precio y la disponibilidad actualizados con un solo clic", async () => {
        render(<DrawerEditarPublicacion {...props} />);

        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: "150" } });
        const disponibilidad = screen.getByRole("switch", { name: "Publicación disponible" });
        expect(disponibilidad).toBeChecked();
        fireEvent.click(disponibilidad);
        expect(disponibilidad).not.toBeChecked();
        expect(screen.getByText("No disponible")).toBeInTheDocument();
    
        const inputUnidades = screen.getByPlaceholderText("Ingresar cantidad aquí") as HTMLInputElement;
        fireEvent.change(inputUnidades, { target: { value: "abc" } });
        expect(inputUnidades.value).toBe("");

        guardarDesdeBoton();
        expect(screen.queryByRole("dialog", { name: "¿Guardar los cambios?" })).not.toBeInTheDocument();

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, {
            precio: "150", 
            foto: undefined, 
            categoriaId: 3, 
            calibreId: 4, 
            presentacionId: 111, 
            paisId: 44, 
            disponible: false,
            cantidadUnidades: null
        }, null));
        expect(mocks.guardar).toHaveBeenCalledOnce();
        await waitFor(() => expect(mocks.cerrar).toHaveBeenCalledOnce());
    });

    it.each(["125,50", "125.50", "-1", "10000000000", "1.234", "texto"])("conserva el precio entero al intentar escribir o pegar %s",
        async (precio) => {
            render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, precio: "125" }}/>);
            const entradaPrecio = screen.getByLabelText("Precio en pesos");
            fireEvent.change(entradaPrecio, { target: { value: precio } });
            expect(entradaPrecio).toHaveValue("125");
            expect(mocks.guardar).not.toHaveBeenCalled();
            fireEvent.click(screen.getByRole("switch", { name: "Publicación disponible" }));
            guardarDesdeBoton();
            await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith( 15, expect.objectContaining({ precio: "125", disponible: false }), null));
        },
    );

    it.each(["12.50", "-1", "10000000000"])("requiere corregir el precio existente inválido %s antes de guardar", (precio) => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, precio }} />);
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(screen.getByRole("alert")).toHaveTextContent("El precio debe ser un número entero de hasta 10 dígitos.");
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it.each([
        { precio: "12.00", esperado: "12" },
        { precio: "0.00", esperado: "0" },
        { precio: "9999999999.00", esperado: "9999999999" },
    ])("normaliza el precio existente $precio como entero $esperado", async ({ precio, esperado }) => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, precio }} />);
        expect(mocks.guardar).not.toHaveBeenCalled();
        await seleccionar("País", "Brasil");
        guardarDesdeBoton();
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({ precio: esperado, paisId: 55 }), null));
    });

    it("permite corregir un precio existente con decimales antes de guardar", async () => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, precio: "125.50" }} />);
        const entradaPrecio = screen.getByLabelText("Precio en pesos");

        expect(entradaPrecio).toHaveValue("125.50");
        fireEvent.change(entradaPrecio, { target: { value: "125" } });
        guardarDesdeBoton();

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({ precio: "125" }), null));
    });

    it("ofrece entrada numérica de texto con un máximo de 10 dígitos", () => {
        render(<DrawerEditarPublicacion {...props} />);

        const entradaPrecio = screen.getByLabelText("Precio en pesos");
        expect(entradaPrecio).toHaveAttribute("type", "text");
        expect(entradaPrecio).toHaveAttribute("inputmode", "numeric");
        expect(entradaPrecio).toHaveAttribute("maxlength", "10");
    });

    it("permite guardar sin precio", async () => {
        render(<DrawerEditarPublicacion {...props} />);

        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: "" } });
        guardarDesdeBoton();

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
        guardarDesdeBoton();

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
        guardarDesdeBoton();

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({
            presentacionId: 211, categoriaId: 5,
        }), null));
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
        fireEvent.change(screen.getByLabelText("Precio en pesos"), {target: { value: "101" }});
        guardarDesdeBoton();
        expect(await screen.findByRole("alert")).toHaveTextContent("La publicación no está disponible para editar.");
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    });

    it("envía el archivo seleccionado y libera su vista previa al cerrar", async () => {
        const { unmount } = render(<DrawerEditarPublicacion {...props} />);
        const foto = new File(["imagen"], "publicacion.jpg", { type: "image/jpeg" });

        fireEvent.change(screen.getByLabelText("Seleccionar foto del producto"), { target: { files: [foto] } });
        expect(mocks.crearVistaPrevia).toHaveBeenCalledWith(foto);
        expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", "blob:foto-publicacion");
        guardarDesdeBoton();

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({ foto: undefined }), foto));
        unmount();
        expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:foto-publicacion");
    });

    it("carga el precio, disponibilidad, foto y opciones de la publicación existente", () => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, precio: null, foto: "/foto-existente.png", disponible: false }} />);

        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("");
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).not.toBeChecked();
        expect(screen.getByText("No disponible")).toBeInTheDocument();
        expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", expect.stringContaining("/foto-existente.png"));
        expect(screen.getByRole("combobox", { name: "Especie" })).toHaveTextContent("Manzana");
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Red Delicious");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("Primera");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("Grande");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveTextContent("Uruguay");
    });

    it.each([
        { inicial: "100", boton: "Aumentar precio en 10", esperado: "110" },
        { inicial: "100", boton: "Disminuir precio en 10", esperado: "90" },
        { inicial: "5", boton: "Disminuir precio en 10", esperado: "0" },
        { inicial: "9999999999", boton: "Aumentar precio en 10", esperado: "9999999999" },
        { inicial: "9999999995", boton: "Aumentar precio en 10", esperado: "9999999999" },
        { inicial: "0.29", boton: "Aumentar precio en 10", esperado: "0.29" },
        { inicial: "", boton: "Aumentar precio en 10", esperado: "10" },
        { inicial: "texto", boton: "Aumentar precio en 10", esperado: "texto" },
    ])("ajusta el precio de $inicial a $esperado respetando sus límites", ({ inicial, boton, esperado }) => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, precio: inicial }} />);
        const entradaPrecio = screen.getByLabelText("Precio en pesos");

        fireEvent.click(screen.getByRole("button", { name: boton }));

        expect(entradaPrecio).toHaveValue(esperado);
    });

    it("envía las opciones elegidas manualmente", async () => {
        render(<DrawerEditarPublicacion {...props} />);

        await seleccionar("Presentación", "Plancha");
        await seleccionar("Calibre", "Mediano");
        await seleccionar("Categoría", "General");
        await seleccionar("País", "Brasil");
        guardarDesdeBoton();
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({
            presentacionId: 112, calibreId: 7, categoriaId: 6, paisId: 55,
        }), null));
    });

    it("conserva una categoría general al cambiar especie", async () => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, categoriaId: 6 }} />);
        await seleccionar("Especie", "Pera");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("General");
        expect(screen.getByRole("combobox", { name: "Presentación" })).toHaveTextContent("Cajón");
        guardarDesdeBoton();
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({
            presentacionId: 211, categoriaId: 6,
        }), null));
    });

    it.each([
        { nombre: "sin variedades", opciones: { variedades: [] } },
        { nombre: "sin presentaciones", opciones: { presentaciones: [] } },
        { nombre: "sin categorías", opciones: { categorias: [] } },
        { nombre: "sin calibres", opciones: { calibres: [] } },
        { nombre: "sin países", opciones: { paises: [] } },
    ])("impide guardar un catálogo $nombre", ({ opciones }) => {
        render(<DrawerEditarPublicacion {...props} {...opciones} />);
        solicitarGuardado();

        expect(screen.getByRole("alert")).toHaveTextContent("Elegí una especie, variedad, presentación, categoría, calibre y país válidos.");
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("impide guardar un país que no pertenece al catálogo", () => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, paisId: 999 }} />);
        solicitarGuardado();

        expect(screen.getByRole("alert")).toHaveTextContent("Elegí una especie, variedad, presentación, categoría, calibre y país válidos.");
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("descarta los cambios sin guardar al cerrar y reabrir", async () => {
        const { rerender } = render(<DrawerEditarPublicacion {...props} />);
        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: "200" } });
        await seleccionar("País", "Brasil");
        seleccionarFoto(new File(["imagen"], "foto.jpg", { type: "image/jpeg" }));

        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(mocks.cerrar).toHaveBeenCalledOnce();
        rerender(<DrawerEditarPublicacion {...props} abierto={false} />);
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:foto-publicacion");
        rerender(<DrawerEditarPublicacion {...props} />);

        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("100");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveTextContent("Uruguay");
        expect(screen.getByText("Sin foto")).toBeInTheDocument();
    });

    it("bloquea la edición y el cierre desde el fondo mientras guarda, y evita un segundo envío", async () => {
        let terminarGuardado: () => void = () => { throw new Error("El guardado no comenzó."); };
        mocks.guardar.mockImplementation(() => new Promise<void>((resolve) => { terminarGuardado = resolve; }));
        render(<DrawerEditarPublicacion {...props} />);
        fireEvent.change(screen.getByLabelText("Precio en pesos"), {target: { value: "101" }});
        guardarDesdeBoton();
        await waitFor(() => expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled());
        expect(screen.getByLabelText("Precio en pesos")).toBeDisabled();
        expect(screen.getByLabelText("Seleccionar foto del producto")).toBeDisabled();
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cámara" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cerrar edición" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
        expect(screen.getByRole("combobox", { name: "Especie" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveAttribute("aria-disabled", "true");
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
        fireEvent.change(screen.getByLabelText("Precio en pesos"), {target: { value: "101" }});
        guardarDesdeBoton();
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron guardar los cambios. Intentá de nuevo.");
        expect(screen.getByLabelText("Precio en pesos")).toBeEnabled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        guardarDesdeBoton();
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(mocks.cerrar).toHaveBeenCalledOnce());
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("abre la cámara desde su botón", () => {
        render(<DrawerEditarPublicacion {...props} />);
        const entradaFoto = screen.getByLabelText("Seleccionar foto del producto");
        const abrirArchivos = vi.spyOn(entradaFoto, "click");

        fireEvent.click(screen.getByRole("button", { name: "Cámara" }));

        expect(abrirArchivos).toHaveBeenCalledOnce();
        expect(entradaFoto).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    });

    it("abre la galería sin forzar la cámara en mobile", () => {
        render(<DrawerEditarPublicacion {...props} />);
        const entradaGaleria = screen.getByLabelText("Seleccionar foto desde galería");
        const abrirGaleria = vi.spyOn(entradaGaleria, "click").mockImplementation(() => {});

        expect(entradaGaleria).not.toHaveAttribute("capture");
        fireEvent.click(screen.getByRole("button", { name: "Galería" }));
        expect(abrirGaleria).toHaveBeenCalledOnce();
    });

    it("acepta una fotografía de exactamente 10 MB", () => {
        render(<DrawerEditarPublicacion {...props} />);
        const foto = new File([new Uint8Array(10 * 1024 * 1024)], "foto.webp", { type: "image/webp" });

        fireEvent.change(screen.getByLabelText("Seleccionar foto desde galería"), { target: { files: [foto] } });
        expect(mocks.crearVistaPrevia).toHaveBeenCalledWith(foto);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it.each([
        { nombre: "un formato no admitido", foto: new File(["imagen"], "foto.gif", { type: "image/gif" }) },
        { nombre: "un archivo vacío", foto: new File([], "foto.png", { type: "image/png" }) },
        { nombre: "un archivo mayor a 10 MB", foto: new File([new Uint8Array(10 * 1024 * 1024 + 1)], "foto.webp", { type: "image/webp" }) },
    ])("rechaza $nombre sin reemplazar la foto existente", ({ foto }) => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, foto: "/foto-existente.png" }} />);
        seleccionarFoto(foto);

        expect(screen.getByRole("alert")).toHaveTextContent("Seleccioná una imagen JPEG, PNG o WebP de hasta 10 MB.");
        expect(screen.getByAltText("Foto de Manzana Red Delicious")).toHaveAttribute("src", expect.stringContaining("/foto-existente.png"));
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
        guardarDesdeBoton();
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
        guardarDesdeBoton();
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(15, expect.objectContaining({ foto: null }), null));
    });

    it("borra una foto existente sin crear ni revocar una URL temporal", async () => {
        render(<DrawerEditarPublicacion {...props} publicacion={{ ...publicacionInicial, foto: "/foto-existente.png" }} />);
        fireEvent.click(screen.getByRole("button", { name: "Borrar foto" }));
        guardarDesdeBoton();

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
    it("no llama a guardar cuando se presiona Guardar sin cambios", () => {
        render(<DrawerEditarPublicacion {...props} />);
        guardarDesdeBoton();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.cerrar).toHaveBeenCalledOnce();
    });
});
