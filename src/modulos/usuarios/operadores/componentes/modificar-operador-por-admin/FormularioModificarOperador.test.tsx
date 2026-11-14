import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "temporal-polyfill";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@/test-utils";

import FormularioModificarOperador from "./FormularioModificarOperador";
import type { NaveOpcion } from "@/modulos/usuarios/operadores/consultas-naves";
import type { OperadorParaModificar } from "../../tipos";

const { push, modificarOperadorMock } = vi.hoisted(() => ({
    push: vi.fn(),
    modificarOperadorMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push }),
}));


vi.mock("../../acciones/modificarOperador", () => ({
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
    return (elemento as HTMLInputElement).value;
}

function estaDeshabilitado(elemento: HTMLElement): boolean {
    return (elemento as HTMLButtonElement).disabled;
}

function apretarGuardar() {
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
}

beforeEach(() => {
    vi.spyOn(Temporal.Now, "plainDateISO").mockImplementation((zona) =>
        Temporal.Instant.from("2026-11-15T01:30:00Z").toZonedDateTimeISO(zona ?? "UTC").toPlainDate(),
    );
});

afterEach(() => {
    cleanup();
    push.mockReset();
    modificarOperadorMock.mockReset();
    vi.restoreAllMocks();
});

describe("FormularioModificarOperador", () => {
    it("muestra los datos actuales del operador", () => {
        renderizar();

        expect(valorDe(screen.getByLabelText(/^Nombre\s*\*?$/))).toBe("Caporale");
        expect(screen.getByRole("combobox", { name: "Código de país" })).toHaveTextContent("+598");
        expect(valorDe(screen.getByLabelText(/Teléfono/))).toBe("99123456");
        expect(screen.getByRole("combobox", { name: "Nave" })).toHaveTextContent("Nave B");
        expect(valorDe(screen.getByLabelText(/^Número de local/))).toBe("022");
        expect(valorDe(screen.getByLabelText("Fin de contrato"))).toBe("2026-12-31");
        expect(valorDe(screen.getByLabelText(/^Nueva contraseña\s*\*?$/))).toBe("");
        expect(valorDe(screen.getByLabelText(/^Confirmar contraseña\s*\*?$/))).toBe("");
    });

    it("pide aceptar el aviso de UAM antes de marcar la licencia y sólo persiste al guardar", async () => {
        modificarOperadorMock.mockResolvedValue({ esValido: true, id: 7, mensaje: "Operador modificado correctamente." });
        renderizar();
        const licencia = screen.getByRole("switch", { name: "En licencia" });

        fireEvent.click(licencia);

        const dialogo = screen.getByRole("alertdialog", { name: "Aviso de licencia" });
        expect(dialogo).toHaveTextContent("La gestión de licencias debe tramitarse exclusivamente a través de los mecanismos habituales de la UAM. La información exhibida en este sitio tiene carácter meramente informativo.");
        expect(licencia).not.toBeChecked();
        expect(modificarOperadorMock).not.toHaveBeenCalled();
        fireEvent.click(within(dialogo).getByRole("button", { name: "Aceptar" }));

        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        expect(licencia).toBeChecked();
        expect(modificarOperadorMock).not.toHaveBeenCalled();
        apretarGuardar();
        expect(await screen.findByRole("alert")).toHaveTextContent("Faltan completar campos obligatorios.");
        expect(screen.getByLabelText(/^Inicio de licencia\s*\*?$/)).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByLabelText(/^Fin de licencia\s*\*?$/)).toHaveAttribute("aria-invalid", "true");
        expect(modificarOperadorMock).not.toHaveBeenCalled();
        expect(screen.getByLabelText(/^Inicio de licencia\s*\*?$/)).not.toHaveAttribute("min");
        expect(screen.getByLabelText(/^Fin de licencia\s*\*?$/)).toHaveAttribute("min", "2026-11-14");
        fireEvent.change(screen.getByLabelText(/^Inicio de licencia\s*\*?$/), { target: { value: "2999-11-05" } });
        expect(screen.getByLabelText(/^Fin de licencia\s*\*?$/)).toHaveAttribute("min", "2999-11-05");
        fireEvent.change(screen.getByLabelText(/^Inicio de licencia\s*\*?$/), { target: { value: "2000-11-05" } });
        expect(screen.getByLabelText(/^Fin de licencia\s*\*?$/)).toHaveAttribute("min", "2026-11-14");
        fireEvent.change(screen.getByLabelText(/^Fin de licencia\s*\*?$/), { target: { value: "2026-11-14" } });
        expect(screen.getByLabelText(/^Inicio de licencia\s*\*?$/)).not.toHaveAttribute("aria-invalid", "true");
        expect(screen.getByLabelText(/^Fin de licencia\s*\*?$/)).not.toHaveAttribute("aria-invalid", "true");
        apretarGuardar();

        await waitFor(() => expect(modificarOperadorMock).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
            enLicencia: true, inicioLicencia: "2000-11-05", finLicencia: "2026-11-14",
        })));
    });

    it.each(["Cancelar", "Escape"])("deja la licencia desmarcada al cerrar el aviso con %s", async (accion) => {
        renderizar();
        const licencia = screen.getByRole("switch", { name: "En licencia" });
        fireEvent.click(licencia);
        const dialogo = screen.getByRole("alertdialog", { name: "Aviso de licencia" });

        if (accion === "Cancelar") fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
        else fireEvent.keyDown(dialogo, { key: "Escape", code: "Escape" });

        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        expect(licencia).not.toBeChecked();
        expect(screen.queryByLabelText(/^Inicio de licencia\s*\*?$/)).not.toBeInTheDocument();
        expect(modificarOperadorMock).not.toHaveBeenCalled();
        expect(push).not.toHaveBeenCalled();
    });

    it("carga una licencia activa sin aviso y permite desmarcarla directamente", () => {
        renderizar({ ...operadorBase, enLicencia: true, comentario: "Licencia: 2999-11-05 - 2999-11-12" });
        const licencia = screen.getByRole("switch", { name: "En licencia" });
        expect(licencia).toBeChecked();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

        fireEvent.click(licencia);

        expect(licencia).not.toBeChecked();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/^Inicio de licencia\s*\*?$/)).not.toBeInTheDocument();
        expect(modificarOperadorMock).not.toHaveBeenCalled();
    });

    it.each(["A22", "22B", "-22", "+22", "2.2", "2,2", "2e2"])(
        "rechaza el número de local inválido %s sin cambiar lo escrito",
        (valor) => {
            renderizar();
            const campo = screen.getByLabelText(/^Número de local/);

            fireEvent.change(campo, { target: { value: valor } });

            expect(campo).toHaveValue("022");
            expect(modificarOperadorMock).not.toHaveBeenCalled();
        },
    );

    it("rechaza un pegado inválido y permite vaciar y reescribir el local con ceros iniciales", () => {
        renderizar();
        const campo = screen.getByLabelText(/^Número de local/) as HTMLInputElement;

        expect(campo).toHaveAttribute("type", "text");
        expect(campo).toHaveAttribute("inputmode", "numeric");
        fireEvent.input(campo, {
            target: { value: "12 A34" },
            inputType: "insertFromPaste",
            data: "12 A34",
        });
        expect(campo).toHaveValue("022");

        fireEvent.change(campo, { target: { value: "" } });
        expect(campo).toHaveValue("");
        expect(campo.validity.valueMissing).toBe(true);
        expect(modificarOperadorMock).not.toHaveBeenCalled();

        fireEvent.input(campo, {
            target: { value: "0022" },
            inputType: "insertFromPaste",
            data: "0022",
        });
        expect(campo).toHaveValue("0022");
        expect(campo.checkValidity()).toBe(true);
    });

    it("agrega un local vacío con la primera nave seleccionada", () => {
        renderizar();

        fireEvent.click(screen.getByRole("button", { name: "+ Agregar local" }));

        const numeros = screen.getAllByLabelText(/^Número de local/);
        expect(numeros).toHaveLength(2);
        expect(valorDe(elementoEn(numeros, 1))).toBe("");
        expect(elementoEn(screen.getAllByRole("combobox", { name: "Nave" }), 1)).toHaveTextContent("Nave A");
        expect(valorDe(elementoEn(screen.getAllByLabelText("Fin de contrato"), 1))).toBe("");
    });

    it("elimina un local cuando hay más de uno", () => {
        renderizar(operadorConDosLocales);

        const botonesEliminar = screen.getAllByRole("button", { name: "Eliminar" });
        fireEvent.click(elementoEn(botonesEliminar, 0));

        const numeros = screen.getAllByLabelText(/^Número de local/);
        expect(numeros).toHaveLength(1);
        expect(valorDe(elementoEn(numeros, 0))).toBe("105");
    });

    it("conserva el último local y avisa fuera de las validaciones del formulario", () => {
        renderizar();

        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

        const alerta = screen.getByRole("alert");
        expect(alerta.textContent).toContain("Debe haber al menos un local.");
        expect(screen.getAllByLabelText(/^Número de local/)).toHaveLength(1);
        expect(valorDe(screen.getByLabelText(/^Número de local/))).toBe("022");
        const formulario = screen.getByRole("button", { name: "Guardar cambios" }).closest("form")!;
        expect(within(formulario).queryByRole("alert")).not.toBeInTheDocument();
        expect(modificarOperadorMock).not.toHaveBeenCalled();
    });

    it("permite cerrar y volver a mostrar el aviso al reintentar eliminar el último local", async () => {
        renderizar();
        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        expect(screen.getByRole("alert")).toHaveTextContent("Debe haber al menos un local.");

        fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
        await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());

        fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Debe haber al menos un local.");
        expect(screen.getAllByRole("alert")).toHaveLength(1);
        expect(screen.getAllByLabelText(/^Número de local/)).toHaveLength(1);
        expect(valorDe(screen.getByLabelText(/^Número de local/))).toBe("022");
    });

    it("envía los datos modificados y vuelve al perfil cuando la modificación es válida", async () => {
        modificarOperadorMock.mockResolvedValue({ esValido: true, id: 7, mensaje: "Operador modificado correctamente." });
        renderizar();

        fireEvent.change(screen.getByLabelText(/^Nombre\s*\*?$/), {
            target: { value: "Caporale Hermanos" },
        });
        fireEvent.change(screen.getByLabelText(/Teléfono/), {
            target: { value: "1123456789" },
        });
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Código de país" }));
        fireEvent.click(screen.getByRole("option", { name: "+54 (Argentina)" }));
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Nave" }));
        fireEvent.click(screen.getByRole("option", { name: "Nave A" }));
        expect(screen.getByRole("combobox", { name: "Código de país" })).toHaveTextContent("+54");
        expect(screen.getByRole("combobox", { name: "Nave" })).toHaveTextContent("Nave A");
        apretarGuardar();

        await waitFor(() => {
            expect(push).toHaveBeenCalledWith("/gestion-operadores/7");
        });
        expect(modificarOperadorMock).toHaveBeenCalledTimes(1);
        expect(within(screen.getByRole("region", { name: "Notificaciones" })).getByRole("status")).toHaveTextContent("Operador modificado correctamente.");
        const formulario = screen.getByRole("button", { name: "Guardar cambios" }).closest("form")!;
        expect(within(formulario).queryByRole("status")).not.toBeInTheDocument();
        expect(modificarOperadorMock).toHaveBeenCalledWith({
            operadorId: 7,
            nombre: "Caporale Hermanos",
            codigoPais: "+54",
            telefono: "1123456789",
            enLicencia: false,
            inicioLicencia: "",
            finLicencia: "",
            comentario: "",
            contraseña: "",
            confirmacionContraseña: "",
            locales: [{ nombre: "022", naveId: 1, contrato: "2026-12-31" }],
        });
    });

    it("envía la nueva contraseña y su confirmación", async () => {
        modificarOperadorMock.mockResolvedValue({ esValido: true, id: 7, mensaje: "Operador modificado correctamente." });
        renderizar();

        fireEvent.change(screen.getByLabelText(/^Nueva contraseña\s*\*?$/), {
            target: { value: "contraseña123" },
        });
        fireEvent.change(screen.getByLabelText(/^Confirmar contraseña\s*\*?$/), {
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

    it("deshabilita el botón de guardar y los selects mientras se está guardando", async () => {
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
        for (const campo of ["Código de país", "Nave"]) {
            const selector = screen.getByRole("combobox", { name: campo });
            expect(selector).toHaveAttribute("aria-disabled", "true");
            fireEvent.mouseDown(selector);
        }
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

        resolver({ esValido: true, id: 7, mensaje: "Operador modificado correctamente." });
        await waitFor(() => {
            expect(push).toHaveBeenCalledWith("/gestion-operadores/7");
        });
    });

    it.each(["Cancelar", "Volver al perfil"])(
        "vuelve al perfil sin guardar al apretar «%s»",
        (nombreDelBoton) => {
            renderizar();

            fireEvent.click(screen.getByRole("button", { name: nombreDelBoton }));

            expect(push).toHaveBeenCalledWith("/gestion-operadores/7");
            expect(modificarOperadorMock).not.toHaveBeenCalled();
        },
    );
});
