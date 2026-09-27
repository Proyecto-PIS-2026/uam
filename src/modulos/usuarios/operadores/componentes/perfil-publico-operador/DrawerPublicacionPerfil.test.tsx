import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import DrawerPublicacionPerfil from "./DrawerPublicacionPerfil";

const mocks = vi.hoisted(() => ({
    useMediaQuery: vi.fn(),
}));

vi.mock("@mui/material/useMediaQuery", () => ({
    default: mocks.useMediaQuery,
}));

vi.mock("@mui/material/SwipeableDrawer", () => ({
    default: ({anchor, open, onClose, onOpen, disableSwipeToOpen, children}: {anchor: "bottom" | "right"; open: boolean; onClose: () => void; onOpen: () => void; disableSwipeToOpen: boolean; children: React.ReactNode}) => (
        <div data-testid="drawer" data-anchor={anchor} data-open={String(open)} data-swipe-open-disabled={String(disableSwipeToOpen)}>
            <button type="button" onClick={onOpen}>Abrir drawer</button>
            <button type="button" onClick={onClose}>Cerrar drawer</button>
            {children}
        </div>
    ),
}));

vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({src, alt}: {src: string; alt: string}) => createElement("img", {src, alt}),
    };
});

vi.mock("./TextoAjustable", () => ({
    default: ({texto, className}: {texto: string; className?: string}) => <span className={className}>{texto}</span>,
}));

vi.mock("@mui/icons-material/ImageOutlined", () => ({
    default: () => <span data-testid="icono-foto"/>,
}));

vi.mock("@mui/icons-material/WhatsApp", () => ({
    default: () => <span data-testid="icono-whatsapp"/>,
}));

const publicacion: PublicacionPerfil = {
    id: 101,
    foto: "/tomate.jpg",
    precio: "120",
    especie: "Tomate",
    variedad: "Perita",
    presentacion: "Cajón",
    categoria: "Extra",
    calibre: "A",
};

describe("DrawerPublicacionPerfil", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useMediaQuery.mockReturnValue(false);
    });

    it("usa el drawer inferior en mobile", () => {
        render(<DrawerPublicacionPerfil publicacion={publicacion} open={true} onOpenChange={vi.fn()} whatsAppOperador="+598 99 123 456"/>);
        expect(screen.getByTestId("drawer")).toHaveAttribute("data-anchor", "bottom");
        expect(screen.getByTestId("drawer")).toHaveAttribute("data-swipe-open-disabled", "false");
    });

    it("usa un drawer lateral en web", () => {
        mocks.useMediaQuery.mockReturnValue(true);
        render(<DrawerPublicacionPerfil publicacion={publicacion} open={true} onOpenChange={vi.fn()} whatsAppOperador="+598 99 123 456"/>);
        expect(screen.getByTestId("drawer")).toHaveAttribute("data-anchor", "right");
        expect(screen.getByTestId("drawer")).toHaveAttribute("data-open", "true");
    });

    it("no muestra un botón de cierre en el contenido del drawer web", () => {
        mocks.useMediaQuery.mockReturnValue(true);
        render(<DrawerPublicacionPerfil publicacion={publicacion} open={true} onOpenChange={vi.fn()} whatsAppOperador="+598 99 123 456"/>);
        expect(screen.queryByRole("button", {name: "Cerrar detalle de publicación"})).not.toBeInTheDocument();
    });

    it("cierra el drawer web mediante onClose", () => {
        mocks.useMediaQuery.mockReturnValue(true);
        const onOpenChange = vi.fn();
        render(<DrawerPublicacionPerfil publicacion={publicacion} open={true} onOpenChange={onOpenChange} whatsAppOperador="+598 99 123 456"/>);
        fireEvent.click(screen.getByRole("button", {name: "Cerrar drawer"}));
        expect(onOpenChange).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("no se abre cuando no hay publicación seleccionada", () => {
        const onOpenChange = vi.fn();
        render(<DrawerPublicacionPerfil publicacion={null} open={true} onOpenChange={onOpenChange} whatsAppOperador="+598 99 123 456"/>);
        expect(screen.getByTestId("drawer")).toHaveAttribute("data-open", "false");
        expect(screen.getByTestId("drawer")).toHaveAttribute("data-swipe-open-disabled", "true");
        fireEvent.click(screen.getByRole("button", {name: "Abrir drawer"}));
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByText("Tomate")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", {name: /WhatsApp/i})).not.toBeInTheDocument();
    });

    it("muestra todos los datos de la publicación", () => {
        render(<DrawerPublicacionPerfil publicacion={publicacion} open={true} onOpenChange={vi.fn()} whatsAppOperador="+598 99 123 456"/>);
        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.getByText("Perita")).toBeInTheDocument();
        expect(screen.getByText("$120")).toBeInTheDocument();
        expect(screen.getByText("Presentación")).toBeInTheDocument();
        expect(screen.getByText("Cajón")).toBeInTheDocument();
        expect(screen.getByText("Calibre")).toBeInTheDocument();
        expect(screen.getByText("A")).toBeInTheDocument();
        expect(screen.getByText("Categoría")).toBeInTheDocument();
        expect(screen.getByText("Extra")).toBeInTheDocument();
    });

    it("no muestra la variedad cuando es guion", () => {
        render(<DrawerPublicacionPerfil publicacion={{...publicacion, variedad: "-"}} open={true} onOpenChange={vi.fn()} whatsAppOperador="+598 99 123 456"/>);
        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.queryByText("Perita")).not.toBeInTheDocument();
        expect(screen.queryByText("-")).not.toBeInTheDocument();
    });

    it("muestra Sin precio cuando la publicación no tiene precio", () => {
        render(<DrawerPublicacionPerfil publicacion={{...publicacion, precio: null}} open={true} onOpenChange={vi.fn()} whatsAppOperador="+598 99 123 456"/>);
        expect(screen.getByText("Sin precio")).toBeInTheDocument();
        expect(screen.queryByText("$120")).not.toBeInTheDocument();
    });

    it("muestra la imagen de la publicación cuando tiene foto", () => {
        render(<DrawerPublicacionPerfil publicacion={publicacion} open={true} onOpenChange={vi.fn()} whatsAppOperador="+598 99 123 456"/>);
        expect(screen.getByRole("img", {name: "Foto de Tomate"})).toHaveAttribute("src", "/tomate.jpg");
        expect(screen.queryByText("Foto")).not.toBeInTheDocument();
    });

    it("muestra el reemplazo de imagen cuando no tiene foto", () => {
        render(<DrawerPublicacionPerfil publicacion={{...publicacion, foto: null}} open={true} onOpenChange={vi.fn()} whatsAppOperador="+598 99 123 456"/>);
        expect(screen.getByText("Foto")).toBeInTheDocument();
        expect(screen.getByTestId("icono-foto")).toBeInTheDocument();
        expect(screen.queryByRole("img", {name: "Foto de Tomate"})).not.toBeInTheDocument();
    });

    it("genera correctamente el enlace personalizado de WhatsApp", () => {
        render(<DrawerPublicacionPerfil publicacion={publicacion} open={true} onOpenChange={vi.fn()} whatsAppOperador="+598 99 123 456"/>);
        const mensaje = "Hola, vi tu publicación de Tomate - Perita en Mercado UAM y quisiera hacerte una consulta.";
        const enlaceEsperado = `https://wa.me/59899123456?text=${encodeURIComponent(mensaje)}`;
        expect(screen.getByRole("link", {name: "Consultar por Tomate - Perita por WhatsApp"})).toHaveAttribute("href", enlaceEsperado);
    });

    it("genera el mensaje de WhatsApp sin variedad cuando corresponde", () => {
        render(<DrawerPublicacionPerfil publicacion={{...publicacion, variedad: "-"}} open={true} onOpenChange={vi.fn()} whatsAppOperador="+598 99 123 456"/>);
        const mensaje = "Hola, vi tu publicación de Tomate en Mercado UAM y quisiera hacerte una consulta.";
        const enlaceEsperado = `https://wa.me/59899123456?text=${encodeURIComponent(mensaje)}`;
        expect(screen.getByRole("link", {name: "Consultar por Tomate por WhatsApp"})).toHaveAttribute("href", enlaceEsperado);
    });

    it("notifica cuando se abre el drawer", () => {
        const onOpenChange = vi.fn();
        render(<DrawerPublicacionPerfil publicacion={publicacion} open={false} onOpenChange={onOpenChange} whatsAppOperador="+598 99 123 456"/>);
        fireEvent.click(screen.getByRole("button", {name: "Abrir drawer"}));
        expect(onOpenChange).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it("notifica cuando se cierra el drawer", () => {
        const onOpenChange = vi.fn();
        render(<DrawerPublicacionPerfil publicacion={publicacion} open={true} onOpenChange={onOpenChange} whatsAppOperador="+598 99 123 456"/>);
        fireEvent.click(screen.getByRole("button", {name: "Cerrar drawer"}));
        expect(onOpenChange).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
