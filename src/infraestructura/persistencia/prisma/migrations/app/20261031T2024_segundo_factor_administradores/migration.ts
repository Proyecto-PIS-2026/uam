#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/149910bfd795df83b5062a61a8970337898a14127bf3455f1c4ef1603311774a/contract';
import endContract from '../../snapshots/149910bfd795df83b5062a61a8970337898a14127bf3455f1c4ef1603311774a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/00a5c4d0c5097c79610099c4b873c840008171e7667a703de42c1134851046e6/contract';
import startContract from '../../snapshots/00a5c4d0c5097c79610099c4b873c840008171e7667a703de42c1134851046e6/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  lit,
} from '@prisma/orm-postgres/migration';

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
