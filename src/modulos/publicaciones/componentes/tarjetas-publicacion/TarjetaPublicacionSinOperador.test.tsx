
import { fireEvent, render, screen } from "@testing-library/react";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/Publicaciones";
import TarjetaPublicacionSinOperador from "./TarjetaPublicacionSinOperador";

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

describe("TarjetaPublicacionSinOperador", () => {
    it("muestra el producto y sus características sin el nombre del operador", () => {
        render(<TarjetaPublicacionSinOperador publicacion={crearPublicacion()} onClick={vi.fn()}/>);
        expect(screen.getByRole("heading", { name: "Tomate - Perita" })).toBeInTheDocument();
        expect(screen.getAllByText("Mediano", { exact: true })).toHaveLength(2);
        expect(screen.getByText("Primera", { exact: true })).toBeInTheDocument();
        expect(screen.getByText("por Cajón")).toBeInTheDocument();
        expect(screen.queryByText("Huerta Sur")).not.toBeInTheDocument();
    });

    it.each(["-", ""])(
        "muestra solamente la especie cuando la variedad es %j",
        (variedad) => {
            render(<TarjetaPublicacionSinOperador publicacion={{ ...crearPublicacion(), variedad}} onClick={vi.fn()} />);
            expect(screen.getByRole("heading", { name: "Tomate" }), ).toBeInTheDocument();
            expect(screen.queryByText("Perita"), ).not.toBeInTheDocument();
        }
    );

    it("muestra la foto con la especie y variedad como texto alternativo", () => {
        render(<TarjetaPublicacionSinOperador publicacion={{ ...crearPublicacion(), foto: "/tomate.jpg"}} onClick={vi.fn()}/>);
        expect(screen.getByRole("img", { name: "Foto de Tomate - Perita" })).toBeInTheDocument();
        expect(screen.queryByText("Sin foto disponible")).not.toBeInTheDocument();
    });

    it("muestra un reemplazo cuando la publicación no tiene foto", () => {
        render(<TarjetaPublicacionSinOperador publicacion={crearPublicacion()} onClick={vi.fn()}/>);
        expect(screen.getByText("Sin foto disponible"), ).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it.each([
        [150, /^\$\s*150$/],
        [1234.5, /^\$\s*1\.234,5$/],
        [0, /^\$\s*0$/],
    ])(
        "muestra el precio %s sin confundir cero con ausencia de precio",
        (precio, esperado) => {
            render(<TarjetaPublicacionSinOperador publicacion={{ ...crearPublicacion(), precio}} onClick={vi.fn()}/>);
            expect(screen.getByText(esperado), ).toBeInTheDocument();
            expect(screen.queryByText("Consultar precio")).not.toBeInTheDocument();
        },
    );

    it("muestra consultar precio cuando el precio es null", () => {
        render(<TarjetaPublicacionSinOperador publicacion={{ ...crearPublicacion(), precio: null }} onClick={vi.fn()}/>);
        expect(screen.getByText("Consultar precio")).toBeInTheDocument();
    });

    it("ejecuta el callback al seleccionar la tarjeta", () => {
        const onClick = vi.fn();
        render(<TarjetaPublicacionSinOperador publicacion={crearPublicacion()} onClick={onClick}/>);
        expect(onClick).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Ver detalles de Tomate - Perita" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
