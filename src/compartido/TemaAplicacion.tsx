"use client";

import type { ReactNode } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";

const tema = createTheme({
    cssVariables: true,
    palette: {
        mode: "light",
        primary: { main: "#008332", dark: "#006826", light: "#e5f0e6", contrastText: "#ffffff" },
        secondary: { main: "#005d29", contrastText: "#ffffff" },
        error: { main: "#b42318", dark: "#912018", light: "#fef3f2" },
        warning: { main: "#946200", light: "#fff8e6" },
        success: { main: "#008332", light: "#e5f0e6" },
        background: { default: "#f6f5f0", paper: "#ffffff" },
        text: { primary: "#1a1a1a", secondary: "#5f5f5f", disabled: "#767676" },
        divider: "#dedede",
    },
    typography: {
        fontFamily: "var(--font-geist-sans), sans-serif",
        button: { fontSize: "0.875rem", fontWeight: 600, textTransform: "none" },
    },
    shape: { borderRadius: 8 },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    minHeight: "var(--alto-control)",
                    padding: "var(--padding-control)",
                    borderRadius: "var(--radio-control)",
                    fontSize: "var(--tamano-texto-secundario)",
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: { backgroundColor: "var(--color-surface)", borderRadius: "var(--radio-control)" },
                notchedOutline: { borderColor: "var(--color-border)" },
            },
        },
        MuiDialog: { styleOverrides: { paper: { borderRadius: "var(--radio-panel)" } } },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    padding: "var(--padding-panel)",
                    color: "var(--color-secondary)",
                    fontSize: "var(--tamano-titulo-seccion)",
                    fontWeight: 700,
                    lineHeight: "var(--interlineado-titulo-pagina)",
                },
            },
        },
        MuiDialogContent: { styleOverrides: { root: { padding: "var(--padding-panel)" } } },
        MuiDialogActions: { styleOverrides: { root: { padding: "var(--padding-panel)" } } },
    },
});

export default function TemaAplicacion({ children }: { children: ReactNode }) {
    return <ThemeProvider theme={tema}>{children}</ThemeProvider>;
}
