#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/dd2325f84e913b72a7ab0918be5325fea4a11638dff51a37d577978c8637f59c/contract';
import endContract from '../../snapshots/dd2325f84e913b72a7ab0918be5325fea4a11638dff51a37d577978c8637f59c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f28ff2fb1e16269215d5546217031823c5ab1e5876c017cc4e73849f448af8df/contract';
import startContract from '../../snapshots/f28ff2fb1e16269215d5546217031823c5ab1e5876c017cc4e73849f448af8df/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ejecucionTareaProgramada',
        columns: [
          col('completadaEn', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('elementosProcesados', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('fecha', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('nombre', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['nombre'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'imagen',
        column: col('avisoVencimientoEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'imagen',
        column: col('cargadaEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('fotoEliminadaPorVencimientoEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
