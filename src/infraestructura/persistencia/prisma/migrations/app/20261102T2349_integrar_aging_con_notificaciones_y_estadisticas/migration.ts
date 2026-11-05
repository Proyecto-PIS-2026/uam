#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9e35ff1bcc54871c0831cc55b70ab97eb906a463b6cc7fb7fe07a7d1ff076cac/contract';
import endContract from '../../snapshots/9e35ff1bcc54871c0831cc55b70ab97eb906a463b6cc7fb7fe07a7d1ff076cac/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b72f67d61ed79fbd975aa468cca108514f199d30f938321fe21fa6ceddbe54fe/contract';
import startContract from '../../snapshots/b72f67d61ed79fbd975aa468cca108514f199d30f938321fe21fa6ceddbe54fe/contract.json' with { type: 'json' };
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
