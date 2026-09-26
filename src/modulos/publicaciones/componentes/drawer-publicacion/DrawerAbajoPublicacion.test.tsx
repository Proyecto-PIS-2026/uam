import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/Publicaciones";
import { DrawerAbajoPublicacion } from "./DrawerAbajoPublicacion";

vi.mock("@mui/material/SwipeableDrawer", () => ({
    default: ({ open, onOpen, onClose, children }: {
        open: boolean;
        onOpen: () => void;
        onClose: () => void;
        children: ReactNode;
    }) => (
        <>
            <button onClick={onOpen}>Abrir detalle</button>
            {open && (
                <div role="dialog" aria-label="Detalle de publicación">
                    <button onClick={onClose}>Cerrar detalle</button>
                    {children}
                </div>
            )}
        </>
    ),
}));

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
        foto: null,
        presentacion: "Cajón",
        categoria: "Primera",
        calibre: "Mediano",
        codigoCalibre: "M",
        operador: {
            id: 10,
            nombreFantasia: "Huerta Sur",
            whatsApp: "099123456",
        },
    };
}

describe("DrawerPublicacion", () => {
    it("muestra los datos de la publicación y los botones de contacto", () => {
        render(<DrawerAbajoPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        for (const texto of ["Tomate", "Perita", "Cajón", "Mediano", "Primera", "Huerta Sur"]) {
            expect(screen.getByText(texto)).toBeInTheDocument();
        }
        expect(screen.getByRole("button", { name: "Ver Perfil" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Contactar a Huerta Sur por WhatsApp" })).toBeInTheDocument();
    });
    it("no muestra el detalle cuando está cerrado", () => {
        render(<DrawerAbajoPublicacion publicacion={crearPublicacion()} open={false} onOpenChange={vi.fn()} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByText("Tomate")).not.toBeInTheDocument();
    });
    it("no muestra datos ni acciones de contacto sin una publicación", () => {
        render(<DrawerAbajoPublicacion publicacion={null} open onOpenChange={vi.fn()} />,);
        expect(screen.queryByText("Publicado por")).not.toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Ver Perfil" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /WhatsApp/i })).not.toBeInTheDocument();
    });
    it("oculta la variedad cuando es un guion", () => {
        render(<DrawerAbajoPublicacion publicacion={{ ...crearPublicacion(), variedad: "-" }} open onOpenChange={vi.fn()} />);
        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.queryByText("-")).not.toBeInTheDocument();
    });
    it("muestra la foto con la especie como texto alternativo", () => {
        render(<DrawerAbajoPublicacion publicacion={{ ...crearPublicacion(), foto: "/tomate.jpg", }} open onOpenChange={vi.fn()} />);
        expect(screen.getByRole("img", { name: "Foto de Tomate" })).toBeInTheDocument();
        expect(screen.queryByTestId("ImageOutlinedIcon")).not.toBeInTheDocument();
    });
    it("muestra un reemplazo cuando no hay foto", () => {
        render(<DrawerAbajoPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        expect(screen.getByTestId("ImageOutlinedIcon")).toBeInTheDocument();
        expect(screen.getByText("Foto")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it.each([[150, "$150"], [1234.5, "$1234.5"]])("muestra el precio %s", (precio, esperado) => {
        render(<DrawerAbajoPublicacion publicacion={{ ...crearPublicacion(), precio }} open onOpenChange={vi.fn()} />);
        expect(screen.getByText(esperado)).toBeInTheDocument();
        expect(screen.queryByText("Sin precio")).not.toBeInTheDocument();
    });
    it.each([0, null])(
        "muestra 'Sin precio' cuando el precio es %s",
        (precio) => {
            render(<DrawerAbajoPublicacion publicacion={{ ...crearPublicacion(), precio }} open onOpenChange={vi.fn()} />);
            expect(screen.getByText("Sin precio")).toBeInTheDocument();
            expect(screen.queryByText("$0")).not.toBeInTheDocument();
        },
    );

    it("notifica la apertura y el cierre y respeta el estado recibido", () => {
        const onOpenChange = vi.fn();
        const publicacion = crearPublicacion();
        const { rerender } = render(<DrawerAbajoPublicacion publicacion={publicacion} open={false} onOpenChange={onOpenChange} />,);
        expect(onOpenChange).not.toHaveBeenCalled();
        fireEvent.click(
            screen.getByRole("button", {
                name: "Abrir detalle",
            }),
        );
        expect(onOpenChange).toHaveBeenNthCalledWith(1, true);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        rerender(<DrawerAbajoPublicacion publicacion={publicacion} open onOpenChange={onOpenChange} />);
        fireEvent.click(
            screen.getByRole("button", {
                name: "Cerrar detalle",
            }),
        );
        expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
        expect(onOpenChange).toHaveBeenCalledTimes(2);
        rerender(<DrawerAbajoPublicacion publicacion={publicacion} open={false} onOpenChange={onOpenChange} />,);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    it("actualiza el detalle al seleccionar otra publicación y permite quitarla", () => {
        const onOpenChange = vi.fn();
        const { rerender } = render(<DrawerAbajoPublicacion publicacion={crearPublicacion()} open onOpenChange={onOpenChange} />);
        rerender(
            <DrawerAbajoPublicacion
                publicacion={{
                    ...crearPublicacion(),
                    id: 2,
                    especie: "Manzana",
                    variedad: "Gala",
                    precio: 80,
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
        rerender(<DrawerAbajoPublicacion publicacion={null} open onOpenChange={onOpenChange} />);
        expect(screen.queryByText("Manzana")).not.toBeInTheDocument();
        expect(screen.queryByText("Publicado por")).not.toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});