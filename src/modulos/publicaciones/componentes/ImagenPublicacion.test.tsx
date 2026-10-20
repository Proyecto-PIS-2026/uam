import { fireEvent, render, screen } from "@testing-library/react";
import ImagenPublicacion from "./ImagenPublicacion";

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

describe("ImagenPublicacion", () => {
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
