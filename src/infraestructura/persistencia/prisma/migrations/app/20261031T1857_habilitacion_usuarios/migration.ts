#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/00a5c4d0c5097c79610099c4b873c840008171e7667a703de42c1134851046e6/contract';
import startContract from '../../snapshots/00a5c4d0c5097c79610099c4b873c840008171e7667a703de42c1134851046e6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f91697ce0934a9b5ebbfe875154982a1719b5ebf1812116844194dd39fc43687/contract';
import endContract from '../../snapshots/f91697ce0934a9b5ebbfe875154982a1719b5ebf1812116844194dd39fc43687/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('habilitado', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
