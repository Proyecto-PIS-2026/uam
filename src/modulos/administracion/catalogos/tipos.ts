export const TIPOS_CATALOGO = ["empaquetados", "kilos", "calibres", "categorias"] as const;

export type TipoCatalogo = typeof TIPOS_CATALOGO[number];

export type ElementoCatalogo = {
    id: number;
    nombre: string;
    codigo?: string;
};

export type DatosCatalogo = {
    nombre: string;
    codigo?: string;
};

export type ResultadoCatalogo = { ok: true } | { ok: false; mensaje: string };
