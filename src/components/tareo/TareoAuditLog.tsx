import React, { useState, useEffect } from "react";
import { fetchAuditLog, type AuditLogEntry } from "../../lib/tareoAnalista";
import type { EmpleadoFila } from "./tareoAnalistaTypes";

// Etiquetas legibles para cada campo de la planilla
const CAMPO_LABELS: Record<string, string> = {
    dias_habiles: "Días Hábiles",
    descanso_lab: "Descanso Lab.",
    desc_med: "Desc. Médico",
    vel: "VEL",
    vac: "Vacaciones",
    lic_sin_h: "Lic. S/H",
    susp: "Suspensión",
    aus_sin_just: "Aus. S/J",
    movilidad: "Movilidad",
    comision: "Comisión",
    bono_productiv: "Bono Productiv.",
    bono_alimento: "Bono Alimento",
    ret_jud: "Ret. Judicial",
    estado: "Estado",
};

const ACCION_LABELS: Record<string, string> = {
    campo_editado: "Edición",
    registro_creado: "Registro creado",
    estado_cambiado: "Cambio de estado",
};

function formatFecha(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("es-PE", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

type Props = {
    tareoAnalistaId: string;
    empleados: EmpleadoFila[];
};

export default function TareoAuditLog({ tareoAnalistaId, empleados }: Props) {
    const [abierto, setAbierto] = useState(false);
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!abierto || loaded) return;
        fetchAuditLog(tareoAnalistaId).then((data) => {
            setEntries(data);
            setLoaded(true);
        });
    }, [abierto, tareoAnalistaId, loaded]);

    // Recargar si cambia el tareoAnalistaId
    useEffect(() => {
        setLoaded(false);
        setEntries([]);
    }, [tareoAnalistaId]);

    const empMap = new Map(empleados.map((e) => [e.id, e.full_name]));

    return (
        <div style={{ marginTop: "24px", borderTop: "1px solid var(--color-border)", paddingTop: "12px" }}>
            <button
                className="btn btn--ghost"
                style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
                onClick={() => setAbierto((v) => !v)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                {abierto ? "Ocultar" : "Ver"} historial de cambios
                {!abierto && loaded && entries.length > 0 && (
                    <span className="badge badge--blue" style={{ fontSize: "10px", padding: "1px 6px" }}>
                        {entries.length}
                    </span>
                )}
            </button>

            {abierto && (
                <div style={{ marginTop: "12px" }}>
                    {!loaded ? (
                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", padding: "12px 0" }}>
                            Cargando historial...
                        </div>
                    ) : entries.length === 0 ? (
                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", padding: "12px 0" }}>
                            Sin cambios registrados aún.
                        </div>
                    ) : (
                        <div className="table-wrapper" style={{ maxHeight: "320px", overflowY: "auto" }}>
                            <table className="data-table" style={{ fontSize: "11px" }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: "130px" }}>Fecha</th>
                                        <th>Acción</th>
                                        <th>Empleado</th>
                                        <th>Campo</th>
                                        <th>Anterior</th>
                                        <th>Nuevo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((e) => (
                                        <tr key={e.id}>
                                            <td className="text-muted mono" style={{ fontSize: "10px", whiteSpace: "nowrap" }}>
                                                {formatFecha(e.created_at)}
                                            </td>
                                            <td>
                                                <span className={`badge ${e.accion === "estado_cambiado" ? "badge--blue" : e.accion === "registro_creado" ? "badge--green" : "badge--gray"}`} style={{ fontSize: "10px" }}>
                                                    {ACCION_LABELS[e.accion] ?? e.accion}
                                                </span>
                                            </td>
                                            <td style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {e.empleado_id ? (empMap.get(e.empleado_id) ?? e.empleado_id) : <span className="text-muted">—</span>}
                                            </td>
                                            <td className="text-muted">
                                                {e.campo ? (CAMPO_LABELS[e.campo] ?? e.campo) : "—"}
                                            </td>
                                            <td style={{ color: "var(--color-danger)" }}>
                                                {e.valor_anterior ?? "—"}
                                            </td>
                                            <td style={{ color: "var(--color-success)", fontWeight: 600 }}>
                                                {e.valor_nuevo ?? "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
