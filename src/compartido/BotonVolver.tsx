import type { ReactNode } from "react";
import Link from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import styles from "./BotonVolver.module.css";

type BotonVolverProps = {
    children: ReactNode;
    className?: string;
} & (
    | { href: string }
    | { onClick: () => void; disabled?: boolean }
);

export default function BotonVolver(props: BotonVolverProps) {
    const className = `${styles.volver} ${props.className ?? ""}`;
    const contenido = (
        <>
            <ArrowBackIcon className={styles.icono} aria-hidden="true" />
            <span>{props.children}</span>
        </>
    );

    if ("href" in props) {
        return <Link href={props.href} className={className}>{contenido}</Link>;
    }

    return (
        <button type="button" className={className} onClick={props.onClick} disabled={props.disabled}>
            {contenido}
        </button>
    );
}
