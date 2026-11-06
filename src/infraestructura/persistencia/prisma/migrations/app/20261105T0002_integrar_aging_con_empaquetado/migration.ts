#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2115500e4b32e27a71436ece49d2042987ee98c0967583f2b292e4c63459c748/contract';
import startContract from '../../snapshots/2115500e4b32e27a71436ece49d2042987ee98c0967583f2b292e4c63459c748/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e60976eb547f555dbdc6b91f6ab500618ce7118f4e8195169ecbbdda2781f73a/contract';
import endContract from '../../snapshots/e60976eb547f555dbdc6b91f6ab500618ce7118f4e8195169ecbbdda2781f73a/contract.json' with { type: 'json' };
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
