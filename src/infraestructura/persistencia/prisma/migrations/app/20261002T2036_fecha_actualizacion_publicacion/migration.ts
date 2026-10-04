#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/090c3a8f7ee1cafc69f331595d913a1e306bd4d66ae029c517f6a15f4dd6e864/contract';
import endContract from '../../snapshots/090c3a8f7ee1cafc69f331595d913a1e306bd4d66ae029c517f6a15f4dd6e864/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/dc63eed1e704a4dd2b30a7db344bb6f745e62667a62f5ed16bb94f62499c27cd/contract';
import startContract from '../../snapshots/dc63eed1e704a4dd2b30a7db344bb6f745e62667a62f5ed16bb94f62499c27cd/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropDefault({ schema: 'public', table: 'publicacion', column: 'fecha' })];
  }
}

MigrationCLI.run(import.meta.url, M);
