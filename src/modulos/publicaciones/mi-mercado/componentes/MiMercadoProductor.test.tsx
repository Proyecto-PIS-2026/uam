import type { DrawerProps } from "@mui/material/Drawer";
import type { DialogProps } from "@mui/material/Dialog";
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import MiMercadoProductor from "./MiMercadoProductor";

const mocks = vi.hoisted(() => ({ mediaQuery: vi.fn(), refresh: vi.fn(), altaReal: false }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("../../productores/AltaPublicacionProductor", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../productores/AltaPublicacionProductor")>();
    return { DrawerAltaPublicacionProductor: (props: { productorId: number; abierto: boolean; alCerrar: () => void; alCrear: (mensaje: string) => void }) => mocks.altaReal ? <actual.DrawerAltaPublicacionProductor {...props} /> : props.abierto ? (
        <section role="dialog" aria-label="Nueva publicación de Productor">
            <button onClick={props.alCerrar}>Cancelar alta</button>
            <button onClick={() => props.alCrear("Publicación creada correctamente.")}>Confirmar alta</button>
        </section>
    ) : null };
});
vi.mock("@mui/material/useMediaQuery", () => ({ default: mocks.mediaQuery }));
vi.mock("@/compartido/componentes/DrawerDeslizable", () => ({
    default: ({ anchor, open, children, onClose, slotProps, ModalProps, arrastreDeshabilitado }: Omit<DrawerProps, "onClose"> & { onClose: () => void; arrastreDeshabilitado?: boolean }) => {
        if (!open && !ModalProps?.keepMounted) return null;
        const papel = slotProps?.paper as { "aria-label"?: string; "aria-labelledby"?: string } | undefined;
        return <section className="MuiDrawer-paper" role="dialog" aria-label={papel?.["aria-label"]} aria-labelledby={papel?.["aria-labelledby"]} data-anchor={anchor} hidden={!open}>
            {anchor === "bottom" && <button type="button" aria-label="Solicitar cierre desde barra" disabled={arrastreDeshabilitado} onClick={onClose} />}
            {children}
        </section>;
    },
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
vi.mock("../../../../compartido/componentes/ConfirmModal", () => ({
    ConfirmModal: ({ abierto, descripcion, textoConfirmar, textoCancelar = "Cancelar", alConfirmar, alCancelar }: {
        abierto: boolean; descripcion: string; textoConfirmar?: string; textoCancelar?: string;
        alConfirmar: () => void; alCancelar: () => void;
    }) => abierto ? (
        <section role="alertdialog" aria-label="Confirmar baja">
            <p>{descripcion}</p>
            <button type="button" onClick={alCancelar}>{textoCancelar}</button>
            <button type="button" onClick={alConfirmar}>{textoConfirmar ?? "Confirmar"}</button>
        </section>
    ) : null,
}));

function crearPublicacion(id: number, especie: string, precio: string | null = "100"): PublicacionMiMercadoProductor {
    return {
        id,
        publicacionProductorId: id + 100,
        paisId: 1,
        pais: "Uruguay",
        foto: null,
        precio,
        fecha: "2026-10-16T14:00:00.000Z",
        publicacionActiva: true,
        publicacionDisponible: true,
        cantidadUnidades: 0,
        especie: { id, nombreEspecie: especie, fotoEspecie: null },
        variedad: { id, nombreVariedad: "-" },
        presentacion: { id, nombrePresentacion: "Cajón" },
        categoria: { id: 1, nombreCategoria: "Primera" },
        calibre: { id: 1, codigoCalibre: "G", nombreCalibre: "Grande" },
        ubicaciones: [{ id: 1, nombreUbicacion: "Quinta del productor", urlMaps: "https://maps.google.com/?q=Montevideo" }],
    };
}

describe("MiMercadoProductor", () => {
    beforeEach(() => {
        mocks.mediaQuery.mockReturnValue(false);
        mocks.altaReal = false;
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it("muestra las publicaciones propias sin agrupar y el botón de alta junto al listado", () => {
        render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera"), crearPublicacion(2, "Manzana")]} nombreProductor="Mi quinta" />);

        expect(screen.getByRole("heading", { level: 1, name: "Mi Mercado" })).toBeInTheDocument();
        expect(screen.getAllByTitle(/Pera|Manzana/).map((titulo) => titulo.textContent)).toEqual(["Manzana", "Pera"]);
        expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
        expect(screen.getByRole("searchbox", { name: "Buscar publicaciones" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Agrupar|Desagrupar/i })).not.toBeInTheDocument();
        const encabezadoListado = screen.getByRole("heading", { level: 2, name: "Publicaciones" }).parentElement!;
        expect(within(encabezadoListado).getByRole("button", { name: "Nueva publicación" })).toBeDisabled();
        expect(screen.queryByRole("button", { name: /Editar|Eliminar|Aumentar precio|Disminuir precio/ })).not.toBeInTheDocument();
    });

    it("filtra y ordena sin consultar APIs de operador", () => {
        render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera", "40"), crearPublicacion(2, "Manzana", "80")]} />);

        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar publicaciones" }), { target: { value: "PERA" } });
        expect(screen.getByTitle("Pera")).toBeInTheDocument();
        expect(screen.queryByTitle("Manzana")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("button", { name: "Menor Precio" }));
        expect(screen.getAllByTitle(/Pera|Manzana/).map((titulo) => titulo.textContent)).toEqual(["Pera", "Manzana"]);
    });

    it.each([
        { esWeb: false, anchor: "bottom" },
        { esWeb: true, anchor: "right" },
    ])("abre el detalle desde $anchor y permite editar y eliminar la publicación", ({ esWeb, anchor }) => {
        mocks.mediaQuery.mockReturnValue(esWeb);
        render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} />);

        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);
        const detalle = screen.getByRole("dialog", { name: "Consulta de publicación" });
        expect(detalle).toHaveAttribute("data-anchor", anchor);
        expect(within(detalle).getByRole("combobox", { name: /^País de origen/ })).toHaveTextContent("Uruguay");
        expect(within(detalle).getByLabelText("Unidades (Cajón)")).toHaveValue("0");
        expect(within(detalle).getByRole("link", { name: "Quinta del productor" })).toHaveAttribute("href", "https://maps.google.com/?q=Montevideo");
        expect(within(detalle).getByLabelText("Precio en pesos")).toHaveValue("100");
        expect(within(detalle).getByLabelText("Precio en pesos")).toHaveAttribute("readonly");
        expect(within(detalle).getByLabelText("Unidades (Cajón)")).toHaveAttribute("readonly");
        for (const campo of ["Especie", "Variedad", "Presentación", "País de origen", "Categoría", "Calibre"]) {
            expect(within(detalle).getByRole("combobox", { name: new RegExp(`^${campo}`) })).toHaveAttribute("aria-disabled", "true");
        }
        expect(within(detalle).getByRole("button", { name: "Editar" })).toBeEnabled();
        expect(within(detalle).getByRole("button", { name: "Eliminar" })).toBeEnabled();
        expect(within(detalle).queryByRole("button", { name: /Guardar|^Cerrar$/ })).not.toBeInTheDocument();
        expect(within(detalle).queryByRole("link", { name: "Ver Perfil" })).not.toBeInTheDocument();
        fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar consulta" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it.each([false, true])("abre el detalle desde toda la tarjeta con escritorio=%s", (esWeb) => {
        mocks.mediaQuery.mockReturnValue(esWeb);
        render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} />);
        const tarjeta = screen.getByRole("button", { name: "Ver detalle de Pera" });
        const zonas = [tarjeta, ...["$100", "Disponible", "Pera", "Sin fotografía"].map((texto) => within(tarjeta).getByText(texto)), within(tarjeta).getByTestId("ChevronRightIcon")];

        for (const zona of zonas) {
            fireEvent.click(zona);
            const detalle = screen.getByRole("dialog", { name: "Consulta de publicación" });
            expect(within(detalle).getByLabelText("Precio en pesos")).toHaveValue("100");
            fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar consulta" }));
            expect(screen.queryByRole("dialog", { name: "Consulta de publicación" })).not.toBeInTheDocument();
        }
    });

    it("permite volver a abrir la publicación después del cierre solicitado desde la barra del drawer", () => {
        render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} />);

        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);
        fireEvent.click(within(screen.getByRole("dialog", { name: "Consulta de publicación" })).getByRole("button", { name: "Solicitar cierre desde barra" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBeInTheDocument();
    });

    it("conserva los datos actualizados al recibir otras publicaciones", () => {
        const inicial = crearPublicacion(1, "Pera");
        const { rerender } = render(<MiMercadoProductor publicaciones={[inicial]} />);
        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);

        rerender(<MiMercadoProductor publicaciones={[{ ...inicial, precio: "150", publicacionDisponible: false }]} />);

        const detalle = screen.getByRole("dialog", { name: "Consulta de publicación" });
        expect(within(detalle).getByLabelText("Precio en pesos")).toHaveValue("150");
        expect(within(detalle).getByText("No disponible")).toBeInTheDocument();
        rerender(<MiMercadoProductor publicaciones={[crearPublicacion(2, "Manzana")]} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByTitle("Manzana")).toBeInTheDocument();
        expect(screen.queryByTitle("Pera")).not.toBeInTheDocument();
    });

    it("conserva el guardado ante un refresh del listado y permite abrir el alta con campos vacíos", async () => {
        mocks.altaReal = true;
        const pera = crearPublicacion(1, "Pera");
        const manzana = crearPublicacion(2, "Manzana", "80");
        const actualizada = { ...pera, precio: "220", paisId: 2, pais: "Argentina", cantidadUnidades: 25, publicacionDisponible: false, fecha: "2026-10-21T15:00:00.000Z" };
        let resolver!: (respuesta: { ok: boolean; json: () => Promise<{ publicacion: typeof actualizada }> }) => void;
        const opciones = {
            especies: [{ id: 1, nombre: "Pera" }],
            variedades: [{ id: 1, nombre: "-", especieId: 1 }],
            presentaciones: [{ id: 1, nombre: "Cajón", variedadId: 1 }],
            categorias: [{ id: 1, nombre: "Primera", especieId: null }],
            calibres: [{ id: 1, nombre: "G - Grande" }],
            paises: [{ id: 1, nombre: "Uruguay" }, { id: 2, nombre: "Argentina" }],
        };
        const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => opciones })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ opciones }) })
            .mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
        vi.stubGlobal("fetch", fetch);
        const vista = render(<MiMercadoProductor publicaciones={[pera, manzana]} productorId={21} />);
        await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/publicaciones/productor"));
        expect(screen.getByRole("button", { name: "Nueva publicación" })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "Ver detalle de Pera" }));
        const papel = screen.getByRole("dialog", { name: "Consulta de publicación" });
        const precio = within(papel).getByLabelText("Precio en pesos");
        const selectores = within(papel).getAllByRole("combobox");
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        const edicion = await screen.findByRole("dialog", { name: "Editar publicación" });
        expect(edicion).toBe(papel);
        expect(within(edicion).getByLabelText("Precio en pesos")).toBe(precio);
        within(edicion).getAllByRole("combobox").forEach((selector, indice) => expect(selector).toBe(selectores[indice]));
        fireEvent.change(within(edicion).getByLabelText("Precio en pesos"), { target: { value: "220" } });
        fireEvent.change(within(edicion).getByLabelText("Unidades (Cajón)"), { target: { value: "25" } });
        fireEvent.click(within(edicion).getByRole("switch", { name: "Publicación disponible" }));
        fireEvent.mouseDown(within(edicion).getByRole("combobox", { name: /^País de origen/ }));
        fireEvent.click(await screen.findByRole("option", { name: "Argentina" }));
        await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
        expect(screen.queryByRole("dialog", { name: "Consulta de publicación" })).not.toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
        vista.rerender(<MiMercadoProductor publicaciones={[{ ...pera, precio: "175" }, { ...manzana, precio: "90" }]} productorId={21} />);
        expect(screen.getByRole("dialog", { name: "Editar publicación" })).toBe(papel);
        expect(precio).toHaveValue("220");
        expect(precio).toBeDisabled();
        expect(within(edicion).getByLabelText("Unidades (Cajón)")).toHaveValue("25");
        expect(within(edicion).getByRole("switch", { name: "Publicación disponible" })).not.toBeChecked();
        expect(within(edicion).getByRole("combobox", { name: /^País de origen/ })).toHaveTextContent("Argentina");
        expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();
        await act(async () => resolver({ ok: true, json: async () => ({ publicacion: actualizada }) }));

        await waitFor(() => expect(within(screen.getByRole("button", { name: "Ver detalle de Pera" })).getByText("$220")).toBeInTheDocument());
        expect(within(screen.getByRole("button", { name: "Ver detalle de Pera" })).getByText("No disponible")).toBeInTheDocument();
        expect(within(screen.getByRole("button", { name: "Ver detalle de Manzana" })).getByText("$90")).toBeInTheDocument();
        expect(fetch.mock.calls[2][0]).toBe("/api/publicaciones/productor/101");
        expect(fetch.mock.calls[2][1]).toEqual(expect.objectContaining({ method: "PATCH" }));
        expect(JSON.parse((fetch.mock.calls[2][1].body as FormData).get("cambios") as string)).toMatchObject({ paisId: 2, cantidadUnidades: 25, disponible: false });
        expect(screen.queryByRole("dialog", { name: "Editar publicación" })).not.toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBe(papel);
        expect(screen.getByLabelText("Precio en pesos")).toBe(precio);
        screen.getAllByRole("combobox").filter((selector) => papel.contains(selector)).forEach((selector, indice) => expect(selector).toBe(selectores[indice]));
        fireEvent.click(screen.getByRole("button", { name: "Cerrar consulta" }));
        fireEvent.click(screen.getByRole("button", { name: "Ver detalle de Pera" }));
        const detalle = screen.getByRole("dialog", { name: "Consulta de publicación" });
        expect(within(detalle).getByLabelText("Precio en pesos")).toHaveValue("220");
        expect(within(detalle).getByLabelText("Unidades (Cajón)")).toHaveValue("25");
        expect(within(detalle).getByRole("combobox", { name: /^País de origen/ })).toHaveTextContent("Argentina");
        expect(within(detalle).getByText("No disponible", { exact: true })).toBeInTheDocument();
        expect(within(detalle).getByText("21/10/2026")).toHaveAttribute("dateTime", actualizada.fecha);
        fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar consulta" }));
        fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));
        const alta = await screen.findByRole("dialog", { name: "Nueva publicación de Productor" });
        expect(within(alta).getByLabelText("Precio en pesos")).toHaveValue("");
        fireEvent.click(within(alta).getByRole("button", { name: "Cancelar" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(within(screen.getByRole("button", { name: "Ver detalle de Pera" })).getByText("$220")).toBeInTheDocument();
    });

    it("muestra el estado vacío sin filtros ni acciones de operador", () => {
        render(<MiMercadoProductor publicaciones={[]} />);

        expect(screen.getByRole("heading", { name: "No tenés publicaciones" })).toBeInTheDocument();
        expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Nueva publicación" })).toBeDisabled();
        expect(screen.queryByRole("button", { name: /Editar|Eliminar|Aumentar precio|Disminuir precio/ })).not.toBeInTheDocument();
    });

    it("actualiza el listado y el contador después de la primera alta, sin recargar al cancelar", () => {
        const { rerender } = render(<MiMercadoProductor publicaciones={[]} productorId={4} />);
        expect(mocks.refresh).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancelar alta" }));
        expect(mocks.refresh).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar alta" }));
        expect(mocks.refresh).toHaveBeenCalledOnce();
        expect(screen.queryByRole("dialog", { name: "Nueva publicación de Productor" })).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Publicación creada correctamente.");

        rerender(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} productorId={4} />);
        expect(screen.getByTitle("Pera")).toBeInTheDocument();
        const encabezado = screen.getByRole("heading", { name: "Mi Mercado" }).closest("header")!;
        expect(within(encabezado).getByText("1 publicación", { exact: true })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "No tenés publicaciones" })).not.toBeInTheDocument();
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("mantiene los filtros al recibir el listado actualizado después del alta", () => {
        const publicaciones = [crearPublicacion(1, "Pera"), crearPublicacion(2, "Manzana")];
        const { rerender } = render(<MiMercadoProductor publicaciones={publicaciones} productorId={4} />);
        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar publicaciones" }), { target: { value: "Pera" } });
        fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar alta" }));

        rerender(<MiMercadoProductor publicaciones={[...publicaciones, crearPublicacion(3, "Pera", "200")]} productorId={4} />);
        expect(mocks.refresh).toHaveBeenCalledOnce();
        expect(screen.getByRole("searchbox", { name: "Buscar publicaciones" })).toHaveValue("Pera");
        expect(screen.getAllByTitle("Pera")).toHaveLength(2);
        expect(screen.getByText("$200", { exact: true })).toBeInTheDocument();
        expect(screen.queryByTitle("Manzana")).not.toBeInTheDocument();
        expect(screen.getByText("3 publicaciones", { exact: true })).toBeInTheDocument();
    });

    it("muestra precio y unidades ausentes y ubicaciones sin enlaces inseguros", () => {
        const publicacion = crearPublicacion(1, "Pera", null);
        publicacion.cantidadUnidades = null;
        publicacion.ubicaciones = [{ id: 2, nombreUbicacion: "Quinta sin mapa", urlMaps: "javascript:alert(1)" }];
        render(<MiMercadoProductor publicaciones={[publicacion]} />);
        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);

        const detalle = screen.getByRole("dialog", { name: "Consulta de publicación" });
        expect(within(detalle).getByLabelText("Precio en pesos")).toHaveValue("");
        expect(within(detalle).getByLabelText("Precio en pesos")).toHaveAttribute("placeholder", "Consultar precio");
        expect(within(detalle).getByLabelText("Unidades (Cajón)")).toHaveValue("");
        expect(within(detalle).getByLabelText("Unidades (Cajón)")).toHaveAttribute("placeholder", "Sin cantidad especificada");
        expect(within(detalle).getByText("Quinta sin mapa")).toBeInTheDocument();
        expect(within(detalle).queryByRole("link")).not.toBeInTheDocument();
    });

    it("muestra los valores en cero y el reemplazo cuando no hay foto ni puntos de retiro", () => {
        const publicacion = crearPublicacion(1, "Pera", "0");
        publicacion.ubicaciones = [];
        render(<MiMercadoProductor publicaciones={[publicacion]} />);
        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);

        const detalle = screen.getByRole("dialog", { name: "Consulta de publicación" });
        expect(within(detalle).getByLabelText("Precio en pesos")).toHaveValue("0");
        expect(within(detalle).getByLabelText("Unidades (Cajón)")).toHaveValue("0");
        expect(within(detalle).getByText("Sin foto")).toBeInTheDocument();
        expect(within(detalle).getByText("No hay puntos de retiro informados.")).toBeInTheDocument();
        expect(within(detalle).queryByRole("button", { name: /Ampliar foto/ })).not.toBeInTheDocument();
        expect(within(detalle).queryByRole("link", { name: /WhatsApp|Ver Perfil/ })).not.toBeInTheDocument();
    });

    it.each([
        { esWeb: false, anchor: "bottom" },
        { esWeb: true, anchor: "right" },
    ])("espera la foto y permite ampliarla y cerrarla desde $anchor", ({ esWeb, anchor }) => {
        mocks.mediaQuery.mockReturnValue(esWeb);
        const publicacion = { ...crearPublicacion(1, "Pera"), foto: "/pera.jpg" };
        render(<MiMercadoProductor publicaciones={[publicacion]} />);
        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        fireEvent.load(screen.getByAltText("Foto de Pera"));
        const detalle = screen.getByRole("dialog", { name: "Consulta de publicación" });
        expect(detalle).toHaveAttribute("data-anchor", anchor);
        fireEvent.click(within(detalle).getByRole("button", { name: "Ampliar foto de Pera" }));
        const fotoAmpliada = screen.getByRole("dialog", { name: "Foto ampliada del producto" });
        expect(within(fotoAmpliada).getByRole("img", { name: "Foto ampliada de Pera" })).toHaveAttribute("src", "/pera.jpg");
        fireEvent.click(within(fotoAmpliada).getByRole("button", { name: "Cerrar foto ampliada" }));

        expect(screen.queryByRole("dialog", { name: "Foto ampliada del producto" })).not.toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBeInTheDocument();
        fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar consulta" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("permite abrir la consulta aunque falle la carga de la foto", () => {
        const publicacion = { ...crearPublicacion(1, "Pera"), foto: "/pera-no-disponible.jpg" };
        render(<MiMercadoProductor publicaciones={[publicacion]} />);
        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        fireEvent.error(screen.getByAltText("Foto de Pera"));

        const detalle = screen.getByRole("dialog", { name: "Consulta de publicación" });
        expect(within(detalle).getByText("Sin foto")).toBeInTheDocument();
        expect(within(detalle).getByLabelText("Precio en pesos")).toHaveValue("100");
        expect(within(detalle).queryByRole("img")).not.toBeInTheDocument();
        fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar consulta" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("actualiza la foto del mismo producto sin desmontar la consulta", () => {
        const publicacion = { ...crearPublicacion(1, "Pera"), foto: "/pera.jpg" };
        const { rerender } = render(<MiMercadoProductor publicaciones={[publicacion]} />);
        fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);
        fireEvent.load(screen.getByAltText("Foto de Pera"));
        const detalle = screen.getByRole("dialog", { name: "Consulta de publicación" });
        const precio = within(detalle).getByLabelText("Precio en pesos");

        rerender(<MiMercadoProductor publicaciones={[{ ...publicacion, foto: "/pera-actualizada.jpg", precio: "125.00" }]} />);
        expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBe(detalle);
        expect(within(detalle).getByLabelText("Precio en pesos")).toBe(precio);
        fireEvent.load(screen.getByAltText("Foto de Pera"));

        expect(within(detalle).getByRole("img", { name: "Foto de Pera" })).toHaveAttribute("src", "/pera-actualizada.jpg");
        expect(within(detalle).getByLabelText("Precio en pesos")).toHaveValue("125");
    });
    describe("baja de una publicación", () => {
        function abrirDetalle() {
            fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Pera" })[0]);
            return screen.getByRole("dialog", { name: "Consulta de publicación" });
        }

        it("pide confirmación y permite cancelar sin enviar ninguna solicitud", () => {
            const fetchMock = vi.fn();
            vi.stubGlobal("fetch", fetchMock);
            render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} />);
            const detalle = abrirDetalle();

            fireEvent.click(within(detalle).getByRole("button", { name: "Eliminar" }));
            expect(screen.getByRole("alertdialog", { name: "Confirmar baja" })).toHaveTextContent("¿Querés eliminar la publicación de Pera?");
            fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

            expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
            expect(fetchMock).not.toHaveBeenCalled();
            expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBeInTheDocument();
        });

        it("da de baja al confirmar, cierra el detalle e informa el éxito", async () => {
            const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ mensaje: "Publicación eliminada correctamente." }) });
            vi.stubGlobal("fetch", fetchMock);
            render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} />);
            fireEvent.click(within(abrirDetalle()).getByRole("button", { name: "Eliminar" }));

            fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

            expect(await screen.findByRole("status")).toHaveTextContent("Publicación eliminada correctamente.");
            expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/publicaciones/productor/101", { method: "DELETE" });
            expect(mocks.refresh).toHaveBeenCalledOnce();
            expect(screen.queryByRole("dialog", { name: "Consulta de publicación" })).not.toBeInTheDocument();
        });

        it("permite eliminar una publicación recién editada y actualiza el listado al refrescar", async () => {
            const pera = crearPublicacion(1, "Pera");
            const manzana = crearPublicacion(2, "Manzana", "80");
            const actualizada = { ...pera, precio: "220" };
            const opciones = {
                especies: [{ id: 1, nombre: "Pera" }],
                variedades: [{ id: 1, nombre: "-", especieId: 1 }],
                presentaciones: [{ id: 1, nombre: "Cajón", variedadId: 1 }],
                categorias: [{ id: 1, nombre: "Primera", especieId: null }],
                calibres: [{ id: 1, nombre: "G - Grande" }],
                paises: [{ id: 1, nombre: "Uruguay" }],
            };
            const fetchMock = vi.fn()
                .mockResolvedValueOnce({ ok: true, json: async () => ({ opciones }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ publicacion: actualizada }) })
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ mensaje: "Publicación eliminada correctamente." }) });
            vi.stubGlobal("fetch", fetchMock);
            const { rerender } = render(<MiMercadoProductor publicaciones={[pera, manzana]} />);
            fireEvent.click(within(abrirDetalle()).getByRole("button", { name: "Editar" }));
            const edicion = await screen.findByRole("dialog", { name: "Editar publicación" });
            fireEvent.change(within(edicion).getByLabelText("Precio en pesos"), { target: { value: "220" } });
            fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

            const detalle = await screen.findByRole("dialog", { name: "Consulta de publicación" });
            expect(within(detalle).getByLabelText("Precio en pesos")).toHaveValue("220");
            fireEvent.click(within(detalle).getByRole("button", { name: "Eliminar" }));
            fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

            expect(await screen.findByText("Publicación eliminada correctamente.")).toBeInTheDocument();
            expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/publicaciones/productor/101", expect.objectContaining({ method: "PATCH" }));
            expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/publicaciones/productor/101", { method: "DELETE" });
            expect(mocks.refresh).toHaveBeenCalledOnce();
            rerender(<MiMercadoProductor publicaciones={[manzana]} />);
            expect(screen.queryByRole("button", { name: "Ver detalle de Pera" })).not.toBeInTheDocument();
            expect(within(screen.getByRole("button", { name: "Ver detalle de Manzana" })).getByText("$80")).toBeInTheDocument();
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });

        it("informa que ya estaba eliminada si el servidor responde 404", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ errores: ["La publicación no existe o ya fue eliminada."] }) }));
            render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} />);
            fireEvent.click(within(abrirDetalle()).getByRole("button", { name: "Eliminar" }));

            fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

            expect(await screen.findByRole("status")).toHaveTextContent("La publicación ya había sido eliminada.");
            expect(mocks.refresh).toHaveBeenCalledOnce();
        });

        it("conserva la consulta y muestra el error si el servidor rechaza la baja", async () => {
            vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ errores: ["No tenés permiso para eliminar esta publicación."] }) }));
            render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} />);
            fireEvent.click(within(abrirDetalle()).getByRole("button", { name: "Eliminar" }));

            fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

            expect(await screen.findByRole("alert")).toHaveTextContent("No tenés permiso para eliminar esta publicación.");
            expect(screen.getByRole("dialog", { name: "Consulta de publicación" })).toBeInTheDocument();
            expect(mocks.refresh).not.toHaveBeenCalled();
        });

        it("muestra un error de conexión si falla la solicitud", async () => {
            vi.stubGlobal("fetch", vi.fn().mockRejectedValue("sin red"));
            render(<MiMercadoProductor publicaciones={[crearPublicacion(1, "Pera")]} />);
            fireEvent.click(within(abrirDetalle()).getByRole("button", { name: "Eliminar" }));

            fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

            expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar con el servidor.");
        });
    });
});
