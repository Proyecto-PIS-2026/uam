import type { ReactNode } from "react";
import type { createRoot, hydrateRoot } from "react-dom/client";
import { render as renderOriginal, type Queries, type RenderOptions, type RenderResult, type queries } from "@testing-library/react";
import { ProveedorNotificacionesToast } from "@/compartido/componentes/NotificacionToast";

export * from "@testing-library/react";

type Contenedor = Parameters<typeof createRoot>[0] | Parameters<typeof hydrateRoot>[0];

export function render<
    Q extends Queries = typeof queries,
    C extends Contenedor = HTMLElement,
    B extends Contenedor = C,
>(ui: ReactNode, options: RenderOptions<Q, C, B> = {}): RenderResult<Q, C, B> {
    const Wrapper = options.wrapper;
    return renderOriginal(ui, {
        ...options,
        wrapper: function ProveedoresPrueba({ children }: { children: ReactNode }) {
            return <ProveedorNotificacionesToast>
                {Wrapper ? <Wrapper>{children}</Wrapper> : children}
            </ProveedorNotificacionesToast>;
        },
    });
}
