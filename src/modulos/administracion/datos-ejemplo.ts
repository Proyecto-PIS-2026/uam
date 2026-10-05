import type { DatosPanel } from "./configuracion";

// Datos exclusivos de la maqueta visual. No representan cuentas ni valores de la BD.
export const datosEjemplo: DatosPanel = {
    configuracion: {
        ordenamiento: "true",
        incremento: "10",
        lista: null,
        fotografias: "30",
    },
    operadores: [
        {
            id: 1,
            nombreFantasia: "Operador de ejemplo A",
            disponible: true,
            locales: [{ id: 1, nombre: "Nave A · Local 1", finContrato: null }],
        },
        {
            id: 2,
            nombreFantasia: "Operador de ejemplo B",
            disponible: false,
            locales: [
                {
                    id: 2,
                    nombre: "Nave B · Local 2",
                    finContrato: "2026-12-31",
                },
            ],
        },
    ],
    cuentas: [
        {
            id: 1,
            username: "operador.ejemplo",
            rol: "OPERADOR",
            twoFactorEnabled: true,
        },
        {
            id: 2,
            username: "productor.ejemplo",
            rol: "PRODUCTOR",
            twoFactorEnabled: false,
        },
    ],
};
