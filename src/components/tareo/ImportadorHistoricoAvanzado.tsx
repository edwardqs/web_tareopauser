import React, { useState, useRef } from "react";
import * as ExcelJS from "exceljs";
import { supabase } from "../../lib/supabase";
import { upsertDetallesLote, fetchDetallesAnalista, type TareoAnalistaDetalle } from "../../lib/tareoAnalista";
import { buildColumnMap, getColValue } from "../../lib/columnDetector";

interface Props {
    tareoAnalistaId: string;
    onImportComplete?: () => void;
}

interface FilaValidada {
    idLocal: number;
    numeroFilaExcel: number;
    dni: string;
    empleadoId?: string;
    nombreEmpleado?: string;
    diasTrabajados: number;
    comisiones: number;
    bonoProductividad: number;
    bonoAlimentacion: number;
    esValido: boolean;
    observacion?: string;
}

export default function ImportadorHistoricoAvanzado({ tareoAnalistaId, onImportComplete }: Props) {
    const [status, setStatus] = useState<"idle" | "loading" | "preview" | "importing" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [registrosValidos, setRegistrosValidos] = useState<FilaValidada[]>([]);
    const [registrosObservados, setRegistrosObservados] = useState<FilaValidada[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus("loading");
        setMessage("Leyendo archivo Excel e identificando empleados...");
        setRegistrosValidos([]);
        setRegistrosObservados([]);

        try {
            // 1. Leer el archivo con ExcelJS
            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);

            // Búsqueda de hoja
            let worksheet = workbook.getWorksheet("2601");
            if (!worksheet) {
                worksheet = workbook.worksheets[0];
            }
            if (!worksheet) {
                throw new Error("No se encontró ninguna hoja válida en el Excel.");
            }

            // ── Detección dinámica de columnas ──────────────────────────────
            const { columnMap, headerRowIndex, unmapped, unknown } = buildColumnMap(worksheet);

            if (unmapped.length > 0) {
                console.warn("[Importador] Campos sin columna detectada:", unmapped);
            }
            if (unknown.length > 0) {
                console.warn("[Importador] Cabeceras no reconocidas:", unknown);
            }

            // Validar campos mínimos obligatorios
            const obligatorios = ["DNI", "DIAS_TRABAJADOS"] as const;
            const faltantes = obligatorios.filter(k => columnMap[k] == null);
            if (faltantes.length > 0) {
                throw new Error(`El Excel no contiene las columnas requeridas: ${faltantes.join(", ")}`);
            }

            if (!supabase) throw new Error("Supabase no está configurado.");

            // 2. Traer todos los empleados de Supabase para el cruce
            const { data: empleadosBd, error: errorEmp } = await supabase
                .from("employees")
                .select("id, dni, full_name")
                .eq("is_active", true)
                .is("termination_date", null);

            if (errorEmp) throw new Error("Error obteniendo empleados de la BD: " + errorEmp.message);

            const mapEmpleados = new Map<string, { id: string, nombre: string }>();
            empleadosBd?.forEach(emp => {
                if (emp.dni) mapEmpleados.set(emp.dni.trim(), { id: emp.id, nombre: emp.full_name });
            });

            // 3. Helpers de conversión
            const asString = (val: unknown): string => {
                if (val === null || val === undefined) return "";
                if (typeof val === 'object' && 'result' in (val as any)) {
                    return String((val as any).result).trim();
                }
                return String(val).trim();
            };

            const parseNum = (val: unknown): number => {
                if (val === null || val === undefined) return 0;
                if (typeof val === 'number') return val;
                if (typeof val === 'object' && 'result' in (val as any)) {
                    return parseNum((val as any).result);
                }
                const parsed = parseFloat(String(val).replace(/,/g, ''));
                return isNaN(parsed) ? 0 : parsed;
            };

            // 4. Procesar las filas del Excel
            const filasProcesadas: FilaValidada[] = [];
            let idCounter = 1;

            for (let rowNumber = headerRowIndex + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
                const row = worksheet.getRow(rowNumber);

                // Leer DNI dinámicamente
                const dni = asString(getColValue(row, columnMap, "DNI"));
                if (!dni) continue;

                // Saltar filas de totales
                const nombre = asString(getColValue(row, columnMap, "NOMBRE"));
                if (/^(total|subtotal)/i.test(nombre)) continue;

                const diasTrabajados = parseNum(getColValue(row, columnMap, "DIAS_TRABAJADOS"));
                const comisiones = parseNum(getColValue(row, columnMap, "COMISIONES"));
                const bonoProductividad = parseNum(getColValue(row, columnMap, "BONO_PRODUCT"));
                const bonoAlimentacion = parseNum(getColValue(row, columnMap, "BONO_ALIMENT"));

                let matchBd = mapEmpleados.get(dni);
                let dniFinal = dni;

                // Recuperar ceros iniciales que Excel puede haber eliminado
                if (!matchBd && /^\d+$/.test(dni) && dni.length < 8) {
                    const paddedDni = dni.padStart(8, '0');
                    matchBd = mapEmpleados.get(paddedDni);
                    if (matchBd) dniFinal = paddedDni;
                }

                filasProcesadas.push({
                    idLocal: idCounter++,
                    numeroFilaExcel: rowNumber,
                    dni: dniFinal,
                    empleadoId: matchBd?.id,
                    nombreEmpleado: matchBd?.nombre,
                    diasTrabajados,
                    comisiones,
                    bonoProductividad,
                    bonoAlimentacion,
                    esValido: !!matchBd,
                    observacion: matchBd ? undefined : "DNI no encontrado en la base de datos",
                });
            }

            // 5. Separar válidos y observados
            setRegistrosValidos(filasProcesadas.filter(f => f.esValido));
            setRegistrosObservados(filasProcesadas.filter(f => !f.esValido));
            setStatus("preview");
            setMessage("Análisis completado. Revisa los resultados antes de confirmar.");

        } catch (error: any) {
            console.error("Error importando excel:", error);
            setStatus("error");
            setMessage(error.message || "Error desconocido al procesar el archivo.");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleConfirmImport = async () => {
        if (registrosValidos.length === 0 && registrosObservados.length === 0) return;
        setStatus("importing");
        setMessage("Guardando en base de datos...");

        try {
            const detallesActuales = await fetchDetallesAnalista(tareoAnalistaId);
            const mapActuales = new Map(detallesActuales.map(d => [d.empleado_id, d]));

            if (registrosValidos.length > 0) {
                const detalles: TareoAnalistaDetalle[] = registrosValidos.map(reg => {
                    const actual = mapActuales.get(reg.empleadoId!);
                    return {
                        tareo_analista_id: tareoAnalistaId,
                        empleado_id: reg.empleadoId!,
                        dias_habiles: reg.diasTrabajados,
                        descanso_lab: actual?.descanso_lab ?? 0,
                        desc_med: actual?.desc_med ?? 0,
                        vel: actual?.vel ?? 0,
                        vac: actual?.vac ?? 0,
                        lic_sin_h: actual?.lic_sin_h ?? 0,
                        susp: actual?.susp ?? 0,
                        aus_sin_just: actual?.aus_sin_just ?? 0,
                        movilidad: actual?.movilidad ?? 0,
                        comision: reg.comisiones || 0,
                        bono_productiv: reg.bonoProductividad || 0,
                        bono_alimento: reg.bonoAlimentacion || 0,
                        ret_jud: actual?.ret_jud ?? 0,
                    };
                });

                const { ok, error } = await upsertDetallesLote(detalles);
                if (!ok) throw new Error("Fallo al insertar detalles válidos: " + error);
            }

            if (registrosObservados.length > 0) {
                const obsAInsertar = registrosObservados.map(obs => ({
                    tareo_analista_id: tareoAnalistaId,
                    dni_erroneo: obs.dni,
                    fila_excel: obs.numeroFilaExcel,
                    detalles_json: {
                        dias_trabajados: obs.diasTrabajados,
                        comisiones: obs.comisiones,
                        bono_productividad: obs.bonoProductividad,
                        bono_alimentacion: obs.bonoAlimentacion
                    },
                    estado: "Pendiente"
                }));

                if (!supabase) throw new Error("Supabase null");
                const { error: obsError } = await supabase
                    .from("observaciones_importacion")
                    .insert(obsAInsertar);
                if (obsError) console.warn("Advertencia al guardar observaciones (¿existe la tabla?):", obsError);
            }

            setStatus("success");
            setMessage("Importación completada con éxito.");
            if (onImportComplete) onImportComplete();

        } catch (error: any) {
            console.error("Error al guardar la importación:", error);
            setStatus("error");
            setMessage(error.message || "Fallo al guardar en la base de datos.");
        }
    };

    return (
        <div className="card" style={{ marginBottom: "20px" }}>
            <div className="card__header">
                <div className="card__title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, marginRight: 8, display: "inline-block", verticalAlign: "middle" }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Importador Histórico
                </div>
                <div className="card__actions">
                    {status === "idle" || status === "error" || status === "success" ? (
                        <label className="btn btn--secondary" style={{ cursor: "pointer", fontSize: "13px" }}>
                            Subir archivo .xlsx
                            <input
                                type="file"
                                accept=".xlsx"
                                style={{ display: "none" }}
                                onChange={handleFileUpload}
                                ref={fileInputRef}
                            />
                        </label>
                    ) : null}
                    {status === "preview" && (
                        <button className="btn btn--primary" onClick={handleConfirmImport} style={{ fontSize: "13px" }}>
                            Confirmar Importación
                        </button>
                    )}
                </div>
            </div>

            <div style={{ padding: "16px" }}>
                {status === "loading" || status === "importing" ? (
                    <div style={{ padding: "30px", textAlign: "center", color: "var(--color-text-muted)" }}>
                        <div className="spinner" style={{ margin: "0 auto 12px", width: 30, height: 30, border: "3px solid transparent", borderTopColor: "var(--color-primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                        <span>{message}</span>
                        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : null}

                {status === "error" && (
                    <div style={{ padding: "12px", background: "rgba(248,113,113,0.1)", color: "var(--color-danger)", borderRadius: "6px", fontSize: "14px", border: "1px solid rgba(248,113,113,0.3)" }}>
                        ⚠️ {message}
                    </div>
                )}

                {status === "success" && (
                    <div style={{ padding: "12px", background: "rgba(52,211,153,0.1)", color: "var(--color-success)", borderRadius: "6px", fontSize: "14px", border: "1px solid rgba(52,211,153,0.3)" }}>
                        ✅ {message}
                    </div>
                )}

                {status === "preview" && (
                    <div>
                        <p style={{ fontSize: "14px", color: "var(--color-text-muted)", marginBottom: "16px" }}>{message}</p>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                            {/* Panel Válidos */}
                            <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: "8px", overflow: "hidden" }}>
                                <div style={{ background: "rgba(52,211,153,0.1)", borderBottom: "1px solid var(--color-border)", padding: "10px 14px", fontWeight: 600, color: "var(--color-success)", display: "flex", justifyContent: "space-between" }}>
                                    <span>Listos para importar</span>
                                    <span style={{ background: "var(--color-success)", color: "#fff", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>{registrosValidos.length}</span>
                                </div>
                                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                                    {registrosValidos.length === 0 ? (
                                        <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>No hay registros válidos.</div>
                                    ) : (
                                        <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                                            <thead style={{ background: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                                                <tr>
                                                    <th style={{ padding: "6px 12px", textAlign: "left" }}>DNI</th>
                                                    <th style={{ padding: "6px 12px", textAlign: "left" }}>Nombre</th>
                                                    <th style={{ padding: "6px 4px", textAlign: "center" }}>Días</th>
                                                    <th style={{ padding: "6px 4px", textAlign: "center" }}>Comis.</th>
                                                    <th style={{ padding: "6px 4px", textAlign: "center" }}>B.Prod</th>
                                                    <th style={{ padding: "6px 4px", textAlign: "center" }}>B.Alim</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {registrosValidos.map(r => (
                                                    <tr key={r.idLocal} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                                        <td style={{ padding: "6px 12px" }}>{r.dni}</td>
                                                        <td style={{ padding: "6px 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "120px" }}>{r.nombreEmpleado}</td>
                                                        <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600 }}>{r.diasTrabajados}</td>
                                                        <td style={{ padding: "6px 4px", textAlign: "center", color: r.comisiones > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>{r.comisiones || "—"}</td>
                                                        <td style={{ padding: "6px 4px", textAlign: "center", color: r.bonoProductividad > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>{r.bonoProductividad || "—"}</td>
                                                        <td style={{ padding: "6px 4px", textAlign: "center", color: r.bonoAlimentacion > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>{r.bonoAlimentacion || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>

                            {/* Panel Observados */}
                            <div style={{ background: "#fff", border: "1px solid var(--color-border)", borderRadius: "8px", overflow: "hidden" }}>
                                <div style={{ background: "rgba(248,113,113,0.1)", borderBottom: "1px solid var(--color-border)", padding: "10px 14px", fontWeight: 600, color: "var(--color-danger)", display: "flex", justifyContent: "space-between" }}>
                                    <span>Observaciones (No hallados en BD)</span>
                                    <span style={{ background: "var(--color-danger)", color: "#fff", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>{registrosObservados.length}</span>
                                </div>
                                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                                    {registrosObservados.length === 0 ? (
                                        <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>No hay observaciones. ¡Todo perfecto!</div>
                                    ) : (
                                        <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                                            <thead style={{ background: "var(--color-bg)", borderBottom: "1px solid var(--color-border)" }}>
                                                <tr>
                                                    <th style={{ padding: "6px 12px", textAlign: "left" }}>Fila</th>
                                                    <th style={{ padding: "6px 12px", textAlign: "left" }}>DNI</th>
                                                    <th style={{ padding: "6px 4px", textAlign: "center" }}>Días</th>
                                                    <th style={{ padding: "6px 4px", textAlign: "center" }}>Comis.</th>
                                                    <th style={{ padding: "6px 4px", textAlign: "center" }}>B.Prod</th>
                                                    <th style={{ padding: "6px 4px", textAlign: "center" }}>B.Alim</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {registrosObservados.map(r => (
                                                    <tr key={r.idLocal} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                                        <td style={{ padding: "6px 12px" }}>#{r.numeroFilaExcel}</td>
                                                        <td style={{ padding: "6px 12px", color: "var(--color-danger)", fontWeight: 600 }}>{r.dni}</td>
                                                        <td style={{ padding: "6px 4px", textAlign: "center" }}>{r.diasTrabajados}</td>
                                                        <td style={{ padding: "6px 4px", textAlign: "center" }}>{r.comisiones || "—"}</td>
                                                        <td style={{ padding: "6px 4px", textAlign: "center" }}>{r.bonoProductividad || "—"}</td>
                                                        <td style={{ padding: "6px 4px", textAlign: "center" }}>{r.bonoAlimentacion || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}