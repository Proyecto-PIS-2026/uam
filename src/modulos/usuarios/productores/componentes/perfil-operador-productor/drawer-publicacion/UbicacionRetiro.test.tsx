import { render, screen } from "@testing-library/react";
import UbicacionesRetiro from "./UbicacionesRetiro";

describe("UbicacionesRetiro", () => {
    it("muestra un mensaje cuando no hay puntos de retiro", () => {
        render(<UbicacionesRetiro ubicaciones={[]} />);
        expect(screen.getByText("Puntos de retiro")).toBeInTheDocument();
        expect(screen.getByText("No hay puntos de retiro informados.")).toBeInTheDocument();
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("muestra los puntos con sus enlaces a Google Maps", () => {
        render(
            <UbicacionesRetiro
                ubicaciones={[
                    {
                        id: 1,
                        nombreUbicacion: "Depósito central",
                        urlMaps: "https://maps.google.com/?q=-34.8,-56.2",
                    },
                    {
                        id: 2,
                        nombreUbicacion: "Local del productor",
                        urlMaps: "https://maps.google.com/?q=-34.7,-56.1",
                    },
                ]}
            />,
        );
        const enlaces = screen.getAllByRole("link");
        expect(enlaces).toHaveLength(2);
        expect(enlaces[0]).toHaveAccessibleName(/^Depósito central\s*Ver ubicación en Google Maps$/);
        expect(enlaces[0]).toHaveAttribute("href", "https://maps.google.com/?q=-34.8,-56.2");
        expect(enlaces[1]).toHaveAccessibleName(/^Local del productor\s*Ver ubicación en Google Maps$/);
        expect(enlaces[1]).toHaveAttribute("href", "https://maps.google.com/?q=-34.7,-56.1");
        for (const enlace of enlaces) {
            expect(enlace).toHaveAttribute("target", "_blank");
            expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
        }
        expect(screen.queryByText("No hay puntos de retiro informados."),).not.toBeInTheDocument();
    });

    it("usa un nombre numerado cuando el nombre está vacío o tiene solo espacios", () => {
        render(
            <UbicacionesRetiro
                ubicaciones={[
                    {
                        id: 1,
                        nombreUbicacion: "",
                        urlMaps: "https://maps.google.com/?q=1",
                    },
                    {
                        id: 2,
                        nombreUbicacion: "   ",
                        urlMaps: "https://maps.google.com/?q=2",
                    },
                ]}
            />,
        );
        expect(screen.getByText("Punto de entrega 1")).toBeInTheDocument();
        expect(screen.getByText("Punto de entrega 2")).toBeInTheDocument();
    });

    it("quita los espacios al inicio y al final del nombre", () => {
        render(
            <UbicacionesRetiro
                ubicaciones={[
                    {
                        id: 1,
                        nombreUbicacion: "  Depósito central  ",
                        urlMaps: "https://maps.google.com/?q=1",
                    },
                ]}
            />,
        );
        expect(screen.getByText("Depósito central").textContent).toBe("Depósito central",);
    });
});