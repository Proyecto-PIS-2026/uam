import CircularProgress from "@mui/material/CircularProgress";

export default function IndicadorCargaPublicaciones() {
    return (
        <div role="status" className="flex items-center gap-2">
            <CircularProgress size={20} color="secondary" aria-hidden="true" />
            <span>Cargando publicaciones...</span>
        </div>
    );
}
