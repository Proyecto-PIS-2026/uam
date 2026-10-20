#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7c157f9d97fc2e8870f9ce0262a133f15e5d9ab81d48f8869ecd817e25f241e0/contract';
import startContract from '../../snapshots/7c157f9d97fc2e8870f9ce0262a133f15e5d9ab81d48f8869ecd817e25f241e0/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7ebfc9a45cd27b34b40279d4b014b448dbfb6c7e0083c7ee6f6e3d19a927de87/contract';
import endContract from '../../snapshots/7ebfc9a45cd27b34b40279d4b014b448dbfb6c7e0083c7ee6f6e3d19a927de87/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('solicitoRestablecimiento', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
