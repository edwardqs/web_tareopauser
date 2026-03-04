/**
 * Wrapper del panel del Jefe — lee sesión desde $user store y aplica guard de rol.
 */
import React, { useEffect } from "react";
import { useStore } from "@nanostores/react";
import { $user } from "../../lib/stores";
import TareoJefePanel from "./TareoJefePanel";

type Props = {
    anioInicial: number;
    mesInicial: number;
};

export default function TareoJefeWrapper({ anioInicial, mesInicial }: Props) {
    const user = useStore($user);

    useEffect(() => {
        if (!user) { window.location.href = "/login"; return; }
        const isJefeOrCentral = user.rol === "jefe" || (user.rol === "analista" && user.sede === "ADM. CENTRAL");
        if (!isJefeOrCentral) { window.location.href = "/"; }
    }, [user]);

    if (!user) {
        return (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
                Verificando sesión...
            </div>
        );
    }

    return <TareoJefePanel anioInicial={anioInicial} mesInicial={mesInicial} />;
}
