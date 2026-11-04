export type ParametrosMiMercado = {
    publicacion?: string | string[];
};

export function leerPublicacionInicialId(valor: ParametrosMiMercado["publicacion"]): number | null {
    if (typeof valor !== "string" || !/^[1-9]\d*$/.test(valor)) return null;
    const id = Number(valor);
    return Number.isInteger(id) && id <= 2_147_483_647 ? id : null;
}
