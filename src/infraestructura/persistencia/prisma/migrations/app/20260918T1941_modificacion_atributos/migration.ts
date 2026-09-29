#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/52517bb0a16d58db079daa0aef1b9c3237b7c28579ac4d236f9129304d447ff4/contract';
import startContract from '../../snapshots/52517bb0a16d58db079daa0aef1b9c3237b7c28579ac4d236f9129304d447ff4/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7424030b0a98dc9adbb50f725ad28058531ed36184456a6f5871df6feb32b282/contract';
import endContract from '../../snapshots/7424030b0a98dc9adbb50f725ad28058531ed36184456a6f5871df6feb32b282/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'especie',
        column: col('fotoEspecie', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'operador',
        column: col('fotoPerfil', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'local', column: 'finContrato' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
