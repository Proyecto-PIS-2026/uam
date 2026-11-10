import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaginaPreciosReferencia from "./page";

const { consultar } = vi.hoisted(() => ({ consultar: vi.fn() }));

vi.mock("@/modulos/informacion-uam/precios-referencia/consultas-precios-referencia", () => ({ obtenerPreciosReferencia: consultar }));
vi.mock("@/modulos/informacion-uam/precios-referencia/PreciosReferencia", () => ({
    default: ({ fechaRelevamiento }: { fechaRelevamiento: string }) => <div>{fechaRelevamiento}</div>,
}));

beforeEach(() => {
    consultar.mockReset();
});

describe("página de precios de referencia", () => {
    it("muestra el relevamiento que devuelve la consulta con caché", async () => {
        consultar.mockResolvedValue({ fechaRelevamiento: "2026-10-01", filas: [] });

        render(await PaginaPreciosReferencia());

        expect(screen.getByText("2026-10-01")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("muestra un estado controlado cuando no hay datos disponibles", async () => {
        consultar.mockRejectedValue(new Error("Faltan la URL o el JWT"));

        render(await PaginaPreciosReferencia());

        expect(screen.getByRole("heading", { name: "Precios de referencia" })).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("No hay precios de referencia disponibles en este momento.");
        expect(screen.queryByText(/JWT/)).not.toBeInTheDocument();
    });
});
