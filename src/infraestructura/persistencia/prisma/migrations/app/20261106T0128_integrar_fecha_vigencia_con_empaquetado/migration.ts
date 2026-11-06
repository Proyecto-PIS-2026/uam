#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/032ad39619a03654520a84697d6c2ef7a5ee893d9c40330a094a06aadce55b49/contract';
import endContract from '../../snapshots/032ad39619a03654520a84697d6c2ef7a5ee893d9c40330a094a06aadce55b49/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e60976eb547f555dbdc6b91f6ab500618ce7118f4e8195169ecbbdda2781f73a/contract';
import startContract from '../../snapshots/e60976eb547f555dbdc6b91f6ab500618ce7118f4e8195169ecbbdda2781f73a/contract.json' with { type: 'json' };
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
