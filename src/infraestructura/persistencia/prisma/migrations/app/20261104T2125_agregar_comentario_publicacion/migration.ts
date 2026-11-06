#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/11093c0a4410813bc236981926bf1e3d54e19cbfd09f4df7f31280f49164cca4/contract';
import startContract from '../../snapshots/11093c0a4410813bc236981926bf1e3d54e19cbfd09f4df7f31280f49164cca4/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d0f5e254b7d5752c9d3887e71f34ed760a79819b4f85d6f5bd83c3d2b7a021ac/contract';
import endContract from '../../snapshots/d0f5e254b7d5752c9d3887e71f34ed760a79819b4f85d6f5bd83c3d2b7a021ac/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('comentario', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
