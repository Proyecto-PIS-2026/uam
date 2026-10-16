export type OperadorParaModificar = {
    id: number;
    nombre: string;
    codigoPais: string;
    telefono: string;
    locales: {
        nombre: string;
        naveId: number;
        contrato: string;
    }[];
};
