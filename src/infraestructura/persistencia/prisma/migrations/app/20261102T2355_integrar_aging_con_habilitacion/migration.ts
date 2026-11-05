#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/50650e5cb247debea4ab8752f6bfb873090723ca76796b3fff32d6361a04d46f/contract';
import endContract from '../../snapshots/50650e5cb247debea4ab8752f6bfb873090723ca76796b3fff32d6361a04d46f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/587d00b79527ec81141f638af26883b9e798538aeb430f58bbb416f5b1c05588/contract';
import startContract from '../../snapshots/587d00b79527ec81141f638af26883b9e798538aeb430f58bbb416f5b1c05588/contract.json' with { type: 'json' };
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
        column: col('cargadaEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
