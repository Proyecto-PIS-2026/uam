import { useState, type ComponentProps, type FormEvent } from "react";
import { fireEvent, render, screen, waitFor, within } from "@/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TemaAplicacion from "@/compartido/TemaAplicacion";
import SelectorFecha from "./SelectorFecha";

type PropsFormulario = Omit<ComponentProps<typeof SelectorFecha>, "value" | "onChange"> & {
    inicial?: string;
    alCambiar?: (valor: string) => void;
    alEnviar?: (datos: FormData) => void;
};

function Formulario({ inicial = "", alCambiar, alEnviar, ...props }: PropsFormulario) {
    const [fecha, setFecha] = useState(inicial);
    const enviar = (evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();
        alEnviar?.(new FormData(evento.currentTarget));
    };
    return <TemaAplicacion>
        <form aria-label="Formulario de fechas" onSubmit={enviar}>
            <SelectorFecha id="fecha" name="fecha" label="Fecha" {...props} value={fecha} onChange={(valor) => {
                setFecha(valor);
                alCambiar?.(valor);
            }} />
            <button type="submit">Enviar fecha</button>
        </form>
    </TemaAplicacion>;
}

function usarPantalla(escritorio: boolean) {
    vi.stubGlobal("matchMedia", vi.fn((consulta: string) => ({
        matches: consulta === "(min-width: 768px)" && escritorio,
        media: consulta,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })));
}

function campoFecha() {
    return screen.getByLabelText(/^Fecha/, { selector: "input" }) as HTMLInputElement;
}

async function abrirCalendario() {
    fireEvent.click(screen.getByRole("button", { name: "Abrir calendario de Fecha" }));
    return screen.findByRole("dialog");
}

describe("SelectorFecha", () => {
    beforeEach(() => {
        usarPantalla(true);
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(16, 16, 280, 44));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it.each([
        "2026-11-16",
        "2026-11-16T00:00:00.000Z",
        "2026-11-16T23:30:00-03:00",
    ])("mantiene el día de %s y envía una fecha ISO sin hora", (inicial) => {
        const enviar = vi.fn();
        render(<Formulario inicial={inicial} alEnviar={enviar} />);

        expect(campoFecha()).toHaveValue("2026-11-16");
        expect(screen.getByRole("group", { name: "Fecha" })).toHaveTextContent(/16.*11.*2026/);
        fireEvent.click(screen.getByRole("button", { name: "Enviar fecha" }));

        expect(enviar).toHaveBeenCalledOnce();
        expect((enviar.mock.calls[0][0] as FormData).get("fecha")).toBe("2026-11-16");
    });

    it("selecciona desde el calendario de escritorio en español y cierra al elegir el día", async () => {
        const cambiar = vi.fn();
        render(<Formulario inicial="2026-11-16" alCambiar={cambiar} />);

        const calendario = await abrirCalendario();
        expect(within(calendario).getByRole("button", { name: "Mes anterior" })).toBeInTheDocument();
        expect(within(calendario).getByRole("button", { name: "Mes siguiente" })).toBeInTheDocument();
        expect(within(calendario).getByRole("gridcell", { name: "16" })).toHaveAttribute("aria-selected", "true");
        fireEvent.click(within(calendario).getByRole("gridcell", { name: "17" }));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(campoFecha()).toHaveValue("2026-11-17");
        expect(cambiar).toHaveBeenLastCalledWith("2026-11-17");
    });

    it("en mobile permite cancelar la selección y aceptar otra fecha", async () => {
        usarPantalla(false);
        render(<Formulario inicial="2026-11-16" />);

        let calendario = await abrirCalendario();
        expect(within(calendario).getByText("Seleccionar fecha")).toBeInTheDocument();
        fireEvent.click(within(calendario).getByRole("gridcell", { name: "17" }));
        expect(calendario).toBeInTheDocument();
        fireEvent.click(within(calendario).getByRole("button", { name: "Cancelar" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(campoFecha()).toHaveValue("2026-11-16");

        calendario = await abrirCalendario();
        fireEvent.click(within(calendario).getByRole("gridcell", { name: "18" }));
        fireEvent.click(within(calendario).getByRole("button", { name: "Aceptar" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(campoFecha()).toHaveValue("2026-11-18");
    });

    it("deshabilita los días fuera de min y max y permite ambos extremos", async () => {
        render(<Formulario inicial="2026-11-15" min="2026-11-10" max="2026-11-20" />);
        const calendario = await abrirCalendario();

        expect(within(calendario).getByRole("gridcell", { name: "9" })).toBeDisabled();
        expect(within(calendario).getByRole("gridcell", { name: "10" })).toBeEnabled();
        expect(within(calendario).getByRole("gridcell", { name: "20" })).toBeEnabled();
        expect(within(calendario).getByRole("gridcell", { name: "21" })).toBeDisabled();
    });

    it.each([
        { valor: "2026-11-09", mensaje: "La fecha debe ser igual o posterior a 10/11/2026." },
        { valor: "2026-11-21", mensaje: "La fecha debe ser igual o anterior a 20/11/2026." },
    ])("bloquea una fecha escrita fuera del rango: $valor", async ({ valor, mensaje }) => {
        const enviar = vi.fn();
        render(<Formulario inicial="2026-11-15" min="2026-11-10" max="2026-11-20" alEnviar={enviar} />);
        fireEvent.change(campoFecha(), { target: { value: valor } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar fecha" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(mensaje);
        expect(campoFecha()).toBeInvalid();
        expect(enviar).not.toHaveBeenCalled();
    });

    it("marca una fecha obligatoria vacía, avisa por toast y permite enviarla al completar", async () => {
        const enviar = vi.fn();
        render(<Formulario required alEnviar={enviar} />);
        fireEvent.click(screen.getByRole("button", { name: "Enviar fecha" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Faltan completar campos obligatorios.");
        expect(campoFecha()).toHaveAttribute("data-error-validacion", "true");
        expect(enviar).not.toHaveBeenCalled();

        fireEvent.change(campoFecha(), { target: { value: "2026-11-16" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar fecha" }));
        expect(enviar).toHaveBeenCalledOnce();
        expect((enviar.mock.calls[0][0] as FormData).get("fecha")).toBe("2026-11-16");
        expect(campoFecha()).toBeValid();
        await waitFor(() => expect(campoFecha()).not.toHaveAttribute("data-error-validacion"));
    });

    it.each(["2026-02-30", "31/02/2026", "texto"])("rechaza la fecha inválida %s aunque el campo sea opcional", async (valor) => {
        const enviar = vi.fn();
        render(<Formulario inicial="2026-11-16" alEnviar={enviar} />);
        fireEvent.change(campoFecha(), { target: { value: valor } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar fecha" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Ingresá una fecha válida.");
        expect(campoFecha()).toBeInvalid();
        expect(enviar).not.toHaveBeenCalled();

        fireEvent.change(campoFecha(), { target: { value: "29/02/2028" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar fecha" }));
        expect(campoFecha()).toBeValid();
        expect(enviar).toHaveBeenCalledOnce();
        expect((enviar.mock.calls[0][0] as FormData).get("fecha")).toBe("2028-02-29");
    });

    it("permite una fecha opcional vacía", () => {
        const enviar = vi.fn();
        render(<Formulario alEnviar={enviar} />);
        fireEvent.click(screen.getByRole("button", { name: "Enviar fecha" }));

        expect(campoFecha()).toBeValid();
        expect(enviar).toHaveBeenCalledOnce();
        expect((enviar.mock.calls[0][0] as FormData).get("fecha")).toBe("");
    });

    it("descarta una fecha inválida al cancelar la edición y no la recupera al volver a editar", () => {
        function Editor() {
            const [editando, setEditando] = useState(true);
            const [fecha, setFecha] = useState("");
            return <TemaAplicacion>
                <SelectorFecha id="fecha" label="Fecha" value={fecha} onChange={setFecha} readOnly={!editando} disabled={!editando} />
                <button disabled={!editando} onClick={() => { setFecha(""); setEditando(false); }}>Cancelar edición</button>
                <button disabled={editando} onClick={() => setEditando(true)}>Editar fecha</button>
            </TemaAplicacion>;
        }
        render(<Editor />);
        fireEvent.change(campoFecha(), { target: { value: "2026-02-30" } });
        expect(campoFecha()).toBeInvalid();
        expect(campoFecha().validity.customError).toBe(true);

        fireEvent.click(screen.getByRole("button", { name: "Cancelar edición" }));
        expect(campoFecha()).toHaveValue("");
        expect(campoFecha()).toBeDisabled();
        expect(campoFecha().validity.customError).toBe(false);

        fireEvent.click(screen.getByRole("button", { name: "Editar fecha" }));
        expect(campoFecha()).toBeEnabled();
        expect(campoFecha()).toHaveValue("");
        expect(campoFecha()).toBeValid();
        expect(campoFecha().validity.customError).toBe(false);
    });

    it.each(["1800-11-16", "2200-11-16"])("acepta escribir %s y muestra una cantidad acotada de años", async (valor) => {
        const enviar = vi.fn();
        render(<Formulario inicial="2026-11-16" alEnviar={enviar} />);
        fireEvent.change(campoFecha(), { target: { value: valor } });

        expect(campoFecha()).toHaveValue(valor);
        expect(campoFecha()).toBeValid();
        fireEvent.click(screen.getByRole("button", { name: "Enviar fecha" }));
        expect(enviar).toHaveBeenCalledOnce();
        expect((enviar.mock.calls[0][0] as FormData).get("fecha")).toBe(valor);

        const calendario = await abrirCalendario();
        fireEvent.click(within(calendario).getByRole("button", { name: /cambie a la vista anual/ }));
        const anios = within(calendario).getAllByRole("radio");
        expect(anios.length).toBeGreaterThan(0);
        expect(anios.length).toBeLessThan(250);
        expect(within(calendario).getByRole("radio", { name: valor.slice(0, 4) })).toHaveAttribute("aria-checked", "true");
    });

    it("limpia una fecha opcional desde el calendario", async () => {
        const cambiar = vi.fn();
        render(<Formulario inicial="2026-11-16" alCambiar={cambiar} />);
        const calendario = await abrirCalendario();
        fireEvent.click(within(calendario).getByRole("button", { name: "Limpiar" }));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(campoFecha()).toHaveValue("");
        expect(campoFecha()).toBeValid();
        expect(cambiar).toHaveBeenLastCalledWith("");
    });

    it.each(["disabled", "readOnly"] as const)("bloquea la edición y el calendario con %s", (estado) => {
        const cambiar = vi.fn();
        render(<Formulario inicial="2026-11-16" {...{ [estado]: true }} alCambiar={cambiar} />);
        const input = campoFecha();
        if (estado === "disabled") expect(input).toBeDisabled();
        else expect(input).toHaveAttribute("readonly");
        const abrir = screen.queryByRole("button", { name: "Abrir calendario de Fecha" });
        if (abrir) {
            expect(abrir).toBeDisabled();
            fireEvent.click(abrir);
        }

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(input).toHaveValue("2026-11-16");
        expect(cambiar).not.toHaveBeenCalled();
    });

    it("conserva la asociación con una etiqueta externa", () => {
        render(<TemaAplicacion>
            <label htmlFor="vigencia">Fecha de vigencia</label>
            <SelectorFecha id="vigencia" labelAccesible="Fecha de vigencia" value="2026-11-16" onChange={vi.fn()} />
        </TemaAplicacion>);

        expect(screen.getByLabelText("Fecha de vigencia", { selector: "input" })).toHaveValue("2026-11-16");
        expect(screen.getByRole("group", { name: "Fecha de vigencia" })).toBeInTheDocument();
    });
});
