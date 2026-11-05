#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/00a5c4d0c5097c79610099c4b873c840008171e7667a703de42c1134851046e6/contract';
import startContract from '../../snapshots/00a5c4d0c5097c79610099c4b873c840008171e7667a703de42c1134851046e6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8fc7916e893841c1d0470df21c9c9a7377e0648953c7b5a206ed77045a43a480/contract';
import endContract from '../../snapshots/8fc7916e893841c1d0470df21c9c9a7377e0648953c7b5a206ed77045a43a480/contract.json' with { type: 'json' };
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
