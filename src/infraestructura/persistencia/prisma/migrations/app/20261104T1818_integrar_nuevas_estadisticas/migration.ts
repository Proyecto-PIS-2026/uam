#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/d5efabd362361b30e8605fcbda72e058bc06328b97ce4850c8f4656180df0075/contract';
import startContract from '../../snapshots/d5efabd362361b30e8605fcbda72e058bc06328b97ce4850c8f4656180df0075/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f28ff2fb1e16269215d5546217031823c5ab1e5876c017cc4e73849f448af8df/contract';
import endContract from '../../snapshots/f28ff2fb1e16269215d5546217031823c5ab1e5876c017cc4e73849f448af8df/contract.json' with { type: 'json' };
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
