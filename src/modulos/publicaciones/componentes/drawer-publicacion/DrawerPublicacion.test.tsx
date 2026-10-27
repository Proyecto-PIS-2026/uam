import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/PublicacionesOperador";
import type { PublicacionProductorListado } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";
import { DrawerPublicacion } from "./DrawerPublicacion";

vi.mock("@/compartido/componentes/DrawerDeslizable", () => ({
    default: ({ open, onClose, children, ModalProps }: { open: boolean; onClose: () => void; children: ReactNode; ModalProps?: { keepMounted?: boolean } }) => open || ModalProps?.keepMounted ? (
        <div role="dialog" aria-label="Detalle de publicación" hidden={!open}>
            <button onClick={onClose}>Cerrar detalle</button>
            {children}
        </div>
    ) : null,
}));

vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({src, alt, onLoad, onError, style}: {
            src: string;
            alt: string;
            onLoad?: React.ReactEventHandler<HTMLImageElement>;
            onError?: React.ReactEventHandler<HTMLImageElement>;
            style?: React.CSSProperties;
        }) => createElement("img", {src, alt, onLoad, onError, style})
    };
});

vi.mock("./TextoAjustable", () => ({
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

describe("DrawerPublicacion", () => {
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
        await vi.waitFor(() => {
            expect(screen.queryByRole("button", { name: "Cerrar foto ampliada" })).not.toBeInTheDocument();
        });
        expect(screen.queryByRole("dialog", { name: "Detalle de publicación" })).not.toBeInTheDocument();

        if (cambio === "cerrar") {
            rerender(<DrawerPublicacion publicacion={original} open onOpenChange={onOpenChange} />);
        } else {
            fireEvent.load(screen.getByAltText("Foto de Tomate"));
        }
        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Cerrar foto ampliada" })).not.toBeInTheDocument();
    });

    it("muestra los datos de la publicación y los botones de contacto", () => {
        render(<DrawerPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        for (const texto of ["Tomate", "Perita", "Cajón", "Mediano", "Primera", "País", "Uruguay", "Huerta Sur"]) {
            expect(screen.getByText(texto)).toBeInTheDocument();
        }
        expect(screen.getByRole("link", { name: "Ver Perfil" })).toHaveAttribute("href", "/operadores/Huerta%20Sur?origen=publicaciones");
        expect(screen.getByRole("link", { name: "Contactar a Huerta Sur por WhatsApp" })).toBeInTheDocument();
    });
    it("no muestra el detalle cuando está cerrado", () => {
        render(<DrawerPublicacion publicacion={crearPublicacion()} open={false} onOpenChange={vi.fn()} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("Tomate")).not.toBeVisible();
    });
    it("no muestra datos ni acciones de contacto sin una publicación", () => {
        render(<DrawerPublicacion publicacion={null} open onOpenChange={vi.fn()} />,);
        expect(screen.queryByText("Publicado por")).not.toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Ver Perfil" })).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /WhatsApp/i })).not.toBeInTheDocument();
    });
    it("oculta la variedad cuando es un guion", () => {
        render(<DrawerPublicacion publicacion={{ ...crearPublicacion(), variedad: "-", cantidadUnidades: 10 }} open onOpenChange={vi.fn()} />);
        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.queryByText("-")).not.toBeInTheDocument();
    });
    it("muestra la foto con la especie como texto alternativo", () => {
        render(<DrawerPublicacion publicacion={{ ...crearPublicacion(), foto: "/tomate.jpg", }} open onOpenChange={vi.fn()} />);
        fireEvent.load(screen.getByAltText("Foto de Tomate"));
        expect(screen.getByRole("img", { name: "Foto de Tomate" })).toBeInTheDocument();
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
    it.each([null])(
        "muestra 'Consultar precio' cuando el precio es %s",
        (precio) => {
            render(<DrawerPublicacion publicacion={{ ...crearPublicacion(), precio }} open onOpenChange={vi.fn()} />);
            expect(screen.getByText("Consultar precio")).toBeInTheDocument();
            expect(screen.queryByText("$0")).not.toBeInTheDocument();
        },
    );

    it("respeta la apertura controlada y notifica el cierre", () => {
        const onOpenChange = vi.fn();
        const publicacion = crearPublicacion();
        const { rerender } = render(<DrawerPublicacion publicacion={publicacion} open={false} onOpenChange={onOpenChange} />,);
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        rerender(<DrawerPublicacion publicacion={publicacion} open onOpenChange={onOpenChange} />);
        fireEvent.click(
            screen.getByRole("button", {
                name: "Cerrar detalle",
            }),
        );
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
        rerender(<DrawerPublicacion publicacion={publicacion} open={false} onOpenChange={onOpenChange} />,);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
        expect(screen.queryByText("Huerta Sur")).not.toBeInTheDocument();
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.getByText("Gala")).toBeInTheDocument();
        expect(screen.getByText("$80")).toBeInTheDocument();
        expect(screen.getByText("Frutas Norte")).toBeInTheDocument();
        rerender(<DrawerPublicacion publicacion={null} open onOpenChange={onOpenChange} />);
        expect(screen.queryByText("Manzana")).not.toBeInTheDocument();
        expect(screen.queryByText("Publicado por")).not.toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});

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

describe("DrawerPublicacion con productores", () => {
    it("muestra los datos de la publicación y el perfil del productor", () => {
        render(
            <DrawerPublicacion
                publicacion={crearPublicacionProductor()}
                open
                onOpenChange={vi.fn()}
            />
        );
        for (const texto of ["Manzana", "Gala", "$120", "Caja", "Grande", "Primera", "20", "Uruguay", "Huerta Productora"]) {
            expect(screen.getByText(texto, { exact: true })).toBeInTheDocument();
        }
        expect(screen.getByRole("link", { name: "Ver Perfil" })).toHaveAttribute("href", "/productores/Huerta%20Productora?origen=publicaciones");
    });

    it("construye el enlace de WhatsApp con el teléfono del productor", () => {
        render(
            <DrawerPublicacion
                publicacion={crearPublicacionProductor()}
                open
                onOpenChange={vi.fn()}
            />
        );
        const enlace = screen.getByRole("link", {name: "Contactar a Huerta Productora por WhatsApp"});
        const url = new URL(enlace.getAttribute("href")!);
        expect(url.origin).toBe("https://web.whatsapp.com");
        expect(url.pathname).toBe("/send");
        expect(url.searchParams.get("phone")).toBe("59899123456");
        expect(url.searchParams.get("text")).toBe("Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.");
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
            />
        );
        expect(screen.getByText("Puntos de retiro")).toBeInTheDocument();
        for (const ubicacion of publicacion.ubicaciones) {
            const enlace = screen.getByRole("link", {name: new RegExp(ubicacion.nombreUbicacion)});
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
            />
        );
        expect(screen.getByText("No hay puntos de retiro informados.")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /Google Maps/ })).not.toBeInTheDocument();
    });

    it("no muestra el detalle del productor cuando está cerrado", () => {
        render(
            <DrawerPublicacion
                publicacion={crearPublicacionProductor()}
                open={false}
                onOpenChange={vi.fn()}
            />
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("Huerta Productora")).not.toBeVisible();
    });

    it("notifica el cierre desde el botón del encabezado", () => {
        const onOpenChange = vi.fn();
        render(
            <DrawerPublicacion
                publicacion={crearPublicacionProductor()}
                open
                onOpenChange={onOpenChange}
            />
        );
        fireEvent.click(screen.getByRole("button", { name: "Detalle de consulta" }));
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    it("notifica el cierre al visitar el perfil del productor", () => {
        const onOpenChange = vi.fn();
        render(
            <DrawerPublicacion
                publicacion={crearPublicacionProductor()}
                open
                onOpenChange={onOpenChange}
            />
        );
        const enlace = screen.getByRole("link", { name: "Ver Perfil" });
        enlace.addEventListener("click", (evento) => {evento.preventDefault()});
        fireEvent.click(enlace);
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    it("actualiza el productor y los puntos de retiro al cambiar la publicación", () => {
        const publicacion = crearPublicacionProductor();
        const onOpenChange = vi.fn();
        const { rerender } = render(
            <DrawerPublicacion
                publicacion={publicacion}
                open
                onOpenChange={onOpenChange}
            />
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
            />
        );
        expect(screen.queryByText("Manzana")).not.toBeInTheDocument();
        expect(screen.queryByText("Huerta Productora")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /Local central/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /Depósito/ })).not.toBeInTheDocument();
        expect(screen.getByText("Pera")).toBeInTheDocument();
        expect(screen.getByText("Williams")).toBeInTheDocument();
        expect(screen.getByText("Quinta Norte")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Quinta.*Google Maps/ })).toHaveAttribute("href", "https://maps.example/quinta");
        expect(screen.getByRole("link", { name: "Ver Perfil" })).toHaveAttribute("href", "/productores/Quinta%20Norte?origen=publicaciones");
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
            />
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        fireEvent.load(screen.getByAltText("Foto de Manzana"));
        expect(screen.getByRole("dialog", {name: "Detalle de publicación",})).toBeInTheDocument();
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
            />
        );
        fireEvent.error(screen.getByAltText("Foto de Manzana"));
        expect(screen.getByRole("dialog", {name: "Detalle de publicación"})).toBeInTheDocument();
        expect(screen.getByText("Foto", { exact: true })).toBeInTheDocument();
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
            />
        );
        fireEvent.load(screen.getByAltText("Foto de Manzana"));
        fireEvent.click(screen.getByRole("button", {name: "Ampliar foto de Manzana"}));
        expect(screen.getByRole("dialog")).toContainElement(screen.getByAltText("Foto ampliada de Manzana"));
        expect(screen.getByAltText("Foto ampliada de Manzana")).toHaveAttribute("src", "/manzana.jpg");
        fireEvent.click(screen.getByRole("button", {name: "Cerrar foto ampliada"}));
        await vi.waitFor(() => {
        expect(screen.queryByRole("button", {name: "Cerrar foto ampliada"})).not.toBeInTheDocument()});
        expect(screen.getByRole("dialog", {name: "Detalle de publicación"})).toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});


