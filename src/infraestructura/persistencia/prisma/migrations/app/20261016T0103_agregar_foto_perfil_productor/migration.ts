#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3fe9ff9b77cc22f3603cc103afea9c647926a2583a93c5bdbb13ab08a75f29a2/contract';
import endContract from '../../snapshots/3fe9ff9b77cc22f3603cc103afea9c647926a2583a93c5bdbb13ab08a75f29a2/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fe34c497b062954eb72806349d8eaa50c907d5b40be05c92df27d345960cd09c/contract';
import startContract from '../../snapshots/fe34c497b062954eb72806349d8eaa50c907d5b40be05c92df27d345960cd09c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'productor',
        column: col('fotoPerfil', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
