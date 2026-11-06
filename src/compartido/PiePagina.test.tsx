
import { render, screen, within } from "@testing-library/react";
import PiePagina from "./PiePagina";

describe("PiePagina", () => {
    it("renderiza el footer con su estructura semántica", () => {
        render(<PiePagina />);

        expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });

    it("muestra los dos avisos legales con sus textos exactos", () => {
        render(<PiePagina />);

        const avisos = within(screen.getByRole("region", { name: "Avisos legales" }));

        expect(avisos.getByText(
            "Las fotos y precios son responsabilidad de los operadores. La UAM no se responsabiliza ni interviene en su contenido o publicación.",
            { exact: true },
        )).toBeInTheDocument();

        expect(avisos.getByText(
            "Las operaciones de compraventa se realizan exclusivamente entre operadores y compradores. La UAM no participa ni interviene en dichas transacciones, ni asume responsabilidad por los acuerdos comerciales entre las partes.",
            { exact: true },
        )).toBeInTheDocument();
    });

    it("muestra los datos de contacto de UAM", () => {
        render(<PiePagina />);

        expect(screen.getByText("Cno. Luis Eduardo Pérez 6651")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "(+598) 2 311 45 92" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "info@uam.com.uy" })).toBeInTheDocument();
    });

    it("asigna los destinos correspondientes al teléfono y al correo", () => {
        render(<PiePagina />);

        expect(screen.getByRole("link", { name: "(+598) 2 311 45 92" })).toHaveAttribute("href", "tel:+59823114592");
        expect(screen.getByRole("link", { name: "info@uam.com.uy" })).toHaveAttribute("href", "mailto:info@uam.com.uy");
    });

    it("mantiene el texto de derechos reservados", () => {
        render(<PiePagina />);

        expect(screen.getByText("© UAM. Todos los derechos reservados.")).toBeInTheDocument();
    });
});
