import { useState } from "react";
import type { ImageProps } from "next/image";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TarjetaUploadFotoEspecie, { type Especie } from "./TarjetaUploadFotoEspecie";

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

function preparar(especieSeleccionada = "1", listado = especies, onGuardarFoto = vi.fn().mockResolvedValue(undefined), onEliminarFoto = vi.fn().mockResolvedValue(undefined)) {
    const props = {
        titulo: "Fotos de especies",
        especies: listado,
        especieSeleccionada,
        onChangeEspecie: vi.fn(),
        onGuardarFoto,
        onEliminarFoto,
    };

    return { ...render(<TarjetaUploadFotoEspecie {...props} />), props, onGuardarFoto, onEliminarFoto };
}

function botonGuardar() {
    return screen.getByRole("button", { name: "Guardar cambios" });
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

beforeEach(() => {
    let contador = 0;
    descriptorCrearUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    descriptorRevocarUrl = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

    Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: vi.fn(() => `blob:foto-${++contador}`) });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn() });
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();

    if (descriptorCrearUrl) {
        Object.defineProperty(URL, "createObjectURL", descriptorCrearUrl);
    } else {
        Reflect.deleteProperty(URL, "createObjectURL");
    }

    if (descriptorRevocarUrl) {
        Object.defineProperty(URL, "revokeObjectURL", descriptorRevocarUrl);
    } else {
        Reflect.deleteProperty(URL, "revokeObjectURL");
    }
});

describe("TarjetaUploadFotoEspecie", () => {
    it("muestra los textos, la especie y su foto actual", () => {
        preparar();
        expect(screen.getByText("Fotos de especies")).toBeInTheDocument();
        expect(screen.getByText("Seleccioná una especie para actualizar o quitar su foto.")).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "Especie" })).toHaveValue("Acelga");
        expect(screen.getByAltText("Foto de Acelga")).toHaveAttribute("src", "/acelga.webp");
        expect(screen.getByText("JPEG, PNG o WebP, hasta 10 MB.")).toBeInTheDocument();
        expect(botonGuardar()).toBeDisabled();
    });

    it("deshabilita las acciones cuando no hay especie seleccionada", () => {
        preparar("");
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Quitar foto" })).toBeDisabled();
        expect(botonGuardar()).toBeDisabled();
        expect(screen.getByText("Sin foto")).toBeInTheDocument();
    });

    it("permite cargar una foto para una especie que no tiene imagen", () => {
        preparar("2");
        expect(screen.getByText("Sin foto")).toBeInTheDocument();
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

    it("permite limpiar la selección", () => {
        const { props } = preparar();
        fireEvent.focus(screen.getByRole("combobox", { name: "Especie" }));
        fireEvent.click(screen.getByRole("button", { name: "Limpiar selección" }));
        expect(props.onChangeEspecie).toHaveBeenCalledExactlyOnceWith("");
    });

    it("abre el selector de archivos desde Cambiar foto", () => {
        const { container } = preparar();
        const abrir = vi.spyOn(entradaArchivo(container), "click");
        fireEvent.click(screen.getByRole("button", { name: "Cambiar foto" }));
        expect(abrir).toHaveBeenCalledOnce();
    });

    it.each(["image/jpeg", "image/png", "image/webp"])("acepta %s y muestra la preview sin guardar automáticamente", (tipo) => {
        const { container, onGuardarFoto } = preparar();
        const archivo = new File(["imagen"], "foto", { type: tipo });
        seleccionarArchivo(container, archivo);

        expect(screen.getByAltText("Vista previa de Acelga")).toHaveAttribute("src", "blob:foto-1");
        expect(botonGuardar()).toBeEnabled();
        expect(onGuardarFoto).not.toHaveBeenCalled();
    });

    it("rechaza un formato no permitido", async () => {
        const { container, onGuardarFoto } = preparar();
        seleccionarArchivo(container, new File(["imagen"], "foto.gif", { type: "image/gif" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("La imagen debe ser JPEG, PNG o WebP.");
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(onGuardarFoto).not.toHaveBeenCalled();
        expect(botonGuardar()).toBeDisabled();
    });

    it.each([0, 10 * 1024 * 1024 + 1])("rechaza un archivo de %s bytes", async (tamano) => {
        const { container } = preparar();
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        Object.defineProperty(archivo, "size", { value: tamano });
        seleccionarArchivo(container, archivo);

        expect(await screen.findByRole("alert")).toHaveTextContent("La imagen debe pesar entre 1 byte y 10 MB.");
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(botonGuardar()).toBeDisabled();
    });

    it("acepta un archivo de exactamente 10 MB", () => {
        const { container } = preparar();
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        Object.defineProperty(archivo, "size", { value: 10 * 1024 * 1024 });
        seleccionarArchivo(container, archivo);
        expect(botonGuardar()).toBeEnabled();
    });

    it("no modifica la foto cuando se cancela la selección del archivo", () => {
        const { container } = preparar();
        fireEvent.change(entradaArchivo(container), { target: { files: [] } });
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(botonGuardar()).toBeDisabled();
    });

    it("libera la preview anterior al elegir otro archivo", () => {
        const { container } = preparar();
        seleccionarArchivo(container, new File(["primera"], "primera.png", { type: "image/png" }));
        seleccionarArchivo(container, new File(["segunda"], "segunda.png", { type: "image/png" }));

        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:foto-1");
        expect(screen.getByAltText("Vista previa de Acelga")).toHaveAttribute("src", "blob:foto-2");
    });

    it("libera la preview al desmontar la tarjeta", () => {
        const { container, unmount } = preparar();
        seleccionarArchivo(container, new File(["imagen"], "foto.png", { type: "image/png" }));
        unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:foto-1");
    });

    it("guarda la foto y conserva la preview hasta que carga la imagen definitiva", async () => {
        const { container, rerender, props, onGuardarFoto } = preparar();
        const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
        seleccionarArchivo(container, archivo);
        fireEvent.click(botonGuardar());

        await waitFor(() => expect(onGuardarFoto).toHaveBeenCalledExactlyOnceWith(1, archivo));
        expect(await screen.findByRole("status")).toHaveTextContent("La foto de la especie se actualizó correctamente.");
        expect(screen.getByAltText("Vista previa de Acelga")).toBeInTheDocument();
        expect(botonGuardar()).toBeDisabled();

        const actualizadas = especies.map((especie) => especie.id === 1 ? { ...especie, fotoEspecie: "/acelga-nueva.webp" } : especie);
        rerender(<TarjetaUploadFotoEspecie {...props} especies={actualizadas} />);

        expect(screen.getByAltText("Vista previa de Acelga")).toBeInTheDocument();
        expect(screen.getByAltText("Foto de Acelga")).toHaveAttribute("src", "/acelga-nueva.webp");

        fireEvent.load(screen.getByAltText("Foto de Acelga"));

        await waitFor(() => expect(screen.queryByAltText("Vista previa de Acelga")).not.toBeInTheDocument());
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeEnabled();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:foto-1");
    });

    it("no retira la preview cuando termina de cargar la foto anterior", async () => {
        const { container } = preparar();
        seleccionarArchivo(container, new File(["imagen"], "foto.png", { type: "image/png" }));
        fireEvent.click(botonGuardar());

        await screen.findByRole("status");
        fireEvent.load(screen.getByAltText("Foto de Acelga"));

        expect(screen.getByAltText("Vista previa de Acelga")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeDisabled();
    });

    it("bloquea los controles durante el guardado", async () => {
        let finalizar!: () => void;
        const onGuardarFoto = vi.fn(() => new Promise<void>((resolve) => { finalizar = resolve; }));
        const { container } = preparar("1", especies, onGuardarFoto);

        seleccionarArchivo(container, new File(["imagen"], "foto.png", { type: "image/png" }));
        fireEvent.click(botonGuardar());

        expect(screen.getByRole("combobox", { name: "Especie" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Quitar foto" })).toBeDisabled();
        expect(entradaArchivo(container)).toBeDisabled();
        expect(botonGuardar()).toBeDisabled();

        fireEvent.click(botonGuardar());
        expect(onGuardarFoto).toHaveBeenCalledOnce();

        await act(async () => { finalizar(); });
    });

    it("conserva la preview y permite reintentar si falla el guardado", async () => {
        const onGuardarFoto = vi.fn().mockRejectedValue(new Error("Error de conexión"));
        const { container } = preparar("1", especies, onGuardarFoto);
        seleccionarArchivo(container, new File(["imagen"], "foto.png", { type: "image/png" }));
        fireEvent.click(botonGuardar());

        expect(await screen.findByRole("alert")).toHaveTextContent("Error de conexión");
        expect(screen.getByAltText("Vista previa de Acelga")).toBeInTheDocument();
        await waitFor(() => expect(botonGuardar()).toBeEnabled());
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeEnabled();
    });

    it("muestra un error genérico cuando el rechazo no es un Error", async () => {
        const { container } = preparar("1", especies, vi.fn().mockRejectedValue("fallo"));
        seleccionarArchivo(container, new File(["imagen"], "foto.png", { type: "image/png" }));
        fireEvent.click(botonGuardar());
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo actualizar la foto.");
    });

    it("solicita quitar la foto pero no la elimina hasta confirmar", async () => {
        const { onEliminarFoto } = preparar();
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));

        expect(screen.queryByAltText("Foto de Acelga")).not.toBeInTheDocument();
        expect(screen.getByText("Sin foto")).toBeInTheDocument();
        expect(botonGuardar()).toBeEnabled();
        expect(onEliminarFoto).not.toHaveBeenCalled();

        fireEvent.click(botonGuardar());

        await waitFor(() => expect(onEliminarFoto).toHaveBeenCalledExactlyOnceWith(1));
    });

    it("finaliza la eliminación cuando el servidor confirma que no hay foto", async () => {
        const { rerender, props } = preparar();
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        fireEvent.click(botonGuardar());
        await screen.findByRole("status");

        const actualizadas = especies.map((especie) => especie.id === 1 ? { ...especie, fotoEspecie: null } : especie);
        rerender(<TarjetaUploadFotoEspecie {...props} especies={actualizadas} />);

        await waitFor(() => expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeEnabled());
        expect(screen.getByRole("button", { name: "Quitar foto" })).toBeDisabled();
        expect(botonGuardar()).toBeDisabled();
        expect(screen.getByText("Sin foto")).toBeInTheDocument();
    });

    it("permite reintentar si falla la eliminación", async () => {
        const onEliminarFoto = vi.fn().mockRejectedValue(new Error("No se pudo eliminar"));
        preparar("1", especies, vi.fn(), onEliminarFoto);
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        fireEvent.click(botonGuardar());

        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo eliminar");
        await waitFor(() => expect(botonGuardar()).toBeEnabled());
    });

    it("quitar una preview de una especie sin foto cancela la carga pendiente", () => {
        const { container, onEliminarFoto, onGuardarFoto } = preparar("2");
        seleccionarArchivo(container, new File(["imagen"], "foto.png", { type: "image/png" }));
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));

        expect(screen.queryByAltText("Vista previa de Ají")).not.toBeInTheDocument();
        expect(botonGuardar()).toBeDisabled();
        expect(onEliminarFoto).not.toHaveBeenCalled();
        expect(onGuardarFoto).not.toHaveBeenCalled();
    });

    it("elegir un archivo cancela la eliminación pendiente", () => {
        const { container } = preparar();
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        seleccionarArchivo(container, new File(["imagen"], "foto.png", { type: "image/png" }));

        expect(screen.getByAltText("Vista previa de Acelga")).toBeInTheDocument();
        expect(screen.getByAltText("Foto de Acelga")).toBeInTheDocument();
        expect(botonGuardar()).toBeEnabled();
    });

    it("descarta la preview al seleccionar otra especie", async () => {
        function ComponentePrueba() {
            const [seleccionada, setSeleccionada] = useState("1");
            return <TarjetaUploadFotoEspecie titulo="Fotos de especies" especies={especies} especieSeleccionada={seleccionada} onChangeEspecie={setSeleccionada} onGuardarFoto={vi.fn()} onEliminarFoto={vi.fn()} />;
        }

        const { container } = render(<ComponentePrueba />);
        seleccionarArchivo(container, new File(["imagen"], "foto.png", { type: "image/png" }));

        fireEvent.focus(screen.getByRole("combobox", { name: "Especie" }));
        fireEvent.click(screen.getByRole("button", { name: "Abrir opciones" }));
        fireEvent.click(await screen.findByRole("option", { name: "Tomate" }));

        expect(screen.getByRole("combobox", { name: "Especie" })).toHaveValue("Tomate");
        expect(screen.queryByAltText("Vista previa de Acelga")).not.toBeInTheDocument();
        expect(botonGuardar()).toBeDisabled();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:foto-1");
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
        const { container } = preparar();
        seleccionarArchivo(container, new File(["imagen"], "foto.png", { type: "image/png" }));
        fireEvent.click(screen.getByRole("button", { name: "Ampliar foto de Acelga" }));

        const dialogo = await screen.findByRole("dialog", { name: "Foto ampliada de especie" });
        expect(within(dialogo).getByAltText("Foto ampliada de Acelga")).toHaveAttribute("src", "blob:foto-1");
    });
});