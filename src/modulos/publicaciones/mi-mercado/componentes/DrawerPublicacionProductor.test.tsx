import type { DrawerProps } from "@mui/material/Drawer";
import type { DialogProps } from "@mui/material/Dialog";
import type { ReactNode, Ref } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpcionesEdicionPublicacion } from "../../operadores/tipos";
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
vi.mock("../../productores/LeafletLocationPicker", () => ({
    default: ({ alConfirmar }: { alConfirmar: (ubicacion: { latitud: number; longitud: number; departamento: string; nombreLugar: string }) => void }) => (
        <button type="button" onClick={() => alConfirmar({ latitud: -34.5, longitud: -56.1, departamento: "Canelones", nombreLugar: "Nuevo retiro" })}>Confirmar punto en mapa</button>
    ),
}));
vi.mock("@/compartido/componentes/DrawerDeslizable", () => ({
    default: ({ anchor, open, children, onClose, slotProps, ModalProps, arrastreDeshabilitado }: Omit<DrawerProps, "onClose"> & { onClose: () => void; arrastreDeshabilitado?: boolean }) => {
        if (!open && !ModalProps?.keepMounted) return null;
        const papel = slotProps?.paper as { ref?: Ref<HTMLElement>; tabIndex?: number; "aria-label"?: string; "aria-labelledby"?: string } | undefined;
        const etiqueta = papel?.["aria-label"];
        return <section ref={papel?.ref} tabIndex={papel?.tabIndex} className="MuiDrawer-paper" role="dialog" aria-label={etiqueta} aria-labelledby={papel?.["aria-labelledby"]} data-anchor={anchor} data-arrastre-deshabilitado={Boolean(arrastreDeshabilitado)} hidden={!open} onTouchEnd={() => { if (!arrastreDeshabilitado) onClose(); }} onKeyDown={(evento) => { if (evento.key === "Escape") onClose(); }}>
            {children}
            <button type="button" aria-label="Cerrar desde fondo" onClick={onClose} />
        </section>;
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
    especie: { id: 1, nombreEspecie: "Pera", fotoEspecie: null },
        variedad: { id: 11, nombreVariedad: "Williams" },
        presentacion: { id: 111, nombrePresentacion: "Cajón" },
    categoria: { id: 3, nombreCategoria: "Primera" },
    calibre: { id: 4, codigoCalibre: "G", nombreCalibre: "Grande" },
    ubicaciones: [{ id: 21, nombreUbicacion: "Quinta", urlMaps: "https://maps.google.com/?q=Salto" }],
};

const opciones: OpcionesEdicionPublicacion = {
    especies: [{ id: 1, nombre: "Pera" }, { id: 2, nombre: "Manzana" }, { id: 3, nombre: "Durazno" }],
    variedades: [{ id: 11, nombre: "Williams", especieId: 1 }, { id: 12, nombre: "Packham", especieId: 1 }, { id: 13, nombre: "Sin presentación", especieId: 1 }, { id: 21, nombre: "Red", especieId: 2 }, { id: 31, nombre: "Amarillo", especieId: 3 }],
    presentaciones: [
        { id: 111, nombre: "Cajón", variedadId: 11 },
        { id: 112, nombre: "Bolsa", variedadId: 11 },
        { id: 121, nombre: "Saco", variedadId: 12 },
        { id: 211, nombre: "Bandeja de manzanas", variedadId: 21 },
    ],
    categorias: [
        { id: 3, nombre: "Primera", especieId: 1 },
        { id: 5, nombre: "Segunda", especieId: 1 },
        { id: 6, nombre: "General", especieId: null },
        { id: 7, nombre: "Manzanas especiales", especieId: 2 },
    ],
    calibres: [{ id: 4, nombre: "G - Grande" }, { id: 8, nombre: "M - Mediano" }],
    paises: [{ id: 1, nombre: "Uruguay" }, { id: 2, nombre: "Argentina" }],
};

function respuesta(datos: object, ok = true, status = ok ? 200 : 400) {
    return { ok, status, json: async () => datos };
}

function mostrar(publicacionInicial = publicacion) {
    return render(<DrawerPublicacionProductor publicacion={publicacionInicial} alCerrar={mocks.cerrar} alGuardar={mocks.guardar} alEliminada={mocks.eliminada} />);
}

async function editar() {
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const edicion = await screen.findByRole("dialog", { name: "Editar publicación" });
    return within(edicion).getByLabelText("Precio en pesos");
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

    it("conserva la prioridad UAM en el selector interno sin cambiar el catálogo ni la selección", async () => {
        const especies = [
            opciones.especies[0], { id: 20, nombre: "Tomate" }, { id: 21, nombre: "Ajo" },
            { id: 22, nombre: "Banana" }, opciones.especies[1], { id: 23, nombre: "Papa" },
        ];
        Object.freeze(especies);
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones: { ...opciones, especies } }));
        mostrar();
        await editar();
        expect(screen.getByRole("combobox", { name: /^Especie/ })).toHaveTextContent("Pera");
        fireEvent.mouseDown(screen.getByRole("combobox", { name: /^Especie/ }));
        expect(screen.getAllByRole("option").filter((opcion) => opcion.getAttribute("aria-disabled") !== "true").map((opcion) => opcion.textContent)).toEqual(["Papa", "Banana", "Manzana", "Tomate", "Ajo", "Pera"]);
        expect(especies.map((opcion) => opcion.nombre)).toEqual(["Pera", "Tomate", "Ajo", "Banana", "Manzana", "Papa"]);
        fireEvent.click(screen.getByRole("option", { name: "Pera" }));
        expect(screen.getByRole("combobox", { name: /^Especie/ })).toHaveTextContent("Pera");
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("edita en el mismo Paper y conserva campos y foto sin guardar al cambiar valores", async () => {
        mostrar({ ...publicacion, foto: "/pera.png" });
        const foto = screen.getByAltText("Foto de Pera");
        fireEvent.load(foto);
        const detalle = screen.getByRole("dialog", { name: "Consulta de publicación" });
        const precioConsulta = within(detalle).getByLabelText("Precio en pesos");
        const selectores = within(detalle).getAllByRole("combobox");
        expect(within(detalle).getByLabelText("Precio en pesos")).toHaveValue("100");
        expect(within(detalle).getByLabelText("Precio en pesos")).toHaveAttribute("readonly");
        expect(within(detalle).getByLabelText("Unidades (Cajón)")).toHaveValue("12");
        expect(within(detalle).getByLabelText("Unidades (Cajón)")).toHaveAttribute("readonly");
        for (const [campo, valor] of [["Especie", "Pera"], ["Variedad", "Williams"], ["Presentación", "Cajón"], ["País de origen", "Uruguay"], ["Categoría", "Primera"], ["Calibre", "Grande"]]) {
            const selector = within(detalle).getByRole("combobox", { name: new RegExp(`^${campo}`) });
            expect(selector).toHaveTextContent(valor);
            expect(selector).toHaveAttribute("aria-disabled", "true");
        }
        expect(within(detalle).getByText("Disponible", { exact: true })).toBeInTheDocument();
        expect(within(detalle).queryByText("Disponibilidad", { exact: true })).not.toBeInTheDocument();
        expect(within(detalle).queryByRole("switch")).not.toBeInTheDocument();
        expect(mocks.fetch).not.toHaveBeenCalled();

        const precio = await editar();

        const edicion = screen.getByRole("dialog", { name: "Editar publicación" });
        expect(edicion).toBe(detalle);
        expect(precio).toBe(precioConsulta);
        screen.getAllByRole("combobox").forEach((selector, indice) => expect(selector).toBe(selectores[indice]));
        expect(screen.getByAltText("Vista previa de la fotografía")).toBe(foto);
        expect(screen.getAllByRole("dialog")).toEqual([edicion]);
        expect(screen.queryByRole("dialog", { name: "Consulta de publicación" })).not.toBeInTheDocument();
        expect(precio).toHaveValue("100");
        expect(screen.getByRole("combobox", { name: /^Presentación/ })).toHaveTextContent("Cajón");
        expect(screen.getByRole("combobox", { name: /^Categoría/ })).toHaveTextContent("Primera");
        expect(screen.getByRole("combobox", { name: /^Calibre/ })).toHaveTextContent("G - Grande");
        for (const [campo, valor] of [["Especie", "Pera"], ["Variedad", "Williams"], ["País de origen", "Uruguay"]]) {
            const selector = screen.getByRole("combobox", { name: new RegExp(`^${campo}`) });
            expect(selector).toHaveTextContent(valor);
            expect(selector).not.toHaveAttribute("aria-disabled", "true");
        }
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBeChecked();
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBeEnabled();
        expect(screen.getByLabelText("Unidades (Cajón)")).toHaveValue("12");
        expect(screen.getByLabelText("Unidades (Cajón)")).toBeEnabled();
        expect(screen.getByLabelText("Unidades (Cajón)")).not.toHaveAttribute("readonly");
        expect(screen.queryByLabelText("Nombre del punto de retiro 1")).not.toBeInTheDocument();
        editarUbicaciones();
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Quinta");
        expect(screen.queryByLabelText("Enlace de Google Maps 1")).not.toBeInTheDocument();
        fireEvent.change(precio, { target: { value: "250" } });
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        expect(mocks.fetch.mock.calls[0][0]).toBe("/api/publicaciones/productor/1042");
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
    });

    it("guarda únicamente la publicación seleccionada y vuelve a consulta con los datos del servidor", async () => {
        const original = { ...publicacion, foto: "/pera.png" };
        const actualizada = {
            ...original,
            precio: "250",
            paisId: 2, pais: "Argentina", cantidadUnidades: 25, publicacionDisponible: false,
            fecha: "2026-10-21T15:00:00.000Z",
            variedad: { id: 12, nombreVariedad: "Packham" },
            presentacion: { id: 121, nombrePresentacion: "Saco" },
            categoria: { id: 5, nombreCategoria: "Segunda" },
            calibre: { id: 8, codigoCalibre: "M", nombreCalibre: "Mediano" },
            ubicaciones: [{ id: 30, nombreUbicacion: "Nuevo retiro", urlMaps: "https://maps.app.goo.gl/retiro" }],
        };
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion: actualizada }));
        mostrar(original);
        const foto = screen.getByAltText("Foto de Pera");
        fireEvent.load(foto);
        const papel = screen.getByRole("dialog", { name: "Consulta de publicación" });
        const precio = screen.getByLabelText("Precio en pesos");
        const selectores = screen.getAllByRole("combobox");
        fireEvent.change(await editar(), { target: { value: "250" } });
        await seleccionar("Variedad", "Packham");
        expect(screen.getByRole("combobox", { name: /^Presentación/ })).toHaveTextContent("Sin especificar");
        await seleccionar("Presentación", "Saco");
        expect(screen.getByRole("combobox", { name: /^Categoría/ })).toHaveTextContent("Primera");
        await seleccionar("Presentación", "Saco");
        await seleccionar("País de origen", "Argentina");
        await seleccionar("Categoría", "Segunda");
        await seleccionar("Calibre", "M - Mediano");
        fireEvent.change(screen.getByLabelText("Unidades (Saco)"), { target: { value: "25" } });
        fireEvent.click(screen.getByRole("switch", { name: "Publicación disponible" }));
        editarUbicaciones();
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar en mapa punto de retiro 1" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar punto en mapa" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(actualizada));
        const { url, datos, cambios } = solicitudGuardado();
        expect(url).toBe("/api/publicaciones/productor/1042");
        expect(cambios).toEqual({
            especieId: 1, variedadId: 12, precio: "250", foto: "/pera.png", presentacionId: 121, categoriaId: 5, calibreId: 8,
            paisId: 2, cantidadUnidades: 25, disponible: false,
            ubicaciones: [{ nombreUbicacion: "Nuevo retiro", urlMaps: "https://www.google.com/maps?q=-34.5,-56.1", departamento: "Canelones" }],
        });
        expect(datos.has("foto")).toBe(false);
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBe(papel);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(screen.getByAltText("Foto de Pera")).toBe(foto);
        screen.getAllByRole("combobox").forEach((selector, indice) => expect(selector).toBe(selectores[indice]));
        expect(screen.getAllByRole("dialog")).toEqual([screen.getByRole("dialog", { name: "Consulta de publicación" })]);
        expect(screen.queryByRole("dialog", { name: "Editar publicación" })).not.toBeInTheDocument();
        expect(screen.getByLabelText("Precio en pesos")).toHaveAttribute("readonly");
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("250");
        expect(screen.getByLabelText("Unidades (Saco)")).toHaveValue("25");
        expect(screen.getByLabelText("Unidades (Saco)")).toHaveAttribute("readonly");
        expect(screen.getByRole("combobox", { name: /^País de origen/ })).toHaveTextContent("Argentina");
        expect(screen.getByText("No disponible", { exact: true })).toBeInTheDocument();
        expect(screen.getByText("21/10/2026")).toHaveAttribute("dateTime", actualizada.fecha);
        const aviso = screen.getByRole("status");
        expect(aviso).toHaveTextContent("Cambios guardados.");
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).not.toContainElement(aviso);
        fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(await editar()).toHaveValue("250");
        expect(screen.getByRole("combobox", { name: /^Presentación/ })).toHaveTextContent("Saco");
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).not.toBeChecked();
    });

    it("Cancelar descarta el borrador y vuelve a consulta sin desmontar el Paper, campos o foto", async () => {
        mostrar({ ...publicacion, foto: "/pera.png" });
        const foto = screen.getByAltText("Foto de Pera");
        fireEvent.load(foto);
        const papel = screen.getByRole("dialog", { name: "Consulta de publicación" });
        const precio = screen.getByLabelText("Precio en pesos");
        const selectores = screen.getAllByRole("combobox");
        fireEvent.change(await editar(), { target: { value: "999" } });
        await seleccionar("Especie", "Manzana");
        await seleccionar("Variedad", "Red");
        await seleccionar("Presentación", "Bandeja de manzanas");
        await seleccionar("País de origen", "Argentina");
        await seleccionar("Categoría", "Manzanas especiales");
        await seleccionar("Calibre", "M - Mediano");
        fireEvent.change(screen.getByLabelText("Unidades (Bandeja de manzanas)"), { target: { value: "35" } });
        fireEvent.click(screen.getByRole("switch", { name: "Publicación disponible" }));
        editarUbicaciones();
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 1"), { target: { value: "No guardar" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBe(papel);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        screen.getAllByRole("combobox").forEach((selector, indice) => expect(selector).toBe(selectores[indice]));
        expect(screen.getByAltText("Foto de Pera")).toBe(foto);
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("100");
        expect(screen.getByRole("link", { name: "Quinta" })).toBeInTheDocument();
        expect(mocks.fetch.mock.calls.some(([, config]) => config?.method === "PATCH")).toBe(false);
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(await editar()).toHaveValue("100");
        expect(screen.getByRole("combobox", { name: /^Especie/ })).toHaveTextContent("Pera");
        expect(screen.getByRole("combobox", { name: /^Variedad/ })).toHaveTextContent("Williams");
        expect(screen.getByRole("combobox", { name: /^Presentación/ })).toHaveTextContent("Cajón");
        expect(screen.getByRole("combobox", { name: /^País de origen/ })).toHaveTextContent("Uruguay");
        expect(screen.getByRole("combobox", { name: /^Categoría/ })).toHaveTextContent("Primera");
        expect(screen.getByRole("combobox", { name: /^Calibre/ })).toHaveTextContent("G - Grande");
        expect(screen.getByLabelText("Unidades (Cajón)")).toHaveValue("12");
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBeChecked();
        editarUbicaciones();
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Quinta");
        expect(screen.queryByLabelText("Nombre del punto de retiro 2")).not.toBeInTheDocument();
    });

    it.each(["Cerrar edición", "Cerrar desde fondo", "Escape", "arrastre"])("cierra todo el drawer desde edición con %s sin guardar", async (accion) => {
        const vista = mostrar();
        fireEvent.change(await editar(), { target: { value: "999" } });
        const papel = screen.getByRole("dialog", { name: "Editar publicación" });
        if (accion === "Escape") fireEvent.keyDown(papel, { key: "Escape" });
        else if (accion === "arrastre") fireEvent.touchEnd(papel);
        else fireEvent.click(screen.getByRole("button", { name: accion }));
        expect(mocks.cerrar).toHaveBeenCalledOnce();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.fetch.mock.calls.some(([, config]) => config?.method === "PATCH")).toBe(false);

        vista.rerender(<DrawerPublicacionProductor publicacion={null} alCerrar={mocks.cerrar} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        vista.rerender(<DrawerPublicacionProductor publicacion={publicacion} alCerrar={mocks.cerrar} />);
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("100");
        expect(screen.getByLabelText("Precio en pesos")).toHaveAttribute("readonly");
    });

    it.each(["0", "00", "12.5", "12,5", "-10", "+10", "1e3", "abc", "10000000000"])("rechaza la entrada de precio inválido %s", async (valor) => {
        mostrar();
        const precio = await editar();
        fireEvent.change(precio, { target: { value: valor } });
        expect(precio).toHaveValue("100");
        fireEvent.change(precio, { target: { value: "0" } });
        expect(precio).toHaveValue("100");
    });

    it.each(["específica", "global"])("cambia especie y resuelve dependencias conservando una categoría %s compatible", async (tipoCategoria) => {
        const inicial = tipoCategoria === "global" ? { ...publicacion, categoria: { id: 6, nombreCategoria: "General" } } : publicacion;
        const actualizada = {
            ...inicial,
            especie: { id: 2, nombreEspecie: "Manzana", fotoEspecie: null },
        variedad: { id: 21, nombreVariedad: "Red" },
        presentacion: { id: 211, nombrePresentacion: "Bandeja de manzanas" },
            categoria: { id: 6, nombreCategoria: "General" },
        };
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion: actualizada }));
        mostrar(inicial);
        await editar();

        await seleccionar("Especie", "Manzana");

        expect(screen.getByRole("combobox", { name: /^Variedad/ })).toHaveTextContent("Sin especificar");
        expect(screen.getByRole("combobox", { name: /^Presentación/ })).toHaveTextContent("Sin especificar");
        expect(screen.getByRole("combobox", { name: /^Categoría/ })).toHaveTextContent(tipoCategoria === "global" ? "General" : "Sin especificar");
        fireEvent.mouseDown(screen.getByRole("combobox", { name: /^Categoría/ }));
        expect(screen.getByRole("option", { name: "General" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Manzanas especiales" })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Primera" })).not.toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Segunda" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("option", { name: "General" }));
        await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
        fireEvent.mouseDown(screen.getByRole("combobox", { name: /^Variedad/ }));
        expect(screen.getByRole("option", { name: "Red" })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Williams" })).not.toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Packham" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("option", { name: "Red" }));
        await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
        await seleccionar("Presentación", "Bandeja de manzanas");
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(actualizada));
        expect(solicitudGuardado().cambios).toEqual({
            especieId: 2, variedadId: 21, precio: "100", foto: null, presentacionId: 211, categoriaId: 6, calibreId: 4,
            paisId: 1, cantidadUnidades: 12, disponible: true,
            ubicaciones: [{ nombreUbicacion: "Quinta", urlMaps: "https://maps.google.com/?q=Salto" }],
        });
        expect(screen.getByRole("combobox", { name: /^Especie/ })).toHaveTextContent("Manzana");
    });

    it.each(["especie", "variedad"])("permite guardar una %s sin presentaciones", async (dependencia) => {
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion }));
        mostrar();
        const precio = await editar();
        await seleccionar(dependencia === "especie" ? "Especie" : "Variedad", dependencia === "especie" ? "Durazno" : "Sin presentación");
        expect(screen.getByRole("combobox", { name: /^Presentación/ })).toHaveTextContent("Sin especificar");
        fireEvent.submit(precio.closest("form")!);
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(publicacion));
        expect(solicitudGuardado().cambios).toMatchObject({
            especieId: dependencia === "especie" ? 3 : 1,
            variedadId: dependencia === "especie" ? null : 13,
            presentacionId: null,
        });
    });

    it("permite vaciar las cinco opciones y consultar una publicación con solo especie", async () => {
        const actualizada = { ...publicacion, variedad: null, presentacion: null, categoria: null, calibre: null, paisId: null, pais: "", precio: null, cantidadUnidades: null, ubicaciones: [] };
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion: actualizada }));
        mostrar();
        await editar();
        for (const campo of ["Variedad", "Categoría", "Calibre", "País de origen"]) await seleccionar(campo, "Sin especificar");
        fireEvent.change(screen.getByLabelText("Precio en pesos"), { target: { value: "" } });
        fireEvent.change(screen.getByLabelText("Unidades"), { target: { value: "" } });
        expect(screen.getByRole("button", { name: "Confirmar" }).closest("form")!.checkValidity()).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(actualizada));
        expect(solicitudGuardado().cambios).toMatchObject({
            especieId: 1, variedadId: null, presentacionId: null, categoriaId: null,
            calibreId: null, paisId: null, precio: null, cantidadUnidades: null,
        });
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: /^Especie/ })).toHaveTextContent("Pera");
        for (const campo of ["Variedad", "Presentación", "Categoría", "Calibre", "País de origen"]) {
            expect(screen.getByRole("combobox", { name: new RegExp('^' + campo) })).toHaveTextContent("-");
        }
    });

    it.each(["0", "2147483647"])("guarda el límite válido de unidades %s como número", async (valor) => {
        const actualizada = { ...publicacion, cantidadUnidades: Number(valor) };
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion: actualizada }));
        mostrar();
        await editar();
        fireEvent.change(screen.getByLabelText("Unidades (Cajón)"), { target: { value: valor } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(actualizada));
        expect(solicitudGuardado().cambios.cantidadUnidades).toBe(Number(valor));
        expect(screen.getByLabelText("Unidades (Cajón)")).toHaveValue(valor);
    });

    it("normaliza ceros iniciales y rechaza signos, decimales, letras y desbordes en unidades", async () => {
        mostrar();
        await editar();
        const unidades = screen.getByLabelText("Unidades (Cajón)");
        fireEvent.change(unidades, { target: { value: "0022" } });
        expect(unidades).toHaveValue("22");
        for (const valor of ["12.5", "12,5", "-1", "+1", "1e3", "abc", "2147483648"]) {
            fireEvent.change(unidades, { target: { value: valor } });
            expect(unidades).toHaveValue("22");
        }
        expect(mocks.fetch.mock.calls.some(([, config]) => config?.method === "PATCH")).toBe(false);
    });

    it("bloquea el guardado de unidades heredadas fuera de rango hasta corregirlas", async () => {
        mostrar({ ...publicacion, cantidadUnidades: 2147483648 });
        const precio = await editar();
        fireEvent.submit(precio.closest("form")!);
        expect(screen.getByRole("alert")).toHaveTextContent("La cantidad de unidades debe ser un número entero entre 0 y 2147483647.");
        expect(mocks.fetch.mock.calls.some(([, config]) => config?.method === "PATCH")).toBe(false);
    });

    it.each([400, 422])("conserva inline el fallo HTTP %s y permite reintentar sin perder el borrador", async (status) => {
        const actualizada = { ...publicacion, precio: "300" };
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones }))
            .mockResolvedValueOnce(respuesta({ errores: ["No se pudo guardar la publicación."] }, false, status))
            .mockResolvedValueOnce(respuesta({ publicacion: actualizada }));
        mostrar();
        fireEvent.change(await editar(), { target: { value: "300" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        const alerta = await screen.findByRole("alert");
        expect(alerta).toHaveTextContent("No se pudo guardar la publicación.");
        expect(screen.getByLabelText("Precio en pesos").closest("form")).toContainElement(alerta);
        expect(screen.queryByRole("button", { name: "Cerrar notificación" })).not.toBeInTheDocument();
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("300");
        expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(actualizada));
    });

    it("guarda null al borrar el precio y las unidades y conserva disponibilidad falsa", async () => {
        const actualizada = { ...publicacion, precio: null, cantidadUnidades: null, publicacionDisponible: false };
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion: actualizada }));
        mostrar();
        fireEvent.change(await editar(), { target: { value: "" } });
        fireEvent.change(screen.getByLabelText("Unidades (Cajón)"), { target: { value: "" } });
        fireEvent.click(screen.getByRole("switch", { name: "Publicación disponible" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(actualizada));
        expect(solicitudGuardado().cambios).toEqual({
            especieId: 1, variedadId: 11, precio: null, foto: null, presentacionId: 111, categoriaId: 3, calibreId: 4,
            paisId: 1, cantidadUnidades: null, disponible: false,
            ubicaciones: [{ nombreUbicacion: "Quinta", urlMaps: "https://maps.google.com/?q=Salto" }],
        });
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("");
        expect(screen.getByLabelText("Unidades (Cajón)")).toHaveValue("");
    });

    it("exige corregir un precio cero existente antes de guardar", async () => {
        mostrar({ ...publicacion, precio: "0.00" });
        await editar();
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        expect(screen.getByRole("alert")).toHaveTextContent("El precio debe ser un número entero positivo de hasta 10 dígitos, sin decimales.");
        expect(mocks.fetch.mock.calls.some(([, config]) => config?.method === "PATCH")).toBe(false);
    });

    it.each(["servidor", "conexión"])("conserva el editor ante fallo de %s y permite cerrar el toast y reintentar", async (fallo) => {
        const actualizada = { ...publicacion, precio: "250" };
        const mensaje = fallo === "servidor" ? "Fallo remoto." : "No se pudieron guardar los cambios. Intentá nuevamente.";
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones }));
        if (fallo === "servidor") mocks.fetch.mockResolvedValueOnce(respuesta({ errores: [mensaje] }, false, 500));
        else mocks.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
        mocks.fetch.mockResolvedValueOnce(respuesta({ publicacion: actualizada }));
        mostrar();
        const precio = await editar();
        fireEvent.change(precio, { target: { value: "250" } });
        const papel = screen.getByRole("dialog", { name: "Editar publicación" });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        const aviso = await screen.findByRole("alert");
        expect(aviso).toHaveTextContent(mensaje);
        expect(papel).not.toContainElement(aviso);
        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toBe(papel);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(precio).toHaveValue("250");
        expect(screen.getByRole("button", { name: "Confirmar" })).toBeEnabled();
        if (fallo === "servidor") fireEvent.keyDown(precio, { key: "Escape" });
        else fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith(actualizada));
        expect(mocks.fetch.mock.calls.filter(([, config]) => config?.method === "PATCH")).toHaveLength(2);
    });

    it("agrega y elimina puntos de retiro en el borrador antes de guardarlos", async () => {
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones })).mockResolvedValueOnce(respuesta({ publicacion }));
        mostrar();
        await editar();
        editarUbicaciones();
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar en mapa punto de retiro 2" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar punto en mapa" }));
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 2"), { target: { value: "Depósito" } });
        fireEvent.click(screen.getByRole("button", { name: "Eliminar punto de retiro 1" }));
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Depósito");
        expect(screen.queryByLabelText("Nombre del punto de retiro 2")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalled());
        expect(solicitudGuardado().cambios.ubicaciones).toEqual([{ nombreUbicacion: "Depósito", urlMaps: "https://www.google.com/maps?q=-34.5,-56.1", departamento: "Canelones" }]);
    });

    it("muestra el error de carga de opciones y conserva la consulta para reintentar", async () => {
        mocks.fetch.mockResolvedValueOnce(respuesta({ errores: ["No se pudieron cargar las opciones."] }, false))
            .mockResolvedValueOnce(respuesta({ opciones }));
        mostrar();
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));

        const aviso = await screen.findByRole("alert");
        expect(aviso).toHaveTextContent("No se pudieron cargar las opciones.");
        const detalle = screen.getByRole("dialog", { name: "Consulta de publicación" });
        expect(detalle).not.toContainElement(aviso);
        fireEvent.keyDown(detalle, { key: "Escape" });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Precio en pesos")).toHaveAttribute("readonly");
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("100");
        expect(await editar()).toHaveValue("100");
    });

    it("recupera el foco en el Paper al entrar en edición sin desplazar el contenido", async () => {
        let resolver!: (valor: ReturnType<typeof respuesta>) => void;
        mocks.fetch.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
        mostrar();
        const papel = screen.getByRole("dialog", { name: "Consulta de publicación" });
        const enfocarPanel = vi.spyOn(papel, "focus");
        const contenido = screen.getByLabelText("Precio en pesos").parentElement!.parentElement!;
        contenido.scrollTop = 80;
        const editar = screen.getByRole("button", { name: "Editar" });
        editar.focus();
        expect(editar).toHaveFocus();
        editar.blur();
        fireEvent.click(editar);
        expect(editar).toBeDisabled();
        const precio = screen.getByLabelText("Precio en pesos");
        expect(precio).toHaveAttribute("readonly");
        expect(precio.closest("form")).toHaveAttribute("aria-busy", "true");
        expect(within(papel).queryByRole("status")).not.toBeInTheDocument();
        expect(document.body).toHaveFocus();

        await act(async () => resolver(respuesta({ opciones })));

        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toBe(papel);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(precio).not.toHaveAttribute("readonly");
        expect(precio.closest("form")).toHaveAttribute("aria-busy", "false");
        expect(papel).toHaveFocus();
        expect(enfocarPanel).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
        expect(contenido.scrollTop).toBe(80);
        fireEvent.keyDown(document.activeElement!, { key: "Escape" });
        expect(mocks.cerrar).toHaveBeenCalledOnce();
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
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBeInTheDocument();
        expect(screen.getByLabelText("Precio en pesos")).toHaveAttribute("readonly");
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

        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toBeInTheDocument();
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("250");
        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it.each([200, 400])("bloquea cambios, cierre y envíos duplicados hasta resolver el guardado con HTTP %s", async (status) => {
        mocks.mediaQuery.mockReturnValue(false);
        let resolver!: (valor: ReturnType<typeof respuesta>) => void;
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones }))
            .mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
        mostrar();
        fireEvent.change(await editar(), { target: { value: "150" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        const guardando = screen.getByRole("button", { name: "Guardando..." });
        expect(guardando).toBeDisabled();
        expect(screen.getByLabelText("Precio en pesos")).toBeDisabled();
        for (const selector of screen.getAllByRole("combobox")) expect(selector).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByLabelText("Unidades (Cajón)")).toBeDisabled();
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).toBeDisabled();
        expect(screen.getByLabelText("Fotografía")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Cerrar edición" })).toBeDisabled();
        const papel = screen.getByRole("dialog", { name: "Editar publicación" });
        expect(papel).toHaveAttribute("data-arrastre-deshabilitado", "true");
        fireEvent.click(screen.getByRole("button", { name: "Cerrar desde fondo" }));
        fireEvent.keyDown(papel, { key: "Escape" });
        fireEvent.touchEnd(papel);
        fireEvent.submit(guardando.closest("form")!);
        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toBeInTheDocument();
        expect(mocks.fetch.mock.calls.filter(([, config]) => config?.method === "PATCH")).toHaveLength(1);
        expect(mocks.cerrar).not.toHaveBeenCalled();

        await act(async () => resolver(status === 200
            ? respuesta({ publicacion: { ...publicacion, precio: "150" } })
            : respuesta({ errores: ["Revisá la presentación seleccionada."] }, false, status)));

        expect(screen.getByRole("dialog", { name: status === 200 ? "Consulta de publicación" : "Editar publicación" })).toBe(papel);
        expect(papel).toHaveAttribute("data-arrastre-deshabilitado", "false");
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("150");
        if (status === 400) {
            expect(screen.getByRole("alert")).toHaveTextContent("Revisá la presentación seleccionada.");
            expect(screen.getByRole("button", { name: "Cerrar edición" })).toBeEnabled();
            fireEvent.keyDown(papel, { key: "Escape" });
            expect(mocks.cerrar).toHaveBeenCalledOnce();
        }
    });

    it("conserva el borrador ante datos nuevos del mismo id y Cancelar recupera la última consulta", async () => {
        const vista = mostrar();
        const precio = await editar();
        const papel = screen.getByRole("dialog", { name: "Editar publicación" });
        const presentacion = screen.getByRole("combobox", { name: /^Presentación/ });
        fireEvent.change(precio, { target: { value: "250" } });
        await seleccionar("País de origen", "Argentina");
        fireEvent.change(screen.getByLabelText("Unidades (Cajón)"), { target: { value: "23" } });
        fireEvent.click(screen.getByRole("switch", { name: "Publicación disponible" }));
        editarUbicaciones();
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 1"), { target: { value: "Mi borrador" } });
        const actualizada = {
            ...publicacion, precio: "175", cantidadUnidades: 40, fecha: "2026-10-24T12:00:00.000Z",
            presentacion: { ...publicacion.presentacion, id: 112, nombrePresentacion: "Bolsa" },
            ubicaciones: [{ id: 22, nombreUbicacion: "Retiro actualizado", urlMaps: "https://maps.google.com/?q=Canelones" }],
        };
        vista.rerender(<DrawerPublicacionProductor publicacion={actualizada} alCerrar={mocks.cerrar} alGuardar={mocks.guardar} />);

        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toBe(papel);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(precio).toHaveValue("250");
        expect(presentacion).toHaveTextContent("Cajón");
        expect(screen.getByRole("combobox", { name: /^País de origen/ })).toHaveTextContent("Argentina");
        expect(screen.getByLabelText("Unidades (Cajón)")).toHaveValue("23");
        expect(screen.getByRole("switch", { name: "Publicación disponible" })).not.toBeChecked();
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Mi borrador");
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBe(papel);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(precio).toHaveValue("175");
        expect(screen.getByRole("combobox", { name: /^Presentación/ })).toBe(presentacion);
        expect(presentacion).toHaveTextContent("Bolsa");
        expect(screen.getByRole("combobox", { name: /^País de origen/ })).toHaveTextContent("Uruguay");
        expect(screen.getByLabelText("Unidades (Bolsa)")).toHaveValue("40");
        expect(screen.getByText("Disponible", { exact: true })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Retiro actualizado" })).toBeInTheDocument();
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.fetch.mock.calls.some(([, config]) => config?.method === "PATCH")).toBe(false);
    });

    it.each([
        ["otra publicación", true], ["otra publicación", false],
        ["cierre", true], ["cierre", false],
        ["desmontaje", true], ["desmontaje", false],
    ] as const)("ignora un PATCH tardío tras %s (éxito=%s)", async (cambio, ok) => {
        let resolver!: (valor: ReturnType<typeof respuesta>) => void;
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones }))
            .mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
        const vista = mostrar();
        fireEvent.change(await editar(), { target: { value: "250" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        if (cambio === "desmontaje") vista.unmount();
        else vista.rerender(<DrawerPublicacionProductor
            publicacion={cambio === "cierre" ? null : { ...publicacion, id: 43, publicacionProductorId: 1043, precio: "175" }}
            alCerrar={mocks.cerrar} alGuardar={mocks.guardar} alEliminada={mocks.eliminada}
        />);

        await act(async () => resolver(respuesta(ok ? { publicacion: { ...publicacion, precio: "250" } } : { errores: ["Fallo anterior."] }, ok, ok ? 200 : 500)));

        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        if (cambio === "otra publicación") {
            expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBeInTheDocument();
            expect(screen.getByLabelText("Precio en pesos")).toHaveValue("175");
            expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
        } else expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("mantiene el guardado pendiente al recibir nuevos datos del mismo id y aplica su respuesta una vez", async () => {
        let resolver!: (valor: ReturnType<typeof respuesta>) => void;
        const guardarActual = vi.fn();
        mocks.fetch.mockResolvedValueOnce(respuesta({ opciones }))
            .mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
        const vista = mostrar();
        const precio = await editar();
        const papel = screen.getByRole("dialog", { name: "Editar publicación" });
        fireEvent.change(precio, { target: { value: "250" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

        vista.rerender(<DrawerPublicacionProductor publicacion={{ ...publicacion, precio: "175", fecha: "2026-10-24T18:00:00.000Z" }} alCerrar={mocks.cerrar} alGuardar={guardarActual} />);
        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toBe(papel);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(precio).toHaveValue("250");
        expect(precio).toBeDisabled();
        expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();
        expect(papel).toHaveAttribute("data-arrastre-deshabilitado", "true");
        fireEvent.keyDown(papel, { key: "Escape" });
        fireEvent.submit(precio.closest("form")!);
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(mocks.fetch.mock.calls.filter(([, config]) => config?.method === "PATCH")).toHaveLength(1);

        const actualizada = { ...publicacion, precio: "250", fecha: "2026-10-24T19:00:00.000Z" };
        await act(async () => resolver(respuesta({ publicacion: actualizada })));
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(guardarActual).toHaveBeenCalledExactlyOnceWith(actualizada);
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBe(papel);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        expect(precio).toHaveValue("250");
        expect(precio).toHaveAttribute("readonly");
        expect(papel).toHaveAttribute("data-arrastre-deshabilitado", "false");
    });

    it("abre la consulta si la foto inicial aún pendiente se elimina con nuevos datos del mismo id", () => {
        const vista = mostrar({ ...publicacion, foto: "/pendiente.png" });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByAltText("Foto de Pera")).toHaveAttribute("src", "/pendiente.png");

        vista.rerender(<DrawerPublicacionProductor publicacion={{ ...publicacion, foto: null }} alCerrar={mocks.cerrar} alGuardar={mocks.guardar} />);

        const papel = screen.getByRole("dialog", { name: "Consulta de publicación" });
        expect(within(papel).getByText("Sin foto")).toBeInTheDocument();
        expect(within(papel).queryByRole("img")).not.toBeInTheDocument();
        expect(within(papel).getByLabelText("Precio en pesos")).toHaveValue("100");
        vista.rerender(<DrawerPublicacionProductor publicacion={{ ...publicacion, foto: "/nueva-pendiente.png" }} alCerrar={mocks.cerrar} alGuardar={mocks.guardar} />);
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBe(papel);
        expect(screen.getByAltText("Foto de Pera")).toHaveAttribute("src", "/nueva-pendiente.png");
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it.each([false, true])("ofrece archivo en web y archivo o cámara en móvil (esWeb=%s)", async (esWeb) => {
        mocks.mediaQuery.mockReturnValue(esWeb);
        mostrar();
        await editar();
        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toHaveAttribute("data-anchor", esWeb ? "right" : "bottom");
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
        mostrar({ ...publicacion, foto: "/anterior.png" });
        const imagen = screen.getByAltText("Foto de Pera");
        const marco = imagen.parentElement;
        fireEvent.load(imagen);
        const papel = screen.getByRole("dialog", { name: "Consulta de publicación" });
        await editar();
        fireEvent.change(screen.getByLabelText("Fotografía"), { target: { files: [foto] } });

        expect(mocks.crearVistaPrevia).toHaveBeenCalledWith(foto);
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        expect(screen.getByAltText("Vista previa de la fotografía")).toHaveAttribute("src", "blob:foto-productor");
        expect(screen.getByAltText("Vista previa de la fotografía").parentElement).toBe(marco);
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalled());

        const enviada = solicitudGuardado().datos.get("foto") as File;
        expect(enviada.name).toBe("pera.png");
        expect(enviada.type).toBe("image/png");
        expect(enviada.size).toBe(foto.size);
        expect(mocks.borrarVistaPrevia).toHaveBeenCalledWith("blob:foto-productor");
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBe(papel);
        expect(screen.getByAltText("Foto de Pera").parentElement).toBe(marco);
        expect(screen.getByAltText("Foto de Pera")).toHaveAttribute("src", "/pera.png");
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

    it("prepara nuevamente la imagen al consultar otra publicación que comparte la foto", () => {
        const foto = "/foto-compartida.webp";
        const { rerender } = mostrar({ ...publicacion, foto });
        const primeraImagen = screen.getByAltText("Foto de Pera");
        fireEvent.load(primeraImagen);
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBeInTheDocument();

        rerender(<DrawerPublicacionProductor publicacion={{ ...publicacion, id: 43, publicacionProductorId: 1043, foto }} alCerrar={mocks.cerrar} />);

        const segundaImagen = screen.getByAltText("Foto de Pera");
        expect(segundaImagen).not.toBe(primeraImagen);
        expect(screen.queryByRole("dialog", { name: "Consulta de publicación" })).not.toBeInTheDocument();
        fireEvent.load(segundaImagen);
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBeInTheDocument();
    });

    it("muestra el fallo de baja en un toast y conserva la publicación para reintentar", async () => {
        mocks.fetch.mockResolvedValueOnce(respuesta({ errores: ["No se pudo eliminar la publicación."] }, false));
        mostrar();
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

        const aviso = await screen.findByRole("alert");
        expect(aviso).toHaveTextContent("No se pudo eliminar la publicación.");
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).not.toContainElement(aviso);
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled();
        expect(mocks.cerrar).not.toHaveBeenCalled();
        expect(mocks.eliminada).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
    });

    it("permite cancelar la confirmación y volver a editar", () => {
        mostrar();
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();

        fireEvent.touchEnd(screen.getByRole("dialog", { name: "Consulta de publicación" }));
        expect(screen.getByRole("alertdialog", { name: "Confirmar baja" })).toBeInTheDocument();
        expect(mocks.cerrar).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Cancelar baja" }));

        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBeInTheDocument();
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
        fireEvent.touchEnd(screen.getByRole("dialog", { name: "Consulta de publicación" }));
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
        expect(screen.getByLabelText("Precio en pesos")).toHaveValue("175");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
        expect(mocks.eliminada).toHaveBeenCalledTimes(ok ? 1 : 0);
    });
});
