#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3fe9ff9b77cc22f3603cc103afea9c647926a2583a93c5bdbb13ab08a75f29a2/contract';
import startContract from '../../snapshots/3fe9ff9b77cc22f3603cc103afea9c647926a2583a93c5bdbb13ab08a75f29a2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d35c23367da1c32c344855a6e2f38be254754d64822b8595be691a0f20a430f1/contract';
import endContract from '../../snapshots/d35c23367da1c32c344855a6e2f38be254754d64822b8595be691a0f20a430f1/contract.json' with { type: 'json' };
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
