#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract';
import startContract from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/edeac76a0d9be78234b0d4f4371956c15f0f63231ea957ff73b635da6a2b766d/contract';
import endContract from '../../snapshots/edeac76a0d9be78234b0d4f4371956c15f0f63231ea957ff73b635da6a2b766d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropTable({ schema: 'public', table: 'presentacion' })];
  }
}

MigrationCLI.run(import.meta.url, M);
