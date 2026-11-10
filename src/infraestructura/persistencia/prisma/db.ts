import 'temporal-polyfill/global';
import 'dotenv/config';
import 'temporal-polyfill/full/global';
import 'temporal-polyfill/types/global';
import { createHash } from 'node:crypto';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract';
import contractJson from './contract.json' with { type: 'json' };

const globalForDb = globalThis as unknown as {
    db: ReturnType<typeof postgres<Contract>> | undefined;
    dbFirma: string | undefined;
};

const url = process.env['DATABASE_URL']!;
const firma = createHash('sha256')
    .update(JSON.stringify({ contractJson, url }))
    .digest('hex');
const clienteAnterior = process.env.NODE_ENV !== 'production' ? globalForDb.db : undefined;

export const db =
    clienteAnterior && globalForDb.dbFirma === firma
        ? clienteAnterior
        : postgres<Contract>({ contractJson, url });

if (process.env.NODE_ENV !== 'production') {
    globalForDb.db = db;
    globalForDb.dbFirma = firma;
    if (clienteAnterior && clienteAnterior !== db) {
        void clienteAnterior.close().catch(() => {
            console.error('No se pudo cerrar el cliente anterior de PostgreSQL.');
        });
    }
}
