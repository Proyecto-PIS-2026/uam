#!/usr/bin/env -S node
import type { Contract } from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract';
import contract from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

// npm run db:migrate exige este invariant de datos junto con el contrato emitido actual.
// La referencia aging-fotos-por-rol también permite seleccionar esta migración explícitamente.
export default class M extends Migration<Contract, Contract> {
  override readonly startContractJson = contract;
  override readonly endContractJson = contract;

  override get operations() {
    return [
      rawSql({
        id: 'data_migration.separar_aging_fotos_productor',
        label: 'Separar la configuración de aging de fotos de productores',
        operationClass: 'data',
        invariantId: 'uam:aging-fotos-productor-separado',
        target: { id: 'postgres' },
        precheck: [],
        execute: [{
          description: 'Copiar la configuración vigente sin sobrescribir valores propios de productores',
          sql: `INSERT INTO "public"."configuracion" ("nombreConfiguracion", "valorConfiguracion")
SELECT claves.destino, COALESCE(actual."valorConfiguracion", claves.predeterminado)
FROM (VALUES
  ('aging_fotos_habilitado', 'aging_fotos_productor_habilitado', 'false'),
  ('vigencia_fotos', 'vigencia_fotos_productor', '3'),
  ('aviso_vencimiento_fotos_habilitado', 'aviso_vencimiento_fotos_productor_habilitado', 'false'),
  ('anticipacion_aviso_fotos', 'anticipacion_aviso_fotos_productor', '1')
) AS claves(origen, destino, predeterminado)
LEFT JOIN "public"."configuracion" actual ON actual."nombreConfiguracion" = claves.origen
ON CONFLICT ("nombreConfiguracion") DO NOTHING;`,
        }],
        postcheck: [{
          description: 'Verificar que existen las cuatro opciones de aging de productores',
          sql: `SELECT count(*) = 4 AS result
FROM "public"."configuracion"
WHERE "nombreConfiguracion" IN (
  'aging_fotos_productor_habilitado',
  'vigencia_fotos_productor',
  'aviso_vencimiento_fotos_productor_habilitado',
  'anticipacion_aviso_fotos_productor'
);`,
        }],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
