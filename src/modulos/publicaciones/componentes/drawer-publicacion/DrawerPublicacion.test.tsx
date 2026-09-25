import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SwipeableDrawerProps } from "@mui/material/SwipeableDrawer";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/publicaciones";
import { DrawerPublicacion } from "./DrawerPublicacion";

function crearPublicacion(id: number, variedad: string, precio: number, foto: string | null): PublicacionListado {
  return {
    id,
    especie: "Manzana", 
    variedad,
    precio,
    foto,
    presentacion: "Cajón",
    categoria: "Primera",
    calibre: "Mediano",
    codigoCalibre: "M",
    operador: { id: 10, nombreFantasia: "Huerta Sur", whatsApp: "099123456" },
  };
}

vi.mock(
    "./TextoAjustable", 
    () => ({
        default: ({ texto }: { texto: string }) => <span>{texto}</span>})
    );
    afterEach(
        () => {
            cleanup()}
);

vi.mock("@mui/material/SwipeableDrawer", async (importOriginal) => {
    const modulo = await importOriginal<typeof import("@mui/material/SwipeableDrawer")>();
    const DrawerReal = modulo.default;
    return {
        ...modulo,
        default: (props: SwipeableDrawerProps) => (
            <>
                <button onClick={(evento) => props.onOpen(evento)}>Simular apertura</button>
                <DrawerReal {...props} />
            </>
        ),
    };
});

describe("DrawerPublicacion", () => {
    it("muestra los datos de una publicación completa", () => {
        render(<DrawerPublicacion publicacion={crearPublicacion(1, "Granny Smith", 150, "/manzana.jpg")} open={true} onOpenChange={vi.fn()} />);
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.getByText("Granny Smith")).toBeInTheDocument();
        expect(screen.getByText("$150")).toBeInTheDocument();
        expect(screen.getByText("Cajón")).toBeInTheDocument();
        expect(screen.getByText("Primera")).toBeInTheDocument();
        expect(screen.getByText("Mediano")).toBeInTheDocument();
        expect(screen.getByText("Huerta Sur")).toBeInTheDocument();
    });

    it("muestra los datos de una publicación sin variedad", () => {
        render(<DrawerPublicacion publicacion={crearPublicacion(1, "-", 150, null)} open={true} onOpenChange={vi.fn()} />);
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.queryByText("-")).not.toBeInTheDocument();
        expect(screen.getByText("$150")).toBeInTheDocument();
        expect(screen.getByText("Cajón")).toBeInTheDocument();
        expect(screen.getByText("Primera")).toBeInTheDocument();
        expect(screen.getByText("Mediano")).toBeInTheDocument();
        expect(screen.getByText("Huerta Sur")).toBeInTheDocument();
    });

    it("muestra los datos de una publicación sin foto", () => {
        render(<DrawerPublicacion publicacion={crearPublicacion(1, "Granny Smith", 150, null)} open={true} onOpenChange={vi.fn()} />);
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.getByText("Granny Smith")).toBeInTheDocument();
        expect(screen.getByText("$150")).toBeInTheDocument();
        expect(screen.getByText("Cajón")).toBeInTheDocument();
        expect(screen.getByText("Primera")).toBeInTheDocument();
        expect(screen.getByText("Mediano")).toBeInTheDocument();
        expect(screen.getByText("Huerta Sur")).toBeInTheDocument();
    });

    it("no muestra contenido de publicación cuando publicacion es null", () => {
        render(<DrawerPublicacion publicacion={null} open={true} onOpenChange={vi.fn()}/>);
        expect(screen.queryByText("Manzana")).not.toBeInTheDocument();
        expect(screen.queryByText("Publicado por")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Ver Perfil"})).not.toBeInTheDocument();
        expect(screen.queryByRole("link", {name: /WhatsAp/i })).not.toBeInTheDocument();
    });

    it("actualiza los datos al recibir otra publicación", () => {
        const onOpenChange = vi.fn();
        const { rerender } = render(<DrawerPublicacion publicacion={crearPublicacion(1, "Granny Smith", 150, null)} open={true} onOpenChange={onOpenChange}/>);
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.getByText("Granny Smith")).toBeInTheDocument();
        expect(screen.getByText("$150")).toBeInTheDocument();
        expect(screen.getByText("Cajón")).toBeInTheDocument();
        expect(screen.getByText("Primera")).toBeInTheDocument();
        expect(screen.getByText("Mediano")).toBeInTheDocument();
        expect(screen.getByText("Huerta Sur")).toBeInTheDocument();
        const nuevaPublicacion = crearPublicacion(2, "Gala", 200, null);
        rerender(<DrawerPublicacion publicacion={nuevaPublicacion} open={true} onOpenChange={onOpenChange}/>);
        expect(screen.getByText("Manzana")).toBeInTheDocument();
        expect(screen.getByText("Gala")).toBeInTheDocument();
        expect(screen.getByText("$200")).toBeInTheDocument();
        expect(screen.getByText("Cajón")).toBeInTheDocument();
        expect(screen.getByText("Primera")).toBeInTheDocument();
        expect(screen.getByText("Mediano")).toBeInTheDocument();
        expect(screen.getByText("Huerta Sur")).toBeInTheDocument();
        expect(screen.queryByText("Granny Smith")).not.toBeInTheDocument();
        expect(screen.queryByText("$150")).not.toBeInTheDocument();
    });
    
    it("solicita cerrar el drawer al presionar Escape", () => {
        const onOpenChange = vi.fn();
        render(<DrawerPublicacion publicacion={crearPublicacion(1, "Granny Smith", 150, null)} open={true} onOpenChange={onOpenChange}/>);
        expect(onOpenChange).not.toHaveBeenCalled();
        fireEvent.keyDown(screen.getByRole("dialog"), {key: "Escape",code: "Escape"});
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    });

    it("solicita abrir el drawer cuando se ejecuta onOpen", () => {
        const onOpenChange = vi.fn();
        render(<DrawerPublicacion publicacion={crearPublicacion(1, "Granny Smith", 150, null)} open={false} onOpenChange={onOpenChange}/>);
        expect(onOpenChange).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", {name: "Simular apertura"}));
        expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
    });
})


