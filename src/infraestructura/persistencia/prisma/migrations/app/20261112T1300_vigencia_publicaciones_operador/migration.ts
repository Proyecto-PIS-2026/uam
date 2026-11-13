#!/usr/bin/env -S node
import type { Contract } from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract';
import contract from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

// npm run db:migrate exige este invariant de datos junto con el contrato emitido actual.
// La referencia vigencia-publicaciones-operador también permite seleccionar esta migración explícitamente.
export default class M extends Migration<Contract, Contract> {
  override readonly startContractJson = contract;
  override readonly endContractJson = contract;

  override get operations() {
    return [
      rawSql({
        id: 'data_migration.vigencia_publicaciones_operador',
        label: 'Incorporar la vigencia configurable de publicaciones de operadores',
        operationClass: 'data',
        invariantId: 'uam:vigencia-publicaciones-operador',
        target: { id: 'postgres' },
        precheck: [],
        execute: [{
          description: 'Conservar los avisos actuales sin activar un límite de vigencia ni sobrescribir opciones de operadores',
          sql: `INSERT INTO "public"."configuracion" ("nombreConfiguracion", "valorConfiguracion")
SELECT claves.destino,
       CASE WHEN actual."nombreConfiguracion" IS NULL
            THEN claves.predeterminado
            ELSE actual."valorConfiguracion"
       END
FROM (VALUES
  (NULL, 'vigencia_publicaciones_operador_habilitada', 'false'),
  ('vigencia_publicaciones_productor', 'vigencia_publicaciones_operador', '30'),
  ('aviso_vencimiento_publicaciones_productor_habilitado', 'aviso_vencimiento_publicaciones_operador_habilitado', 'true'),
  ('anticipacion_aviso_publicaciones_productor', 'anticipacion_aviso_publicaciones_operador', '7')
) AS claves(origen, destino, predeterminado)
LEFT JOIN "public"."configuracion" actual ON actual."nombreConfiguracion" = claves.origen
ON CONFLICT ("nombreConfiguracion") DO NOTHING;`,
        }],
        postcheck: [{
          description: 'Verificar que existen las cuatro opciones de vigencia de operadores',
          sql: `SELECT count(*) = 4 AS result
FROM "public"."configuracion"
WHERE "nombreConfiguracion" IN (
  'vigencia_publicaciones_operador_habilitada',
  'vigencia_publicaciones_operador',
  'aviso_vencimiento_publicaciones_operador_habilitado',
  'anticipacion_aviso_publicaciones_operador'
);`,
        }],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
