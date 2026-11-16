import { StrictMode, useState } from "react";
import type { ImageProps } from "next/image";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TarjetaUploadFotoEspecie, { type Especie } from "./TarjetaUploadFotoEspecie";

const mocks = vi.hoisted(() => ({ notificar: vi.fn() }));

vi.mock("@/compartido/componentes/NotificacionToast", () => ({
    useNotificacionToast: () => ({ notificar: mocks.notificar }),
}));

vi.mock("next/image", () => ({
    default: ({ src, alt, onLoad, onError, style, className }: ImageProps) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={typeof src === "string" ? src : "/imagen.jpg"} alt={alt} onLoad={onLoad} onError={onError} style={style} className={className} />
    ),
}));

const especies: Especie[] = [
    { id: 1, nombreEspecie: "Acelga", fotoEspecie: "/acelga.webp" },
    { id: 2, nombreEspecie: "Ají", fotoEspecie: null },
    { id: 3, nombreEspecie: "Tomate", fotoEspecie: "/tomate.webp" },
];

let descriptorCrearUrl: PropertyDescriptor | undefined;
let descriptorRevocarUrl: PropertyDescriptor | undefined;

function preparar(especieSeleccionada = "1", cambios: Record<number, File | null> = {}) {
    const props = {
        titulo: "Fotos de especies", especies, especieSeleccionada, cambios,
        onChangeEspecie: vi.fn(), onChangeFoto: vi.fn(),
    };
    return { ...render(<TarjetaUploadFotoEspecie {...props} />), props };
}

function entradaArchivo(contenedor: HTMLElement): HTMLInputElement {
    const entrada = contenedor.querySelector<HTMLInputElement>('input[type="file"]');
    if (!entrada) throw new Error("No se encontró el input de archivo");
    return entrada;
}

function seleccionarArchivo(contenedor: HTMLElement, archivo: File) {
    fireEvent.change(entradaArchivo(contenedor), { target: { files: [archivo] } });
}

function buscarEspecie(texto: string) {
    const buscador = screen.getByRole("combobox", { name: "Especie" });
    fireEvent.focus(buscador);
    fireEvent.change(buscador, { target: { value: texto } });
}

function seccionImagen(container: HTMLElement) {
    return container.querySelector("[data-modificado]");
}

beforeEach(() => {
    vi.clearAllMocks();
    let contador = 0;
    descriptorCrearUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    descriptorRevocarUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: vi.fn(() => `blob:foto-${++contador}`) });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn() });
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    if (descriptorCrearUrl) Object.defineProperty(URL, "createObjectURL", descriptorCrearUrl);
    else Reflect.deleteProperty(URL, "createObjectURL");
    if (descriptorRevocarUrl) Object.defineProperty(URL, "revokeObjectURL", descriptorRevocarUrl);
    else Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("TarjetaUploadFotoEspecie", () => {
    it("muestra la especie y su foto sin formulario ni guardado propio", () => {
        const { container } = preparar();
        expect(screen.getByText("Fotos de especies")).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "Especie" })).toHaveValue("Acelga");
        expect(screen.getByAltText("Foto de Acelga")).toHaveAttribute("src", "/acelga.webp");
        expect(screen.getByText("JPEG, PNG o WebP, hasta 10 MB.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
        expect(container.querySelector("form")).toBeNull();
        expect(seccionImagen(container)).toHaveAttribute("data-modificado", "false");
    });

    it("deshabilita las acciones cuando no hay especie seleccionada", () => {
        const { container } = preparar("");
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Quitar foto" })).toBeDisabled();
        expect(entradaArchivo(container)).toBeDisabled();
        expect(screen.getByText("Sin foto disponible")).toBeInTheDocument();
    });

    it("permite cargar una foto para una especie que no tiene imagen", () => {
        preparar("2");
        expect(screen.getByText("Sin foto disponible")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Quitar foto" })).toBeDisabled();
    });

    it("filtra especies ignorando mayúsculas y tildes", async () => {
        preparar("");
        buscarEspecie("AJI");
        expect(await screen.findByRole("option", { name: "Ají" })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Acelga" })).not.toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Tomate" })).not.toBeInTheDocument();
    });

    it("informa cuando la búsqueda no tiene coincidencias", async () => {
        preparar("");
        buscarEspecie("inexistente");
        expect(await screen.findByText("No se encontraron especies")).toBeInTheDocument();
    });

    it("notifica al padre la especie seleccionada", async () => {
        const { props } = preparar("");
        buscarEspecie("Tom");
        fireEvent.click(await screen.findByRole("option", { name: "Tomate" }));
        expect(props.onChangeEspecie).toHaveBeenCalledExactlyOnceWith("3");
    });

    it("permite limpiar la selección sin quitar borradores", () => {
        const { props } = preparar();
        fireEvent.focus(screen.getByRole("combobox", { name: "Especie" }));
        fireEvent.click(screen.getByRole("button", { name: "Limpiar selección" }));
        expect(props.onChangeEspecie).toHaveBeenCalledExactlyOnceWith("");
        expect(props.onChangeFoto).not.toHaveBeenCalled();
    });

    it("abre el selector de archivos desde Cambiar foto", () => {
        const { container } = preparar();
        const abrir = vi.spyOn(entradaArchivo(container), "click");
        fireEvent.click(screen.getByRole("button", { name: "Cambiar foto" }));
        expect(abrir).toHaveBeenCalledOnce();
    });

    it.each(["image/jpeg", "image/png", "image/webp"])("acepta %s y muestra el borrador que devuelve el padre", (tipo) => {
        const { container, props, rerender } = preparar();
        const archivo = new File(["imagen"], "foto", { type: tipo });
        seleccionarArchivo(container, archivo);
        expect(props.onChangeFoto).toHaveBeenCalledExactlyOnceWith(1, archivo);
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        rerender(<TarjetaUploadFotoEspecie {...props} cambios={{ 1: archivo }} />);
        expect(screen.getByAltText("Vista previa de Acelga")).toHaveAttribute("src", "blob:foto-1");
        expect(seccionImagen(container)).toHaveAttribute("data-modificado", "true");
    });

    it("rechaza un formato no permitido", async () => {
        const { container, props } = preparar();
        seleccionarArchivo(container, new File(["imagen"], "foto.gif", { type: "image/gif" }));
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledExactlyOnceWith("La imagen debe ser JPEG, PNG o WebP.", "error"));
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(props.onChangeFoto).not.toHaveBeenCalled();
    });

    it.each([0, 10 * 1024 * 1024 + 1])("rechaza un archivo de %s bytes", async (tamano) => {
        const { container, props } = preparar();
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        Object.defineProperty(archivo, "size", { value: tamano });
        seleccionarArchivo(container, archivo);
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledExactlyOnceWith("La imagen debe pesar menos de 10 MB.", "error"));
        expect(props.onChangeFoto).not.toHaveBeenCalled();
    });

    it("acepta un archivo de exactamente 10 MB", () => {
        const { container, props } = preparar();
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        Object.defineProperty(archivo, "size", { value: 10 * 1024 * 1024 });
        seleccionarArchivo(container, archivo);
        expect(props.onChangeFoto).toHaveBeenCalledExactlyOnceWith(1, archivo);
    });

    it("no modifica la foto cuando se cancela la selección del archivo", () => {
        const { container, props } = preparar();
        fireEvent.change(entradaArchivo(container), { target: { files: [] } });
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(props.onChangeFoto).not.toHaveBeenCalled();
    });

    it("libera la preview anterior al cambiar de archivo y al desmontar", () => {
        const primera = new File(["primera"], "primera.png", { type: "image/png" });
        const segunda = new File(["segunda"], "segunda.png", { type: "image/png" });
        const { props, rerender, unmount } = preparar("1", { 1: primera });
        rerender(<TarjetaUploadFotoEspecie {...props} cambios={{ 1: segunda }} />);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:foto-1");
        expect(screen.getByAltText("Vista previa de Acelga")).toHaveAttribute("src", "blob:foto-2");
        unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:foto-2");
    });

    it("mantiene una URL válida en StrictMode y libera todas las creadas al desmontar", () => {
        const urlsCreadas: string[] = [];
        vi.mocked(URL.createObjectURL).mockImplementation(() => {
            const url = `blob:estricto-${urlsCreadas.length + 1}`;
            urlsCreadas.push(url);
            return url;
        });
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        const { unmount } = render(
            <StrictMode>
                <TarjetaUploadFotoEspecie titulo="Fotos de especies" especies={especies} especieSeleccionada="1"
                    cambios={{ 1: archivo }} onChangeEspecie={vi.fn()} onChangeFoto={vi.fn()} />
            </StrictMode>,
        );
        const urlVisible = screen.getByAltText("Vista previa de Acelga").getAttribute("src");
        expect(urlsCreadas).toContain(urlVisible);
        expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(urlVisible);

        unmount();

        expect(vi.mocked(URL.revokeObjectURL).mock.calls.map(([url]) => url).sort()).toEqual([...urlsCreadas].sort());
    });

    it("conserva la preview confirmada sin marca pendiente mientras llega la foto del servidor", () => {
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        const { container, props, rerender } = preparar("1", { 1: archivo });
        rerender(<TarjetaUploadFotoEspecie {...props} cambios={{}} confirmadas={{ 1: archivo }} />);
        expect(screen.getByAltText("Vista previa de Acelga")).toHaveAttribute("src", "blob:foto-1");
        expect(seccionImagen(container)).toHaveAttribute("data-modificado", "false");
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeEnabled();
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
        const actualizadas = especies.map((especie) => especie.id === 1 ? { ...especie, fotoEspecie: "/acelga-nueva.webp" } : especie);
        rerender(<TarjetaUploadFotoEspecie {...props} especies={actualizadas} cambios={{}} />);
        expect(screen.queryByAltText("Vista previa de Acelga")).not.toBeInTheDocument();
        expect(screen.getByAltText("Foto de Acelga")).toHaveAttribute("src", "/acelga-nueva.webp");
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:foto-1");
    });

    it("restaura la foto del servidor y libera el borrador cuando el padre cancela", () => {
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        const { container, props, rerender } = preparar("1", { 1: archivo });
        rerender(<TarjetaUploadFotoEspecie {...props} cambios={{}} />);
        expect(screen.queryByAltText("Vista previa de Acelga")).not.toBeInTheDocument();
        expect(screen.getByAltText("Foto de Acelga")).toHaveAttribute("src", "/acelga.webp");
        expect(seccionImagen(container)).toHaveAttribute("data-modificado", "false");
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:foto-1");
    });

    it("bloquea los controles durante el guardado global", () => {
        const { container, props, rerender } = preparar();
        rerender(<TarjetaUploadFotoEspecie {...props} guardando />);
        expect(screen.getByRole("combobox", { name: "Especie" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Quitar foto" })).toBeDisabled();
        expect(entradaArchivo(container)).toBeDisabled();
        seleccionarArchivo(container, new File(["imagen"], "foto.png", { type: "image/png" }));
        expect(props.onChangeFoto).not.toHaveBeenCalled();
    });

    it("solicita al padre la eliminación y muestra el borrador sin eliminar por su cuenta", () => {
        const { container, props, rerender } = preparar();
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        expect(props.onChangeFoto).toHaveBeenCalledExactlyOnceWith(1, null);
        expect(screen.getByAltText("Foto de Acelga")).toBeInTheDocument();
        rerender(<TarjetaUploadFotoEspecie {...props} cambios={{ 1: null }} />);
        expect(screen.queryByAltText("Foto de Acelga")).not.toBeInTheDocument();
        expect(screen.getByText("Sin foto disponible")).toBeInTheDocument();
        expect(seccionImagen(container)).toHaveAttribute("data-modificado", "true");
    });

    it("mantiene oculta una eliminación confirmada hasta que llegan los datos nuevos", () => {
        const { container, props, rerender } = preparar();
        rerender(<TarjetaUploadFotoEspecie {...props} confirmadas={{ 1: null }} />);
        expect(screen.queryByAltText("Foto de Acelga")).not.toBeInTheDocument();
        expect(screen.getByText("Sin foto disponible")).toBeInTheDocument();
        expect(seccionImagen(container)).toHaveAttribute("data-modificado", "false");
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeEnabled();
    });

    it("quitar una preview sin foto previa solicita descartar el borrador", () => {
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        const { props } = preparar("2", { 2: archivo });
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        expect(props.onChangeFoto).toHaveBeenCalledExactlyOnceWith(2, undefined);
    });

    it("quitar una foto recién confirmada solicita eliminarla aunque las props sigan sin foto", () => {
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        const { props, rerender } = preparar("2");
        rerender(<TarjetaUploadFotoEspecie {...props} confirmadas={{ 2: archivo }} />);
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        expect(props.onChangeFoto).toHaveBeenCalledExactlyOnceWith(2, null);
    });

    it("elegir un archivo reemplaza la eliminación pendiente", () => {
        const { container, props, rerender } = preparar("1", { 1: null });
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        seleccionarArchivo(container, archivo);
        expect(props.onChangeFoto).toHaveBeenCalledExactlyOnceWith(1, archivo);
        rerender(<TarjetaUploadFotoEspecie {...props} cambios={{ 1: archivo }} />);
        expect(screen.getByAltText("Vista previa de Acelga")).toBeInTheDocument();
    });

    it("conserva los borradores de cada especie al cambiar la selección", async () => {
        function ComponentePrueba() {
            const [seleccionada, setSeleccionada] = useState("1");
            const [cambios, setCambios] = useState<Record<number, File | null>>({});
            return <TarjetaUploadFotoEspecie titulo="Fotos de especies" especies={especies} especieSeleccionada={seleccionada} onChangeEspecie={setSeleccionada}
                cambios={cambios} onChangeFoto={(id, archivo) => setCambios((anteriores) => {
                    const siguientes = { ...anteriores };
                    if (archivo === undefined) delete siguientes[id];
                    else siguientes[id] = archivo;
                    return siguientes;
                })} />;
        }
        const { container } = render(<ComponentePrueba />);
        seleccionarArchivo(container, new File(["imagen"], "foto.png", { type: "image/png" }));
        buscarEspecie("Tom");
        fireEvent.click(await screen.findByRole("option", { name: "Tomate" }));
        expect(screen.queryByAltText("Vista previa de Acelga")).not.toBeInTheDocument();
        expect(seccionImagen(container)).toHaveAttribute("data-modificado", "false");
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        expect(seccionImagen(container)).toHaveAttribute("data-modificado", "true");
        buscarEspecie("Ace");
        fireEvent.click(await screen.findByRole("option", { name: "Acelga" }));
        expect(screen.getByAltText("Vista previa de Acelga")).toBeInTheDocument();
        expect(seccionImagen(container)).toHaveAttribute("data-modificado", "true");
        buscarEspecie("Tom");
        fireEvent.click(await screen.findByRole("option", { name: "Tomate" }));
        expect(screen.queryByAltText("Foto de Tomate")).not.toBeInTheDocument();
        expect(seccionImagen(container)).toHaveAttribute("data-modificado", "true");
    });

    it("abre y cierra el visor ampliado de la foto", async () => {
        preparar();
        fireEvent.click(screen.getByRole("button", { name: "Ampliar foto de Acelga" }));
        const dialogo = await screen.findByRole("dialog", { name: "Foto ampliada de especie" });
        expect(within(dialogo).getByAltText("Foto ampliada de Acelga")).toHaveAttribute("src", "/acelga.webp");
        fireEvent.click(within(dialogo).getByRole("button", { name: "Cerrar foto ampliada" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("amplía la preview cuando hay un archivo pendiente", async () => {
        preparar("1", { 1: new File(["imagen"], "foto.png", { type: "image/png" }) });
        fireEvent.click(screen.getByRole("button", { name: "Ampliar foto de Acelga" }));
        const dialogo = await screen.findByRole("dialog", { name: "Foto ampliada de especie" });
        expect(within(dialogo).getByAltText("Foto ampliada de Acelga")).toHaveAttribute("src", "blob:foto-1");
    });
});
