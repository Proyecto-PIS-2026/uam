#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/00a5c4d0c5097c79610099c4b873c840008171e7667a703de42c1134851046e6/contract';
import endContract from '../../snapshots/00a5c4d0c5097c79610099c4b873c840008171e7667a703de42c1134851046e6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/580baa18385f3be13bd65c632f572151ac3bed83620b4f21eb6d1f5f98c4b59a/contract';
import startContract from '../../snapshots/580baa18385f3be13bd65c632f572151ac3bed83620b4f21eb6d1f5f98c4b59a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'ubicacion',
        column: col('departamento', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
