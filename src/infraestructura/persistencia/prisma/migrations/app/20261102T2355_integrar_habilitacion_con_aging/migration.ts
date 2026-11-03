#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/50650e5cb247debea4ab8752f6bfb873090723ca76796b3fff32d6361a04d46f/contract';
import endContract from '../../snapshots/50650e5cb247debea4ab8752f6bfb873090723ca76796b3fff32d6361a04d46f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9e35ff1bcc54871c0831cc55b70ab97eb906a463b6cc7fb7fe07a7d1ff076cac/contract';
import startContract from '../../snapshots/9e35ff1bcc54871c0831cc55b70ab97eb906a463b6cc7fb7fe07a7d1ff076cac/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('habilitado', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
