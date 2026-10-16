import { Client } from "pg";
import type { CambioPublicacion } from "./publicaciones";

type Oyente = (cambio: CambioPublicacion | null) => void;

export class EscuchaPublicaciones {
    private oyentes = new Set<Oyente>();
    private cliente: Client | null = null;
    private conectando: Promise<void> | null = null;
    private reintento: ReturnType<typeof setTimeout> | null = null;

    suscribir(oyente: Oyente) {
        this.oyentes.add(oyente);
        void this.conectar();
        return () => {
            this.oyentes.delete(oyente);
            if (this.oyentes.size === 0) {
                if (this.reintento) clearTimeout(this.reintento);
                this.reintento = null;
                const cliente = this.cliente;
                this.cliente = null;
                void cliente?.end().catch(() => {});
            }
        };
    }

    private emitir(cambio: CambioPublicacion | null) {
        for (const oyente of this.oyentes) oyente(cambio);
    }

    private async conectar() {
        if (this.cliente || this.conectando || this.oyentes.size === 0) return;
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
            this.cliente = null;
            void cliente.end().catch(() => {});
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
            if (channel !== "uam_publicaciones" || !payload) return;
            try {
                const cambio = JSON.parse(payload) as CambioPublicacion;
                if (Number.isSafeInteger(cambio.operadorId) && cambio.operadorId > 0 && Number.isSafeInteger(cambio.publicacionId) && cambio.publicacionId > 0) {
                    this.emitir(cambio);
                }
            } catch {}
        });
        try {
            await cliente.connect();
            if (this.cliente !== cliente) return;
            await cliente.query("LISTEN uam_publicaciones");
            this.emitir(null);
        } catch {
            desconectar();
        }
    }
}

const globalEventos = globalThis as typeof globalThis & { escuchaPublicaciones?: EscuchaPublicaciones };
export const escuchaPublicaciones = globalEventos.escuchaPublicaciones ??= new EscuchaPublicaciones();
