#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/11093c0a4410813bc236981926bf1e3d54e19cbfd09f4df7f31280f49164cca4/contract';
import startContract from '../../snapshots/11093c0a4410813bc236981926bf1e3d54e19cbfd09f4df7f31280f49164cca4/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e60976eb547f555dbdc6b91f6ab500618ce7118f4e8195169ecbbdda2781f73a/contract';
import endContract from '../../snapshots/e60976eb547f555dbdc6b91f6ab500618ce7118f4e8195169ecbbdda2781f73a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'publicacion',
        constraint: 'publicacion_presentacionId_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({
        schema: 'public',
        table: 'publicacion',
        index: 'publicacion_presentacionId_idx_2981aeac',
      }),
      this.dropColumn({ schema: 'public', table: 'publicacion', column: 'presentacionId' }),
      this.createTable({
        schema: 'public',
        table: 'envase',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombreEnvase', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'kilosEmpaquetado',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('valor', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('envaseId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('kilosId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'envase',
        constraint: 'envase_nombreEnvase_key',
        columns: ['nombreEnvase'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'kilosEmpaquetado',
        constraint: 'kilosEmpaquetado_valor_key',
        columns: ['valor'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacion',
        index: 'publicacion_envaseId_idx_c66e7843',
        columns: ['envaseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacion',
        index: 'publicacion_kilosId_idx_9257854e',
        columns: ['kilosId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacion',
        foreignKey: {
          name: 'publicacion_envaseId_fkey',
          columns: ['envaseId'],
          references: { schema: 'public', table: 'envase', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacion',
        foreignKey: {
          name: 'publicacion_kilosId_fkey',
          columns: ['kilosId'],
          references: { schema: 'public', table: 'kilosEmpaquetado', columns: ['id'] },
        },
      }),
      rawSql({
        id: 'data.catalogos_envases_kilos_calibres',
        label: 'Cargar envases, kilos del empaquetado y calibres generales',
        operationClass: 'data',
        target: { id: 'postgres' },
        precheck: [],
        execute: [
          {
            description: 'Cargar envases independientes de la especie y la variedad',
            sql: `INSERT INTO "public"."envase" ("nombreEnvase")
VALUES ('Plancha'), ('Cajon'), ('Cajita'), ('Bolsa'), ('Descartable'), ('Bing'), ('Bins')
ON CONFLICT ("nombreEnvase") DO NOTHING;`,
          },
          {
            description: 'Cargar cantidades y rangos de kilos preestablecidos',
            sql: `INSERT INTO "public"."kilosEmpaquetado" ("valor")
VALUES ('2'), ('4'), ('8'), ('10'), ('18'), ('20'), ('22'), ('25'), ('250'), ('400'), ('10-12'), ('18-24')
ON CONFLICT ("valor") DO NOTHING;`,
          },
          {
            description: 'Agregar calibres disponibles para todas las publicaciones',
            sql: `INSERT INTO "public"."calibre" ("codigoCalibre", "nombreCalibre")
VALUES ('Primera', 'Primera'), ('Segunda', 'Segunda'), ('Tercera', 'Tercera'),
('Cuarta', 'Cuarta'), ('Quinta', 'Quinta'), ('Sexta', 'Sexta'),
('0', '0'), ('00', '00'), ('Especial', 'Especial')
ON CONFLICT ("codigoCalibre") DO UPDATE SET "nombreCalibre" = EXCLUDED."nombreCalibre";`,
          },
        ],
        postcheck: [],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
