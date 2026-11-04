#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/587d00b79527ec81141f638af26883b9e798538aeb430f58bbb416f5b1c05588/contract';
import startContract from '../../snapshots/587d00b79527ec81141f638af26883b9e798538aeb430f58bbb416f5b1c05588/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d5efabd362361b30e8605fcbda72e058bc06328b97ce4850c8f4656180df0075/contract';
import endContract from '../../snapshots/d5efabd362361b30e8605fcbda72e058bc06328b97ce4850c8f4656180df0075/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('twoFactorChallengeHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('twoFactorExpiresAt', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('twoFactorFailedAttempts', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('twoFactorLastStep', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('twoFactorLockedUntil', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('twoFactorPendingSecret', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'usuario',
        constraint: 'usuario_twoFactorChallengeHash_key',
        columns: ['twoFactorChallengeHash'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
