#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b04e63ad43f1b21150b2480a803730162a5ed496146d474aeade96f7f1abe0b6/contract';
import endContract from '../../snapshots/b04e63ad43f1b21150b2480a803730162a5ed496146d474aeade96f7f1abe0b6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d5efabd362361b30e8605fcbda72e058bc06328b97ce4850c8f4656180df0075/contract';
import startContract from '../../snapshots/d5efabd362361b30e8605fcbda72e058bc06328b97ce4850c8f4656180df0075/contract.json' with { type: 'json' };
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
