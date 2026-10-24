import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/PublicacionesOperador";
import type { PublicacionProductorListado } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";
import { DrawerPublicacionPerfil  } from "./DrawerPublicacionPerfil";

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
    it("muestra los datos de la publicación y los botones de contacto", () => {
        render(<DrawerPublicacionPerfil  publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        for (const texto of ["Tomate", "Perita", "Cajón", "Mediano", "Primera", "País", "Uruguay"]) {
            expect(screen.getByText(texto)).toBeInTheDocument();
        }
        expect(screen.getByRole("link", { name: "Contactar a Huerta Sur por WhatsApp" })).toBeInTheDocument();
    });
    it("no muestra el detalle cuando está cerrado", () => {
        render(<DrawerPublicacionPerfil  publicacion={crearPublicacion()} open={false} onOpenChange={vi.fn()} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("Tomate")).not.toBeVisible();
    });
    it("no muestra datos ni acciones de contacto sin una publicación", () => {
        render(<DrawerPublicacionPerfil  publicacion={null} open onOpenChange={vi.fn()} />,);
        expect(screen.queryByText("Publicado por")).not.toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /WhatsApp/i })).not.toBeInTheDocument();
    });
    it("oculta la variedad cuando es un guion", () => {
        render(<DrawerPublicacionPerfil  publicacion={{ ...crearPublicacion(), variedad: "-" }} open onOpenChange={vi.fn()} />);
        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.queryByText("-")).not.toBeInTheDocument();
    });
    it("muestra la foto con la especie como texto alternativo", () => {
        render(<DrawerPublicacionPerfil  publicacion={{ ...crearPublicacion(), foto: "/tomate.jpg", }} open onOpenChange={vi.fn()} />);
        fireEvent.load(screen.getByAltText("Foto de Tomate"));
        expect(screen.getByRole("img", { name: "Foto de Tomate" })).toBeInTheDocument();
        expect(screen.queryByTestId("ImageOutlinedIcon")).not.toBeInTheDocument();
    });
    it("muestra un reemplazo cuando no hay foto", () => {
        render(<DrawerPublicacionPerfil  publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        expect(screen.getByTestId("ImageOutlinedIcon")).toBeInTheDocument();
        expect(screen.getByText("Foto")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it.each([[150, "$150"], [1234.5, "$1234.5"], [0, "$0"]])("muestra el precio %s", (precio, esperado) => {
        render(<DrawerPublicacionPerfil  publicacion={{ ...crearPublicacion(), precio }} open onOpenChange={vi.fn()} />);
        expect(screen.getByText(esperado)).toBeInTheDocument();
        expect(screen.queryByText("Consultar precio")).not.toBeInTheDocument();
    });
    it.each([null])(
        "muestra 'Consultar precio' cuando el precio es %s",
        (precio) => {
            render(<DrawerPublicacionPerfil  publicacion={{ ...crearPublicacion(), precio }} open onOpenChange={vi.fn()} />);
            expect(screen.getByText("Consultar precio")).toBeInTheDocument();
            expect(screen.queryByText("$0")).not.toBeInTheDocument();
        },
    );

    it("respeta la apertura controlada y notifica el cierre", () => {
        const onOpenChange = vi.fn();
        const publicacion = crearPublicacion();
        const { rerender } = render(<DrawerPublicacionPerfil  publicacion={publicacion} open={false} onOpenChange={onOpenChange} />,);
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        rerender(<DrawerPublicacionPerfil  publicacion={publicacion} open onOpenChange={onOpenChange} />);
        fireEvent.click(
            screen.getByRole("button", {
                name: "Cerrar detalle",
            }),
        );
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
        rerender(<DrawerPublicacionPerfil  publicacion={publicacion} open={false} onOpenChange={onOpenChange} />,);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    it("actualiza el detalle al seleccionar otra publicación y permite quitarla", () => {
        const onOpenChange = vi.fn();
        const { rerender } = render(<DrawerPublicacionPerfil  publicacion={crearPublicacion()} open onOpenChange={onOpenChange} />);
        rerender(
            <DrawerPublicacionPerfil 
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
        expect(screen.getByRole("link", {name: "Contactar a Frutas Norte por WhatsApp"})).toBeInTheDocument();
        rerender(<DrawerPublicacionPerfil  publicacion={null} open onOpenChange={onOpenChange} />);
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
            <DrawerPublicacionPerfil 
                publicacion={crearPublicacionProductor()}
                open
                onOpenChange={vi.fn()}
            />
        );
        for (const texto of ["Manzana", "Gala", "$120", "Caja", "Grande", "Primera", "20", "Uruguay"]) {
            expect(screen.getByText(texto, { exact: true })).toBeInTheDocument();
        }
    });

    it("construye el enlace de WhatsApp con el teléfono del productor", () => {
        render(
            <DrawerPublicacionPerfil 
                publicacion={crearPublicacionProductor()}
                open
                onOpenChange={vi.fn()}
            />
        );
        const enlace = screen.getByRole("link", {name: "Contactar a Huerta Productora por WhatsApp"});
        const url = new URL(enlace.getAttribute("href")!);
        expect(url.origin).toBe("https://wa.me");
        expect(url.pathname).toBe("/59899123456");
        expect(url.searchParams.get("text")).toBe("Hola, vi tu perfil en Mercado UAM y quisiera hacerte una consulta.");
        expect(enlace).toHaveAttribute("target", "_blank");
        expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("no muestra el detalle del productor cuando está cerrado", () => {
        render(
            <DrawerPublicacionPerfil 
                publicacion={crearPublicacionProductor()}
                open={false}
                onOpenChange={vi.fn()}
            />
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", {name: "Contactar a Huerta Productora por WhatsApp"})).not.toBeInTheDocument();
    });

    it("notifica el cierre desde el botón del encabezado", () => {
        const onOpenChange = vi.fn();
        render(
            <DrawerPublicacionPerfil 
                publicacion={crearPublicacionProductor()}
                open
                onOpenChange={onOpenChange}
            />
        );
        fireEvent.click(screen.getByRole("button", { name: "Detalle de consulta" }));
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    it("actualiza la publicación y el contacto del productor al cambiar la publicación", () => {
        const publicacion = crearPublicacionProductor();
        const onOpenChange = vi.fn();
        const { rerender } = render(
            <DrawerPublicacionPerfil 
                publicacion={publicacion}
                open
                onOpenChange={onOpenChange}
            />
        );
        rerender(
            <DrawerPublicacionPerfil 
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
        expect(screen.queryByRole("link", {name: "Contactar a Huerta Productora por WhatsApp"})).not.toBeInTheDocument();
        expect(screen.getByText("Pera")).toBeInTheDocument();
        expect(screen.getByText("Williams")).toBeInTheDocument();
        expect(screen.getByRole("link", {name: "Contactar a Quinta Norte por WhatsApp"})).toBeInTheDocument();
    });

    it("espera a que cargue la foto antes de mostrar el detalle", () => {
        render(
            <DrawerPublicacionPerfil 
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
            <DrawerPublicacionPerfil 
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
            <DrawerPublicacionPerfil 
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

    it("cierra la foto ampliada con Escape sin cerrar el detalle", async () => {
        const onOpenChange = vi.fn();
        render(
            <DrawerPublicacionPerfil
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
        const dialogoFoto = screen.getByRole("dialog");
        expect(dialogoFoto).toContainElement(screen.getByAltText("Foto ampliada de Manzana"));
        fireEvent.keyDown(dialogoFoto, { key: "Escape", code: "Escape",  keyCode: 27 });
        await vi.waitFor(() => {
            expect(screen.queryByAltText("Foto ampliada de Manzana")).not.toBeInTheDocument();
        });
        expect(screen.getByRole("dialog", {name: "Detalle de publicación"})).toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});


