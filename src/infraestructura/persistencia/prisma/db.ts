import 'temporal-polyfill/global';
import 'dotenv/config';
import 'temporal-polyfill/full/global';
import 'temporal-polyfill/types/global';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract';
import contractJson from './contract.json' with { type: 'json' };

const globalForDb = globalThis as unknown as {
    db: ReturnType<typeof postgres<Contract>> | undefined;
};

export const db =
    globalForDb.db ??
    postgres<Contract>({
        contractJson,
        url: process.env['DATABASE_URL']!,
    });

if (process.env.NODE_ENV !== 'production') {
    globalForDb.db = db;
}