#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/b04e63ad43f1b21150b2480a803730162a5ed496146d474aeade96f7f1abe0b6/contract';
import startContract from '../../snapshots/b04e63ad43f1b21150b2480a803730162a5ed496146d474aeade96f7f1abe0b6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f7fcd0b585a12a650947f3a80a08e064685e65500c2a77a59cf14e302c1b52bf/contract';
import endContract from '../../snapshots/f7fcd0b585a12a650947f3a80a08e064685e65500c2a77a59cf14e302c1b52bf/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'imagen',
        column: col('avisoVencimientoEn', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
