import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import FormularioModificarOperador from "./FormularioModificarOperador";
import type { NaveOpcion } from "./obtenerNaves";
import type { OperadorParaModificar } from "./obtenerOperadorParaModificar";

const { push, modificarOperadorMock } = vi.hoisted(() => ({
    push: vi.fn(),
    modificarOperadorMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push }),
}));


vi.mock("./modificarOperador", () => ({
    modificarOperador: modificarOperadorMock,
}));

const naves: NaveOpcion[] = [
    { id: 1, nombre: "Nave A" },
    { id: 2, nombre: "Nave B" },
];

const operadorBase: OperadorParaModificar = {
    id: 7,
    nombre: "Caporale",
    codigoPais: "+598",
    telefono: "99123456",
    locales: [{ nombre: "022", naveId: 2, contrato: "2026-12-31" }],
};

const operadorConDosLocales: OperadorParaModificar = {
    ...operadorBase,
    locales: [
        { nombre: "022", naveId: 2, contrato: "2026-12-31" },
        { nombre: "105", naveId: 1, contrato: "" },
    ],
};

function renderizar(operador: OperadorParaModificar = operadorBase) {
    render(<FormularioModificarOperador operador={operador} naves={naves} />);
}

function elementoEn(elementos: HTMLElement[], indice: number): HTMLElement {
    const elemento = elementos[indice];
    if (!elemento) {
        throw new Error(`No hay elemento en la posición ${indice}`);
    }
    return elemento;
}

function valorDe(elemento: HTMLElement): string {
    return (elemento as HTMLInputElement | HTMLSelectElement).value;
}

function estaDeshabilitado(elemento: HTMLElement): boolean {
    return (elemento as HTMLButtonElement).disabled;
}

function apretarGuardar() {
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
}

afterEach(() => {
    cleanup();
    push.mockReset();
    modificarOperadorMock.mockReset();
    vi.restoreAllMocks();
});

describe("FormularioModificarOperador", () => {
    it("muestra los datos actuales del operador", () => {
        renderizar();

        expect(valorDe(screen.getByLabelText("Nombre"))).toBe("Caporale");
        expect(valorDe(screen.getByLabelText("Código"))).toBe("+598");
        expect(valorDe(screen.getByLabelText("WhatsApp"))).toBe("99123456");
        expect((screen.getByRole("option", { name: "Nave B" }) as HTMLOptionElement).selected).toBe(true);
        expect(valorDe(screen.getByLabelText("Número de local"))).toBe("022");
        expect(valorDe(screen.getByLabelText("Fin de contrato"))).toBe("2026-12-31");
        expect(valorDe(screen.getByLabelText("Nueva contraseña"))).toBe("");
        expect(valorDe(screen.getByLabelText("Confirmar contraseña"))).toBe("");
    });

    it("agrega un local vacío con la primera nave seleccionada", () => {
        renderizar();

        fireEvent.click(screen.getByRole("button", { name: "+ Agregar local" }));

        const numeros = screen.getAllByLabelText("Número de local");
        expect(numeros).toHaveLength(2);
        expect(valorDe(elementoEn(numeros, 1))).toBe("");
        expect(valorDe(elementoEn(screen.getAllByLabelText("Nave"), 1))).toBe("1");
        expect(valorDe(elementoEn(screen.getAllByLabelText("Fin de contrato"), 1))).toBe("");
    });

    it("elimina un local cuando hay más de uno", () => {
        renderizar(operadorConDosLocales);

        const botonesEliminar = screen.getAllByRole("button", { name: "Eliminar" });
        fireEvent.click(elementoEn(botonesEliminar, 0));

        const numeros = screen.getAllByLabelText("Número de local");
        expect(numeros).toHaveLength(1);
        expect(valorDe(elementoEn(numeros, 0))).toBe("105");
    });

    it("no permite eliminar el único local y muestra el aviso", () => {
        renderizar();

        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

        const alerta = screen.getByRole("alert");
        expect(alerta.textContent).toContain("Debe haber al menos un local.");
        expect(screen.getAllByLabelText("Número de local")).toHaveLength(1);
    });

    it("envía los datos modificados y vuelve al perfil cuando la modificación es válida", async () => {
        modificarOperadorMock.mockResolvedValue({ esValido: true, id: 7 });
        renderizar();

        fireEvent.change(screen.getByLabelText("Nombre"), {
            target: { value: "Caporale Hermanos" },
        });
        fireEvent.change(screen.getByLabelText("WhatsApp"), {
            target: { value: "98765432" },
        });
        apretarGuardar();

        await waitFor(() => {
            expect(push).toHaveBeenCalledWith("/gestion-operadores/7");
        });
        expect(modificarOperadorMock).toHaveBeenCalledTimes(1);
        expect(modificarOperadorMock).toHaveBeenCalledWith({
            operadorId: 7,
            nombre: "Caporale Hermanos",
            codigoPais: "+598",
            telefono: "98765432",
            contraseña: "",
            confirmacionContraseña: "",
            locales: [{ nombre: "022", naveId: 2, contrato: "2026-12-31" }],
        });
    });

    it("envía la nueva contraseña y su confirmación", async () => {
        modificarOperadorMock.mockResolvedValue({ esValido: true, id: 7 });
        renderizar();

        fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
            target: { value: "contraseña123" },
        });
        fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
            target: { value: "contraseña123" },
        });
        apretarGuardar();

        await waitFor(() => {
            expect(modificarOperadorMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    contraseña: "contraseña123",
                    confirmacionContraseña: "contraseña123",
                }),
            );
        });
    });

    it("muestra los errores de validación y no navega", async () => {
        modificarOperadorMock.mockResolvedValue({
            esValido: false,
            errores: ["El nombre es obligatorio.", "El teléfono no es válido."],
        });
        renderizar();

        apretarGuardar();

        const alerta = await screen.findByRole("alert");
        expect(alerta.textContent).toContain("El nombre es obligatorio.");
        expect(alerta.textContent).toContain("El teléfono no es válido.");
        expect(push).not.toHaveBeenCalled();
    });

    it("muestra un mensaje genérico si la acción falla", async () => {
        const errorDeConsola = vi.spyOn(console, "error").mockImplementation(() => {});
        modificarOperadorMock.mockRejectedValue(new Error("Falla simulada"));
        renderizar();

        apretarGuardar();

        const alerta = await screen.findByRole("alert");
        expect(alerta.textContent).toContain(
            "No se pudieron guardar los cambios. Intentá de nuevo.",
        );
        expect(errorDeConsola).toHaveBeenCalled();
        expect(push).not.toHaveBeenCalled();
    });

    it("deshabilita el botón de guardar mientras se está guardando", async () => {
        let resolver: (valor: unknown) => void = () => {};
        modificarOperadorMock.mockReturnValue(
            new Promise((resolve) => {
                resolver = resolve;
            }),
        );
        renderizar();

        apretarGuardar();

        const botonGuardando = await screen.findByRole("button", { name: "Guardando..." });
        expect(estaDeshabilitado(botonGuardando)).toBe(true);

        resolver({ esValido: true, id: 7 });
        await waitFor(() => {
            expect(push).toHaveBeenCalledWith("/gestion-operadores/7");
        });
    });

    it.each(["Cancelar", "← Volver al perfil"])(
        "vuelve al perfil sin guardar al apretar «%s»",
        (nombreDelBoton) => {
            renderizar();

            fireEvent.click(screen.getByRole("button", { name: nombreDelBoton }));

            expect(push).toHaveBeenCalledWith("/gestion-operadores/7");
            expect(modificarOperadorMock).not.toHaveBeenCalled();
        },
    );
});