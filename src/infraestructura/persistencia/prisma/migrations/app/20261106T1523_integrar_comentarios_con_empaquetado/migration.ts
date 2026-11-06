#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/e60976eb547f555dbdc6b91f6ab500618ce7118f4e8195169ecbbdda2781f73a/contract';
import startContract from '../../snapshots/e60976eb547f555dbdc6b91f6ab500618ce7118f4e8195169ecbbdda2781f73a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e95cc4c5f46822260ee5773661dc18477d7156192c267076edfc55b3e2131525/contract';
import endContract from '../../snapshots/e95cc4c5f46822260ee5773661dc18477d7156192c267076edfc55b3e2131525/contract.json' with { type: 'json' };
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
