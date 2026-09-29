import { fireEvent, render, screen } from "@testing-library/react";
import ImagenPublicacion from "./ImagenPublicacion";

describe("ImagenPublicacion", () => {
    it("muestra el reemplazo si falta la foto", () => {
        render(<ImagenPublicacion src={null} alt="Acelga" fill reemplazo={<span>Sin fotografía</span>} />);
        expect(screen.getByText("Sin fotografía")).toBeInTheDocument();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("muestra el reemplazo cuando la URL falla y permite mostrar una foto nueva", () => {
        const { rerender } = render(<ImagenPublicacion src="/anterior.jpg" alt="Acelga" fill reemplazo={<span>Sin fotografía</span>} />);
        fireEvent.error(screen.getByRole("img", { name: "Acelga" }));
        expect(screen.getByText("Sin fotografía")).toBeInTheDocument();

        rerender(<ImagenPublicacion src="/nueva.jpg" alt="Acelga" fill reemplazo={<span>Sin fotografía</span>} />);
        expect(screen.getByRole("img", { name: "Acelga" })).toBeInTheDocument();
    });
});
