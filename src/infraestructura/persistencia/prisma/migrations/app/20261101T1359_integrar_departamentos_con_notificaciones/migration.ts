#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/ab324b686f298874a9b085ab4fb43de91ec22d019f9fbd7a4d9a0c6219d8b363/contract';
import startContract from '../../snapshots/ab324b686f298874a9b085ab4fb43de91ec22d019f9fbd7a4d9a0c6219d8b363/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/db0bb2af972b451bef5b50a6367375df63008e0555a34e735f906ed0e83cf268/contract';
import endContract from '../../snapshots/db0bb2af972b451bef5b50a6367375df63008e0555a34e735f906ed0e83cf268/contract.json' with { type: 'json' };
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
