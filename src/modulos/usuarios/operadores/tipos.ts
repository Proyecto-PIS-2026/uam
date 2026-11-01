export type OperadorParaModificar = {
    id: number;
    nombre: string;
    fotoPerfil?: string | null;
    codigoPais: string;
    telefono: string;
    locales: {
        nombre: string;
        naveId: number;
        contrato: string;
    }[];
};
