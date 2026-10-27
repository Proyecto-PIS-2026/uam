#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4c1be49ae006f84744eab77f4bcbaf4fc56a44f9a625e65984629e8806b440f8/contract';
import endContract from '../../snapshots/4c1be49ae006f84744eab77f4bcbaf4fc56a44f9a625e65984629e8806b440f8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/7ebfc9a45cd27b34b40279d4b014b448dbfb6c7e0083c7ee6f6e3d19a927de87/contract';
import startContract from '../../snapshots/7ebfc9a45cd27b34b40279d4b014b448dbfb6c7e0083c7ee6f6e3d19a927de87/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('version', 'int4', {
          notNull: true,
          default: lit(1),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
