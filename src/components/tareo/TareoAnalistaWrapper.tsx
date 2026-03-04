/**
 * Wrapper que lee la sesión del usuario desde sessionStorage y
 * monta TareoAnalistaGrid con los props correctos.
 * Se usa con client:only="react" para evitar SSR.
 */
import React, { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { $periodo, $user } from "../../lib/stores";
import TareoAnalistaGrid from "./TareoAnalistaGrid";

type Props = {
    anio?: number;
    mes?: number;
    mesLabel?: string;
    /** Si se pasa, es vista del Jefe viendo el tareo de un analista */
    tareoAnalistaId?: string;
    readonly?: boolean;
};

export default function TareoAnalistaWrapper({ anio, mes, mesLabel, tareoAnalistaId, readonly }: Props) {
    const { anio: storeAnio, mes: storeMes } = useStore($periodo);
    const user = useStore($user);

    const isClient = typeof window !== "undefined";
    const searchParams = isClient ? new URLSearchParams(window.location.search) : null;
    const finalId = tareoAnalistaId || (searchParams?.get("id") ?? undefined);

    const currentAnio = new Date().getFullYear();
    const currentMes  = new Date().getMonth() + 1;

    // Si es vista del Jefe (finalId existe), tomar anio/mes de URL o props; si no, usar store global.
    const finalAnio = finalId
        ? (anio ?? (searchParams?.get("anio") ? parseInt(searchParams.get("anio")!) : currentAnio))
        : storeAnio;
    const finalMes = finalId
        ? (mes ?? (searchParams?.get("mes") ? parseInt(searchParams.get("mes")!) : currentMes))
        : storeMes;
    const finalMesLabel = mesLabel ?? (isClient ? "Tareo seleccionado" : "");

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) {
            window.location.href = "/login";
            return;
        }
        // Guard: si es jefe puro y no trae el ID desde la URL o props → redirigir
        if (user.rol === "jefe" && !finalId) {
            window.location.href = "/";
        }
    }, [user, finalId]);

    if (error) {
        return <div style={{ padding: "20px", color: "var(--color-danger)" }}>⚠️ {error}</div>;
    }

    if (!user) {
        return (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
                Verificando sesión...
            </div>
        );
    }

    return (
        <TareoAnalistaGrid
            analistaId={user.id}
            analistaNombre={user.nombre}
            sede={finalId ? "" : user.sede}
            businessUnit={finalId ? null : user.business_unit}
            anio={finalAnio}
            mes={finalMes}
            mesLabel={finalMesLabel}
            tareoAnalistaId={finalId}
            readonly={readonly ?? false}
        />
    );
}
