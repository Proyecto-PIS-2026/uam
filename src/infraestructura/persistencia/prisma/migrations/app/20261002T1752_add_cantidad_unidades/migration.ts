#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7424030b0a98dc9adbb50f725ad28058531ed36184456a6f5871df6feb32b282/contract';
import startContract from '../../snapshots/7424030b0a98dc9adbb50f725ad28058531ed36184456a6f5871df6feb32b282/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/dc63eed1e704a4dd2b30a7db344bb6f745e62667a62f5ed16bb94f62499c27cd/contract';
import endContract from '../../snapshots/dc63eed1e704a4dd2b30a7db344bb6f745e62667a62f5ed16bb94f62499c27cd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('cantidadUnidades', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
