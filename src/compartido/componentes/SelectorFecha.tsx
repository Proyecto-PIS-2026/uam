"use client";

import { useCallback, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/es";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { esES } from "@mui/x-date-pickers/locales";
import styles from "./SelectorFecha.module.css";

type Props = {
    value: string;
    onChange: (valor: string) => void;
    min?: string;
    max?: string;
    id?: string;
    name?: string;
    label?: string;
    labelAccesible?: string;
    className?: string;
    disabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    error?: boolean;
    fullWidth?: boolean;
};

function leerFecha(valor: string): Dayjs | null {
    if (!valor) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(valor);
    const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
    if (!iso && !local) return dayjs(NaN);
    const [anio, mes, dia] = iso ? iso.slice(1).map(Number) : [Number(local![3]), Number(local![2]), Number(local![1])];
    const fecha = dayjs("2000-01-01").year(anio).month(mes - 1).date(dia);
    return anio > 0 && fecha.year() === anio && fecha.month() === mes - 1 && fecha.date() === dia ? fecha : dayjs(NaN);
}

const fechaMinima = leerFecha("0001-01-01")!;
const fechaMaxima = leerFecha("9999-12-31")!;
const textos = { ...esES.components.MuiLocalizationProvider.defaultProps.localeText, okButtonLabel: "Aceptar" };

export default function SelectorFecha({
    value, onChange, min, max, id, name, label, labelAccesible, className,
    disabled = false, readOnly = false, required = false, error = false, fullWidth = true,
}: Props) {
    const [borrador, setBorrador] = useState<{ valor: string; fecha: Dayjs | null; soloLectura: boolean } | null>(null);
    if (borrador && borrador.soloLectura !== readOnly) setBorrador(null);
    const fecha = borrador?.valor === value && borrador.soloLectura === readOnly ? borrador.fecha : leerFecha(value);
    const minima = leerFecha(min ?? "") ?? fechaMinima;
    const maxima = leerFecha(max ?? "") ?? fechaMaxima;
    // Acota los años renderizados; una fecha escrita fuera de la ventana la desplaza.
    const candidata = fecha?.isValid() ? fecha : dayjs();
    const referencia = candidata.isBefore(minima) ? minima : candidata.isAfter(maxima) ? maxima : candidata;
    const inicioVentana = referencia.year(Math.max(1, referencia.year() - 100)).startOf("year");
    const finVentana = referencia.year(Math.min(9999, referencia.year() + 100)).endOf("year");
    const minimaCalendario = minima.isAfter(inicioVentana) ? minima : inicioVentana;
    const maximaCalendario = maxima.isBefore(finVentana) ? maxima : finVentana;
    const mensaje = fecha && (!fecha.isValid() || fecha.year() < 1 || fecha.year() > 9999)
        ? "Ingresá una fecha válida."
        : fecha?.isBefore(minima, "day") ? `La fecha debe ser igual o posterior a ${minima.format("DD/MM/YYYY")}.`
            : fecha?.isAfter(maxima, "day") ? `La fecha debe ser igual o anterior a ${maxima.format("DD/MM/YYYY")}.` : "";

    const validarInput = useCallback((input: HTMLInputElement | null) => {
        input?.setCustomValidity(mensaje);
    }, [mensaje]);

    function cambiar(fechaNueva: Dayjs | null) {
        const valor = fechaNueva?.isValid() ? fechaNueva.format("YYYY-MM-DD") : "";
        setBorrador({ valor, fecha: fechaNueva, soloLectura: readOnly });
        onChange(valor);
    }

    return <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es" localeText={textos}>
        <DatePicker
            value={fecha}
            onChange={cambiar}
            minDate={minimaCalendario}
            maxDate={maximaCalendario}
            referenceDate={referencia}
            label={label}
            name={name}
            format="DD/MM/YYYY"
            disabled={disabled}
            readOnly={readOnly}
            inputRef={validarInput}
            desktopModeMediaQuery="(min-width: 768px)"
            slotProps={{
                textField: {
                    id, required, fullWidth, size: "small", color: "secondary",
                    error: error || Boolean(mensaje),
                    className: `${styles.campo} ${className ?? ""}`,
                    slotProps: {
                        inputLabel: { shrink: true },
                        input: { "aria-label": labelAccesible },
                        htmlInput: {
                            ...{ "data-selector-fecha": true },
                            value: value ? leerFecha(value)?.format("YYYY-MM-DD") ?? "" : "",
                            min, max,
                            onChange: (evento) => cambiar(leerFecha(evento.target.value)),
                        },
                    },
                },
                openPickerButton: { color: "secondary", "aria-label": `Abrir calendario${label || labelAccesible ? ` de ${label ?? labelAccesible}` : ""}` },
                actionBar: { actions: required ? ["cancel", "accept"] : ["clear", "cancel", "accept"] },
                layout: { className: styles.calendario },
            }}
        />
    </LocalizationProvider>;
}
