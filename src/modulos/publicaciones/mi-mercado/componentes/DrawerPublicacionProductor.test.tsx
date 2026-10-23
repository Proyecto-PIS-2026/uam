import type { SwipeableDrawerProps } from "@mui/material/SwipeableDrawer";
import type { DrawerProps } from "@mui/material/Drawer";
import type { DialogProps } from "@mui/material/Dialog";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpcionesEdicionPublicacion } from "../../operadores/consultas-edicion-publicacion";
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import DrawerPublicacionProductor from "./DrawerPublicacionProductor";

const mocks = vi.hoisted(() => ({
    mediaQuery: vi.fn(),
    fetch: vi.fn(),
    cerrar: vi.fn(),
    guardar: vi.fn(),
    eliminada: vi.fn(),
    crearVistaPrevia: vi.fn(),
    borrarVistaPrevia: vi.fn(),
}));

vi.mock("@mui/material/useMediaQuery", () => ({ default: mocks.mediaQuery }));
vi.mock("@mui/material/SwipeableDrawer", () => ({
    default: ({ anchor, open, children, onClose }: SwipeableDrawerProps) => <section role="dialog" aria-label="Detalle de publicación" data-anchor={anchor} hidden={!open} onTouchEnd={onClose} onKeyDown={(evento) => { if (evento.key === "Escape") onClose?.(evento); }}>{children}</section>,
}));
vi.mock("@mui/material/Drawer", () => ({
    default: ({ anchor, open, children, onClose, slotProps }: DrawerProps) => {
        const papel = slotProps?.paper as { "aria-label"?: string } | undefined;
        return open ? <section role="dialog" aria-label={papel?.["aria-label"]} data-anchor={anchor}>
            {children}
            <button type="button" aria-label="Cerrar edición desde fondo" onClick={(evento) => onClose?.(evento, "backdropClick")} />
        </section> : null;
    },
}));
vi.mock("@mui/material/Dialog", () => ({
    default: ({ open, children, "aria-label": etiqueta }: DialogProps) => open ? <section role="dialog" aria-label={etiqueta}>{children}</section> : null,
}));
vi.mock("../../componentes/drawer-publicacion/TextoAjustable", () => ({
    default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("../../../../compartido/componentes/ConfirmModal", () => ({
    ConfirmModal: ({ abierto, descripcion, textoConfirmar, procesando, alConfirmar, alCancelar }: {
        abierto: boolean; descripcion: string; textoConfirmar: string; procesando: boolean;
        alConfirmar: () => void; alCancelar: () => void;
    }) => <dialog open={abierto} role="alertdialog" aria-label="Confirmar baja">
        <p>{descripcion}</p>
        <button type="button" disabled={procesando} onClick={alCancelar}>Cancelar baja</button>
        <button type="button" disabled={procesando} onClick={alConfirmar}>{procesando ? "Eliminando..." : textoConfirmar}</button>
    </dialog>,
}));
vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({ src, alt, onLoad, onError }: {
            src: string;
            alt: string;
            onLoad?: React.ReactEventHandler<HTMLImageElement>;
            onError?: React.ReactEventHandler<HTMLImageElement>;
        }) => createElement("img", { src, alt, onLoad, onError }),
    };
});

const publicacion: PublicacionMiMercadoProductor = {
    id: 42,
    publicacionProductorId: 1042,
    paisId: 1,
    pais: "Uruguay",
    foto: null,
    precio: "100.00",
    fecha: "2026-10-16T14:00:00.000Z",
    publicacionActiva: true,
    publicacionDisponible: true,
    cantidadUnidades: 12,
    presentacion: {
        id: 111,
        nombrePresentacion: "Cajón",
        variedad: {
            id: 11,
            nombreVariedad: "Williams",
            especie: { id: 1, nombreEspecie: "Pera", fotoEspecie: null },
        },
    },
    categoria: { id: 3, nombreCategoria: "Primera" },
    calibre: { id: 4, codigoCalibre: "G", nombreCalibre: "Grande" },
    ubicaciones: [{ id: 21, nombreUbicacion: "Quinta", urlMaps: "https://maps.google.com/?q=Salto" }],
};

const opciones: OpcionesEdicionPublicacion = {
    especies: [{ id: 1, nombre: "Pera" }, { id: 2, nombre: "Manzana" }],
    variedades: [{ id: 11, nombre: "Williams", especieId: 1 }, { id: 21, nombre: "Red", especieId: 2 }],
    presentaciones: [
        { id: 111, nombre: "Cajón", variedadId: 11 },
        { id: 112, nombre: "Bolsa", variedadId: 11 },
        { id: 211, nombre: "Bandeja de manzanas", variedadId: 21 },
    ],
    categorias: [
        { id: 3, nombre: "Primera", especieId: 1 },
        { id: 5, nombre: "Segunda", especieId: 1 },
        { id: 6, nombre: "General", especieId: null },
        { id: 7, nombre: "Manzanas especiales", especieId: 2 },
    ],
    calibres: [{ id: 4, nombre: "G - Grande" }, { id: 8, nombre: "M - Mediano" }],
    paises: [{ id: 1, nombre: "Uruguay" }],
};

function respuesta(datos: object, ok = true, status = ok ? 200 : 400) {
    return { ok, status, json: async () => datos };
}

function mostrar(publicacionInicial = publicacion) {
    return render(<DrawerPublicacionProductor publicacion={publicacionInicial} alCerrar={mocks.cerrar} alGuardar={mocks.guardar} alEliminada={mocks.eliminada} />);
}

async function editar() {
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    return screen.findByLabelText("Precio en pesos");
}

async function seleccionar(campo: string, opcion: string) {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: new RegExp(`^${campo}`) }));
    fireEvent.click(await screen.findByRole("option", { name: opcion }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

function editarUbicaciones() {
    fireEvent.click(screen.getByRole("button", { name: /^(Cambiar ubicación|Seleccionar ubicación de retiro)$/ }));
}

function solicitudGuardado() {
    const llamada = mocks.fetch.mock.calls.find(([, configuracion]) => configuracion?.method === "PATCH");
    expect(llamada).toBeDefined();
    const datos = llamada![1].body as FormData;
    expect(datos).toBeInstanceOf(FormData);
    return { url: llamada![0], datos, cambios: JSON.parse(datos.get("cambios") as string) };
}

describe("DrawerPublicacionProductor: edición", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mediaQuery.mockReturnValue(true);
        mocks.fetch.mockReset().mockResolvedValue(respuesta({ opciones }));
        mocks.crearVistaPrevia.mockReset().mockReturnValue("blob:foto-productor");
        class UrlConVistaPrevia extends URL {
            static createObjectURL = mocks.crearVistaPrevia;
            static revokeObjectURL = mocks.borrarVistaPrevia;
        }
        vi.stubGlobal("URL", UrlConVistaPrevia);
        vi.stubGlobal("fetch", mocks.fetch);
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("abre un drawer de edición separado con los datos precargados y no guarda al cambiar campos", async () => {
        mostrar();
        const detalle = screen.getByRole("dialog", { name: "Detalle de publicación" });
        expect(within(detalle).getByText("$100")).toBeInTheDocument();
        expect(within(detalle).queryByRole("textbox")).not.toBeInTheDocument();
        expect(mocks.fetch).not.toHaveBeenCalled();

        const precio = await editar();

        const edicion = screen.getByRole("dialog", { name: "Editar publicación de Productor" });
        expect(screen.getAllByRole("dialog")).toEqual([edicion]);
        expect(screen.queryByRole("dialog", { name: "Detalle de publicación" })).not.toBeInTheDocument();
        expect(precio).toHaveValue("100");
        expect(screen.getByRole("combobox", { name: /^Presentación/ })).toHaveTextContent("Cajón");
        expect(screen.getByRole("combobox", { name: /^Categoría/ })).toHaveTextContent("Primera");
        expect(screen.getByRole("combobox", { name: /^Calibre/ })).toHaveTextContent("G - Grande");
        for (const [campo, valor] of [["Especie", "Pera"], ["Variedad", "Williams"], ["País de origen", "Uruguay"]]) {
            const selector = screen.getByRole("combobox", { name: new RegExp(`^${campo}`) });
            expect(selector).toHaveTextContent(valor);
            expect(selector).toHaveAttribute("aria-disabled", "true");
        }
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBeChecked();
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBeDisabled();
        expect(screen.getByLabelText("Cantidad (Cajón)")).toHaveValue("12");
        expect(screen.getByLabelText("Cantidad (Cajón)")).toBeDisabled();
        expect(screen.queryByLabelText("Nombre del punto de retiro 1")).not.toBeInTheDocument();
        editarUbicaciones();
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Quinta");
        expect(screen.getByLabelText("Enlace de Google Maps 1")).toHaveValue("https://maps.google.com/?q=Salto");
        fireEvent.change(precio, { target: { value: "250" } });
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        expect(mocks.fetch.mock.calls[0][0]).toBe("/api/publicaciones/productor/1042");
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
    });

    it("guarda únicamente la publicación seleccionada y vuelve a consulta con los datos del servidor", async () => {
        const actualizada = {
            ...publicacion,
            precio: "250",
            fecha: "2026-10-21T15:00:00.000Z",
            presentacion: { ...publicacion.presentacion, id: 112, nombrePresentacion: "Bolsa" },
            categoria: { id: 5, nombreCategoria: "Segunda" },
            calibre: { id: 8, codigoCalibre: "M", nombreCalibre: "Mediano" },
            ubicaciones: [{ id: 30, nombreUbicacion: "Nuevo retiro", urlMaps: "https://maps.app.goo.gl/retiro" }],
        };
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion: actualizada }));
        mostrar();
        fireEvent.change(await editar(), { target: { value: "250" } });
        await seleccionar("Presentación", "Bolsa");
        await seleccionar("Categoría", "Segunda");
        await seleccionar("Calibre", "M - Mediano");
        editarUbicaciones();
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 1"), { target: { value: "Nuevo retiro" } });
        fireEvent.change(screen.getByLabelText("Enlace de Google Maps 1"), { target: { value: "https://maps.app.goo.gl/retiro" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(actualizada));
        const { url, datos, cambios } = solicitudGuardado();
        expect(url).toBe("/api/publicaciones/productor/1042");
        expect(cambios).toEqual({
            precio: "250", foto: null, presentacionId: 112, categoriaId: 5, calibreId: 8,
            ubicaciones: [{ nombreUbicacion: "Nuevo retiro", urlMaps: "https://maps.app.goo.gl/retiro" }],
        });
        expect(datos.has("foto")).toBe(false);
        expect(screen.getAllByRole("dialog")).toEqual([screen.getByRole("dialog", { name: "Detalle de publicación" })]);
        expect(screen.queryByRole("dialog", { name: "Editar publicación de Productor" })).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Precio en pesos")).not.toBeInTheDocument();
        expect(screen.getByText("$250")).toBeInTheDocument();
        expect(screen.getByText("21/10/2026")).toHaveAttribute("dateTime", actualizada.fecha);
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(await editar()).toHaveValue("250");
        expect(screen.getByRole("combobox", { name: /^Presentación/ })).toHaveTextContent("Bolsa");
    });

    it.each(["Cancelar", "Cerrar edición", "Cerrar edición desde fondo"])("descarta el borrador con %s y restaura los datos guardados al reabrir", async (accion) => {
        mostrar();
        fireEvent.change(await editar(), { target: { value: "999" } });
        await seleccionar("Presentación", "Bolsa");
        editarUbicaciones();
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 1"), { target: { value: "No guardar" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.click(screen.getByRole("button", { name: accion }));

        expect(screen.getByText("$100")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Quinta" })).toBeInTheDocument();
        expect(mocks.fetch.mock.calls.some(([, config]) => config?.method === "PATCH")).toBe(false);
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(await editar()).toHaveValue("100");
        expect(screen.getByRole("combobox", { name: /^Presentación/ })).toHaveTextContent("Cajón");
        editarUbicaciones();
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Quinta");
        expect(screen.queryByLabelText("Nombre del punto de retiro 2")).not.toBeInTheDocument();
    });

    it.each(["12.5", "12,5", "-10", "1e3", "abc"])("rechaza la entrada de precio no entero %s", async (valor) => {
        mostrar();
        const precio = await editar();
        fireEvent.change(precio, { target: { value: valor } });
        expect(precio).toHaveValue("100");
        fireEvent.change(precio, { target: { value: "0" } });
        expect(precio).toHaveValue("0");
    });

    it("conserva el borrador cuando falla el guardado y permite reintentar", async () => {
        const actualizada = { ...publicacion, precio: "300" };
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones }))
            .mockResolvedValueOnce(respuesta({ errores: ["No se pudo guardar la publicación."] }, false))
            .mockResolvedValueOnce(respuesta({ publicacion: actualizada }));
        mostrar();
        fireEvent.change(await editar(), { target: { value: "300" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la publicación.");
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("300");
        expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(actualizada));
    });

    it("agrega y elimina puntos de retiro en el borrador antes de guardarlos", async () => {
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion }));
        mostrar();
        await editar();
        editarUbicaciones();
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 2"), { target: { value: "Depósito" } });
        fireEvent.change(screen.getByLabelText("Enlace de Google Maps 2"), { target: { value: "https://maps.google.com/?q=Montevideo" } });
        fireEvent.click(screen.getByRole("button", { name: "Eliminar punto de retiro 1" }));
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Depósito");
        expect(screen.queryByLabelText("Nombre del punto de retiro 2")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalled());
        expect(solicitudGuardado().cambios.ubicaciones).toEqual([{ nombreUbicacion: "Depósito", urlMaps: "https://maps.google.com/?q=Montevideo" }]);
    });

    it("muestra el error de carga de opciones y conserva la consulta para reintentar", async () => {
        mocks.fetch.mockResolvedValueOnce(respuesta({ errores: ["No se pudieron cargar las opciones."] }, false))
            .mockResolvedValueOnce(respuesta({ opciones }));
        mostrar();
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las opciones.");
        expect(screen.queryByLabelText("Precio en pesos")).not.toBeInTheDocument();
        expect(screen.getByText("$100")).toBeInTheDocument();
        expect(await editar()).toHaveValue("100");
    });

    it("no abre la edición si la consulta se cierra mientras carga las opciones", async () => {
        let resolver!: (valor: ReturnType<typeof respuesta>) => void;
        mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
        const { rerender } = mostrar();
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.click(screen.getByRole("button", { name: "Cerrar consulta" }));
        rerender(<DrawerPublicacionProductor publicacion={null} alCerrar={mocks.cerrar} alGuardar={mocks.guardar} />);

        await act(async () => resolver(respuesta({ opciones })));

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(mocks.guardar).not.toHaveBeenCalled();
        rerender(<DrawerPublicacionProductor publicacion={publicacion} alCerrar={mocks.cerrar} alGuardar={mocks.guardar} />);
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
        expect(screen.queryByLabelText("Precio en pesos")).not.toBeInTheDocument();
    });

    it("permite editar datos nuevos del mismo id durante una carga pendiente e ignora la respuesta anterior", async () => {
        let resolverAnterior!: (valor: ReturnType<typeof respuesta>) => void;
        mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { resolverAnterior = resolve; }))
            .mockResolvedValueOnce(respuesta({ opciones }));
        const { rerender } = mostrar();
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        const actualizada = { ...publicacion, precio: "175" };

        rerender(<DrawerPublicacionProductor publicacion={actualizada} alCerrar={mocks.cerrar} alGuardar={mocks.guardar} />);

        expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
        const precio = await editar();
        expect(precio).toHaveValue("175");
        fireEvent.change(precio, { target: { value: "250" } });
        await act(async () => resolverAnterior(respuesta({ opciones })));

        expect(screen.getByRole("dialog", { name: "Editar publicación de Productor" })).toBeInTheDocument();
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("250");
        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("bloquea cambios, cierre y envíos duplicados mientras guarda", async () => {
        let resolver!: (valor: ReturnType<typeof respuesta>) => void;
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones }))
            .mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
        mostrar();
        fireEvent.change(await editar(), { target: { value: "150" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        const guardando = screen.getByRole("button", { name: "Guardando..." });
        expect(guardando).toBeDisabled();
        expect(screen.getByLabelText("Precio en pesos")).toBeDisabled();
        expect(screen.getByRole("combobox", { name: /^Presentación/ })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByLabelText("Fotografía")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cerrar edición" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Cerrar edición desde fondo" }));
        fireEvent.submit(guardando.closest("form")!);
        expect(screen.getByRole("dialog", { name: "Editar publicación de Productor" })).toBeInTheDocument();
        expect(mocks.fetch.mock.calls.filter(([, config]) => config?.method === "PATCH")).toHaveLength(1);
        expect(mocks.cerrar).not.toHaveBeenCalled();

        await act(async () => resolver(respuesta({ publicacion: { ...publicacion, precio: "150" } })));

        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
        expect(screen.getByText("$150")).toBeInTheDocument();
    });

    it.each([false, true])("ofrece archivo en web y archivo o cámara en móvil (esWeb=%s)", async (esWeb) => {
        mocks.mediaQuery.mockReturnValue(esWeb);
        mostrar();
        await editar();
        expect(screen.getByRole("dialog", { name: "Editar publicación de Productor" })).toHaveAttribute("data-anchor", esWeb ? "right" : "bottom");
        const archivo = screen.getByLabelText("Fotografía");
        const abrirArchivo = vi.spyOn(archivo, "click").mockImplementation(() => {});
        expect(archivo).toHaveAttribute("type", "file");
        expect(archivo).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
        fireEvent.click(screen.getByRole("button", { name: esWeb ? "Editar foto" : "Cámara" }));
        expect(abrirArchivo).toHaveBeenCalledOnce();

        if (esWeb) {
            expect(archivo).not.toHaveAttribute("capture");
            expect(screen.queryByRole("button", { name: "Cámara" })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Galería" })).not.toBeInTheDocument();
            expect(screen.queryByLabelText("Fotografía desde galería")).not.toBeInTheDocument();
        } else {
            expect(archivo).toHaveAttribute("capture", "environment");
            const galeria = screen.getByLabelText("Fotografía desde galería");
            const abrirGaleria = vi.spyOn(galeria, "click").mockImplementation(() => {});
            expect(galeria).not.toHaveAttribute("capture");
            expect(galeria).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
            fireEvent.click(screen.getByRole("button", { name: "Galería" }));
            expect(abrirGaleria).toHaveBeenCalledOnce();
        }
    });

    it("incluye la fotografía seleccionada únicamente al guardar y libera la vista previa", async () => {
        const foto = new File(["foto"], "pera.png", { type: "image/png" });
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion: { ...publicacion, foto: "/pera.png" } }));
        mostrar();
        await editar();
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [foto] } });

        expect(mocks.crearVistaPrevia).toHaveBeenCalledWith(foto);
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        expect(screen.getByAltText("Vista previa de la fotografía")).toHaveAttribute("src", "blob:foto-productor");
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalled());

        const enviada = solicitudGuardado().datos.get("foto") as File;
        expect(enviada.name).toBe("pera.png");
        expect(enviada.type).toBe("image/png");
        expect(enviada.size).toBe(foto.size);
        expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:foto-productor");
    });

    it("quita una fotografía existente y guarda explícitamente foto nula", async () => {
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion }));
        mostrar({ ...publicacion, foto: "/pera.png" });
        fireEvent.load(screen.getByAltText("Foto de Pera"));
        await editar();
        expect(screen.getByAltText("Vista previa de la fotografía")).toHaveAttribute("src", "/pera.png");
        fireEvent.click(screen.getByRole("button", { name: "Borrar foto" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalled());

        const { datos, cambios } = solicitudGuardado();
        expect(cambios.foto).toBeNull();
        expect(datos.has("foto")).toBe(false);
        expect(mocks.crearVistaPrevia).not.toHaveBeenCalled();
    });

    it("descarta el archivo nuevo al cancelar y mantiene la foto guardada", async () => {
        mostrar({ ...publicacion, foto: "/pera.png" });
        fireEvent.load(screen.getByAltText("Foto de Pera"));
        await editar();
        fireEvent.change(screen.getByLabelText("Fotografía"), {
            target: { files: [new File(["foto nueva"], "nueva.png", { type: "image/png" })] },
        });
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        expect(screen.getByAltText("Foto de Pera")).toHaveAttribute("src", "/pera.png");
        expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:foto-productor");
        expect(mocks.fetch.mock.calls.some(([, config]) => config?.method === "PATCH")).toBe(false);
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("bloquea la baja mientras carga las opciones de edición", async () => {
        let resolver!: (valor: ReturnType<typeof respuesta>) => void;
        mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
        mostrar();
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));

        const eliminar = screen.getByRole("button", { name: "Eliminar" });
        expect(eliminar).toBeDisabled();
        fireEvent.click(eliminar);
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(mocks.fetch).toHaveBeenCalledOnce();

        await act(async () => resolver(respuesta({ opciones })));

        expect(screen.getByRole("dialog", { name: "Editar publicación de Productor" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
    });

    it("permite cancelar la confirmación y volver a editar", () => {
        mostrar();
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();

        fireEvent.click(screen.getByRole("button", { name: "Cancelar baja" }));

        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("bloquea Escape, cierre y edición durante la baja y cierra al terminar", async () => {
        let resolver!: (valor: ReturnType<typeof respuesta>) => void;
        mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
        mostrar();
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));
        const procesando = screen.getByRole("button", { name: "Eliminando..." });

        expect(procesando).toBeDisabled();
        expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Eliminar" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cerrar consulta" })).toBeDisabled();
        fireEvent.keyDown(procesando, { key: "Escape" });
        fireEvent.touchEnd(screen.getByRole("dialog", { name: "Detalle de publicación" }));
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        fireEvent.click(procesando);
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("/api/publicaciones/productor/1042", { method: "DELETE" });

        await act(async () => resolver(respuesta({ mensaje: "Publicación eliminada correctamente." })));

        expect(mocks.cerrar).toHaveBeenCalledOnce();
        expect(mocks.eliminada).toHaveBeenCalledExactlyOnceWith("Publicación eliminada correctamente.");
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it.each([true, false])("una baja anterior no cierra ni muestra errores en otra publicación (éxito=%s)", async (ok) => {
        let resolver!: (valor: ReturnType<typeof respuesta>) => void;
        mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
        const { rerender } = mostrar();
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));
        const otra = { ...publicacion, id: 43, publicacionProductorId: 1043, precio: "175" };
        rerender(<DrawerPublicacionProductor publicacion={otra} alCerrar={mocks.cerrar} alGuardar={mocks.guardar} alEliminada={mocks.eliminada} />);

        await act(async () => resolver(respuesta({ errores: ["No se pudo eliminar la publicación anterior."] }, ok)));

        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(screen.getByText("$175")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
        expect(mocks.eliminada).toHaveBeenCalledTimes(ok ? 1 : 0);
    });
});
