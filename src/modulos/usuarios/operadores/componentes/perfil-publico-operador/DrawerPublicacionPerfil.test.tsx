import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicacionPerfil } from "../../consultas-perfil-publico";
import DrawerPublicacionPerfil from "./DrawerPublicacionPerfil";

const mocks = vi.hoisted(() => ({
    useMediaQuery: vi.fn(),
}));

// Simula si la pantalla es mobile o web
vi.mock("@mui/material/useMediaQuery", () => ({
    default: mocks.useMediaQuery,
}));

// Reemplaza SwipeableDrawer por una versión simple para los tests
vi.mock("@mui/material/SwipeableDrawer", () => ({
    default: ({
        anchor,
        open,
        onClose,
        onOpen,
        children,
    }: {
        anchor: "bottom" | "right";
        open: boolean;
        onClose: () => void;
        onOpen: () => void;
        children: React.ReactNode;
    }) => (
        <div
            data-testid="drawer"
            data-anchor={anchor}
            data-open={String(open)}
        >
            <button type="button" onClick={onOpen}>
                Abrir drawer
            </button>

            <button type="button" onClick={onClose}>
                Cerrar drawer
            </button>

            {children}
        </div>
    ),
}));

// Reemplaza Image de Next por un img común
vi.mock("next/image", async () => {
    const { createElement } = await import("react");

    return {
        default: ({ src, alt }: { src: string; alt: string }) =>
            createElement("img", { src, alt }),
    };
});

// TextoAjustable tiene lógica propia que se prueba en su archivo
vi.mock("./TextoAjustable", () => ({
    default: ({
        texto,
        className,
    }: {
        texto: string;
        className?: string;
    }) => (
        <span className={className}>
            {texto}
        </span>
    ),
}));

// Simplifica los íconos de MUI
vi.mock("@mui/icons-material/ImageOutlined", () => ({
    default: () => <span data-testid="icono-foto" />,
}));

vi.mock("@mui/icons-material/WhatsApp", () => ({
    default: () => <span data-testid="icono-whatsapp" />,
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

        // Por defecto se comporta como mobile
        mocks.useMediaQuery.mockReturnValue(false);
    });

    // Verifica que en mobile el drawer se abra desde abajo
    it("usa el drawer inferior en mobile", () => {
        render(
            <DrawerPublicacionPerfil
                publicacion={publicacion}
                open={true}
                onOpenChange={vi.fn()}
                whatsAppOperador="+598 99 123 456"
            />
        );

        expect(screen.getByTestId("drawer")).toHaveAttribute(
            "data-anchor",
            "bottom"
        );
    });

    // Verifica que en web se abra un diálogo en lugar del drawer inferior
    it("usa un diálogo en web", () => {
        mocks.useMediaQuery.mockReturnValue(true);
        const onOpenChange = vi.fn();

        render(
            <DrawerPublicacionPerfil
                publicacion={publicacion}
                open={true}
                onOpenChange={onOpenChange}
                whatsAppOperador="+598 99 123 456"
            />
        );

        expect(screen.getByRole("dialog", { name: "Detalle de publicación" })).toBeInTheDocument();
        expect(screen.queryByTestId("drawer")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle de publicación" }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    // Verifica que no muestre información cuando no hay publicación seleccionada
    it("no muestra contenido cuando no hay publicación seleccionada", () => {
        render(
            <DrawerPublicacionPerfil
                publicacion={null}
                open={true}
                onOpenChange={vi.fn()}
                whatsAppOperador="+598 99 123 456"
            />
        );

        expect(
            screen.queryByText("Tomate")
        ).not.toBeInTheDocument();

        expect(
            screen.queryByRole("link", { name: /WhatsApp/i })
        ).not.toBeInTheDocument();
    });

    // Verifica los datos principales de la publicación
    it("muestra todos los datos de la publicación", () => {
        render(
            <DrawerPublicacionPerfil
                publicacion={publicacion}
                open={true}
                onOpenChange={vi.fn()}
                whatsAppOperador="+598 99 123 456"
            />
        );

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

    // Verifica que no muestre la variedad cuando su valor es "-"
    it("no muestra la variedad cuando es guion", () => {
        render(
            <DrawerPublicacionPerfil
                publicacion={{
                    ...publicacion,
                    variedad: "-",
                }}
                open={true}
                onOpenChange={vi.fn()}
                whatsAppOperador="+598 99 123 456"
            />
        );

        expect(screen.getByText("Tomate")).toBeInTheDocument();
        expect(screen.queryByText("Perita")).not.toBeInTheDocument();
        expect(screen.queryByText("-")).not.toBeInTheDocument();
    });

    // Verifica que muestre el precio alternativo cuando no existe precio
    it("muestra Sin precio cuando la publicación no tiene precio", () => {
        render(
            <DrawerPublicacionPerfil
                publicacion={{
                    ...publicacion,
                    precio: null,
                }}
                open={true}
                onOpenChange={vi.fn()}
                whatsAppOperador="+598 99 123 456"
            />
        );

        expect(screen.getByText("Sin precio")).toBeInTheDocument();
        expect(screen.queryByText("$120")).not.toBeInTheDocument();
    });

    // Verifica que muestre la foto cuando existe
    it("muestra la imagen de la publicación cuando tiene foto", () => {
        render(
            <DrawerPublicacionPerfil
                publicacion={publicacion}
                open={true}
                onOpenChange={vi.fn()}
                whatsAppOperador="+598 99 123 456"
            />
        );

        expect(
            screen.getByRole("img", {
                name: "Foto de Tomate",
            })
        ).toHaveAttribute("src", "/tomate.jpg");

        expect(screen.queryByText("Foto")).not.toBeInTheDocument();
    });

    // Verifica el placeholder cuando la publicación no tiene foto
    it("muestra el reemplazo de imagen cuando no tiene foto", () => {
        render(
            <DrawerPublicacionPerfil
                publicacion={{
                    ...publicacion,
                    foto: null,
                }}
                open={true}
                onOpenChange={vi.fn()}
                whatsAppOperador="+598 99 123 456"
            />
        );

        expect(screen.getByText("Foto")).toBeInTheDocument();
        expect(screen.getByTestId("icono-foto")).toBeInTheDocument();

        expect(
            screen.queryByRole("img", {
                name: "Foto de Tomate",
            })
        ).not.toBeInTheDocument();
    });

    // Verifica que el enlace de WhatsApp tenga número y mensaje correctos
    it("genera correctamente el enlace personalizado de WhatsApp", () => {
        render(
            <DrawerPublicacionPerfil
                publicacion={publicacion}
                open={true}
                onOpenChange={vi.fn()}
                whatsAppOperador="+598 99 123 456"
            />
        );

        const mensaje =
            "Hola, vi tu publicación de Tomate - Perita en Mercado UAM y quisiera hacerte una consulta.";

        const enlaceEsperado =
            `https://wa.me/59899123456?text=${encodeURIComponent(mensaje)}`;

        expect(
            screen.getByRole("link", {
                name: "Consultar por Tomate - Perita por WhatsApp",
            })
        ).toHaveAttribute("href", enlaceEsperado);
    });

    // Verifica el mensaje de WhatsApp cuando el producto no tiene variedad
    it("genera el mensaje de WhatsApp sin variedad cuando corresponde", () => {
        render(
            <DrawerPublicacionPerfil
                publicacion={{
                    ...publicacion,
                    variedad: "-",
                }}
                open={true}
                onOpenChange={vi.fn()}
                whatsAppOperador="+598 99 123 456"
            />
        );

        const mensaje =
            "Hola, vi tu publicación de Tomate en Mercado UAM y quisiera hacerte una consulta.";

        const enlaceEsperado =
            `https://wa.me/59899123456?text=${encodeURIComponent(mensaje)}`;

        expect(
            screen.getByRole("link", {
                name: "Consultar por Tomate por WhatsApp",
            })
        ).toHaveAttribute("href", enlaceEsperado);
    });

    // Verifica que se notifique la apertura del drawer
    it("notifica cuando se abre el drawer", () => {
        const onOpenChange = vi.fn();

        render(
            <DrawerPublicacionPerfil
                publicacion={publicacion}
                open={false}
                onOpenChange={onOpenChange}
                whatsAppOperador="+598 99 123 456"
            />
        );

        fireEvent.click(
            screen.getByRole("button", {
                name: "Abrir drawer",
            })
        );

        expect(onOpenChange).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    // Verifica que se notifique el cierre del drawer
    it("notifica cuando se cierra el drawer", () => {
        const onOpenChange = vi.fn();

        render(
            <DrawerPublicacionPerfil
                publicacion={publicacion}
                open={true}
                onOpenChange={onOpenChange}
                whatsAppOperador="+598 99 123 456"
            />
        );

        fireEvent.click(
            screen.getByRole("button", {
                name: "Cerrar drawer",
            })
        );

        expect(onOpenChange).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
