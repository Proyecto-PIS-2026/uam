import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TarjetaVigencia, { type ConfiguracionVigenciaFotos } from "./TarjetaVigencia";

const mocks = vi.hoisted(() => ({
    notificar: vi.fn(),
}));

vi.mock("@/compartido/componentes/NotificacionToast", () => ({
    useNotificacionToast: () => ({ notificar: mocks.notificar }),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(cleanup);

function crearConfiguracion(cambios: Partial<ConfiguracionVigenciaFotos> = {}): ConfiguracionVigenciaFotos {
    return {
        habilitado: true,
        diasVigencia: "30",
        avisosHabilitados: true,
        diasAnticipacion: "7",
        ...cambios,
    };
}

function preparar(configuracion = crearConfiguracion(), onGuardar = vi.fn().mockResolvedValue(undefined)) {
    const props = {
        titulo: "Vigencia de las fotos",
        descripcion: "Configurá la vigencia de las fotos.",
        etiquetaVencimiento: "Vencimiento de fotos",
        ayudaVencimiento: "Aplicar un período de vigencia.",
        ayudaAvisos: "Notificar a operadores y productores.",
        configuracion,
        onGuardar,
    };

    return { ...render(<TarjetaVigencia {...props} />), props, onGuardar };
}

function botonGuardar() {
    return screen.getByRole("button", { name: "Guardar configuración: Vigencia de las fotos" });
}

describe("TarjetaVigencia", () => {
    it("muestra los textos y la configuración recibida", () => {
        preparar();
        expect(screen.getByText("Vigencia de las fotos")).toBeInTheDocument();
        expect(screen.getByText("Configurá la vigencia de las fotos.")).toBeInTheDocument();
        expect(screen.getByText("Aplicar un período de vigencia.")).toBeInTheDocument();
        expect(screen.getByText("Notificar a operadores y productores.")).toBeInTheDocument();
        expect(screen.getByRole("switch", { name: "Vencimiento de fotos" })).toBeChecked();
        expect(screen.getByRole("switch", { name: "Habilitar avisos de próximo vencimiento" })).toBeChecked();
        expect(screen.getByLabelText("Días de vigencia")).toHaveValue("30");
        expect(screen.getByLabelText("Días de anticipación del aviso")).toHaveValue("7");
        expect(botonGuardar()).toBeDisabled();
    });

    it("permite omitir los textos opcionales", () => {
        render(<TarjetaVigencia configuracion={crearConfiguracion()} onGuardar={vi.fn()} />);
        expect(screen.queryByText("Vigencia de las fotos")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Guardar configuración:" })).toBeDisabled();
    });

    it("habilita guardar al editar y lo deshabilita al restaurar el valor", () => {
        preparar();
        fireEvent.change(screen.getByLabelText("Días de vigencia"), { target: { value: "40" } });
        expect(botonGuardar()).toBeEnabled();
        fireEvent.change(screen.getByLabelText("Días de vigencia"), { target: { value: "30" } });
        expect(botonGuardar()).toBeDisabled();
    });

    it("no guarda automáticamente al modificar los campos", () => {
        const { onGuardar } = preparar();
        fireEvent.change(screen.getByLabelText("Días de vigencia"), { target: { value: "40" } });
        expect(onGuardar).not.toHaveBeenCalled();
    });

    it.each(["abc", "-1", "1.5", " 2", "1e2"])("ignora la entrada no permitida %j", (valor) => {
        preparar();
        fireEvent.change(screen.getByLabelText("Días de vigencia"), { target: { value: valor } });
        expect(screen.getByLabelText("Días de vigencia")).toHaveValue("30");
        expect(botonGuardar()).toBeDisabled();
    });

    it("permite habilitar vigencia y desplegar sus opciones", async () => {
        preparar(crearConfiguracion({ habilitado: false, diasVigencia: "", avisosHabilitados: false, diasAnticipacion: "" }));
        expect(screen.getByLabelText("Días de vigencia")).toBeDisabled();
        expect(screen.getByLabelText("Días de vigencia")).not.toBeVisible();
        fireEvent.click(screen.getByRole("switch", { name: "Vencimiento de fotos" }));
        await waitFor(() => expect(screen.getByLabelText("Días de vigencia")).toBeVisible());
        expect(screen.getByLabelText("Días de vigencia")).toBeEnabled();
        expect(botonGuardar()).toBeEnabled();
    });

    it("despliega la anticipación al habilitar los avisos", async () => {
        preparar(crearConfiguracion({ avisosHabilitados: false, diasAnticipacion: "" }));
        expect(screen.getByLabelText("Días de anticipación del aviso")).toBeDisabled();
        expect(screen.getByLabelText("Días de anticipación del aviso")).not.toBeVisible();
        fireEvent.click(screen.getByRole("switch", { name: "Habilitar avisos de próximo vencimiento" }));
        await waitFor(() => expect(screen.getByLabelText("Días de anticipación del aviso")).toBeVisible());
        expect(screen.getByLabelText("Días de anticipación del aviso")).toBeEnabled();
    });

    it("limpia la anticipación al apagar los avisos", async () => {
        const { onGuardar } = preparar();
        fireEvent.click(screen.getByRole("switch", { name: "Habilitar avisos de próximo vencimiento" }));
        expect(screen.getByLabelText("Días de anticipación del aviso")).toHaveValue("");
        expect(screen.getByLabelText("Días de vigencia")).toHaveValue("30");
        expect(onGuardar).not.toHaveBeenCalled();
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ habilitado: true, diasVigencia: "30", avisosHabilitados: false, diasAnticipacion: "" }));
    });

    it("limpia ambos campos y apaga los avisos al desactivar vigencia", async () => {
        const { onGuardar } = preparar();
        fireEvent.click(screen.getByRole("switch", { name: "Vencimiento de fotos" }));
        expect(screen.getByLabelText("Días de vigencia")).toHaveValue("");
        expect(screen.getByLabelText("Días de anticipación del aviso")).toHaveValue("");
        expect(screen.getByLabelText("Habilitar avisos de próximo vencimiento")).not.toBeChecked();
        expect(onGuardar).not.toHaveBeenCalled();
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ habilitado: false, diasVigencia: "", avisosHabilitados: false, diasAnticipacion: "" }));
    });

    it.each([
        { valor: "", mensaje: "La vigencia debe ser un número entero mayor que cero." },
        { valor: "0", mensaje: "La vigencia debe ser un número entero mayor que cero." },
        { valor: "9007199254740992", mensaje: "La vigencia ingresada es demasiado grande." },
    ])("rechaza la vigencia $valor con su mensaje correspondiente", async ({ valor, mensaje }) => {
        const { onGuardar } = preparar();
        fireEvent.change(screen.getByLabelText("Días de vigencia"), { target: { value: valor } });
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledExactlyOnceWith(mensaje, "error"));
        expect(screen.getByLabelText("Días de vigencia")).not.toHaveAttribute("aria-invalid", "true");
        expect(onGuardar).not.toHaveBeenCalled();
    });

    it.each([
        { valor: "", mensaje: "La anticipación debe ser un número entero mayor que cero." },
        { valor: "0", mensaje: "La anticipación debe ser un número entero mayor que cero." },
        { valor: "9007199254740992", mensaje: "La anticipación ingresada es demasiado grande." },
    ])("rechaza la anticipación $valor con su mensaje correspondiente", async ({ valor, mensaje }) => {
        const { onGuardar } = preparar();
        fireEvent.change(screen.getByLabelText("Días de anticipación del aviso"), { target: { value: valor } });
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledExactlyOnceWith(mensaje, "error"));
        expect(screen.getByLabelText("Días de anticipación del aviso")).not.toHaveAttribute("aria-invalid", "true");
        expect(onGuardar).not.toHaveBeenCalled();
    });

    it.each(["30", "31"])("rechaza anticipación %s con vigencia de 30 días", async (valor) => {
        const { onGuardar } = preparar();
        fireEvent.change(screen.getByLabelText("Días de anticipación del aviso"), { target: { value: valor } });
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("La anticipación debe ser menor que la vigencia.", "error"));
        expect(onGuardar).not.toHaveBeenCalled();
    });

    it("permite un día de vigencia con avisos apagados", async () => {
        const { onGuardar } = preparar(crearConfiguracion({ avisosHabilitados: false, diasAnticipacion: "" }));
        fireEvent.change(screen.getByLabelText("Días de vigencia"), { target: { value: "1" } });
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(onGuardar).toHaveBeenCalledWith({ habilitado: true, diasVigencia: "1", avisosHabilitados: false, diasAnticipacion: "" }));
    });

    it("normaliza los días y muestra confirmación al guardar", async () => {
        const { onGuardar } = preparar();
        fireEvent.change(screen.getByLabelText("Días de vigencia"), { target: { value: "040" } });
        fireEvent.change(screen.getByLabelText("Días de anticipación del aviso"), { target: { value: "005" } });
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(onGuardar).toHaveBeenCalledExactlyOnceWith({ habilitado: true, diasVigencia: "40", avisosHabilitados: true, diasAnticipacion: "5" }));
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("La configuración de vigencia se guardó correctamente.", "success"));
        expect(screen.getByLabelText("Días de vigencia")).toHaveValue("40");
        expect(screen.getByLabelText("Días de anticipación del aviso")).toHaveValue("5");
        expect(botonGuardar()).toBeDisabled();
    });

    it("bloquea los controles mientras guarda y evita envíos repetidos", async () => {
        let finalizar!: () => void;
        const onGuardar = vi.fn(() => new Promise<void>((resolve) => { finalizar = resolve }));
        preparar(crearConfiguracion(), onGuardar);
        fireEvent.change(screen.getByLabelText("Días de vigencia"), { target: { value: "40" } });
        fireEvent.click(botonGuardar());
        expect(botonGuardar()).toBeDisabled();
        expect(screen.getByLabelText("Días de vigencia")).toBeDisabled();
        expect(screen.getByLabelText("Días de anticipación del aviso")).toBeDisabled();
        expect(screen.getByRole("switch", { name: "Vencimiento de fotos" })).toBeDisabled();
        expect(screen.getByRole("switch", { name: "Habilitar avisos de próximo vencimiento" })).toBeDisabled();
        fireEvent.click(botonGuardar());
        expect(onGuardar).toHaveBeenCalledOnce();
        await act(async () => { finalizar(); });
        expect(screen.getByLabelText("Días de vigencia")).toBeEnabled();
        expect(botonGuardar()).toBeDisabled();
    });

    it("conserva los cambios y permite reintentar si falla el guardado", async () => {
        const onGuardar = vi.fn().mockRejectedValueOnce(new Error("Error de conexión")).mockResolvedValueOnce(undefined);
        preparar(crearConfiguracion(), onGuardar);
        fireEvent.change(screen.getByLabelText("Días de vigencia"), { target: { value: "40" } });
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("Error de conexión", "error"));
        expect(screen.getByLabelText("Días de vigencia")).toHaveValue("40");
        await waitFor(() => expect(botonGuardar()).toBeEnabled());
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("La configuración de vigencia se guardó correctamente.", "success"));
        expect(onGuardar).toHaveBeenCalledTimes(2);
    });

    it("muestra un mensaje genérico si el rechazo no es un Error", async () => {
        preparar(crearConfiguracion(), vi.fn().mockRejectedValue("fallo"));
        fireEvent.change(screen.getByLabelText("Días de vigencia"), { target: { value: "40" } });
        fireEvent.click(botonGuardar());
        await waitFor(() => expect(mocks.notificar).toHaveBeenCalledWith("No se pudo guardar la configuración.", "error"));
        await waitFor(() => expect(botonGuardar()).toBeEnabled());
    });

    it("sincroniza los valores cuando cambia la configuración del servidor", () => {
        const { rerender, props } = preparar();
        fireEvent.change(screen.getByLabelText("Días de vigencia"), { target: { value: "40" } });
        rerender(<TarjetaVigencia {...props} configuracion={crearConfiguracion({ diasVigencia: "60", diasAnticipacion: "10" })} />);
        expect(screen.getByLabelText("Días de vigencia")).toHaveValue("60");
        expect(screen.getByLabelText("Días de anticipación del aviso")).toHaveValue("10");
        expect(botonGuardar()).toBeDisabled();
    });

    it("no descarta la edición si recibe otro objeto con los mismos valores", () => {
        const { rerender, props } = preparar();
        fireEvent.change(screen.getByLabelText("Días de vigencia"), { target: { value: "40" } });
        rerender(<TarjetaVigencia {...props} configuracion={crearConfiguracion()} />);
        expect(screen.getByLabelText("Días de vigencia")).toHaveValue("40");
        expect(botonGuardar()).toBeEnabled();
    });

    it("permite reutilizar la tarjeta para publicaciones de productores", () => {
        render(<TarjetaVigencia titulo="Vigencia de publicaciones de productores" descripcion="Configurá las publicaciones." etiquetaVencimiento="Vencimiento de publicaciones" ayudaVencimiento="Aplicar vigencia a publicaciones." ayudaAvisos="Notificar a productores." configuracion={crearConfiguracion()} onGuardar={vi.fn()} />);
        expect(screen.getByText("Vigencia de publicaciones de productores")).toBeInTheDocument();
        expect(screen.getByText("Configurá las publicaciones.")).toBeInTheDocument();
        expect(screen.getByText("Notificar a productores.")).toBeInTheDocument();
        expect(screen.getByRole("switch", { name: "Vencimiento de publicaciones" })).toBeChecked();
    });
});