import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/PublicacionesOperador";
import type { PublicacionProductorListado } from "../../../consulta-mercado/acciones/PublicacionesProductor";
import { DrawerPublicacion } from "./DrawerPublicacion";

const usarMediaQueryMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("@mui/material/useMediaQuery", () => ({
    default: usarMediaQueryMock,
}));

vi.mock("@/compartido/componentes/DrawerDeslizable", async () => {
    const React = await import("react");
    type DrawerProps = {
        open: boolean;
        anchor: string;
        onClose: () => void;
        children?: ReactNode;
        slotProps?: {
            paper?: {
                className?: string;
                role?: string;
                "aria-label"?: string;
            };
        };
        ModalProps?: {
            keepMounted?: boolean;
            onTransitionEnter?: () => void;
            onTransitionExited?: () => void;
        };
    };
    return {
        default: function DrawerDeslizableMock({ open, anchor, onClose, children, slotProps, ModalProps }: DrawerProps) {
            const abiertoAnterior = React.useRef(false);
            const onTransitionEnter = ModalProps?.onTransitionEnter;
            const onTransitionExited = ModalProps?.onTransitionExited;
            React.useEffect(() => {
                if (open && !abiertoAnterior.current) {
                    onTransitionEnter?.();
                }
                if (!open && abiertoAnterior.current) {
                    onTransitionExited?.();
                }
                abiertoAnterior.current = open;
            }, [open, onTransitionEnter, onTransitionExited]);
            if (!open && !ModalProps?.keepMounted) {
                return null;
            }
            return React.createElement(
                "div",
                {
                    role: slotProps?.paper?.role ?? "dialog",
                    "aria-label": slotProps?.paper?.["aria-label"] ?? "Detalle de publicación",
                    className: slotProps?.paper?.className,
                    "data-anchor": anchor,
                    hidden: !open,
                },
                React.createElement("button", { type: "button", onClick: onClose }, "Cerrar detalle"),
                children,
            );
        },
    };
});

vi.mock("@mui/material/Dialog", async () => {
    const React = await import("react");
    type DialogProps = {
        open: boolean;
        onClose?: (event: unknown, reason: string) => void;
        children?: ReactNode;
        "aria-label"?: string;
        slotProps?: {
            transition?: {
                onExited?: () => void;
            };
        };
    };
    return {
        default: function DialogMock({ open, onClose, children, slotProps, "aria-label": ariaLabel }: DialogProps) {
            const abiertoAnterior = React.useRef(false);
            const onExited = slotProps?.transition?.onExited;
            React.useEffect(() => {
                if (!open && abiertoAnterior.current) {
                    onExited?.();
                }
                abiertoAnterior.current = open;
            }, [open, onExited]);
            if (!open) {
                return null;
            }
            return React.createElement(
                "div",
                {
                    role: "dialog",
                    "aria-label": ariaLabel,
                    onKeyDown: (event: { key: string }) => {
                        if (event.key === "Escape") onClose?.(event, "escapeKeyDown");
                    },
                },
                children,
            );
        },
    };
});

vi.mock("next/link", async () => {
    const React = await import("react");
    type LinkProps = {
        href: string;
        children?: ReactNode;
        className?: string;
        onClick?: () => void;
    };
    return {
        default: ({ href, children, className, onClick }: LinkProps) => React.createElement(
            "a",
            {
                href,
                className,
                onClick: (event: { preventDefault: () => void }) => {
                    event.preventDefault();
                    onClick?.();
                },
            },
            children,
        ),
    };
});

vi.mock("next/image", async () => {
    const React = await import("react");
    return {
        default: ({ src, alt, onLoad, onError, style, className }: {
            src?: string | null;
            alt?: string;
            onLoad?: React.ReactEventHandler<HTMLImageElement>;
            onError?: React.ReactEventHandler<HTMLImageElement>;
            style?: React.CSSProperties;
            className?: string;
        }) => React.createElement("img", { src: src ?? undefined, alt, onLoad, onError, style, className }),
    };
});

vi.mock("@mui/icons-material/ImageOutlined", async () => {
    const React = await import("react");
    return { default: () => React.createElement("span", { "data-testid": "ImageOutlinedIcon" }) };
});

vi.mock("@mui/icons-material/WhatsApp", async () => {
    const React = await import("react");
    return { default: () => React.createElement("span", { "data-testid": "WhatsAppIcon" }) };
});

vi.mock("@mui/icons-material/Close", async () => {
    const React = await import("react");
    return { default: () => React.createElement("span", { "data-testid": "CloseIcon" }) };
});

vi.mock("./TextoAjustable", () => ({
    default: ({ children, className }: { children: ReactNode; className?: string }) => <span className={className}>{children}</span>,
}));

class ResizeObserverMock {
    static instancias: ResizeObserverMock[] = [];
    callback: ResizeObserverCallback;
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        ResizeObserverMock.instancias.push(this);
    }
    notificar() {
        this.callback([], this as unknown as ResizeObserver);
    }
}

const mensajeWhatsApp = "Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.";

function crearPublicacion(): PublicacionListado {
    return {
        id: 7,
        especie: "Tomate",
        variedad: "Perita",
        precio: 150,
        fecha: "2026-10-03T15:00:00.000Z",
        foto: null,
        envase: "Cajón", kilos: "",
        categoria: "Primera",
        calibre: "Mediano",
        codigoCalibre: "M",
        pais: "Uruguay",
        tipoPublicacion: "OPERADOR",
        operador: { id: 10, nombreFantasia: "Huerta Sur", whatsApp: "099123456" },
    };
}

function crearPublicacionProductor(): PublicacionProductorListado {
    return {
        id: 8,
        especie: "Manzana",
        variedad: "Gala",
        precio: 120,
        fecha: "2026-10-03T15:00:00.000Z",
        foto: null,
        envase: "Caja", kilos: "",
        cantidadUnidades: 20,
        categoria: "Primera",
        calibre: "Grande",
        codigoCalibre: "G",
        pais: "Uruguay",
        tipoPublicacion: "PRODUCTOR",
        productor: { id: 30, nombreFantasia: "Huerta Productora", fotoPerfil: null, whatsApp: "+598 99 123 456" },
        ubicaciones: [
            { id: 1, nombreUbicacion: "Local central", urlMaps: "https://maps.example/central" },
            { id: 2, nombreUbicacion: "Depósito", urlMaps: "https://maps.example/deposito" },
        ],
    };
}

function obtenerElementoPorClase(container: HTMLElement, nombreClase: string): HTMLElement {
    const elemento = container.querySelector<HTMLElement>(`[class*="${nombreClase}"]`);
    if (!elemento) throw new Error(`No se encontró el elemento con la clase ${nombreClase}`);
    return elemento;
}

beforeEach(() => {
    vi.clearAllMocks();
    usarMediaQueryMock.mockReturnValue(true);
    ResizeObserverMock.instancias = [];
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("DrawerPublicacion con operadores", () => {
    it.each(["otra publicación", "otra foto", "sin publicación"])("vuelve a esperar la foto al regresar desde %s", (cambio) => {
        const original = { ...crearPublicacion(), foto: "/tomate.jpg" };
        const siguiente = cambio === "sin publicación" ? null : {
            ...original,
            id: cambio === "otra publicación" ? original.id + 1 : original.id,
            foto: "/tomate-nuevo.jpg",
        };
        const onOpenChange = vi.fn();
        const { rerender } = render(<DrawerPublicacion publicacion={original} open onOpenChange={onOpenChange} />);
        fireEvent.load(screen.getByAltText("Foto de Tomate"));
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
        rerender(<DrawerPublicacion publicacion={siguiente} open onOpenChange={onOpenChange} />);
        expect(screen.queryByRole("dialog", { name: "Detalle de publicación" })).not.toBeInTheDocument();
        rerender(<DrawerPublicacion publicacion={original} open onOpenChange={onOpenChange} />);
        expect(screen.queryByRole("dialog", { name: "Detalle de publicación" })).not.toBeInTheDocument();
        fireEvent.load(screen.getByAltText("Foto de Tomate"));
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
    });

    it.each(["cerrar", "cambiar"])("descarta la foto ampliada al %s la consulta", async (cambio) => {
        const original = { ...crearPublicacion(), foto: "/tomate.jpg" };
        const onOpenChange = vi.fn();
        const { rerender } = render(<DrawerPublicacion publicacion={original} open onOpenChange={onOpenChange} />);
        fireEvent.load(screen.getByAltText("Foto de Tomate"));
        fireEvent.click(screen.getByRole("button", { name: "Ampliar foto de Tomate" }));
        expect(screen.getByRole("button", { name: "Cerrar foto ampliada" })).toBeInTheDocument();
        const siguiente = cambio === "cambiar" ? { ...original, foto: "/tomate-nuevo.jpg" } : original;
        rerender(<DrawerPublicacion publicacion={siguiente} open={cambio === "cambiar"} onOpenChange={onOpenChange} />);
        await waitFor(() => {expect(screen.queryByRole("button", { name: "Cerrar foto ampliada" })).not.toBeInTheDocument()});
        expect(screen.queryByRole("dialog", { name: "Detalle de publicación" })).not.toBeInTheDocument();
        if (cambio === "cerrar") {
            rerender(<DrawerPublicacion publicacion={original} open onOpenChange={onOpenChange} />);
        } else {
            fireEvent.load(screen.getByAltText("Foto de Tomate"));
        }
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Cerrar foto ampliada" })).not.toBeInTheDocument();
    });

    it("muestra los datos de la publicación y los enlaces de contacto y perfil", () => {
        render(<DrawerPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
        for (const texto of ["Tomate", "Perita", "$150", "Cajón", "Mediano", "Primera", "País", "Uruguay", "Huerta Sur"]) {
            expect(screen.getByText(texto)).toBeInTheDocument();
        }
        expect(screen.getByRole("link", { name: "Ver Perfil" })).toHaveAttribute("href", "/operadores/Huerta%20Sur?origen=publicaciones");
        expect(screen.getByRole("link", { name: "Contactar a Huerta Sur por WhatsApp" })).toBeInTheDocument();
    });

    it("muestra la fecha formateada y conserva el valor original en dateTime", () => {
        render(<DrawerPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        const fecha = screen.getByText("Actualización").nextElementSibling;
        expect(fecha).toHaveTextContent("03/10/2026");
        expect(fecha).toHaveAttribute("dateTime", "2026-10-03T15:00:00.000Z");
    });

    it("muestra guiones cuando los datos opcionales están vacíos o son nulos", () => {
        const publicacion = { ...crearPublicacion(), variedad: " ", envase: " ", kilos: "", calibre: " ", categoria: " ", pais: " ", cantidadUnidades: null };
        render(<DrawerPublicacion publicacion={publicacion} open onOpenChange={vi.fn()} />);
        expect(screen.getByText("Tomate")).toBeInTheDocument();
        for (const etiqueta of ["Empaquetado", "Calibre", "Categoría", "País"]) {
            expect(screen.getByText(etiqueta).nextElementSibling).toHaveTextContent("-");
        }
        expect(screen.getByText(/^Unidades/).nextElementSibling).toHaveTextContent("-");
    });

    it("oculta la variedad cuando es un guion", () => {
        render(<DrawerPublicacion publicacion={{ ...crearPublicacion(), variedad: "-" }} open onOpenChange={vi.fn()} />);
        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.getByText("Tomate").parentElement).not.toHaveTextContent("-");
        expect(screen.getAllByText("-", { exact: true }).length).toBeGreaterThan(0);
    });

    it("muestra la foto con la especie como texto alternativo", () => {
        render(<DrawerPublicacion publicacion={{ ...crearPublicacion(), foto: "/tomate.jpg" }} open onOpenChange={vi.fn()} />);
        fireEvent.load(screen.getByAltText("Foto de Tomate"));
        expect(screen.getByRole("img", { name: "Foto de Tomate" })).toHaveAttribute("src", "/tomate.jpg");
        expect(screen.queryByTestId("ImageOutlinedIcon")).not.toBeInTheDocument();
    });

    it("muestra un reemplazo cuando no hay foto", () => {
        render(<DrawerPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        expect(screen.getByTestId("ImageOutlinedIcon")).toBeInTheDocument();
        expect(screen.getByText("Foto")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it.each([[150, "$150"], [1234.5, "$1234.5"], [0, "$0"]])("muestra el precio %s", (precio, esperado) => {
        render(<DrawerPublicacion publicacion={{ ...crearPublicacion(), precio }} open onOpenChange={vi.fn()} />);
        expect(screen.getByText(esperado)).toBeInTheDocument();
        expect(screen.queryByText("Consultar precio")).not.toBeInTheDocument();
    });

    it("muestra Consultar precio cuando el precio es nulo", () => {
        render(<DrawerPublicacion publicacion={{ ...crearPublicacion(), precio: null }} open onOpenChange={vi.fn()} />);
        expect(screen.getByText("Consultar precio")).toBeInTheDocument();
        expect(screen.queryByText("$0")).not.toBeInTheDocument();
    });

    it.each([[true, "right"], [false, "bottom"]])("utiliza el anclaje %s según el tamaño de pantalla", (esWeb, anchorEsperado) => {
        usarMediaQueryMock.mockReturnValue(esWeb);
        render(<DrawerPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toHaveAttribute("data-anchor", anchorEsperado);
    });

    it.each([[false, "/operadores/Huerta%20Sur?origen=publicaciones"], [true, "/gestion-operadores/10"]])("genera la ruta del perfil del operador según esAdmin=%s", (esAdmin, rutaEsperada) => {
        render(<DrawerPublicacion publicacion={crearPublicacion()} open esAdmin={esAdmin} onOpenChange={vi.fn()} />);
        expect(screen.getByRole("link", { name: "Ver Perfil" })).toHaveAttribute("href", rutaEsperada);
        expect(screen.getByRole("link", { name: "Huerta Sur" })).toHaveAttribute("href", rutaEsperada);
    });

    it("respeta la apertura controlada y notifica el cierre desde el drawer", () => {
        const onOpenChange = vi.fn();
        const publicacion = crearPublicacion();
        const { rerender } = render(<DrawerPublicacion publicacion={publicacion} open={false} onOpenChange={onOpenChange} />);
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog", { name: "Detalle de publicación" })).not.toBeInTheDocument();
        rerender(<DrawerPublicacion publicacion={publicacion} open onOpenChange={onOpenChange} />);
        fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
        rerender(<DrawerPublicacion publicacion={publicacion} open={false} onOpenChange={onOpenChange} />);
        expect(screen.queryByRole("dialog", { name: "Detalle de publicación" })).not.toBeInTheDocument();
    });

    it("notifica el cierre desde el botón del encabezado", () => {
        const onOpenChange = vi.fn();
        render(<DrawerPublicacion publicacion={crearPublicacion()} open onOpenChange={onOpenChange} />);
        fireEvent.click(screen.getByRole("button", { name: "Detalle de consulta" }));
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    it.each([["nombre del operador", "Huerta Sur"],["botón Ver Perfil", "Ver Perfil"]])("notifica el cierre al visitar el perfil desde %s", (_origen, nombreEnlace) => {
        const onOpenChange = vi.fn();
        render(<DrawerPublicacion publicacion={crearPublicacion()} open onOpenChange={onOpenChange} />);
        fireEvent.click(screen.getByRole("link", { name: nombreEnlace }));
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    it("actualiza el detalle al seleccionar otra publicación y permite quitarla", () => {
        const onOpenChange = vi.fn();
        const { rerender } = render(<DrawerPublicacion publicacion={crearPublicacion()} open onOpenChange={onOpenChange} />);
        rerender(
            <DrawerPublicacion
                publicacion={{
                    ...crearPublicacion(),
                    id: 2,
                    especie: "Manzana",
                    variedad: "Gala",
                    precio: 80,
                    fecha: "2026-10-03T15:00:00.000Z",
                    operador: { id: 20, nombreFantasia: "Frutas Norte", whatsApp: "098654321" },
                }}
                open
                onOpenChange={onOpenChange}
            />,
        );
        expect(screen.queryByText("Tomate")).not.toBeInTheDocument();
        expect(screen.queryByText("Huerta Sur")).not.toBeInTheDocument();
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.getByText("Gala")).toBeInTheDocument();
        expect(screen.getByText("$80")).toBeInTheDocument();
        expect(screen.getByText("Frutas Norte")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Ver Perfil" })).toHaveAttribute("href", "/operadores/Frutas%20Norte?origen=publicaciones");
        rerender(<DrawerPublicacion publicacion={null} open onOpenChange={onOpenChange} />);
        expect(screen.queryByText("Manzana")).not.toBeInTheDocument();
        expect(screen.queryByText("Publicado por")).not.toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("reinicia la posición del scroll al cambiar la publicación", () => {
        const publicacion = crearPublicacion();
        const { container, rerender } = render(<DrawerPublicacion publicacion={publicacion} open onOpenChange={vi.fn()} />);
        const contenido = obtenerElementoPorClase(container, "contenidoScrollable") as HTMLDivElement;
        contenido.scrollTop = 35;
        rerender(<DrawerPublicacion publicacion={{ ...publicacion, id: 9, especie: "Manzana" }} open onOpenChange={vi.fn()} />);
        expect(contenido.scrollTop).toBe(0);
    });

    it("observa el contenido y sus hijos, actualiza el pie según el scroll y desconecta el observer", () => {
        const { container, rerender, unmount } = render(<DrawerPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        const contenido = obtenerElementoPorClase(container, "contenidoScrollable") as HTMLDivElement;
        const pie = obtenerElementoPorClase(container, "pie");
        const observer = ResizeObserverMock.instancias[ResizeObserverMock.instancias.length - 1];
        expect(observer).toBeDefined();
        expect(observer.observe).toHaveBeenCalledTimes(contenido.children.length + 1);
        expect(observer.observe).toHaveBeenNthCalledWith(1, contenido);
        Array.from(contenido.children).forEach((hijo, indice) => {expect(observer.observe).toHaveBeenNthCalledWith(indice + 2, hijo)});
        Object.defineProperty(contenido, "scrollHeight", { configurable: true, value: 180 });
        Object.defineProperty(contenido, "clientHeight", { configurable: true, value: 100 });
        act(() => {observer.notificar()});
        expect(pie.className).toContain("pieConScroll");
        Object.defineProperty(contenido, "scrollHeight", { configurable: true, value: 100 });
        act(() => {observer.notificar()});
        expect(pie.className).not.toContain("pieConScroll");
        rerender(<DrawerPublicacion publicacion={crearPublicacion()} open={false} onOpenChange={vi.fn()} />);
        expect(observer.disconnect).toHaveBeenCalled();
        unmount();
    });

    it("restaura el foco al elemento que estaba activo antes de abrir el drawer", () => {
        const publicacion = crearPublicacion();
        const { rerender } = render(
            <>
                <button type="button">Volver al listado</button>
                <DrawerPublicacion publicacion={publicacion} open={false} onOpenChange={vi.fn()} />
            </>,
        );
        const botonOrigen = screen.getByRole("button", { name: "Volver al listado" });
        botonOrigen.focus();
        expect(botonOrigen).toHaveFocus();
        rerender(
            <>
                <button type="button">Volver al listado</button>
                <DrawerPublicacion publicacion={publicacion} open onOpenChange={vi.fn()} />
            </>,
        );
        rerender(
            <>
                <button type="button">Volver al listado</button>
                <DrawerPublicacion publicacion={publicacion} open={false} onOpenChange={vi.fn()} />
            </>,
        );
        expect(botonOrigen).toHaveFocus();
    });

    it("no restaura el foco si el elemento anterior ya no está conectado", () => {
        const publicacion = crearPublicacion();
        const { rerender } = render(
            <>
                <button type="button">Volver al listado</button>
                <DrawerPublicacion publicacion={publicacion} open={false} onOpenChange={vi.fn()} />
            </>,
        );
        const botonOrigen = screen.getByRole("button", { name: "Volver al listado" });
        botonOrigen.focus();
        rerender(
            <>
                <button type="button">Volver al listado</button>
                <DrawerPublicacion publicacion={publicacion} open onOpenChange={vi.fn()} />
            </>,
        );
        const focusSpy = vi.spyOn(botonOrigen, "focus");
        rerender(<DrawerPublicacion publicacion={publicacion} open onOpenChange={vi.fn()} />);
        expect(botonOrigen.isConnected).toBe(false);
        rerender(<DrawerPublicacion publicacion={publicacion} open={false} onOpenChange={vi.fn()} />);
        expect(focusSpy).not.toHaveBeenCalled();
    });

    it("prepara el enlace de WhatsApp con el teléfono normalizado y el mensaje", () => {
        render(<DrawerPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        const enlace = screen.getByRole("link", { name: "Contactar a Huerta Sur por WhatsApp" });
        const url = new URL(enlace.getAttribute("href")!);
        expect(url.origin).toBe("https://web.whatsapp.com");
        expect(url.pathname).toBe("/send");
        expect(url.searchParams.get("phone")).toBe("099123456");
        expect(url.searchParams.get("text")).toBe(mensajeWhatsApp);
    });

    it("registra el contacto de WhatsApp del operador", () => {
        const fetchMock = vi.fn().mockResolvedValue({});
        vi.stubGlobal("fetch", fetchMock);
        render(<DrawerPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        fireEvent.click(screen.getByRole("link", { name: "Contactar a Huerta Sur por WhatsApp" }));
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/estadisticas/whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: "OPERADOR", entidadId: 10 }),
            keepalive: true,
        });
    });

    it("registra el error cuando falla el contacto de WhatsApp", async () => {
        const error = new Error("Error de red");
        const fetchMock = vi.fn().mockRejectedValue(error);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.stubGlobal("fetch", fetchMock);
        render(<DrawerPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        fireEvent.click(screen.getByRole("link", { name: "Contactar a Huerta Sur por WhatsApp" }));
        await waitFor(() => {expect(errorSpy).toHaveBeenCalledExactlyOnceWith("Error al registrar contacto:", error)});
    });
});

describe("DrawerPublicacion con productores", () => {
    it.each([[false, "/productores/Huerta%20Productora?origen=publicaciones"], [true, "/gestion-productores/30"]])("genera la ruta del perfil del productor según esAdmin=%s", (esAdmin, rutaEsperada) => {
        render(<DrawerPublicacion publicacion={crearPublicacionProductor()} open esAdmin={esAdmin} onOpenChange={vi.fn()} />);
        expect(screen.getByRole("link", { name: "Ver Perfil" })).toHaveAttribute("href", rutaEsperada);
        expect(screen.getByRole("link", { name: "Huerta Productora" })).toHaveAttribute("href", rutaEsperada);
    });

    it("muestra los datos de la publicación y el perfil del productor", () => {
        render(<DrawerPublicacion publicacion={crearPublicacionProductor()} open onOpenChange={vi.fn()} />);
        for (const texto of ["Manzana", "Gala", "$120", "Caja", "Grande", "Primera", "20", "Uruguay"]) {
            expect(screen.getByText(texto, { exact: true })).toBeInTheDocument();
        }
        expect(screen.getByRole("link", { name: "Ver Perfil" })).toHaveAttribute("href", "/productores/Huerta%20Productora?origen=publicaciones");
        expect(screen.getByRole("link", { name: "Contactar a Huerta Productora por WhatsApp" })).toBeInTheDocument();
    });

    it("construye el enlace de WhatsApp con el teléfono del productor", () => {
        render(<DrawerPublicacion publicacion={crearPublicacionProductor()} open onOpenChange={vi.fn()} />);
        const enlace = screen.getByRole("link", { name: "Contactar a Huerta Productora por WhatsApp" });
        const url = new URL(enlace.getAttribute("href")!);
        expect(url.origin).toBe("https://web.whatsapp.com");
        expect(url.pathname).toBe("/send");
        expect(url.searchParams.get("phone")).toBe("59899123456");
        expect(url.searchParams.get("text")).toBe(mensajeWhatsApp);
        expect(enlace).toHaveAttribute("target", "_blank");
        expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("registra el contacto de WhatsApp del productor", () => {
        const fetchMock = vi.fn().mockResolvedValue({});
        vi.stubGlobal("fetch", fetchMock);
        render(<DrawerPublicacion publicacion={crearPublicacionProductor()} open onOpenChange={vi.fn()} />);
        fireEvent.click(screen.getByRole("link", { name: "Contactar a Huerta Productora por WhatsApp" }));
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/estadisticas/whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: "PRODUCTOR", entidadId: 30 }),
            keepalive: true,
        });
    });

    it("muestra los puntos de retiro con sus enlaces", () => {
        const publicacion = crearPublicacionProductor();
        render(<DrawerPublicacion publicacion={publicacion} open onOpenChange={vi.fn()} />);
        expect(screen.getByText("Puntos de retiro")).toBeInTheDocument();
        for (const ubicacion of publicacion.ubicaciones) {
            const enlace = screen.getByRole("link", { name: new RegExp(ubicacion.nombreUbicacion) });
            expect(enlace).toHaveAttribute("href", ubicacion.urlMaps);
            expect(enlace).toHaveAttribute("target", "_blank");
            expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
        }
    });

    it("informa cuando el productor no tiene puntos de retiro", () => {
        render(<DrawerPublicacion publicacion={{ ...crearPublicacionProductor(), ubicaciones: [] }} open onOpenChange={vi.fn()} />);
        expect(screen.getByText("No hay puntos de retiro informados.")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /Google Maps/ })).not.toBeInTheDocument();
    });

    it("no muestra el detalle del productor cuando está cerrado", () => {
        render(<DrawerPublicacion publicacion={crearPublicacionProductor()} open={false} onOpenChange={vi.fn()} />);
        expect(screen.queryByRole("dialog", { name: "Detalle de publicación" })).not.toBeInTheDocument();
        expect(screen.getByText("Huerta Productora")).not.toBeVisible();
    });

    it("notifica el cierre desde el botón del encabezado", () => {
        const onOpenChange = vi.fn();
        render(<DrawerPublicacion publicacion={crearPublicacionProductor()} open onOpenChange={onOpenChange} />);
        fireEvent.click(screen.getByRole("button", { name: "Detalle de consulta" }));
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    it.each([["nombre del productor", "Huerta Productora"], ["botón Ver Perfil", "Ver Perfil"]])("notifica el cierre al visitar el perfil desde %s", (_origen, nombreEnlace) => {
        const onOpenChange = vi.fn();
        render(<DrawerPublicacion publicacion={crearPublicacionProductor()} open onOpenChange={onOpenChange} />);
        fireEvent.click(screen.getByRole("link", { name: nombreEnlace }));
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    it("actualiza el productor y los puntos de retiro al cambiar la publicación", () => {
        const publicacion = crearPublicacionProductor();
        const onOpenChange = vi.fn();
        const { rerender } = render(<DrawerPublicacion publicacion={publicacion} open onOpenChange={onOpenChange} />);
        rerender(
            <DrawerPublicacion
                publicacion={{
                    ...publicacion,
                    id: 9,
                    especie: "Pera",
                    variedad: "Williams",
                    productor: { ...publicacion.productor, id: 40, nombreFantasia: "Quinta Norte" },
                    ubicaciones: [{ id: 3, nombreUbicacion: "Quinta", urlMaps: "https://maps.example/quinta" }],
                }}
                open
                onOpenChange={onOpenChange}
            />,
        );
        expect(screen.queryByText("Manzana")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Huerta Productora" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /Local central/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /Depósito/ })).not.toBeInTheDocument();
        expect(screen.getByText("Pera")).toBeInTheDocument();
        expect(screen.getByText("Williams")).toBeInTheDocument();
        expect(screen.getByText("Quinta Norte")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Quinta.*Google Maps/ })).toHaveAttribute("href", "https://maps.example/quinta");
        expect(screen.getByRole("link", { name: "Ver Perfil" })).toHaveAttribute("href", "/productores/Quinta%20Norte?origen=publicaciones");
    });

    it("espera a que cargue la foto antes de mostrar el detalle", () => {
        render(<DrawerPublicacion publicacion={{ ...crearPublicacionProductor(), foto: "/manzana.jpg" }} open onOpenChange={vi.fn()} />);
        expect(screen.queryByRole("dialog", { name: "Detalle de publicación" })).not.toBeInTheDocument();
        fireEvent.load(screen.getByAltText("Foto de Manzana"));
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
    });

    it("muestra el detalle y el reemplazo si falla la foto", () => {
        render(<DrawerPublicacion publicacion={{ ...crearPublicacionProductor(), foto: "/foto-inexistente.jpg" }} open onOpenChange={vi.fn()} />);
        fireEvent.error(screen.getByAltText("Foto de Manzana"));
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
        expect(screen.getByText("Foto", { exact: true })).toBeInTheDocument();
    });

    it("amplía la foto y permite cerrarla sin cerrar el detalle", async () => {
        const onOpenChange = vi.fn();
        render(<DrawerPublicacion publicacion={{ ...crearPublicacionProductor(), foto: "/manzana.jpg" }} open onOpenChange={onOpenChange} />);
        fireEvent.load(screen.getByAltText("Foto de Manzana"));
        fireEvent.click(screen.getByRole("button", { name: "Ampliar foto de Manzana" }));
        const dialogoFoto = screen.getByRole("dialog", { name: "Foto ampliada del producto" });
        expect(dialogoFoto).toContainElement(screen.getByAltText("Foto ampliada de Manzana"));
        expect(screen.getByAltText("Foto ampliada de Manzana")).toHaveAttribute("src", "/manzana.jpg");
        fireEvent.click(screen.getByRole("button", { name: "Cerrar foto ampliada" }));
        await waitFor(() => {expect(screen.queryByRole("dialog", { name: "Foto ampliada del producto" })).not.toBeInTheDocument()});
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("restaura el foco al botón de ampliar la foto después de cerrar el diálogo", async () => {
        render(<DrawerPublicacion publicacion={{ ...crearPublicacionProductor(), foto: "/manzana.jpg" }} open onOpenChange={vi.fn()} />);
        fireEvent.load(screen.getByAltText("Foto de Manzana"));
        const botonAmpliar = screen.getByRole("button", { name: "Ampliar foto de Manzana" });
        fireEvent.click(botonAmpliar);
        fireEvent.click(screen.getByRole("button", { name: "Cerrar foto ampliada" }));
        await waitFor(() => {expect(botonAmpliar).toHaveFocus()});
    });

    it("cierra la foto ampliada con Escape sin cerrar el detalle", async () => {
        const onOpenChange = vi.fn();
        render(<DrawerPublicacion publicacion={{ ...crearPublicacionProductor(), foto: "/manzana.jpg" }} open onOpenChange={onOpenChange} />);
        fireEvent.load(screen.getByAltText("Foto de Manzana"));
        fireEvent.click(screen.getByRole("button", { name: "Ampliar foto de Manzana" }));
        const dialogoFoto = screen.getByRole("dialog", { name: "Foto ampliada del producto" });
        expect(dialogoFoto).toContainElement(screen.getByAltText("Foto ampliada de Manzana"));
        fireEvent.keyDown(dialogoFoto, { key: "Escape", code: "Escape", keyCode: 27 });
        await waitFor(() => { expect(screen.queryByRole("dialog", { name: "Foto ampliada del producto" })).not.toBeInTheDocument()});
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("muestra el comentario del publicador", () => {
        render(<DrawerPublicacion publicacion={{ ...crearPublicacion(), comentario: "Cosecha de esta semana" }} open onOpenChange={vi.fn()} />);

        expect(screen.getByText("Comentario")).toBeInTheDocument();
        expect(screen.getByText("Cosecha de esta semana")).toBeInTheDocument();
    });

    it.each([null, undefined, "   "])("muestra un guion cuando el comentario es %j", (comentario) => {
        render(<DrawerPublicacion publicacion={{ ...crearPublicacion(), comentario }} open onOpenChange={vi.fn()} />);

        expect(screen.getByText("Comentario").nextElementSibling).toHaveTextContent("-");
    });
});
