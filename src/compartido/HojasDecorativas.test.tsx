import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HojasDecorativas from "./HojasDecorativas";
import styles from "./HojasDecorativas.module.css";

afterEach(cleanup);

describe("HojasDecorativas", () => {
    it("muestra el separador y acepta una clase adicional", () => {
        const { container } = render(<HojasDecorativas className="hojas-extra" />);
        expect(container.firstElementChild).toHaveClass(styles.decoracion, styles.separador, "hojas-extra");
        expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    });

    it("conserva las tres formas decorativas del separador", () => {
        const { container } = render(<HojasDecorativas />);
        const decoracion = container.firstElementChild;
        expect(decoracion).toHaveClass(styles.separador);
        expect(decoracion?.children).toHaveLength(3);
        expect(decoracion?.children[0]).toHaveClass(styles.motivo, styles.hojaAncha, styles.motivoUno);
        expect(decoracion?.children[1]).toHaveClass(styles.motivo, styles.ramita, styles.motivoDos);
        expect(decoracion?.children[2]).toHaveClass(styles.motivo, styles.helecho, styles.motivoTres);
    });

    it("mantiene los elementos que dibujan la hoja, la ramita y el helecho", () => {
        const { container } = render(<HojasDecorativas />);
        const hoja = container.querySelector(`.${styles.hojaAncha}`);
        const ramita = container.querySelector(`.${styles.ramita}`);
        const helecho = container.querySelector(`.${styles.helecho}`);

        expect(hoja?.querySelector(`.${styles.laminaAncha}`)).toBeInTheDocument();
        expect(hoja?.querySelector(`.${styles.nervio}`)).toBeInTheDocument();
        expect(ramita?.querySelector(`.${styles.eje}`)).toBeInTheDocument();
        expect(ramita?.querySelectorAll(`.${styles.par}`)).toHaveLength(3);
        expect(helecho?.querySelector(`.${styles.eje}`)).toBeInTheDocument();
        expect(helecho?.querySelectorAll(`.${styles.par}`)).toHaveLength(6);
    });
});