export const dynamic = 'force-dynamic';

import FormularioAltaUsuario from '@/modulos/usuarios/administradores/componentes/alta-usuario/FormularioAltaUsuario';

export default function Page() {
    return (
        <main className="relative isolate flex-1 overflow-hidden bg-background font-sans text-foreground">
            <div className="relative z-10">
                <FormularioAltaUsuario />
            </div>
        </main>
    );
}
