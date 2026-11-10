import { randomUUID } from "node:crypto";
import { Client } from "pg";
import type { CambioPublicacion } from "./publicaciones";

type Oyente = (cambio: CambioPublicacion | null) => void;

export class EscuchaPublicaciones {
    private oyentes = new Set<Oyente>();
    private cliente: Client | null = null;
    private conectando: Promise<void> | null = null;
    private reintento: ReturnType<typeof setTimeout> | null = null;
    private gracia: ReturnType<typeof setTimeout> | null = null;
    private listo = false;
    private epoca = randomUUID();
    private versionGlobal = this.epoca;
    private versionesOperador = new Map<number, string>();

    obtenerVersion(operadorId?: number): string {
        return operadorId === undefined ? this.versionGlobal : this.versionesOperador.get(operadorId) ?? this.epoca;
    }

    suscribir(oyente: Oyente) {
        if (this.gracia) clearTimeout(this.gracia);
        this.gracia = null;
        this.oyentes.add(oyente);
        if (this.listo) oyente(null);
        else void this.conectar();
        return () => {
            if (!this.oyentes.delete(oyente) || this.oyentes.size > 0) return;
            if (this.reintento) clearTimeout(this.reintento);
            this.reintento = null;
            if (this.listo) {
                this.gracia = setTimeout(() => this.cerrarCliente(), 60000);
                this.gracia.unref?.();
            } else {
                this.cerrarCliente();
            }
        };
    }

    private cerrarCliente() {
        if (this.gracia) clearTimeout(this.gracia);
        this.gracia = null;
        this.listo = false;
        this.versionesOperador.clear();
        this.versionGlobal = this.epoca;
        const cliente = this.cliente;
        this.cliente = null;
        void cliente?.end().catch(() => {});
    }

    private emitir(cambio: CambioPublicacion | null) {
        for (const oyente of this.oyentes) oyente(cambio);
    }

    private async conectar() {
        if (this.cliente || this.conectando || this.reintento || this.oyentes.size === 0) return;
        this.conectando = this.abrir();
        try {
            await this.conectando;
        } finally {
            this.conectando = null;
            if (!this.cliente && !this.reintento && this.oyentes.size > 0) void this.conectar();
        }
    }

    private async abrir() {
        const cliente = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, application_name: "uam_eventos" });
        this.cliente = cliente;
        const desconectar = () => {
            if (this.cliente !== cliente) return;
            this.cerrarCliente();
            if (this.oyentes.size > 0 && !this.reintento) {
                this.reintento = setTimeout(() => {
                    this.reintento = null;
                    void this.conectar();
                }, 3000);
                this.reintento.unref?.();
            }
        };
        cliente.on("error", desconectar);
        cliente.on("end", desconectar);
        cliente.on("notification", ({ channel, payload }) => {
            if (this.cliente !== cliente || !this.listo || channel !== "uam_publicaciones" || !payload) return;
            try {
                const cambio = JSON.parse(payload) as CambioPublicacion;
                if (Number.isSafeInteger(cambio.operadorId) && cambio.operadorId > 0 &&
                    (cambio.publicacionId === undefined || Number.isSafeInteger(cambio.publicacionId) && cambio.publicacionId > 0)) {
                    const version = randomUUID();
                    this.versionGlobal = version;
                    this.versionesOperador.set(cambio.operadorId, version);
                    this.emitir(cambio);
                }
            } catch {}
        });
        try {
            await cliente.connect();
            if (this.cliente !== cliente) return;
            await cliente.query("LISTEN uam_publicaciones");
            if (this.cliente !== cliente) return;
            this.epoca = randomUUID();
            this.versionGlobal = this.epoca;
            this.versionesOperador.clear();
            this.listo = true;
            this.emitir(null);
        } catch {
            desconectar();
        }
    }
}

const globalEventos = globalThis as typeof globalThis & { escuchaPublicaciones?: EscuchaPublicaciones };
export const escuchaPublicaciones = globalEventos.escuchaPublicaciones ??= new EscuchaPublicaciones();
