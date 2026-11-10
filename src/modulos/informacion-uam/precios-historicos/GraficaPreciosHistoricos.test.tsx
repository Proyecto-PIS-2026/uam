import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GraficaPreciosHistoricos from "./GraficaPreciosHistoricos";
import type { RegistroGrafica } from "./datos-grafica";

function registro(dia: RegistroGrafica["dia"]["date"], minimo: RegistroGrafica["precio"]["min_kg"], maximo: RegistroGrafica["precio"]["max_kg"]): RegistroGrafica {
    return { dia: { date: dia }, precio: { min_kg: minimo, max_kg: maximo } };
}

describe("GraficaPreciosHistoricos con Recharts", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-10-17T02:00:00.000Z"));
        vi.stubGlobal("ResizeObserver", class {
            observe() {}
            unobserve() {}
            disconnect() {}
        });
        vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
            const mideTexto = this.id === "recharts_measurement_span" || this.tagName.toLowerCase() === "text";
            const ancho = mideTexto ? (this.textContent?.length ?? 0) * 6 : 600;
            const alto = mideTexto ? 12 : 350;
            return { width: ancho, height: alto, x: 0, y: 0, top: 0, left: 0, right: ancho, bottom: alto, toJSON: () => ({}) };
        });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("dibuja todas las fechas del período, incluyendo los registros posteriores a la primera página", async () => {
        const registros = Array.from({ length: 65 }, (_, indice) => {
            const dia = new Date(Date.UTC(2026, 0, 1 + indice)).toISOString().slice(0, 10);
            return registro(dia, indice + 1, indice + 11);
        });
        const { container } = render(<GraficaPreciosHistoricos registros={registros} desde="2026-01-01" hasta="2026-03-06" producto="Pera" />);

        await waitFor(() => expect(container.querySelectorAll(".recharts-line-curve")).toHaveLength(2));
        for (const curva of container.querySelectorAll(".recharts-line-curve")) {
            expect(curva.getAttribute("d")?.match(/L/g)).toHaveLength(64);
        }
        expect(screen.getByText(/65 días con datos y 65 registros/)).toBeInTheDocument();
        expect(container.querySelectorAll(".recharts-line-dot")).toHaveLength(0);
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("ubica un punto según el período completo y lo centra al consultar únicamente ese día", async () => {
        const registros = [registro("2026-01-03", 10, 20)];
        const { container, rerender } = render(<GraficaPreciosHistoricos registros={registros} desde="2026-01-01" hasta="2026-01-31" producto="Pera" />);

        await waitFor(() => expect(container.querySelectorAll(".recharts-line-dot")).toHaveLength(2));
        const posicionEnMes = Number(container.querySelector(".recharts-line-dot")?.getAttribute("cx"));
        expect(posicionEnMes).toBeGreaterThan(30);
        expect(posicionEnMes).toBeLessThan(150);

        rerender(<GraficaPreciosHistoricos registros={registros} desde="2026-01-03" hasta="2026-01-03" producto="Pera" />);
        await waitFor(() => expect(Number(container.querySelector(".recharts-line-dot")?.getAttribute("cx"))).toBeGreaterThan(250));
        expect(Number(container.querySelector(".recharts-line-dot")?.getAttribute("cx"))).toBeLessThan(400);
        expect(container.querySelectorAll(".recharts-line-dot")).toHaveLength(2);
    });

    it("marca la fecha de hoy en Uruguay de años anteriores, incluso sin cotizaciones en esas fechas", async () => {
        const registros = [registro("2023-10-16", 10, 20), registro("2025-01-10", 15, 30), registro("2026-10-16", 20, 40)];
        const { container, rerender } = render(<GraficaPreciosHistoricos registros={registros} desde="2023-10-16" hasta="2026-10-16" producto="Pera" />);
        const referenciasVerticales = () => [...container.querySelectorAll(".recharts-reference-line")].filter((referencia) => {
            const linea = referencia.querySelector("line");
            return linea && linea.getAttribute("x1") === linea.getAttribute("x2") && linea.getAttribute("y1") !== linea.getAttribute("y2");
        });

        await waitFor(() => expect(referenciasVerticales()).toHaveLength(3));
        expect(referenciasVerticales().map((referencia) => referencia.querySelector("text")?.getAttribute("aria-label"))).toEqual(["16/10/2023", "16/10/2024", "16/10/2025"]);
        expect(screen.queryByText("Hoy en años anteriores")).not.toBeInTheDocument();
        expect(screen.getByText(/3 días con datos y 3 registros/)).toBeInTheDocument();

        rerender(<GraficaPreciosHistoricos registros={registros} desde="2024-10-16" hasta="2025-10-16" producto="Pera" />);
        await waitFor(() => expect(referenciasVerticales()).toHaveLength(2));
        expect(referenciasVerticales().map((referencia) => referencia.querySelector("text")?.getAttribute("aria-label"))).toEqual(["16/10/2024", "16/10/2025"]);

        rerender(<GraficaPreciosHistoricos registros={registros} desde="2024-10-17" hasta="2025-10-15" producto="Pera" />);
        await waitFor(() => expect(referenciasVerticales()).toHaveLength(0));
        expect(screen.queryByText("Hoy en años anteriores")).not.toBeInTheDocument();
    });

    it("combina los extremos iguales en una etiqueta con precio y fecha", async () => {
        const { container } = render(<GraficaPreciosHistoricos registros={[registro("2026-10-07", 10, 10)]} desde="2026-10-07" hasta="2026-10-07" producto="Pera" />);

        await waitFor(() => expect(container.querySelectorAll(".recharts-reference-line")).toHaveLength(1));
        expect(container.querySelector(".recharts-reference-line text")).toHaveTextContent("Mínimo y máximo $10 · 07/10/2026");
        expect(container.querySelectorAll(".recharts-line-curve")).toHaveLength(0);
        expect(container.querySelectorAll(".recharts-line-dot")).toHaveLength(2);
        expect(screen.getByText(/1 día con datos y 1 registro\./)).toBeInTheDocument();
    });

    it("permite recorrer los días con teclado y muestra límites reales y cantidad en el tooltip", async () => {
        const registros = [registro("2026-10-07", 10, 20), registro("2026-10-07", 5, 30), registro("2026-10-08", 15, 25)];
        const { container } = render(<GraficaPreciosHistoricos registros={registros} desde="2026-10-07" hasta="2026-10-08" producto="Pera" />);
        const grafica = await screen.findByRole("application");

        fireEvent.focus(grafica);
        await waitFor(() => expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent("Mínimo: $5/kg"));
        expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent("Máximo: $30/kg");
        expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent("2 registros");
        expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent("07/10/2026");

        fireEvent.keyDown(grafica, { key: "ArrowRight" });
        await waitFor(() => expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent("Mínimo: $15/kg"));
        expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent("Máximo: $25/kg");
        expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent("1 registro");
        expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent("08/10/2026");
    });

    it.each(["fecha-invalida", "2026-02-30", ""])("muestra el estado de error sin fallar al formatear %s", (desde) => {
        render(<GraficaPreciosHistoricos registros={[]} desde={desde} hasta="2026-10-07" producto="Pera" error />);

        expect(screen.getByRole("heading", { name: "Evolución del precio" })).toBeInTheDocument();
        expect(screen.getByText(/La gráfica no está disponible/)).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.queryByRole("application")).not.toBeInTheDocument();
    });

    it("muestra carga y ausencia de datos sin duplicar los roles de estado de la tabla", () => {
        const { rerender } = render(<GraficaPreciosHistoricos registros={[]} desde="2026-10-01" hasta="2026-10-07" producto="Pera" cargando />);
        expect(screen.getByText("Cargando la evolución del precio...")).toBeInTheDocument();
        expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "true");
        expect(screen.queryByRole("status")).not.toBeInTheDocument();

        rerender(<GraficaPreciosHistoricos registros={[]} desde="2026-10-01" hasta="2026-10-07" producto="Pera" />);
        expect(screen.getByText(/No hay precios para graficar/)).toBeInTheDocument();
        expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "false");
        expect(screen.queryByRole("application")).not.toBeInTheDocument();
    });

    it("puede renderizarse en el servidor con datos sin depender de medidas del navegador", () => {
        const html = renderToString(<GraficaPreciosHistoricos registros={[registro("2026-10-07", 10, 20)]} desde="2026-10-01" hasta="2026-10-07" producto="Pera" />).replace(/<!-- -->/g, "");

        expect(html).toContain("Evolución del precio");
        expect(html).toContain("recharts-responsive-container");
        expect(html).not.toContain("NaN");
        expect(html).toContain("1 día con datos y 1 registro.");
        expect(html).toContain("Mínimo del período: $10/kg el 07/10/2026");
    });

    it("omite Ñ de una serie y muestra el otro precio del mismo registro", async () => {
        const { container } = render(<GraficaPreciosHistoricos registros={[registro("2026-10-07", "Ñ", "20")]} desde="2026-10-07" hasta="2026-10-07" producto="Pera" />);

        await waitFor(() => expect(container.querySelectorAll(".recharts-line-dot")).toHaveLength(1));
        expect(container.querySelectorAll(".recharts-reference-line")).toHaveLength(1);
        expect(container.querySelector(".recharts-reference-line text")).toHaveTextContent("Máximo $20");
        fireEvent.focus(screen.getByRole("application"));
        await waitFor(() => expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent("Mínimo: —"));
        expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent("Máximo: $20/kg");
        expect(container.querySelector("svg")?.innerHTML).not.toContain("NaN");
    });

    it.each([[100, 2], [-10, -20]])("representa mínimo %s mayor que máximo %s sin intercambiarlos ni recortarlos", async (minimo, maximo) => {
        const { container } = render(<GraficaPreciosHistoricos registros={[registro("2026-10-07", minimo, maximo)]} desde="2026-10-07" hasta="2026-10-07" producto="Pera" />);

        await waitFor(() => expect(container.querySelectorAll(".recharts-line-dot")).toHaveLength(2));
        const [puntoMinimo, puntoMaximo] = [...container.querySelectorAll(".recharts-line-dot")];
        const yMinimo = Number(puntoMinimo.getAttribute("cy"));
        const yMaximo = Number(puntoMaximo.getAttribute("cy"));
        expect(yMinimo).toBeGreaterThanOrEqual(20);
        expect(yMinimo).toBeLessThan(yMaximo);
        expect(yMaximo).toBeLessThan(320);
        fireEvent.focus(screen.getByRole("application"));
        await waitFor(() => expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent(`Mínimo: $${minimo}/kg`));
        expect(container.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent(`Máximo: $${maximo}/kg`);
    });

    it("calcula el eje con todos los valores aunque los extremos de cada serie no incluyan el mayor precio", async () => {
        const { container } = render(<GraficaPreciosHistoricos registros={[registro("2026-10-07", 100, 10), registro("2026-10-08", 1, 2)]} desde="2026-10-07" hasta="2026-10-08" producto="Pera" />);

        await waitFor(() => expect(container.querySelectorAll(".recharts-line-curve")).toHaveLength(2));
        const curvaMinimo = container.querySelector(".recharts-line-curve")?.getAttribute("d") ?? "";
        const primeraY = Number(curvaMinimo.match(/^M[^,]+,([^L]+)/)?.[1]);
        expect(primeraY).toBeGreaterThanOrEqual(20);
        expect(primeraY).toBeLessThan(320);
        expect(screen.getByText(/Mínimo del período: \$1\/kg/)).toBeInTheDocument();
        expect(screen.getByText(/Máximo del período: \$10\/kg/)).toBeInTheDocument();
    });

    it("deja huecos donde no hay números y mantiene visibles los puntos aislados", async () => {
        const { container } = render(<GraficaPreciosHistoricos registros={[
            registro("2026-10-07", 5, 15), registro("2026-10-08", "Ñ", null), registro("2026-10-09", 10, 20),
        ]} desde="2026-10-07" hasta="2026-10-09" producto="Pera" />);

        await waitFor(() => expect(container.querySelectorAll(".recharts-line-dot")).toHaveLength(4));
        for (const curva of container.querySelectorAll(".recharts-line-curve")) {
            expect(curva.getAttribute("d")).not.toContain("L");
        }
        expect(screen.getByText(/2 días con datos y 2 registros/)).toBeInTheDocument();
    });

    it("muestra vacío cuando sólo recibe texto, valores ausentes o fechas no representables", () => {
        render(<GraficaPreciosHistoricos registros={[
            registro("2026-10-07", "Ñ", null), registro("fecha incorrecta", 10, 20), registro("2026-10-08", false, {}),
        ]} desde="2026-10-07" hasta="2026-10-08" producto="Pera" />);

        expect(screen.getByText(/No hay precios para graficar/)).toBeInTheDocument();
        expect(screen.queryByRole("application")).not.toBeInTheDocument();
    });
});
