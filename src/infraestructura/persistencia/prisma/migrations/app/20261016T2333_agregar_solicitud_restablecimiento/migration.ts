#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3fe9ff9b77cc22f3603cc103afea9c647926a2583a93c5bdbb13ab08a75f29a2/contract';
import startContract from '../../snapshots/3fe9ff9b77cc22f3603cc103afea9c647926a2583a93c5bdbb13ab08a75f29a2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e329d367f1b1e76ef0a18c17bf60a4774f04fced990d58d8f439815417932f7c/contract';
import endContract from '../../snapshots/e329d367f1b1e76ef0a18c17bf60a4774f04fced990d58d8f439815417932f7c/contract.json' with { type: 'json' };
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
