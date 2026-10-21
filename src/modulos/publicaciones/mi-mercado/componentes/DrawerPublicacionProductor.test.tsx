import type { SwipeableDrawerProps } from "@mui/material/SwipeableDrawer";
import type { DialogProps } from "@mui/material/Dialog";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpcionesEdicionPublicacion } from "../../operadores/consultas-edicion-publicacion";
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import DrawerPublicacionProductor from "./DrawerPublicacionProductor";

const mocks = vi.hoisted(() => ({
    mediaQuery: vi.fn(),
    fetch: vi.fn(),
    cerrar: vi.fn(),
    guardar: vi.fn(),
    crearVistaPrevia: vi.fn(),
    borrarVistaPrevia: vi.fn(),
}));

vi.mock("@mui/material/useMediaQuery", () => ({ default: mocks.mediaQuery }));
vi.mock("@mui/material/SwipeableDrawer", () => ({
    default: ({ anchor, open, children, onClose }: SwipeableDrawerProps) => <section role="dialog" aria-label="Detalle de publicación" data-anchor={anchor} hidden={!open} onTouchEnd={onClose}>{children}</section>,
}));
vi.mock("@mui/material/Dialog", () => ({
    default: ({ open, children, "aria-label": etiqueta }: DialogProps) => open ? <section role="dialog" aria-label={etiqueta}>{children}</section> : null,
}));
vi.mock("../../componentes/drawer-publicacion/TextoAjustable", () => ({
    default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
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

function respuesta(datos: object, ok = true) {
    return { ok, json: async () => datos };
}

function mostrar(publicacionInicial = publicacion) {
    return render(<DrawerPublicacionProductor publicacion={publicacionInicial} alCerrar={mocks.cerrar} alGuardar={mocks.guardar} />);
}

async function editar() {
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    return screen.findByLabelText("Precio en pesos");
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

    it("habilita la edición en el mismo drawer de consulta sin guardar al cambiar campos", async () => {
        mostrar();
        const detalle = screen.getByRole("dialog", { name: "Detalle de publicación" });
        expect(within(detalle).getByText("$100")).toBeInTheDocument();
        expect(within(detalle).queryByRole("textbox")).not.toBeInTheDocument();
        expect(mocks.fetch).not.toHaveBeenCalled();

        const precio = await editar();

        expect(screen.getAllByRole("dialog")).toEqual([detalle]);
        expect(precio).toHaveValue("100");
        expect(screen.getByRole("combobox", { name: "Presentación" })).toBeEnabled();
        expect(screen.getByRole("combobox", { name: "Categoría" })).toBeEnabled();
        expect(screen.getByRole("combobox", { name: "Calibre" })).toBeEnabled();
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
        const detalle = screen.getByRole("dialog", { name: "Detalle de publicación" });
        fireEvent.change(await editar(), { target: { value: "250" } });
        fireEvent.change(screen.getByRole("combobox", { name: "Presentación" }), { target: { value: "112" } });
        fireEvent.change(screen.getByRole("combobox", { name: "Categoría" }), { target: { value: "5" } });
        fireEvent.change(screen.getByRole("combobox", { name: "Calibre" }), { target: { value: "8" } });
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 1"), { target: { value: "Nuevo retiro" } });
        fireEvent.change(screen.getByLabelText("Enlace de Google Maps 1"), { target: { value: "https://maps.app.goo.gl/retiro" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(actualizada));
        const { url, datos, cambios } = solicitudGuardado();
        expect(url).toBe("/api/publicaciones/productor/1042");
        expect(cambios).toEqual({
            precio: "250", foto: null, presentacionId: 112, categoriaId: 5, calibreId: 8,
            ubicaciones: [{ nombreUbicacion: "Nuevo retiro", urlMaps: "https://maps.app.goo.gl/retiro" }],
        });
        expect(datos.has("foto")).toBe(false);
        expect(screen.getAllByRole("dialog")).toEqual([detalle]);
        expect(screen.queryByLabelText("Precio en pesos")).not.toBeInTheDocument();
        expect(screen.getByText("$250")).toBeInTheDocument();
        expect(screen.getByText("21/10/2026")).toHaveAttribute("dateTime", actualizada.fecha);
        expect(mocks.cerrar).not.toHaveBeenCalled();
    });

    it("cancela el borrador sin persistir y recupera los valores originales al volver a editar", async () => {
        mostrar();
        fireEvent.change(await editar(), { target: { value: "999" } });
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 1"), { target: { value: "No guardar" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        expect(screen.getByText("$100")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Quinta" })).toBeInTheDocument();
        expect(mocks.fetch.mock.calls.some(([, config]) => config?.method === "PATCH")).toBe(false);
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(await editar()).toHaveValue("100");
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
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar la publicación.");
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("300");
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(actualizada));
    });

    it("agrega y elimina puntos de retiro en el borrador antes de guardarlos", async () => {
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion }));
        mostrar();
        await editar();
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 2"), { target: { value: "Depósito" } });
        fireEvent.change(screen.getByLabelText("Enlace de Google Maps 2"), { target: { value: "https://maps.google.com/?q=Montevideo" } });
        fireEvent.click(screen.getByRole("button", { name: "Eliminar punto de retiro 1" }));
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Depósito");
        expect(screen.queryByLabelText("Nombre del punto de retiro 2")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

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

    it.each([false, true])("ofrece archivo en web y archivo o cámara en móvil (esWeb=%s)", async (esWeb) => {
        mocks.mediaQuery.mockReturnValue(esWeb);
        mostrar();
        await editar();
        const archivo = screen.getByLabelText("Seleccionar fotografía");
        const abrirArchivo = vi.spyOn(archivo, "click").mockImplementation(() => {});
        expect(archivo).toHaveAttribute("type", "file");
        expect(archivo).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
        expect(archivo).not.toHaveAttribute("capture");
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar archivo" }));
        expect(abrirArchivo).toHaveBeenCalledOnce();

        if (esWeb) {
            expect(screen.queryByRole("button", { name: "Tomar foto" })).not.toBeInTheDocument();
            expect(screen.queryByLabelText("Tomar fotografía")).not.toBeInTheDocument();
        } else {
            const camara = screen.getByLabelText("Tomar fotografía");
            const abrirCamara = vi.spyOn(camara, "click").mockImplementation(() => {});
            expect(camara).toHaveAttribute("capture", "environment");
            expect(camara).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
            fireEvent.click(screen.getByRole("button", { name: "Tomar foto" }));
            expect(abrirCamara).toHaveBeenCalledOnce();
        }
    });

    it("incluye la fotografía seleccionada únicamente al guardar y libera la vista previa", async () => {
        const foto = new File(["foto"], "pera.png", { type: "image/png" });
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion: { ...publicacion, foto: "/pera.png" } }));
        mostrar();
        await editar();
        fireEvent.change(screen.getByLabelText("Seleccionar fotografía"), { target: { files: [foto] } });

        expect(mocks.crearVistaPrevia).toHaveBeenCalledWith(foto);
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        expect(screen.getByAltText("Foto de Pera")).toHaveAttribute("src", "blob:foto-productor");
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
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
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
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
        fireEvent.change(screen.getByLabelText("Seleccionar fotografía"), {
            target: { files: [new File(["foto nueva"], "nueva.png", { type: "image/png" })] },
        });
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        expect(screen.getByAltText("Foto de Pera")).toHaveAttribute("src", "/pera.png");
        expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:foto-productor");
        expect(mocks.fetch.mock.calls.some(([, config]) => config?.method === "PATCH")).toBe(false);
        expect(mocks.guardar).not.toHaveBeenCalled();
    });
});
