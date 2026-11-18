export type OpcionEdicion = {
    id: number;
    nombre: string;
};

export type OpcionVariedad = OpcionEdicion & {
    especieId: number;
};

export type OpcionCategoria = OpcionEdicion & {
    especieId: number | null;
};

export type OpcionesEdicionPublicacion = {
    especies: OpcionEdicion[];
    variedades: OpcionVariedad[];
    envases: OpcionEdicion[];
    kilos: OpcionEdicion[];
    categorias: OpcionCategoria[];
    calibres: OpcionEdicion[];
    paises: OpcionEdicion[];
};
