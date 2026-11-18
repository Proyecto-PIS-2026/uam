#!/usr/bin/env -S node
import type { Contract } from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract';
import contract from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

// npm run db:migrate exige este invariant junto con el contrato emitido actual.
// Conserva todas las publicaciones: sólo unifica las referencias a categorías equivalentes.
export default class M extends Migration<Contract, Contract> {
  override readonly startContractJson = contract;
  override readonly endContractJson = contract;

  override get operations() {
    return [
      rawSql({
        id: "data_migration.catalogos_publicacion_globales",
        label: "Hacer globales las categorías conservando sus publicaciones",
        operationClass: 'data',
        invariantId: "uam:catalogos-publicacion-globales",
        target: { id: 'postgres' },
        precheck: [],
        execute: [
          {
            description: "Evitar cambios de referencias durante la unificación",
            sql: `LOCK TABLE "public"."categoria", "public"."publicacion" IN SHARE ROW EXCLUSIVE MODE;`,
          },
          {
            description: "Vincular las publicaciones a una única categoría por nombre",
            sql: `WITH equivalencias AS (
    SELECT id, min(id) OVER (PARTITION BY lower(btrim(regexp_replace("nombreCategoria", '[[:space:]]+', ' ', 'g')))) AS destino
    FROM "public"."categoria"
)
UPDATE "public"."publicacion" AS publicacion
SET "categoriaId" = equivalencias.destino
FROM equivalencias
WHERE publicacion."categoriaId" = equivalencias.id AND equivalencias.id <> equivalencias.destino;`,
          },
          {
            description: "Eliminar únicamente las categorías duplicadas ya desvinculadas",
            sql: `WITH equivalencias AS (
    SELECT id, min(id) OVER (PARTITION BY lower(btrim(regexp_replace("nombreCategoria", '[[:space:]]+', ' ', 'g')))) AS destino
    FROM "public"."categoria"
)
DELETE FROM "public"."categoria" AS categoria
USING equivalencias
WHERE categoria.id = equivalencias.id AND equivalencias.id <> equivalencias.destino;`,
          },
          {
            description: "Permitir todas las categorías para cualquier especie",
            sql: `UPDATE "public"."categoria" SET "especieId" = NULL WHERE "especieId" IS NOT NULL;`,
          },
        ],
        postcheck: [
          {
            description: "Verificar categorías globales sin nombres repetidos ni publicaciones huérfanas",
            sql: `SELECT NOT EXISTS (SELECT 1 FROM "public"."categoria" WHERE "especieId" IS NOT NULL)
AND NOT EXISTS (
    SELECT 1 FROM "public"."categoria"
    GROUP BY lower(btrim(regexp_replace("nombreCategoria", '[[:space:]]+', ' ', 'g'))) HAVING count(*) > 1
)
AND NOT EXISTS (
    SELECT 1 FROM "public"."publicacion" AS publicacion
    LEFT JOIN "public"."categoria" AS categoria ON categoria.id = publicacion."categoriaId"
    WHERE publicacion."categoriaId" IS NOT NULL AND categoria.id IS NULL
) AS result;`,
          },
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
