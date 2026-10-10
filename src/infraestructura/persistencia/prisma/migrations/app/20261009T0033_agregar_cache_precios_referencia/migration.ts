#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/090c3a8f7ee1cafc69f331595d913a1e306bd4d66ae029c517f6a15f4dd6e864/contract';
import startContract from '../../snapshots/090c3a8f7ee1cafc69f331595d913a1e306bd4d66ae029c517f6a15f4dd6e864/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6199bcda0d7cc5d6c1bb7b01b0d8bc41bcb8252696ec6d8cad02dbeaf8f84b57/contract';
import endContract from '../../snapshots/6199bcda0d7cc5d6c1bb7b01b0d8bc41bcb8252696ec6d8cad02dbeaf8f84b57/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'cachePreciosReferencia',
        columns: [
          col('claveCache', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('estadoCache', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'cachePreciosReferencia',
        constraint: 'cachePreciosReferencia_claveCache_key',
        columns: ['claveCache'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
