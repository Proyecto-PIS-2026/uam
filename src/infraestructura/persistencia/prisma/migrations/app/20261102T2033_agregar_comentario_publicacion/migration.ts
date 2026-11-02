#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1bf9b13433dd08cf1afcd49ddce202b84f4a28a5dbe9099accd4daed7578ccf6/contract';
import endContract from '../../snapshots/1bf9b13433dd08cf1afcd49ddce202b84f4a28a5dbe9099accd4daed7578ccf6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b72f67d61ed79fbd975aa468cca108514f199d30f938321fe21fa6ceddbe54fe/contract';
import startContract from '../../snapshots/b72f67d61ed79fbd975aa468cca108514f199d30f938321fe21fa6ceddbe54fe/contract.json' with { type: 'json' };
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
