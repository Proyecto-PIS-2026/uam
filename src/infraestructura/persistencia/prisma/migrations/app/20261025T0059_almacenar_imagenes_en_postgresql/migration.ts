#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4c1be49ae006f84744eab77f4bcbaf4fc56a44f9a625e65984629e8806b440f8/contract';
import startContract from '../../snapshots/4c1be49ae006f84744eab77f4bcbaf4fc56a44f9a625e65984629e8806b440f8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6b31658ea64079e091b507d9944874ebee46bdc19fa80ccdc2a96259ebb04492/contract';
import endContract from '../../snapshots/6b31658ea64079e091b507d9944874ebee46bdc19fa80ccdc2a96259ebb04492/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'imagen',
        columns: [
          col('clave', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('contenido', 'bytea', { notNull: true, codecRef: { codecId: 'pg/bytea@1' } }),
        ],
        constraints: [primaryKey(['clave'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
