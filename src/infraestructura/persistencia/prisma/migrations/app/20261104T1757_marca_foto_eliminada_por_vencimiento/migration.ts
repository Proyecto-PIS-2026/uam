#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/11093c0a4410813bc236981926bf1e3d54e19cbfd09f4df7f31280f49164cca4/contract';
import endContract from '../../snapshots/11093c0a4410813bc236981926bf1e3d54e19cbfd09f4df7f31280f49164cca4/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f7fcd0b585a12a650947f3a80a08e064685e65500c2a77a59cf14e302c1b52bf/contract';
import startContract from '../../snapshots/f7fcd0b585a12a650947f3a80a08e064685e65500c2a77a59cf14e302c1b52bf/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
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
