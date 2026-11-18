import Badge from "@mui/material/Badge";

export default function ContadorNotificaciones({ cantidad, enEsquina = false }: { cantidad: number; enEsquina?: boolean }) {
    if (cantidad <= 0) return null;

    return (
        <Badge
            badgeContent={cantidad}
            max={9}
            color="error"
            sx={enEsquina ? {
                position: "absolute",
                right: "-0.15rem",
                bottom: "-0.15rem",
                zIndex: 1,
                pointerEvents: "none",
            } : undefined}
            slotProps={{
                badge: {
                    "aria-hidden": true,
                    sx: {
                        position: "static",
                        transform: "none",
                        backgroundColor: "var(--color-danger)",
                        color: "var(--color-surface)",
                        ...(enEsquina && { outline: "2px solid var(--color-surface)" }),
                    },
                },
            }}
        />
    );
}
