import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/Publicaciones";
import { DrawerDerechaPublicacion } from "./DrawerDerechaPublicacion";


vi.mock("@mui/material/SwipeableDrawer", () => ({
    default: ({ open, onOpen, onClose, anchor, children }: { open: boolean; onOpen: () => void; onClose: () => void; anchor?: string; children: ReactNode; }) => (
        <>
            <button onClick={onOpen}>Abrir detalle</button>
            {open && (<div role="dialog" aria-label="Detalle de publicación" data-anchor={anchor}>
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

describe("DrawerDerechaPublicacion", () => {
    it("muestra los datos de la publicación y las acciones de contacto", () => {
        render(<DrawerDerechaPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        for (const texto of ["Tomate", "Perita", "Cajón", "Mediano", "Primera", "Publicado por", "Huerta Sur"]) {
            expect(screen.getByText(texto)).toBeInTheDocument();
        }
        expect(screen.getByRole("button", { name: "Ver Perfil" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Contactar a Huerta Sur por WhatsApp" })).toBeInTheDocument();
    });
    it("configura el drawer para abrirse desde la derecha", () => {
        render(<DrawerDerechaPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        expect(screen.getByRole("dialog")).toHaveAttribute("data-anchor", "right");
    });
    it("no muestra el detalle cuando está cerrado", () => {
        render(<DrawerDerechaPublicacion publicacion={crearPublicacion()} open={false} onOpenChange={vi.fn()} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByText("Tomate")).not.toBeInTheDocument();
    });
    it("no muestra datos ni acciones de contacto sin una publicación", () => {
        render(<DrawerDerechaPublicacion publicacion={null} open onOpenChange={vi.fn()} />);
        expect(screen.queryByText("Publicado por")).not.toBeInTheDocument();
        expect(screen.queryByText("Tomate")).not.toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Ver Perfil" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /WhatsApp/i })).not.toBeInTheDocument();
    });
    it("oculta la variedad cuando es un guion", () => {
        render(<DrawerDerechaPublicacion publicacion={{ ...crearPublicacion(), variedad: "-" }} open onOpenChange={vi.fn()} />);
        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.queryByText("-")).not.toBeInTheDocument();
    });
    it("muestra la variedad cuando tiene un valor", () => {
        render(<DrawerDerechaPublicacion publicacion={{ ...crearPublicacion(), variedad: "Perita" }} open onOpenChange={vi.fn()} />);
        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.getByText("Perita")).toBeInTheDocument();
    });
    it("muestra la foto con la especie como texto alternativo", () => {
        render(<DrawerDerechaPublicacion publicacion={{ ...crearPublicacion(), foto: "/tomate.jpg" }} open onOpenChange={vi.fn()} />);
        expect(screen.getByRole("img", { name: "Foto de Tomate" })).toBeInTheDocument();
        expect(screen.queryByTestId("ImageOutlinedIcon")).not.toBeInTheDocument();
    });
    it("muestra un reemplazo cuando no hay foto", () => {
        render(<DrawerDerechaPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        expect(screen.getByTestId("ImageOutlinedIcon"),).toBeInTheDocument();
        expect(screen.getByText("Foto")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
    it.each([[150, "$150"], [1234.5, "$1234.5"]])("muestra el precio %s", (precio, esperado) => {
        render(<DrawerDerechaPublicacion publicacion={{ ...crearPublicacion(), precio }} open onOpenChange={vi.fn()} />);
        expect(screen.getByText(esperado)).toBeInTheDocument();
        expect(screen.queryByText("Sin precio")).not.toBeInTheDocument();
    });
    it.each([0, null])("muestra 'Sin precio' cuando el precio es %s",
        (precio) => {
            render(<DrawerDerechaPublicacion publicacion={{ ...crearPublicacion(), precio }} open onOpenChange={vi.fn()} />);
            expect(screen.getByText("Sin precio"),).toBeInTheDocument();
            expect(screen.queryByText("$0"),).not.toBeInTheDocument();
        },
    );
    it("genera correctamente el enlace de WhatsApp", () => {
        render(<DrawerDerechaPublicacion publicacion={crearPublicacion()} open onOpenChange={vi.fn()} />);
        const enlace = screen.getByRole("link", { name: "Contactar a Huerta Sur por WhatsApp", });
        expect(enlace).toHaveAttribute("href", "https://wa.me/099123456?text=Hola%2C%20vi%20tu%20perfil%20en%20Mercado%20UAM%20y%20quisiera%20hacerte%20una%20consulta.",);
        expect(enlace).toHaveAttribute("target", "_blank");
        expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
    });
    it("elimina caracteres no numéricos del número de WhatsApp", () => {
        render(<DrawerDerechaPublicacion publicacion={{ ...crearPublicacion(), operador: { ...crearPublicacion().operador, whatsApp: "+598 99 123-456", } }} open onOpenChange={vi.fn()} />);
        const enlace = screen.getByRole("link", { name: "Contactar a Huerta Sur por WhatsApp" });
        expect(enlace).toHaveAttribute("href", expect.stringContaining("https://wa.me/59899123456"));
    });
    it("notifica la apertura y el cierre y respeta el estado recibido", () => {
        const onOpenChange = vi.fn();
        const publicacion = crearPublicacion();
        const { rerender } = render(<DrawerDerechaPublicacion publicacion={publicacion} open={false} onOpenChange={onOpenChange} />);
        expect(onOpenChange).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Abrir detalle", }),);
        expect(onOpenChange).toHaveBeenNthCalledWith(1, true);
        expect(screen.queryByRole("dialog"),).not.toBeInTheDocument();
        rerender(<DrawerDerechaPublicacion publicacion={publicacion} open onOpenChange={onOpenChange} />);
        fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));
        expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
        expect(onOpenChange).toHaveBeenCalledTimes(2);
        rerender(<DrawerDerechaPublicacion publicacion={publicacion} open={false} onOpenChange={onOpenChange} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    it("actualiza el detalle al seleccionar otra publicación y permite quitarla", () => {
        const onOpenChange = vi.fn();
        const { rerender } = render(<DrawerDerechaPublicacion publicacion={crearPublicacion()} open onOpenChange={onOpenChange} />);
        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.getByText("Huerta Sur")).toBeInTheDocument();
        rerender(<DrawerDerechaPublicacion publicacion={{ ...crearPublicacion(), id: 2, especie: "Manzana", variedad: "Gala", precio: 80, operador: { id: 20, nombreFantasia: "Frutas Norte", whatsApp: "098654321" } }} open onOpenChange={onOpenChange} />);
        expect(screen.queryByText("Tomate"),).not.toBeInTheDocument();
        expect(screen.queryByText("Huerta Sur"),).not.toBeInTheDocument();
        expect(screen.getByText("Manzana"),).toBeInTheDocument();
        expect(screen.getByText("Gala"),).toBeInTheDocument();
        expect(screen.getByText("$80"),).toBeInTheDocument();
        expect(screen.getByText("Frutas Norte"),).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Contactar a Frutas Norte por WhatsApp" })).toHaveAttribute("href", expect.stringContaining("098654321"));
        rerender(<DrawerDerechaPublicacion publicacion={null} open onOpenChange={onOpenChange} />);
        expect(screen.queryByText("Manzana"),).not.toBeInTheDocument();
        expect(screen.queryByText("Publicado por"),).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Ver Perfil" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /WhatsApp/i })).not.toBeInTheDocument(); expect(onOpenChange).not.toHaveBeenCalled()
    });
});