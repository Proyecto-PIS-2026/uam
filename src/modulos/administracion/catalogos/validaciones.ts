import { TIPOS_CATALOGO, type DatosCatalogo, type ElementoCatalogo, type TipoCatalogo } from "./tipos";

export class ErrorCatalogo extends Error {}

export function esTipoCatalogo(tipo: unknown): tipo is TipoCatalogo {
    return typeof tipo === "string" && TIPOS_CATALOGO.some((valor) => valor === tipo);
}

export function esIdCatalogo(id: unknown): id is number {
    return typeof id === "number" && Number.isSafeInteger(id) && id > 0 && id <= 2147483647;
}

function normalizarTexto(valor: string): string {
    return valor.trim().replace(/\s+/g, " ");
}

function claveTexto(valor: string): string {
    return normalizarTexto(valor).toLocaleLowerCase("es-UY");
}

function normalizarKilos(valor: string): string | null {
    if (!/^\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?$/.test(valor)) return null;
    const extremos = valor.split(/\s*-\s*/).map((extremo) => {
        const [entero, decimal = ""] = extremo.replace(",", ".").split(".");
        const fraccion = decimal.replace(/0+$/, "");
        return `${entero.replace(/^0+(?=\d)/, "")}${fraccion ? `.${fraccion}` : ""}`;
    });
    if (extremos.some((extremo) => !Number.isFinite(Number(extremo)) || Number(extremo) <= 0)) return null;
    if (extremos.length === 2 && Number(extremos[0]) >= Number(extremos[1])) return null;
    return extremos.join("-");
}

export function validarDatosCatalogo(tipo: TipoCatalogo, datos: unknown): DatosCatalogo {
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) throw new ErrorCatalogo("Los datos del valor no son válidos.");
    const { nombre, codigo } = datos as Partial<DatosCatalogo>;
    if (typeof nombre !== "string") throw new ErrorCatalogo("El valor es obligatorio.");
    let valor = normalizarTexto(nombre);
    if (!valor) throw new ErrorCatalogo("El valor es obligatorio.");
    if (valor.length > 120) throw new ErrorCatalogo("El valor no puede superar los 120 caracteres.");
    if (tipo === "kilos") {
        const normalizado = normalizarKilos(valor);
        if (!normalizado) throw new ErrorCatalogo("Ingresá un peso positivo o un rango creciente, por ejemplo 10 o 10-12.");
        valor = normalizado;
    }
    if (tipo !== "calibres") return { nombre: valor };
    if (typeof codigo !== "string" || !normalizarTexto(codigo)) throw new ErrorCatalogo("El código del calibre es obligatorio.");
    const codigoNormalizado = normalizarTexto(codigo);
    if (codigoNormalizado.length > 60) throw new ErrorCatalogo("El código no puede superar los 60 caracteres.");
    return { nombre: valor, codigo: codigoNormalizado };
}

export function valorDuplicado(tipo: TipoCatalogo, elementos: ElementoCatalogo[], datos: DatosCatalogo, id?: number): boolean {
    const claveNombre = (nombre: string) => tipo === "kilos"
        ? normalizarKilos(normalizarTexto(nombre)) ?? claveTexto(nombre)
        : claveTexto(nombre);
    return elementos.some((elemento) => elemento.id !== id && (
        claveNombre(elemento.nombre) === claveNombre(datos.nombre)
        || (tipo === "calibres" && claveTexto(elemento.codigo ?? "") === claveTexto(datos.codigo ?? ""))
    ));
}

export function mensajeConflictoCatalogo(error: unknown, eliminando: boolean): string | null {
    const revisados = new Set<object>();
    while (error && typeof error === "object" && !revisados.has(error)) {
        revisados.add(error);
        const dato = error as { code?: string; sqlState?: string; cause?: unknown };
        const codigo = dato.sqlState ?? dato.code;
        if (codigo === "23505") return "Ya existe un valor con ese nombre o código en el catálogo.";
        if (codigo === "23503") return eliminando
            ? "No se puede eliminar este valor porque tiene publicaciones asociadas."
            : "Los datos asociados cambiaron. Actualizá el listado e intentá nuevamente.";
        error = dato.cause;
    }
    return null;
}
