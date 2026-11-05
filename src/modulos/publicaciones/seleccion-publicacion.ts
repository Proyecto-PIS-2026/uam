import type { db } from "@/infraestructura/persistencia/prisma/db";

export type SeleccionPublicacion = {
    especieId: number;
    variedadId: number | null;
    envaseId: number | null;
    kilosId: number | null;
    categoriaId: number | null;
    calibreId: number | null;
    paisId: number | null;
};

export function idCatalogoValido(valor: unknown): valor is number {
    return typeof valor === "number" && Number.isSafeInteger(valor) && valor > 0 && valor <= 2147483647;
}

export function normalizarSeleccionPublicacion(datos: Record<string, unknown>):
    { esValido: true; seleccion: SeleccionPublicacion } | { esValido: false; errores: string[] } {
    const errores: string[] = [];
    if (!idCatalogoValido(datos.especieId)) errores.push("La especie es obligatoria y debe ser válida.");
    const seleccion: SeleccionPublicacion = {
        especieId: datos.especieId as number, variedadId: null, envaseId: null, kilosId: null,
        categoriaId: null, calibreId: null, paisId: null,
    };
    for (const campo of ["variedadId", "envaseId", "kilosId", "categoriaId", "calibreId", "paisId"] as const) {
        const valor = datos[campo];
        if (valor === undefined || valor === null || valor === "" || valor === 0) continue;
        if (!idCatalogoValido(valor)) errores.push(`El campo ${campo} no es válido.`);
        else seleccion[campo] = valor;
    }
    return errores.length > 0 ? { esValido: false, errores } : { esValido: true, seleccion };
}

export async function validarCatalogosSeleccion(cliente: Pick<typeof db, "orm">, datos: SeleccionPublicacion): Promise<boolean> {
    const [especie, variedad, envase, kilos, categoria, calibre, pais] = await Promise.all([
        cliente.orm.public.Especie.where({ id: datos.especieId }).first(),
        datos.variedadId === null ? null : cliente.orm.public.Variedad.where({ id: datos.variedadId }).first(),
        datos.envaseId === null ? null : cliente.orm.public.Envase.where({ id: datos.envaseId }).first(),
        datos.kilosId === null ? null : cliente.orm.public.KilosEmpaquetado.where({ id: datos.kilosId }).first(),
        datos.categoriaId === null ? null : cliente.orm.public.Categoria.where({ id: datos.categoriaId }).first(),
        datos.calibreId === null ? null : cliente.orm.public.Calibre.where({ id: datos.calibreId }).first(),
        datos.paisId === null ? null : cliente.orm.public.Pais.where({ id: datos.paisId }).first(),
    ]);
    return Boolean(especie?.especieActiva
        && (datos.variedadId === null || (variedad?.variedadActiva && variedad.especieId === datos.especieId))
        && (datos.envaseId === null || envase)
        && (datos.kilosId === null || kilos)
        && (datos.categoriaId === null || (categoria && (categoria.especieId === null || categoria.especieId === datos.especieId)))
        && (datos.calibreId === null || calibre)
        && (datos.paisId === null || pais));
}
