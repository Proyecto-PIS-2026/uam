#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/a09547d007bfed4af7744500b7a0a0b9de16165c312f05643f0666456fe50abb/contract';
import endContract from '../../snapshots/a09547d007bfed4af7744500b7a0a0b9de16165c312f05643f0666456fe50abb/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e95cc4c5f46822260ee5773661dc18477d7156192c267076edfc55b3e2131525/contract';
import startContract from '../../snapshots/e95cc4c5f46822260ee5773661dc18477d7156192c267076edfc55b3e2131525/contract.json' with { type: 'json' };
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
