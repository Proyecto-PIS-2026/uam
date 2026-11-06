#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/b72f67d61ed79fbd975aa468cca108514f199d30f938321fe21fa6ceddbe54fe/contract';
import startContract from '../../snapshots/b72f67d61ed79fbd975aa468cca108514f199d30f938321fe21fa6ceddbe54fe/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bdd5172bbae91ef1a7454921f494c7c089b55e18fd24033e872c1485021fddb6/contract';
import endContract from '../../snapshots/bdd5172bbae91ef1a7454921f494c7c089b55e18fd24033e872c1485021fddb6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

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
