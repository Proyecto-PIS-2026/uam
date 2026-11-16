import { cleanup, fireEvent, render, screen, waitFor } from "@/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import TarjetaVigencia, { type ConfiguracionVigenciaFotos } from "./TarjetaVigencia";

afterEach(cleanup);

const configuracion: ConfiguracionVigenciaFotos = {
    habilitado: true, diasVigencia: "30", avisosHabilitados: true, diasAnticipacion: "7",
};

function preparar(cambios: Partial<ConfiguracionVigenciaFotos> = {}, avisosIndependientes = false) {
    const props = {
        titulo: "Vigencia de las fotos",
        descripcion: "Configurá la vigencia de las fotos.",
        etiquetaVencimiento: "Vencimiento de fotos",
        ayudaVencimiento: "Aplicar un período de vigencia.",
        ayudaAvisos: "Notificar a operadores y productores.",
        avisosIndependientes,
        configuracion: { ...configuracion, ...cambios },
        onChange: vi.fn(),
    };
    return { ...render(<TarjetaVigencia {...props} />), props };
}

describe("TarjetaVigencia controlada", () => {
    it("muestra los textos y valores sin formularios ni guardados individuales", () => {
        const { container } = preparar();
        for (const texto of ["Vigencia de las fotos", "Configurá la vigencia de las fotos.", "Aplicar un período de vigencia.", "Notificar a operadores y productores."]) {
            expect(screen.getByText(texto)).toBeInTheDocument();
        }
        expect(screen.getByRole("switch", { name: "Vencimiento de fotos" })).toBeChecked();
        expect(screen.getByRole("switch", { name: "Habilitar avisos de próximo vencimiento" })).toBeChecked();
        expect(screen.getByLabelText(/^Días de vigencia/)).toHaveValue("30");
        expect(screen.getByLabelText(/^Días de anticipación del aviso/)).toHaveValue("7");
        expect(container.querySelector("form")).toBeNull();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("permite omitir los textos opcionales", () => {
        render(<TarjetaVigencia configuracion={configuracion} onChange={vi.fn()} />);
        expect(screen.queryByText("Vigencia de las fotos")).not.toBeInTheDocument();
        expect(screen.getByLabelText(/^Días de vigencia/)).toHaveValue("30");
    });

    it.each([
        { nombre: "Vencimiento de fotos", campo: "habilitado" },
        { nombre: "Habilitar avisos de próximo vencimiento", campo: "avisosHabilitados" },
    ] as const)("comunica solo $campo sin alterar la configuración recibida", ({ nombre, campo }) => {
        const { props } = preparar();
        fireEvent.click(screen.getByRole("switch", { name: nombre }));
        expect(props.onChange).toHaveBeenCalledExactlyOnceWith({ [campo]: false });
        expect(props.configuracion).toEqual(configuracion);
        expect(screen.getByLabelText(/^Días de vigencia/)).toHaveValue("30");
        expect(screen.getByLabelText(/^Días de anticipación del aviso/)).toHaveValue("7");
    });

    describe.each([
        { etiqueta: /^Días de vigencia/, campo: "diasVigencia" },
        { etiqueta: /^Días de anticipación del aviso/, campo: "diasAnticipacion" },
    ] as const)("$campo", ({ etiqueta, campo }) => {
        it.each(["", "0", "040", "36501", "9007199254740992"])("envía el borrador %j sin normalizar ni validar su plazo", (valor) => {
            const { props } = preparar();
            const entrada = screen.getByLabelText(etiqueta);
            expect(entrada).toBeEnabled();
            fireEvent.change(entrada, { target: { value: valor } });
            expect(props.onChange).toHaveBeenCalledExactlyOnceWith({ [campo]: valor });
            expect(entrada).toHaveValue(configuracion[campo]);
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });

        it.each(["abc", "-1", "1.5", " 2", "1e2"])("ignora caracteres que no sean dígitos: %j", (valor) => {
            const { props } = preparar();
            fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
            expect(props.onChange).not.toHaveBeenCalled();
            expect(screen.getByLabelText(etiqueta)).toHaveValue(configuracion[campo]);
        });
    });

    it("oculta y recupera los controles de fotos sin perder los plazos ni los avisos del borrador", async () => {
        const { props, rerender } = preparar();
        const borrador = { ...configuracion, diasVigencia: "40", diasAnticipacion: "9" };
        const vigencia = screen.getByLabelText(/^Días de vigencia/);
        const anticipacion = screen.getByLabelText(/^Días de anticipación del aviso/);
        const avisos = screen.getByRole("switch", { name: "Habilitar avisos de próximo vencimiento" });
        const filaAvisos = avisos.closest("label");
        expect(filaAvisos).toBeVisible();
        rerender(<TarjetaVigencia {...props} configuracion={{ ...borrador, habilitado: false }} />);
        expect(screen.getByRole("switch", { name: "Vencimiento de fotos" })).not.toBeChecked();
        expect(vigencia.closest(".MuiCollapse-root")).toHaveStyle({ transitionDuration: "300ms" });
        await waitFor(() => {
            expect(vigencia).not.toBeVisible();
            expect(filaAvisos).not.toBeVisible();
            expect(anticipacion).not.toBeVisible();
        });
        for (const entrada of [vigencia, avisos, anticipacion]) expect(entrada).toBeDisabled();
        expect(vigencia).not.toBeRequired();
        expect(anticipacion).not.toBeRequired();
        expect(vigencia).toHaveValue("40");
        expect(anticipacion).toHaveValue("9");
        expect(avisos).toBeChecked();
        rerender(<TarjetaVigencia {...props} configuracion={borrador} />);
        await waitFor(() => {
            expect(vigencia).toBeVisible();
            expect(filaAvisos).toBeVisible();
            expect(anticipacion).toBeVisible();
        });
        for (const entrada of [vigencia, avisos, anticipacion]) expect(entrada).toBeEnabled();
        expect(vigencia).toBeRequired();
        expect(anticipacion).toBeRequired();
        expect(vigencia).toHaveValue("40");
        expect(anticipacion).toHaveValue("9");
        rerender(<TarjetaVigencia {...props} />);
        expect(vigencia).toHaveValue("30");
        expect(anticipacion).toHaveValue("7");
        expect(screen.getByRole("switch", { name: "Vencimiento de fotos" })).toBeChecked();
        expect(props.onChange).not.toHaveBeenCalled();
    });

    it("permite los avisos independientes con la vigencia apagada y conserva su anticipación al cerrarlos", async () => {
        const { props, rerender } = preparar({ habilitado: false, diasAnticipacion: "09" }, true);
        const vigencia = screen.getByLabelText(/^Días de vigencia/);
        const anticipacion = screen.getByLabelText(/^Días de anticipación del aviso/);
        const avisos = screen.getByRole("switch", { name: "Habilitar avisos de próximo vencimiento" });
        const filaAvisos = avisos.closest("label");
        expect(vigencia).not.toBeVisible();
        expect(vigencia).toBeDisabled();
        expect(vigencia).not.toBeRequired();
        expect(filaAvisos).toBeVisible();
        expect(avisos).toBeEnabled();
        expect(anticipacion).toBeVisible();
        expect(anticipacion).toBeRequired();
        fireEvent.click(avisos);
        expect(props.onChange).toHaveBeenCalledExactlyOnceWith({ avisosHabilitados: false });
        rerender(<TarjetaVigencia {...props} configuracion={{ ...props.configuracion, avisosHabilitados: false }} />);
        expect(anticipacion.closest(".MuiCollapse-root")).toHaveStyle({ transitionDuration: "300ms" });
        await waitFor(() => expect(anticipacion).not.toBeVisible());
        expect(anticipacion).toBeDisabled();
        expect(anticipacion).not.toBeRequired();
        expect(anticipacion).toHaveValue("09");
        expect(filaAvisos).toBeVisible();
        expect(avisos).toBeEnabled();
        rerender(<TarjetaVigencia {...props} />);
        await waitFor(() => expect(anticipacion).toBeVisible());
        expect(anticipacion).toBeEnabled();
        expect(anticipacion).toHaveValue("09");
        expect(props.onChange).toHaveBeenCalledTimes(1);
    });

    it("marca únicamente los campos pendientes indicados por el panel", () => {
        const { props, rerender } = preparar();
        rerender(<TarjetaVigencia {...props} modificados={{ habilitado: true, diasAnticipacion: true }} />);
        expect(screen.getByRole("switch", { name: "Vencimiento de fotos" }).closest("[data-modificado]")).toHaveAttribute("data-modificado", "true");
        expect(screen.getByRole("switch", { name: "Habilitar avisos de próximo vencimiento" }).closest("[data-modificado]")).toHaveAttribute("data-modificado", "false");
        expect(screen.getByLabelText(/^Días de vigencia/).closest("[data-modificado]")).toHaveAttribute("data-modificado", "false");
        expect(screen.getByLabelText(/^Días de anticipación del aviso/).closest("[data-modificado]")).toHaveAttribute("data-modificado", "true");
        rerender(<TarjetaVigencia {...props} />);
        expect(screen.getByRole("switch", { name: "Vencimiento de fotos" }).closest("[data-modificado]")).toHaveAttribute("data-modificado", "false");
    });

    it("mantiene la marca de error en campos pendientes hasta que el panel la retire", () => {
        const { props, rerender } = preparar();
        const marcas = { habilitado: true, diasVigencia: true, avisosHabilitados: true, diasAnticipacion: true };
        rerender(<TarjetaVigencia {...props} modificados={marcas} errores={marcas} />);
        for (const entrada of [...screen.getAllByRole("switch"), ...screen.getAllByRole("textbox")]) {
            expect(entrada).toHaveAttribute("aria-invalid", "true");
            expect(entrada.closest("[data-modificado]")).toHaveAttribute("data-modificado", "true");
        }
        expect(screen.getByRole("switch", { name: "Vencimiento de fotos" }).closest("[data-error]")).toHaveAttribute("data-error", "true");
        expect(screen.getByLabelText(/^Días de vigencia/).closest(".MuiOutlinedInput-root")).toHaveClass("Mui-error");
        rerender(<TarjetaVigencia {...props} modificados={marcas} />);
        expect(screen.getByLabelText(/^Días de vigencia/)).not.toHaveAttribute("aria-invalid", "true");
    });

    it("bloquea todos los controles durante el guardado global", () => {
        const { props, rerender } = preparar();
        rerender(<TarjetaVigencia {...props} guardando />);
        for (const entrada of [...screen.getAllByRole("switch"), ...screen.getAllByRole("textbox")]) expect(entrada).toBeDisabled();
        rerender(<TarjetaVigencia {...props} />);
        for (const entrada of [...screen.getAllByRole("switch"), ...screen.getAllByRole("textbox")]) expect(entrada).toBeEnabled();
    });

    it("revela los plazos con errores aunque sus switches estén apagados y permite corregirlos hasta cancelar", async () => {
        const { props, rerender } = preparar({ habilitado: false, avisosHabilitados: false });
        const vigencia = screen.getByLabelText(/^Días de vigencia/);
        const anticipacion = screen.getByLabelText(/^Días de anticipación del aviso/);
        const modificados = { diasVigencia: true, diasAnticipacion: true };
        expect(vigencia).not.toBeVisible();
        expect(anticipacion).not.toBeVisible();
        rerender(<TarjetaVigencia {...props} configuracion={{ ...props.configuracion, diasVigencia: "0", diasAnticipacion: "366" }} modificados={modificados} errores={modificados} />);
        await waitFor(() => {
            for (const entrada of [vigencia, anticipacion]) {
                expect(entrada).toBeVisible();
                expect(entrada.closest(".MuiCollapse-root")).toHaveClass("MuiCollapse-entered");
            }
        });
        expect(vigencia).toBeEnabled();
        expect(anticipacion).toBeEnabled();
        fireEvent.change(vigencia, { target: { value: "40" } });
        fireEvent.change(anticipacion, { target: { value: "9" } });
        expect(props.onChange.mock.calls).toEqual([[{ diasVigencia: "40" }], [{ diasAnticipacion: "9" }]]);
        rerender(<TarjetaVigencia {...props} configuracion={{ ...props.configuracion, diasVigencia: "40", diasAnticipacion: "9" }} modificados={modificados} />);
        for (const entrada of [vigencia, anticipacion]) {
            expect(entrada).toBeVisible();
            expect(entrada).toBeEnabled();
            expect(entrada.closest(".MuiCollapse-root")).toHaveClass("MuiCollapse-entered");
            expect(entrada).not.toHaveAttribute("aria-invalid", "true");
        }
        expect(screen.getByRole("switch", { name: "Vencimiento de fotos" })).not.toBeChecked();
        expect(screen.getByLabelText("Habilitar avisos de próximo vencimiento")).not.toBeChecked();
        rerender(<TarjetaVigencia {...props} />);
        await waitFor(() => {
            expect(vigencia).not.toBeVisible();
            expect(anticipacion).not.toBeVisible();
        });
        expect(vigencia).toBeDisabled();
        expect(anticipacion).toBeDisabled();
        expect(vigencia).toHaveValue("30");
        expect(anticipacion).toHaveValue("7");
        expect(props.onChange).toHaveBeenCalledTimes(2);
    });
});
