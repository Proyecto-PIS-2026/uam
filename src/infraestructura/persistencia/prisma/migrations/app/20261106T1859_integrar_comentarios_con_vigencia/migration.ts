#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/032ad39619a03654520a84697d6c2ef7a5ee893d9c40330a094a06aadce55b49/contract';
import startContract from '../../snapshots/032ad39619a03654520a84697d6c2ef7a5ee893d9c40330a094a06aadce55b49/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a09547d007bfed4af7744500b7a0a0b9de16165c312f05643f0666456fe50abb/contract';
import endContract from '../../snapshots/a09547d007bfed4af7744500b7a0a0b9de16165c312f05643f0666456fe50abb/contract.json' with { type: 'json' };
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
