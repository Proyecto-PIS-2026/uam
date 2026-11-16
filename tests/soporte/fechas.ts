import { expect, type Locator } from "@playwright/test";

function secciones(campo: Locator, fecha: string) {
    const [anio = "", mes = "", dia = ""] = fecha.split("-");
    return [
        { campo: campo.getByRole("spinbutton", { name: /^D[ií]a$/ }), valor: dia },
        { campo: campo.getByRole("spinbutton", { name: "Mes", exact: true }), valor: mes },
        { campo: campo.getByRole("spinbutton", { name: "Año", exact: true }), valor: anio },
    ];
}

export async function completarFecha(campo: Locator, fecha: string) {
    for (const seccion of secciones(campo, fecha)) {
        await seccion.campo.fill(seccion.valor);
    }
    await campo.getByRole("spinbutton", { name: "Año", exact: true }).press("Tab");
    await esperarFecha(campo, fecha);
}

export async function esperarFecha(campo: Locator, fecha: string) {
    for (const seccion of secciones(campo, fecha)) {
        if (seccion.valor) await expect(seccion.campo).toHaveAttribute("aria-valuenow", String(Number(seccion.valor)));
        else await expect(seccion.campo).not.toHaveAttribute("aria-valuenow");
    }
}

export async function leerFecha(campo: Locator) {
    const [dia, mes, anio] = await Promise.all(secciones(campo, "").map((seccion) => seccion.campo.getAttribute("aria-valuenow")));
    return dia && mes && anio ? `${anio.padStart(4, "0")}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}` : "";
}
