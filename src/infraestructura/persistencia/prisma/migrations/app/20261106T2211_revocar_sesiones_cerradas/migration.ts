#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8ca6395c9b4912fea56216d23ddb5e1c92416c1a91f2fe1738adf6abc7656ef3/contract';
import startContract from '../../snapshots/8ca6395c9b4912fea56216d23ddb5e1c92416c1a91f2fe1738adf6abc7656ef3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/cf0698ef656932cbdd7397e9ee81f637a75be4f27bfb8e3334c09d18476ea6de/contract';
import endContract from '../../snapshots/cf0698ef656932cbdd7397e9ee81f637a75be4f27bfb8e3334c09d18476ea6de/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'sesionRevocada',
        columns: [
          col('expiraEn', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['tokenHash'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sesionRevocada',
        index: 'sesionRevocada_expiraEn_idx_68039536',
        columns: ['expiraEn'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
