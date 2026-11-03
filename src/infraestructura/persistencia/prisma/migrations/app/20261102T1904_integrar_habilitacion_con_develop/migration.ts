#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/587d00b79527ec81141f638af26883b9e798538aeb430f58bbb416f5b1c05588/contract';
import endContract from '../../snapshots/587d00b79527ec81141f638af26883b9e798538aeb430f58bbb416f5b1c05588/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b72f67d61ed79fbd975aa468cca108514f199d30f938321fe21fa6ceddbe54fe/contract';
import startContract from '../../snapshots/b72f67d61ed79fbd975aa468cca108514f199d30f938321fe21fa6ceddbe54fe/contract.json' with { type: 'json' };
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
