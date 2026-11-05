#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/11093c0a4410813bc236981926bf1e3d54e19cbfd09f4df7f31280f49164cca4/contract';
import startContract from '../../snapshots/11093c0a4410813bc236981926bf1e3d54e19cbfd09f4df7f31280f49164cca4/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/dd2325f84e913b72a7ab0918be5325fea4a11638dff51a37d577978c8637f59c/contract';
import endContract from '../../snapshots/dd2325f84e913b72a7ab0918be5325fea4a11638dff51a37d577978c8637f59c/contract.json' with { type: 'json' };
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
