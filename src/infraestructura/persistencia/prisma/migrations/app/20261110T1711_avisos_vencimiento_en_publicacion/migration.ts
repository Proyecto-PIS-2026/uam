#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract';
import endContract from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d79f1cd356b2a43f5bd3afc98fe6393e620060df81d4cdc92dea125dbdbbd1b6/contract';
import startContract from '../../snapshots/d79f1cd356b2a43f5bd3afc98fe6393e620060df81d4cdc92dea125dbdbbd1b6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('avisoProximoVencimientoEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('avisoVencimientoEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      rawSql({
        id: 'data_migration.conservar_avisos_en_publicacion',
        label: 'Conservar los avisos enviados de la vigencia actual en la publicación',
        operationClass: 'data',
        target: { id: 'postgres' },
        precheck: [],
        execute: [{
          description: 'Registrar las fechas de envío de las notificaciones existentes',
          sql: `WITH propietarios AS (
  SELECT po."publicacionId", o."usuarioId", '/mi-mercado?publicacion=' || po."publicacionId" AS url
  FROM "public"."publicacionOperador" po
  JOIN "public"."operador" o ON o.id = po."operadorId"
  UNION ALL
  SELECT pp."publicacionId", p."usuarioId", '/mi-mercado/productor?publicacion=' || pp."publicacionId" AS url
  FROM "public"."publicacionProductor" pp
  JOIN "public"."productor" p ON p.id = pp."productorId"
), avisos AS (
  SELECT p.id,
    min(n.fecha) FILTER (WHERE aviso.tipo = 'proximo') AS proximo,
    min(n.fecha) FILTER (WHERE aviso.tipo = 'vencido') AS vencido
  FROM propietarios propietario
  JOIN "public"."publicacion" p ON p.id = propietario."publicacionId"
  JOIN "public"."notificacion" n ON n."usuarioId" = propietario."usuarioId" AND n.url = propietario.url
  CROSS JOIN LATERAL (
    VALUES
      ('proximo', ' está próxima a vencer el ' || to_char(p."fechaVigencia" AT TIME ZONE 'America/Montevideo', 'YYYY-MM-DD') || '.'),
      ('vencido', ' ha vencido el ' || to_char(p."fechaVigencia" AT TIME ZONE 'America/Montevideo', 'YYYY-MM-DD') || ' y ya no está disponible.')
  ) AS aviso(tipo, sufijo)
  WHERE p."fechaVigencia" IS NOT NULL
    AND n.descripcion LIKE 'Tu publicación de %'
    AND right(n.descripcion, length(aviso.sufijo)) = aviso.sufijo
  GROUP BY p.id
)
UPDATE "public"."publicacion" p
SET "avisoProximoVencimientoEn" = avisos.proximo,
    "avisoVencimientoEn" = avisos.vencido
FROM avisos
WHERE p.id = avisos.id;`,
        }],
        postcheck: [],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
