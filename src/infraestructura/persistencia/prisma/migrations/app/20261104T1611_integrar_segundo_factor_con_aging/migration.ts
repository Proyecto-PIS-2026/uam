#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/50650e5cb247debea4ab8752f6bfb873090723ca76796b3fff32d6361a04d46f/contract';
import startContract from '../../snapshots/50650e5cb247debea4ab8752f6bfb873090723ca76796b3fff32d6361a04d46f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b04e63ad43f1b21150b2480a803730162a5ed496146d474aeade96f7f1abe0b6/contract';
import endContract from '../../snapshots/b04e63ad43f1b21150b2480a803730162a5ed496146d474aeade96f7f1abe0b6/contract.json' with { type: 'json' };
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
