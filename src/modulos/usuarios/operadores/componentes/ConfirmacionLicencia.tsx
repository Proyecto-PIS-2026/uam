"use client";

import { useId } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

type Props = {
    abierto: boolean;
    alAceptar: () => void;
    alCancelar: () => void;
};

export default function ConfirmacionLicencia({ abierto, alAceptar, alCancelar }: Props) {
    const tituloId = useId();
    const avisoId = useId();

    return (
        <Dialog open={abierto} onClose={alCancelar} role="alertdialog" aria-labelledby={tituloId} aria-describedby={avisoId} maxWidth="xs" fullWidth>
            <DialogTitle id={tituloId} className="flex items-center gap-2">
                <WarningAmberOutlinedIcon aria-hidden="true" />
                Aviso de licencia
            </DialogTitle>
            <DialogContent>
                <DialogContentText id={avisoId}>
                    La declaración de licencia en la aplicación no sustituye la solicitud formal ante el área jurídica de la UAM.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button type="button" variant="outlined" onClick={alCancelar} autoFocus>Cancelar</Button>
                <Button type="button" variant="contained" onClick={alAceptar}>Aceptar</Button>
            </DialogActions>
        </Dialog>
    );
}
