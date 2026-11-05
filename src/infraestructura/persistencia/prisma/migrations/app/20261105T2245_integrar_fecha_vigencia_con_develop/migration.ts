#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/11093c0a4410813bc236981926bf1e3d54e19cbfd09f4df7f31280f49164cca4/contract';
import startContract from '../../snapshots/11093c0a4410813bc236981926bf1e3d54e19cbfd09f4df7f31280f49164cca4/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/1d5defc091053f3d8513cb0efb0ea4d47d2a4e5f228181eda1add9b3a193e50c/contract';
import endContract from '../../snapshots/1d5defc091053f3d8513cb0efb0ea4d47d2a4e5f228181eda1add9b3a193e50c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('fechaVigencia', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
