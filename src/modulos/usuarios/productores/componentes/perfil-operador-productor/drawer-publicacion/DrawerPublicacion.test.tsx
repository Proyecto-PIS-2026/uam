
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactEventHandler, ReactNode } from "react";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/PublicacionesOperador";
import type { PublicacionProductorListado } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";
import { DrawerPublicacion } from "./DrawerPublicacion";

const usarMediaQueryMock = vi.hoisted(() => vi.fn(() => true));

class ResizeObserverMock {
    static instancias: ResizeObserverMock[] = [];

    private callback: ResizeObserverCallback;

    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        ResizeObserverMock.instancias.push(this);
    }

    notificar() {
        this.callback([], this as unknown as ResizeObserver);
    }
}

vi.mock("@mui/material/useMediaQuery", () => ({
    default: usarMediaQueryMock,
}));

vi.mock("@/compartido/componentes/DrawerDeslizable", async () => {
    const { createElement, useEffect, useRef } = await import("react");

    function DrawerDeslizableMock({
        open,
        onClose,
        children,
        ModalProps,
        slotProps,
        anchor,
    }: {
        open: boolean;
        onClose: () => void;
        children: ReactNode;
        ModalProps?: {
            keepMounted?: boolean;
            disableRestoreFocus?: boolean;
            onTransitionEnter?: () => void;
            onTransitionExited?: () => void;
        };
        slotProps?: {
            paper?: {
                role?: string;
                "aria-label"?: string;
            };
        };
        anchor: "right" | "bottom";
    }) {
        const abiertoAnterior = useRef(false);
        const modalPropsRef = useRef(ModalProps);
        modalPropsRef.current = ModalProps;

        useEffect(() => {
            if (open && !abiertoAnterior.current) {
                modalPropsRef.current?.onTransitionEnter?.();
            }

            if (!open && abiertoAnterior.current) {
                modalPropsRef.current?.onTransitionExited?.();
            }

            abiertoAnterior.current = open;
        }, [open]);

        if (!open && !ModalProps?.keepMounted) {
            return null;
        }

        return createElement(
            "div",
            {
                role: slotProps?.paper?.role ?? "dialog",
                "aria-label": slotProps?.paper?.["aria-label"] ?? "Detalle de publicación",
                "data-testid": "drawer",
                "data-anchor": anchor,
                hidden: !open,
            },
            createElement(
                "button",
                {
                    type: "button",
                    onClick: onClose,
                },
                "Cerrar detalle",
            ),
            children,
        );
    }

    return {
        default: DrawerDeslizableMock,
    };
});

vi.mock("@/modulos/publicaciones/componentes/ImagenPublicacion", async () => {
    const { createElement, useState } = await import("react");

    function ImagenPublicacionMock({
        src,
        alt,
        onLoad,
        onError,
        reemplazo,
    }: {
        src: string | null;
        alt: string;
        onLoad?: ReactEventHandler<HTMLImageElement>;
        onError?: ReactEventHandler<HTMLImageElement>;
        reemplazo?: ReactNode;
    }) {
        const [error, setError] = useState(false);

        if (!src || error) {
            return createElement(
                "div",
                { "data-testid": "contenedor-imagen-fallback" },
                reemplazo,
            );
        }

        return createElement("img", {
            src,
            alt,
            onLoad,
            onError: (event: React.SyntheticEvent<HTMLImageElement>) => {
                setError(true);
                onError?.(event);
            },
        });
    }

    return {
        default: ImagenPublicacionMock,
    };
});

vi.mock("@mui/material/Dialog", async () => {
    const { createElement, useEffect, useRef } = await import("react");

    function DialogMock({
        open,
        children,
        "aria-label": ariaLabel,
        slotProps,
    }: {
        open: boolean;
        children: ReactNode;
        "aria-label": string;
        slotProps?: {
            transition?: {
                onExited?: () => void;
            };
        };
    }) {
        const abiertoAnterior = useRef(false);
        const slotPropsRef = useRef(slotProps);
        slotPropsRef.current = slotProps;

        useEffect(() => {
            if (abiertoAnterior.current && !open) {
                slotPropsRef.current?.transition?.onExited?.();
            }

            abiertoAnterior.current = open;
        }, [open]);

        if (!open) {
            return null;
        }

        return createElement(
            "div",
            {
                role: "dialog",
                "aria-label": ariaLabel,
            },
            children,
        );
    }

    return {
        default: DialogMock,
    };
});

vi.mock("@mui/icons-material/ImageOutlined", () => ({
    default: () => <svg data-testid="ImageOutlinedIcon" />,
}));

vi.mock("@mui/icons-material/WhatsApp", () => ({
    default: () => <svg data-testid="WhatsAppIcon" />,
}));

vi.mock("@mui/icons-material/Close", () => ({
    default: () => <svg data-testid="CloseIcon" />,
}));

vi.mock("../TextoAjustable", () => ({
    default: ({ children }: { children: ReactNode }) => (
        <span>{children}</span>
    ),
}));

function crearPublicacion(): PublicacionListado {
    return {
        id: 7,
        especie: "Tomate",
        variedad: "Perita",
        precio: 150,
        fecha: "2026-10-03T15:00:00.000Z",
        foto: null,
        presentacion: "Cajón",
        categoria: "Primera",
        calibre: "Mediano",
        codigoCalibre: "M",
        pais: "Uruguay",
        tipoPublicacion: "OPERADOR",
        operador: {
            id: 10,
            nombreFantasia: "Huerta Sur",
            whatsApp: "099123456",
        },
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
        presentacion: "Caja",
        cantidadUnidades: 20,
        categoria: "Primera",
        calibre: "Grande",
        codigoCalibre: "G",
        pais: "Uruguay",
        tipoPublicacion: "PRODUCTOR",
        productor: {
            id: 30,
            nombreFantasia: "Huerta Productora",
            fotoPerfil: null,
            whatsApp: "+598 99 123 456",
        },
        ubicaciones: [
            {
                id: 1,
                nombreUbicacion: "Local central",
                urlMaps: "https://maps.example/central",
            },
            {
                id: 2,
                nombreUbicacion: "Depósito",
                urlMaps: "https://maps.example/deposito",
            },
        ],
    };
}

const mensajeWhatsApp = "Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.";

function configurarRequestAnimationFrame() {
    const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
    });

    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);

    return requestAnimationFrameMock;
}

describe("DrawerPublicacion", () => {
    beforeEach(() => {
        usarMediaQueryMock.mockReturnValue(true);
        ResizeObserverMock.instancias.length = 0;
        vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it.each(["otra publicación", "otra foto", "sin publicación"])(
        "vuelve a esperar la foto al regresar desde %s",
        (cambio) => {
            const original = {
                ...crearPublicacion(),
                foto: "/tomate.jpg",
            };

            const siguiente = cambio === "sin publicación" ? null : {
                ...original,
                id: cambio === "otra publicación" ? original.id + 1 : original.id,
                foto: "/tomate-nuevo.jpg",
            };

            const onOpenChange = vi.fn();

            const { rerender } = render(
                <DrawerPublicacion
                    publicacion={original}
                    open
                    onOpenChange={onOpenChange}
                />,
            );

            fireEvent.load(screen.getByAltText("Foto de Tomate"));

            expect(screen.getByRole("dialog", {
                name: "Detalle de publicación",
            })).toBeInTheDocument();

            rerender(
                <DrawerPublicacion
                    publicacion={siguiente}
                    open
                    onOpenChange={onOpenChange}
                />,
            );

            expect(screen.queryByRole("dialog", {
                name: "Detalle de publicación",
            })).not.toBeInTheDocument();

            rerender(
                <DrawerPublicacion
                    publicacion={original}
                    open
                    onOpenChange={onOpenChange}
                />,
            );

            expect(screen.queryByRole("dialog", {
                name: "Detalle de publicación",
            })).not.toBeInTheDocument();

            fireEvent.load(screen.getByAltText("Foto de Tomate"));

            expect(screen.getByRole("dialog", {
                name: "Detalle de publicación",
            })).toBeInTheDocument();
        },
    );

    it.each(["cerrar", "cambiar"])(
        "descarta la foto ampliada al %s la consulta",
        async (cambio) => {
            const original = {
                ...crearPublicacion(),
                foto: "/tomate.jpg",
            };

            const onOpenChange = vi.fn();

            const { rerender } = render(
                <DrawerPublicacion
                    publicacion={original}
                    open
                    onOpenChange={onOpenChange}
                />,
            );

            fireEvent.load(screen.getByAltText("Foto de Tomate"));

            fireEvent.click(
                screen.getByRole("button", {
                    name: "Ampliar foto de Tomate",
                }),
            );

            expect(screen.getByRole("button", {
                name: "Cerrar foto ampliada",
            })).toBeInTheDocument();

            const siguiente = cambio === "cambiar"
                ? { ...original, foto: "/tomate-nuevo.jpg" }
                : original;

            rerender(
                <DrawerPublicacion
                    publicacion={siguiente}
                    open={cambio === "cambiar"}
                    onOpenChange={onOpenChange}
                />,
            );

            await waitFor(() => {
                expect(screen.queryByRole("button", {
                    name: "Cerrar foto ampliada",
                })).not.toBeInTheDocument();
            });

            expect(screen.queryByRole("dialog", {
                name: "Detalle de publicación",
            })).not.toBeInTheDocument();

            if (cambio === "cerrar") {
                rerender(
                    <DrawerPublicacion
                        publicacion={original}
                        open
                        onOpenChange={onOpenChange}
                    />,
                );
            } else {
                fireEvent.load(screen.getByAltText("Foto de Tomate"));
            }

            expect(screen.getByRole("dialog", {
                name: "Detalle de publicación",
            })).toBeInTheDocument();

            expect(screen.queryByRole("button", {
                name: "Cerrar foto ampliada",
            })).not.toBeInTheDocument();
        },
    );

    it("muestra los datos de la publicación y los botones de contacto", () => {
        render(
            <DrawerPublicacion
                publicacion={crearPublicacion()}
                open
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.getByRole("dialog", {
            name: "Detalle de publicación",
        })).toBeInTheDocument();

        for (const texto of ["Tomate", "Perita", "Cajón", "Mediano", "Primera", "País", "Uruguay"]) {
            expect(screen.getByText(texto)).toBeInTheDocument();
        }

        expect(screen.getByTestId("WhatsAppIcon")).toBeInTheDocument();
    });

    it("no muestra el detalle cuando está cerrado", () => {
        render(
            <DrawerPublicacion
                publicacion={crearPublicacion()}
                open={false}
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.queryByRole("dialog", {
            name: "Detalle de publicación",
        })).not.toBeInTheDocument();

        expect(screen.getByText("Tomate")).not.toBeVisible();
    });

    it("no muestra datos ni acciones de contacto sin una publicación", () => {
        render(
            <DrawerPublicacion
                publicacion={null}
                open
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.queryByText("Publicado por")).not.toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();

        expect(screen.queryByRole("dialog", {
            name: "Detalle de publicación",
        })).not.toBeInTheDocument();

        expect(screen.queryByRole("link", {
            name: /WhatsApp/i,
        })).not.toBeInTheDocument();
    });

    it("oculta la variedad cuando es un guion", () => {
        render(
            <DrawerPublicacion
                publicacion={{
                    ...crearPublicacion(),
                    variedad: "-",
                    cantidadUnidades: 10,
                }}
                open
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.queryAllByText("-")).toEqual([screen.getByText("Comentario").nextElementSibling]);
    });

    it("muestra la foto con la especie como texto alternativo", () => {
        render(
            <DrawerPublicacion
                publicacion={{
                    ...crearPublicacion(),
                    foto: "/tomate.jpg",
                }}
                open
                onOpenChange={vi.fn()}
            />,
        );

        fireEvent.load(screen.getByAltText("Foto de Tomate"));

        expect(screen.getByRole("img", {
            name: "Foto de Tomate",
        })).toBeInTheDocument();

        expect(screen.queryByTestId("ImageOutlinedIcon")).not.toBeInTheDocument();
    });

    it("muestra un reemplazo cuando no hay foto", () => {
        render(
            <DrawerPublicacion
                publicacion={crearPublicacion()}
                open
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.getByTestId("ImageOutlinedIcon")).toBeInTheDocument();
        expect(screen.getByText("Foto")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("muestra un reemplazo cuando falla la carga de la foto", () => {
        render(
            <DrawerPublicacion
                publicacion={{
                    ...crearPublicacion(),
                    foto: "/foto-inexistente.jpg",
                }}
                open
                onOpenChange={vi.fn()}
            />,
        );

        fireEvent.error(screen.getByAltText("Foto de Tomate"));

        expect(screen.getByTestId("ImageOutlinedIcon")).toBeInTheDocument();
        expect(screen.getByText("Foto")).toBeInTheDocument();

        expect(screen.getByRole("dialog", {
            name: "Detalle de publicación",
        })).toBeInTheDocument();
    });

    it.each([
        [150, "$150"],
        [1234.5, "$1234.5"],
        [0, "$0"],
    ])("muestra el precio %s", (precio, esperado) => {
        render(
            <DrawerPublicacion
                publicacion={{
                    ...crearPublicacion(),
                    precio,
                }}
                open
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.getByText(esperado)).toBeInTheDocument();
        expect(screen.queryByText("Consultar precio")).not.toBeInTheDocument();
    });

    it("muestra Consultar precio cuando el precio es nulo", () => {
        render(
            <DrawerPublicacion
                publicacion={{
                    ...crearPublicacion(),
                    precio: null,
                }}
                open
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.getByText("Consultar precio")).toBeInTheDocument();
        expect(screen.queryByText("$0")).not.toBeInTheDocument();
    });

    it("respeta la apertura controlada y notifica el cierre", () => {
        const onOpenChange = vi.fn();
        const publicacion = crearPublicacion();

        const { rerender } = render(
            <DrawerPublicacion
                publicacion={publicacion}
                open={false}
                onOpenChange={onOpenChange}
            />,
        );

        expect(onOpenChange).not.toHaveBeenCalled();

        expect(screen.queryByRole("dialog", {
            name: "Detalle de publicación",
        })).not.toBeInTheDocument();

        rerender(
            <DrawerPublicacion
                publicacion={publicacion}
                open
                onOpenChange={onOpenChange}
            />,
        );

        fireEvent.click(screen.getByRole("button", {
            name: "Cerrar detalle",
        }));

        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);

        rerender(
            <DrawerPublicacion
                publicacion={publicacion}
                open={false}
                onOpenChange={onOpenChange}
            />,
        );

        expect(screen.queryByRole("dialog", {
            name: "Detalle de publicación",
        })).not.toBeInTheDocument();
    });

    it("notifica el cierre desde el botón del encabezado", () => {
        const onOpenChange = vi.fn();

        render(
            <DrawerPublicacion
                publicacion={crearPublicacion()}
                open
                onOpenChange={onOpenChange}
            />,
        );

        fireEvent.click(screen.getByRole("button", {
            name: "Detalle de consulta",
        }));

        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    it("actualiza el detalle al seleccionar otra publicación y permite quitarla", () => {
        const onOpenChange = vi.fn();

        const { rerender } = render(
            <DrawerPublicacion
                publicacion={crearPublicacion()}
                open
                onOpenChange={onOpenChange}
            />,
        );

        rerender(
            <DrawerPublicacion
                publicacion={{
                    ...crearPublicacion(),
                    id: 2,
                    especie: "Manzana",
                    variedad: "Gala",
                    precio: 80,
                    fecha: "2026-10-03T15:00:00.000Z",
                    operador: {
                        id: 20,
                        nombreFantasia: "Frutas Norte",
                        whatsApp: "098654321",
                    },
                }}
                open
                onOpenChange={onOpenChange}
            />,
        );

        expect(screen.queryByText("Tomate")).not.toBeInTheDocument();
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.getByText("Gala")).toBeInTheDocument();
        expect(screen.getByText("$80")).toBeInTheDocument();

        expect(screen.getByRole("link", {
            name: "Contactar a Frutas Norte por WhatsApp",
        })).toBeInTheDocument();

        rerender(
            <DrawerPublicacion
                publicacion={null}
                open
                onOpenChange={onOpenChange}
            />,
        );

        expect(screen.queryByText("Manzana")).not.toBeInTheDocument();
        expect(screen.queryByText("Publicado por")).not.toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("utiliza el anclaje derecho en pantallas web", () => {
        usarMediaQueryMock.mockReturnValue(true);

        render(
            <DrawerPublicacion
                publicacion={crearPublicacion()}
                open
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.getByTestId("drawer")).toHaveAttribute(
            "data-anchor",
            "right",
        );
    });

    it("utiliza el anclaje inferior en pantallas móviles", () => {
        usarMediaQueryMock.mockReturnValue(false);

        render(
            <DrawerPublicacion
                publicacion={crearPublicacion()}
                open
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.getByTestId("drawer")).toHaveAttribute(
            "data-anchor",
            "bottom",
        );
    });

    it("observa el contenido, actualiza el pie cuando cambia el scroll y desconecta el observer", () => {
        const publicacion = crearPublicacion();

        const { container, rerender } = render(
            <DrawerPublicacion
                publicacion={publicacion}
                open
                onOpenChange={vi.fn()}
            />,
        );

        const etiquetaPresentacion = screen.getByText("Presentación");
        const contenido = etiquetaPresentacion.parentElement?.parentElement?.parentElement as HTMLDivElement;
        const pie = contenido.parentElement?.lastElementChild as HTMLDivElement;

        const observer = ResizeObserverMock.instancias.at(-1);

        expect(observer).toBeDefined();
        expect(observer?.observe).toHaveBeenCalledTimes(1 + contenido.children.length);

        Object.defineProperty(contenido, "scrollHeight", {
            configurable: true,
            value: 500,
        });

        Object.defineProperty(contenido, "clientHeight", {
            configurable: true,
            value: 200,
        });

        act(() => {
            observer?.notificar();
        });

        expect(pie.className).toContain("pieConScroll");

        Object.defineProperty(contenido, "scrollHeight", {
            configurable: true,
            value: 200,
        });

        act(() => {
            observer?.notificar();
        });

        expect(pie.className).not.toContain("pieConScroll");

        rerender(
            <DrawerPublicacion
                publicacion={publicacion}
                open={false}
                onOpenChange={vi.fn()}
            />,
        );

        expect(observer?.disconnect).toHaveBeenCalledOnce();
        expect(container.querySelector('[class*="contenidoScrollable"]')).toBeInTheDocument();
    });

    it("restaura el foco al elemento que estaba activo antes de cerrar el drawer", () => {
        const elementoOrigen = document.createElement("button");
        document.body.appendChild(elementoOrigen);
        elementoOrigen.focus();

        const foco = vi.spyOn(elementoOrigen, "focus");
        const requestAnimationFrameMock = configurarRequestAnimationFrame();

        const publicacion = crearPublicacion();

        const { rerender } = render(
            <DrawerPublicacion
                publicacion={publicacion}
                open
                onOpenChange={vi.fn()}
            />,
        );

        expect(document.activeElement).toBe(elementoOrigen);

        rerender(
            <DrawerPublicacion
                publicacion={publicacion}
                open={false}
                onOpenChange={vi.fn()}
            />,
        );

        expect(requestAnimationFrameMock).toHaveBeenCalledOnce();
        expect(foco).toHaveBeenCalledOnce();
        expect(document.activeElement).toBe(elementoOrigen);

        elementoOrigen.remove();
    });

    it("no intenta restaurar el foco si el elemento anterior ya no está conectado", () => {
        const elementoOrigen = document.createElement("button");
        document.body.appendChild(elementoOrigen);
        elementoOrigen.focus();

        const foco = vi.spyOn(elementoOrigen, "focus");
        const requestAnimationFrameMock = configurarRequestAnimationFrame();

        const publicacion = crearPublicacion();

        const { rerender } = render(
            <DrawerPublicacion
                publicacion={publicacion}
                open
                onOpenChange={vi.fn()}
            />,
        );

        elementoOrigen.remove();

        rerender(
            <DrawerPublicacion
                publicacion={publicacion}
                open={false}
                onOpenChange={vi.fn()}
            />,
        );

        expect(requestAnimationFrameMock).toHaveBeenCalledOnce();
        expect(foco).not.toHaveBeenCalled();
        expect(document.activeElement).not.toBe(elementoOrigen);
    });

    it("registra el contacto de WhatsApp de un operador", () => {
        const fetchMock = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("fetch", fetchMock);

        render(
            <DrawerPublicacion
                publicacion={crearPublicacion()}
                open
                onOpenChange={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole("link", {
            name: "Contactar a Huerta Sur por WhatsApp",
        }));

        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
            "/api/estadisticas/whatsapp",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    tipo: "OPERADOR",
                    entidadId: 10,
                }),
                keepalive: true,
            },
        );
    });

    it("registra el contacto de WhatsApp de un productor", () => {
        const fetchMock = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("fetch", fetchMock);

        render(
            <DrawerPublicacion
                publicacion={crearPublicacionProductor()}
                open
                onOpenChange={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole("link", {
            name: "Contactar a Huerta Productora por WhatsApp",
        }));

        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
            "/api/estadisticas/whatsapp",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    tipo: "PRODUCTOR",
                    entidadId: 30,
                }),
                keepalive: true,
            },
        );
    });

    it("registra el error en consola cuando falla el registro del contacto", async () => {
        const error = new Error("Error de conexión");
        const fetchMock = vi.fn().mockRejectedValue(error);
        const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});

        vi.stubGlobal("fetch", fetchMock);

        render(
            <DrawerPublicacion
                publicacion={crearPublicacionProductor()}
                open
                onOpenChange={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole("link", {
            name: "Contactar a Huerta Productora por WhatsApp",
        }));

        await waitFor(() => {
            expect(registrarError).toHaveBeenCalledExactlyOnceWith(
                "Error al registrar contacto:",
                error,
            );
        });

        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("prepara el enlace de WhatsApp con el teléfono y el mensaje del operador", () => {
        render(
            <DrawerPublicacion
                publicacion={crearPublicacion()}
                open
                onOpenChange={vi.fn()}
            />,
        );

        const enlace = screen.getByRole("link", {
            name: "Contactar a Huerta Sur por WhatsApp",
        });

        const url = new URL(enlace.getAttribute("href")!);

        expect(url.origin).toBe("https://web.whatsapp.com");
        expect(url.pathname).toBe("/send");
        expect(url.searchParams.get("phone")).toBe("099123456");
        expect(url.searchParams.get("text")).toBe(mensajeWhatsApp);
    });
});

describe("DrawerPublicacion con productores", () => {
    beforeEach(() => {
        usarMediaQueryMock.mockReturnValue(true);
        ResizeObserverMock.instancias.length = 0;
        vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("muestra los datos de la publicación y el perfil del productor", () => {
        render(
            <DrawerPublicacion
                publicacion={crearPublicacionProductor()}
                open
                onOpenChange={vi.fn()}
            />,
        );

        for (const texto of [
            "Manzana",
            "Gala",
            "$120",
            "Caja",
            "Grande",
            "Primera",
            "20",
            "Uruguay",
        ]) {
            expect(screen.getByText(texto, {
                exact: true,
            })).toBeInTheDocument();
        }
    });

    it("construye el enlace de WhatsApp con el teléfono del productor", () => {
        render(
            <DrawerPublicacion
                publicacion={crearPublicacionProductor()}
                open
                onOpenChange={vi.fn()}
            />,
        );

        const enlace = screen.getByRole("link", {
            name: "Contactar a Huerta Productora por WhatsApp",
        });

        const url = new URL(enlace.getAttribute("href")!);

        expect(url.origin).toBe("https://web.whatsapp.com");
        expect(url.pathname).toBe("/send");
        expect(url.searchParams.get("phone")).toBe("59899123456");
        expect(url.searchParams.get("text")).toBe(mensajeWhatsApp);

        expect(enlace).toHaveAttribute("target", "_blank");
        expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("muestra los puntos de retiro con sus enlaces", () => {
        const publicacion = crearPublicacionProductor();

        render(
            <DrawerPublicacion
                publicacion={publicacion}
                open
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.getByText("Puntos de retiro")).toBeInTheDocument();

        for (const ubicacion of publicacion.ubicaciones) {
            const enlace = screen.getByRole("link", {
                name: new RegExp(ubicacion.nombreUbicacion),
            });

            expect(enlace).toHaveAttribute("href", ubicacion.urlMaps);
            expect(enlace).toHaveAttribute("target", "_blank");
            expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
        }
    });

    it("informa cuando el productor no tiene puntos de retiro", () => {
        render(
            <DrawerPublicacion
                publicacion={{
                    ...crearPublicacionProductor(),
                    ubicaciones: [],
                }}
                open
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.getByText("No hay puntos de retiro informados.")).toBeInTheDocument();

        expect(screen.queryByRole("link", {
            name: /Google Maps/,
        })).not.toBeInTheDocument();
    });

    it("no muestra el detalle del productor cuando está cerrado", () => {
        render(
            <DrawerPublicacion
                publicacion={crearPublicacionProductor()}
                open={false}
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.queryByRole("dialog", {
            name: "Detalle de publicación",
        })).not.toBeInTheDocument();

        expect(screen.getByText("Manzana")).not.toBeVisible();
    });

    it("actualiza el productor y los puntos de retiro al cambiar la publicación", () => {
        const publicacion = crearPublicacionProductor();
        const onOpenChange = vi.fn();

        const { rerender } = render(
            <DrawerPublicacion
                publicacion={publicacion}
                open
                onOpenChange={onOpenChange}
            />,
        );

        rerender(
            <DrawerPublicacion
                publicacion={{
                    ...publicacion,
                    id: 9,
                    especie: "Pera",
                    variedad: "Williams",
                    productor: {
                        ...publicacion.productor,
                        id: 40,
                        nombreFantasia: "Quinta Norte",
                    },
                    ubicaciones: [
                        {
                            id: 3,
                            nombreUbicacion: "Quinta",
                            urlMaps: "https://maps.example/quinta",
                        },
                    ],
                }}
                open
                onOpenChange={onOpenChange}
            />,
        );

        expect(screen.queryByText("Manzana")).not.toBeInTheDocument();
        expect(screen.queryByText("Huerta Productora")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", {
            name: /Local central/,
        })).not.toBeInTheDocument();

        expect(screen.queryByRole("link", {
            name: /Depósito/,
        })).not.toBeInTheDocument();

        expect(screen.getByText("Pera")).toBeInTheDocument();
        expect(screen.getByText("Williams")).toBeInTheDocument();

        expect(screen.getByRole("link", {
            name: "Contactar a Quinta Norte por WhatsApp",
        })).toBeInTheDocument();

        expect(screen.getByRole("link", {
            name: /Quinta.*Google Maps/,
        })).toHaveAttribute("href", "https://maps.example/quinta");
    });

    it("espera a que cargue la foto antes de mostrar el detalle", () => {
        render(
            <DrawerPublicacion
                publicacion={{
                    ...crearPublicacionProductor(),
                    foto: "/manzana.jpg",
                }}
                open
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.queryByRole("dialog", {
            name: "Detalle de publicación",
        })).not.toBeInTheDocument();

        fireEvent.load(screen.getByAltText("Foto de Manzana"));

        expect(screen.getByRole("dialog", {
            name: "Detalle de publicación",
        })).toBeInTheDocument();
    });

    it("muestra el detalle y el reemplazo si falla la foto", () => {
        render(
            <DrawerPublicacion
                publicacion={{
                    ...crearPublicacionProductor(),
                    foto: "/foto-inexistente.jpg",
                }}
                open
                onOpenChange={vi.fn()}
            />,
        );

        fireEvent.error(screen.getByAltText("Foto de Manzana"));

        expect(screen.getByRole("dialog", {
            name: "Detalle de publicación",
        })).toBeInTheDocument();

        expect(screen.getByText("Foto", {
            exact: true,
        })).toBeInTheDocument();
    });

    it("amplía la foto y permite cerrarla sin cerrar el detalle", async () => {
        const onOpenChange = vi.fn();

        render(
            <DrawerPublicacion
                publicacion={{
                    ...crearPublicacionProductor(),
                    foto: "/manzana.jpg",
                }}
                open
                onOpenChange={onOpenChange}
            />,
        );

        fireEvent.load(screen.getByAltText("Foto de Manzana"));

        const botonAmpliar = screen.getByRole("button", {
            name: "Ampliar foto de Manzana",
        });

        fireEvent.click(botonAmpliar);

        const dialogoFoto = screen.getByRole("dialog", {
            name: "Foto ampliada del producto",
        });

        expect(dialogoFoto).toContainElement(
            screen.getByAltText("Foto ampliada de Manzana"),
        );

        expect(screen.getByAltText("Foto ampliada de Manzana")).toHaveAttribute(
            "src",
            "/manzana.jpg",
        );

        fireEvent.click(screen.getByRole("button", {
            name: "Cerrar foto ampliada",
        }));

        await waitFor(() => {
            expect(screen.queryByRole("button", {
                name: "Cerrar foto ampliada",
            })).not.toBeInTheDocument();
        });

        expect(screen.getByRole("dialog", {
            name: "Detalle de publicación",
        })).toBeInTheDocument();

        expect(document.activeElement).toBe(botonAmpliar);
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
