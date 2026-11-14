export type CampoFormulario = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export function esCampoFormulario(elemento: unknown): elemento is CampoFormulario {
    return elemento instanceof HTMLInputElement || elemento instanceof HTMLSelectElement || elemento instanceof HTMLTextAreaElement;
}

export function faltaCompletarCampo(campo: CampoFormulario): boolean {
    if (!campo.required || !campo.willValidate) return false;
    if (campo.validity.valueMissing) return true;
    if (campo instanceof HTMLInputElement && ["checkbox", "radio", "file"].includes(campo.type)) return false;
    return campo.value.trim() === "";
}

export function esCampoInvalido(campo: CampoFormulario): boolean {
    return campo.willValidate && (faltaCompletarCampo(campo) || !campo.validity.valid);
}

export function controlVisible(campo: CampoFormulario): HTMLElement {
    // El select de MUI valida un input invisible; el usuario interactúa con el combobox.
    return campo.closest(".MuiInputBase-root")?.querySelector<HTMLElement>('[role="combobox"]') ?? campo;
}

export function crearMarcadorCamposInvalidos() {
    const marcas = new Map<CampoFormulario, { elemento: HTMLElement; ariaInvalid: string | null }[]>();
    const raices = new Set<Element>();

    function quitarMarca(campo: CampoFormulario) {
        for (const { elemento, ariaInvalid } of marcas.get(campo) ?? []) {
            elemento.removeAttribute("data-error-validacion");
            if (elemento.getAttribute("aria-invalid") === "true") {
                if (ariaInvalid === null) elemento.removeAttribute("aria-invalid");
                else elemento.setAttribute("aria-invalid", ariaInvalid);
            }
        }
        marcas.delete(campo);
    }

    function limpiarCorregidos() {
        for (const campo of marcas.keys()) {
            if (!campo.isConnected || !esCampoInvalido(campo)) quitarMarca(campo);
        }
        if (marcas.size === 0) {
            observador.disconnect();
            raices.clear();
        }
    }

    // También detecta selects controlados de MUI y campos condicionales retirados.
    const observador = new MutationObserver(limpiarCorregidos);

    function marcar(campo: CampoFormulario) {
        if (marcas.has(campo)) return;
        const elementos = [...new Set([campo, controlVisible(campo)])];
        marcas.set(campo, elementos.map((elemento) => ({ elemento, ariaInvalid: elemento.getAttribute("aria-invalid") })));
        for (const elemento of elementos) {
            elemento.setAttribute("data-error-validacion", "true");
            elemento.setAttribute("aria-invalid", "true");
        }
        const raiz = campo.form ?? campo.parentElement ?? campo;
        if (!raices.has(document.body)) {
            raices.add(document.body);
            observador.observe(document.body, { childList: true, subtree: true });
        }
        if (!raices.has(raiz)) {
            raices.add(raiz);
            observador.observe(raiz, { childList: true, subtree: true, attributes: true, attributeFilter: ["value", "required", "disabled", "readonly"] });
        }
    }

    function destruir() {
        observador.disconnect();
        for (const campo of marcas.keys()) quitarMarca(campo);
        raices.clear();
    }

    return { marcar, limpiarCorregidos, destruir };
}
