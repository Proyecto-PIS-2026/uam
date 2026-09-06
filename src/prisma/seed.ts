import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

const db = postgres<Contract>({
    contractJson,
    url: process.env.DATABASE_URL!,
});

type CsvRow = {
    // Grupo
    grupo_id: string;
    grupo: string;
    // Especie
    especie_id: string;
    especie: string;
    especie_activa: string;
    // Variedad
    variedad_id: string;
    variedad: string;
    variedad_activa: string;
    // Presentación
    presentacion_id: string;
    presentacion: string;
    kg_por_unidad: string;
    presentacion_activa: string;
    presentacion_default: string;
};

function parseBoolean(value: string): boolean | null {
    if (value === "1") {
        return true;
    }
    if (value === "0") {
        return false;
    }
    return null;
}

function parseDecimal(value: string): string | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return value;
}
const csvPath = path.join(
    process.cwd(),
    "src",
    "prisma",
    "data",
    "catalogo-uam.csv"
);

const csv = fs.readFileSync(csvPath, "utf8");

const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
}) as CsvRow[];

async function main() {
    //Grupos
    const grupos = new Map<number, CsvRow>();
    for (const row of records) {
        grupos.set(Number(row.grupo_id), row);
    }
    const grupoIds = new Map<number, number>();
    for (const [uamId, row] of grupos) {
        const grupo = await db.orm.public.Grupo.upsert({
            create: {
                uamId,
                nombre: row.grupo,
            },
            update: {
                nombre: row.grupo,
            },
            conflictOn: {
                uamId,
            },
        });
        grupoIds.set(uamId, grupo.id);
    }
    // Especies
    const especies = new Map<number, CsvRow>();
    for (const row of records) {
        especies.set(Number(row.especie_id), row);
    }
    const especieIds = new Map<number, number>();
    for (const [uamId, row] of especies) {
        const grupoId = grupoIds.get(Number(row.grupo_id));
        if (grupoId === undefined) {
            throw new Error(`No se encontró el grupo ${row.grupo_id} para la especie ${uamId}`);
        }
        const especie = await db.orm.public.Especie.upsert({
            create: {
                uamId,
                nombre: row.especie,
                activa: parseBoolean(row.especie_activa),
                grupoId,
            },
            update: {
                nombre: row.especie,
                activa: parseBoolean(row.especie_activa),
                grupoId,
            },
            conflictOn: {
                uamId,
            },
        });
        especieIds.set(uamId, especie.id);
    }
    // Variedades
    const variedades = new Map<number, CsvRow>();
    for (const row of records) {
        if (!row.variedad_id) {
            continue;
        }
        variedades.set(Number(row.variedad_id), row);
    }
    const variedadIds = new Map<number, number>();
    for (const [uamId, row] of variedades) {
        const especieId = especieIds.get(Number(row.especie_id));
        if (especieId === undefined) {
            throw new Error(`No se encontró la especie ${row.especie_id} para la variedad ${uamId}`);
        }
        const variedad = await db.orm.public.Variedad.upsert({
            create: {
                uamId,
                nombre: row.variedad || null,
                activa: parseBoolean(row.variedad_activa),
                especieId,
            },
            update: {
                nombre: row.variedad || null,
                activa: parseBoolean(row.variedad_activa),
                especieId,
            },
            conflictOn: {
                uamId,
            },
        });
        variedadIds.set(uamId, variedad.id);
    }
    // Presentaciones
    const presentaciones = new Map<number, CsvRow>();
    for (const row of records) {
        if (!row.presentacion_id) {
            continue;
        }
        presentaciones.set(Number(row.presentacion_id), row);
    }
    for (const [uamId, row] of presentaciones) {
        const variedadId = variedadIds.get(Number(row.variedad_id));
        if (variedadId === undefined) {
            throw new Error(`No se encontró la variedad ${row.variedad_id} para la presentación ${uamId}`);
        }
        await db.orm.public.Presentacion.upsert({
            create: {
                uamId,
                nombre: row.presentacion || null,
                kgPorUnidad: parseDecimal(row.kg_por_unidad),
                activa: parseBoolean(row.presentacion_activa),
                esDefault: parseBoolean(row.presentacion_default),
                variedadId,
            },
            update: {
                nombre: row.presentacion || null,
                kgPorUnidad: parseDecimal(row.kg_por_unidad),
                activa: parseBoolean(row.presentacion_activa),
                esDefault: parseBoolean(row.presentacion_default),
                variedadId,
            },
            conflictOn: {
                uamId,
            },
        });
    }
    console.table([
        {Entidad: "Grupos",         Cargados: grupos.size,          Resultado: "OK"},
        {Entidad: "Especies",       Cargados: especies.size,        Resultado: "OK"},
        {Entidad: "Variedades",     Cargados: variedades.size,      Resultado: "OK"},
        {Entidad: "Presentaciones", Cargados: presentaciones.size,  Resultado: "OK"},
    ]);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});