export type OperadorParaModificar = {
    id: number;
    nombre: string;
    fotoPerfil?: string | null;
    codigoPais: string;
    telefono: string;
    enLicencia?: boolean;
    comentario?: string | null;
    locales: {
        nombre: string;
        naveId: number;
        contrato: string;
    }[];
};
