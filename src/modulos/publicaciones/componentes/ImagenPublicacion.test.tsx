import { fireEvent, render, screen } from "@testing-library/react";
import ImagenPublicacion from "./ImagenPublicacion";

vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({src, alt, onLoad, onError, style, unoptimized}: {
            src: string;
            alt: string;
            onLoad?: React.ReactEventHandler<HTMLImageElement>;
            onError?: React.ReactEventHandler<HTMLImageElement>;
            style?: React.CSSProperties;
            unoptimized?: boolean;
        }) => createElement("img", {src, alt, onLoad, onError, style, "data-unoptimized": unoptimized})
    };
});

describe("ImagenPublicacion", () => {
    it("carga las imágenes protegidas directamente y conserva el reemplazo y los callbacks", () => {
        const onLoad = vi.fn();
        const onError = vi.fn();
        render(<ImagenPublicacion src="/api/imagenes/publicaciones/1/foto.webp" alt="Tomate" fill reemplazo={<span>Cargando foto</span>} onLoad={onLoad} onError={onError} />);
        const imagen = screen.getByAltText("Tomate");
        expect(imagen).toHaveAttribute("data-unoptimized", "true");
        expect(imagen).not.toBeVisible();
        expect(screen.getByText("Cargando foto")).toBeInTheDocument();
        fireEvent.load(imagen);
        expect(imagen).toBeVisible();
        expect(onLoad).toHaveBeenCalledOnce();
        fireEvent.error(imagen);
        expect(onError).toHaveBeenCalledOnce();
        expect(screen.getByText("Cargando foto")).toBeInTheDocument();
    });
    it("muestra el reemplazo si falta la foto", () => {
        render(<ImagenPublicacion src={null} alt="Acelga" fill reemplazo={<span>Sin fotografía</span>} />);
        expect(screen.getByText("Sin fotografía")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("muestra el reemplazo cuando la URL falla y permite mostrar una foto nueva", () => {
        const { rerender } = render(<ImagenPublicacion src="/anterior.jpg" alt="Acelga" fill reemplazo={<span>Sin fotografía</span>}/>);
        fireEvent.error(screen.getByAltText("Acelga"));
        expect(screen.getByText("Sin fotografía")).toBeInTheDocument();
        rerender(<ImagenPublicacion src="/nueva.jpg" alt="Acelga" fill reemplazo={<span>Sin fotografía</span>}/>,);
        fireEvent.load(screen.getByAltText("Acelga"));
        expect(screen.getByRole("img", { name: "Acelga" })).toBeVisible();
        expect(screen.queryByText("Sin fotografía")).not.toBeInTheDocument();
    });
});
