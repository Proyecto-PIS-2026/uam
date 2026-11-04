#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4ce732482677e9b8e09aceece1358f275c0f542a4c4495be4d6c174bd9cdaf81/contract';
import endContract from '../../snapshots/4ce732482677e9b8e09aceece1358f275c0f542a4c4495be4d6c174bd9cdaf81/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d5efabd362361b30e8605fcbda72e058bc06328b97ce4850c8f4656180df0075/contract';
import startContract from '../../snapshots/d5efabd362361b30e8605fcbda72e058bc06328b97ce4850c8f4656180df0075/contract.json' with { type: 'json' };
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
