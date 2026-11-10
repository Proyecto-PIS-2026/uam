import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import CampoComentario from "./CampoComentario";
import { LARGO_MAXIMO_COMENTARIO } from "../validarComentario";

afterEach(() => {
    cleanup();
});

describe("CampoComentario", () => {
    it("muestra el comentario y avisa cada cambio", () => {
        const alCambiar = vi.fn();
        render(<CampoComentario id="comentario" valor="Cosecha de esta semana" alCambiar={alCambiar} clases={{}} />);

        const campo = screen.getByLabelText("Comentario");
        expect(campo).toHaveValue("Cosecha de esta semana");

        fireEvent.change(campo, { target: { value: "Cosecha nueva" } });
        expect(alCambiar).toHaveBeenCalledWith("Cosecha nueva");
    });

    it("muestra cuántos caracteres quedan y limita el largo", () => {
        render(<CampoComentario id="comentario" valor="Hola" alCambiar={vi.fn()} clases={{}} />);

        expect(screen.getByText(`4/${LARGO_MAXIMO_COMENTARIO} caracteres`)).toBeInTheDocument();
        expect(screen.getByLabelText("Comentario")).toHaveAttribute("maxLength", String(LARGO_MAXIMO_COMENTARIO));
    });

    it("en modo consulta lo muestra sin permitir modificarlo", () => {
        render(<CampoComentario id="comentario" valor="Cosecha de esta semana" editando={false} clases={{}} />);

        const campo = screen.getByLabelText("Comentario");
        expect(campo).toHaveValue("Cosecha de esta semana");
        expect(campo).toHaveAttribute("readonly");
        expect(screen.queryByText(/caracteres/)).not.toBeInTheDocument();
    });

    it("en modo consulta sin comentario muestra un guion", () => {
        render(<CampoComentario id="comentario" valor="" editando={false} clases={{}} />);

        expect(screen.getByLabelText("Comentario")).toHaveAttribute("placeholder", "-");
    });
});