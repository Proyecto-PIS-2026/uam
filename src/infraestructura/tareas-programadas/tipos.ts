import type { db } from "../persistencia/prisma/db";

export const ZONA_HORARIA_TAREAS = "America/Montevideo";

export type TransaccionTarea = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ContextoTareaDiaria = {
    tx: TransaccionTarea;
    fecha: string;
    limite: string;
};

export type TareaDiaria = {
    nombre: string;
    habilitada?: () => boolean | Promise<boolean>;
    ejecutar: (contexto: ContextoTareaDiaria) => Promise<number>;
};

export type ResultadoTareaDiaria =
    | { nombre: string; estado: "completada"; fecha: string; elementosProcesados: number }
    | { nombre: string; estado: "ya-completada"; fecha: string }
    | { nombre: string; estado: "ocupada" | "error" | "deshabilitada" };
