#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/cf0698ef656932cbdd7397e9ee81f637a75be4f27bfb8e3334c09d18476ea6de/contract';
import startContract from '../../snapshots/cf0698ef656932cbdd7397e9ee81f637a75be4f27bfb8e3334c09d18476ea6de/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d79f1cd356b2a43f5bd3afc98fe6393e620060df81d4cdc92dea125dbdbbd1b6/contract';
import endContract from '../../snapshots/d79f1cd356b2a43f5bd3afc98fe6393e620060df81d4cdc92dea125dbdbbd1b6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'estadisticaCantidadPublicacion',
        columns: [
          col('cantidad', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('fecha', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('username', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'estadisticaContactoPublicacion',
        columns: [
          col('cantidad', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('especie', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('fecha', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('username', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'estadisticaCantidadPublicacion',
        constraint: 'estadisticaCantidadPublicacion_fecha_username_key',
        columns: ['fecha', 'username'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'estadisticaContactoPublicacion',
        constraint: 'estadisticaContactoPublicacion_fecha_username_especie_key',
        columns: ['fecha', 'username', 'especie'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
