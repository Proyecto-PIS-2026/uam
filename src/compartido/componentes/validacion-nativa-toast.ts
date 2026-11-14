import { useEffect } from "react";
import { controlVisible, crearMarcadorCamposInvalidos, esCampoFormulario, esCampoInvalido, faltaCompletarCampo, type CampoFormulario } from "./campos-invalidos";

export const MENSAJE_CAMPOS_OBLIGATORIOS = "Faltan completar campos obligatorios.";

function mensajeValidacion(campo: CampoFormulario): string {
    const nombre = campo.getAttribute("aria-label") || campo.labels?.[0]?.textContent?.replace(/\s*\*\s*$/, "").trim() || campo.name;
    const etiqueta = nombre ? `«${nombre}»` : "este campo";
    const validez = campo.validity;
    if (validez.customError) return campo.validationMessage;
    if (validez.typeMismatch && campo instanceof HTMLInputElement) {
        if (campo.type === "email") return `Ingresá un correo electrónico válido en ${etiqueta}.`;
        if (campo.type === "url") return `Ingresá una dirección web válida en ${etiqueta}.`;
    }
    if (validez.patternMismatch) return `Revisá el formato de ${etiqueta}.${campo.title ? ` ${campo.title}` : ""}`;
    if (campo instanceof HTMLInputElement) {
        if (validez.rangeUnderflow) return `El valor de ${etiqueta} debe ser mayor o igual a ${campo.min}.`;
        if (validez.rangeOverflow) return `El valor de ${etiqueta} debe ser menor o igual a ${campo.max}.`;
    }
    if (campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement) {
        if (validez.tooShort) return `${etiqueta} debe tener al menos ${campo.minLength} caracteres.`;
        if (validez.tooLong) return `${etiqueta} debe tener como máximo ${campo.maxLength} caracteres.`;
    }
    return `Ingresá un valor válido en ${etiqueta}.`;
}

export function useErroresValidacionNativa(notificar: (mensaje: string) => void) {
    useEffect(() => {
        let activo = true;
        const pendientes = new Set<CampoFormulario>();
        const marcas = crearMarcadorCamposInvalidos();
        let temporizador: ReturnType<typeof setTimeout> | null = null;
        const programarAviso = (campo: CampoFormulario) => {
            pendientes.add(campo);
            if (temporizador !== null) return;
            // El navegador emite un evento por campo: se agrupan en un solo aviso.
            temporizador = setTimeout(() => {
                temporizador = null;
                if (!activo) return;
                // Un valor con espacios puede pasar la validación HTML de required.
                for (const entrada of [...pendientes]) {
                    if (!entrada.form) continue;
                    for (const control of Array.from(entrada.form.elements)) {
                        if (esCampoFormulario(control) && faltaCompletarCampo(control)) pendientes.add(control);
                    }
                }
                const invalidos = [...pendientes].filter((entrada) => entrada.isConnected && esCampoInvalido(entrada));
                pendientes.clear();
                if (invalidos.length === 0) return;
                marcas.limpiarCorregidos();
                invalidos.forEach(marcas.marcar);
                const primerFaltante = invalidos.find(faltaCompletarCampo);
                notificar(primerFaltante ? MENSAJE_CAMPOS_OBLIGATORIOS : invalidos.map(mensajeValidacion).join("\n"));
                controlVisible(primerFaltante ?? invalidos[0]).focus();
            }, 0);
        };
        const mostrarError = (evento: Event) => {
            if (!esCampoFormulario(evento.target)) return;
            // Oculta el globo del navegador; la restricción sigue impidiendo el envío.
            evento.preventDefault();
            programarAviso(evento.target);
        };

        const validarObligatorios = (evento: Event) => {
            if (!(evento.target instanceof HTMLFormElement)) return;
            const boton = (evento as SubmitEvent).submitter;
            if ((boton instanceof HTMLButtonElement || boton instanceof HTMLInputElement) && boton.formNoValidate) return;
            marcas.limpiarCorregidos();
            const faltantes = Array.from(evento.target.elements).filter(esCampoFormulario).filter(faltaCompletarCampo);
            if (faltantes.length === 0) return;
            // Cubre formularios con noValidate y evita llegar al guardado con datos vacíos.
            evento.preventDefault();
            evento.stopPropagation();
            faltantes.forEach(programarAviso);
        };

        document.addEventListener("invalid", mostrarError, true);
        document.addEventListener("submit", validarObligatorios, true);
        document.addEventListener("input", marcas.limpiarCorregidos, true);
        document.addEventListener("change", marcas.limpiarCorregidos, true);
        return () => {
            activo = false;
            if (temporizador !== null) clearTimeout(temporizador);
            pendientes.clear();
            marcas.destruir();
            document.removeEventListener("invalid", mostrarError, true);
            document.removeEventListener("submit", validarObligatorios, true);
            document.removeEventListener("input", marcas.limpiarCorregidos, true);
            document.removeEventListener("change", marcas.limpiarCorregidos, true);
        };
    }, [notificar]);
}
