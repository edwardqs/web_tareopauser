import type { EmpleadoBase, TareoEmployeeConfig } from "../../lib/empleados";
import type { TareoAnalistaDetalle } from "../../lib/tareoAnalista";
import {
    calcDiasTrab,
    calcTotalHoras,
    calcSueldoProporcional,
    calcAfpOnpSimple,
    calcEssalud,
    calcVidaLey,
    calcTotalIngresos,
    calcTotalDescuentos,
    calcNetoPagar,
    round2,
} from "../../lib/formulas";

export type EmpleadoFila = EmpleadoBase & {
    config: TareoEmployeeConfig | null;
    detalle: TareoAnalistaDetalle;
};

export type VistaTab = "dias" | "ingresos" | "descuentos" | "totales";

export type TotalesRow = {
    diasTrab: number;
    totalHoras: number;
    totalIngresos: number;
    afpOnp: number;
    vidaLey: number;
    totalDesc: number;
    netoPagar: number;
    essalud: number;
};

export function calcularFila(emp: EmpleadoFila) {
    const d = emp.detalle;
    const config = emp.config;
    const sueldoBase = config?.sueldo_base ?? 0;
    const afp = config?.afp_codigo ?? "ONP";
    const tieneVidaLey = config?.vida_ley ?? false;

    const diasTrab = calcDiasTrab(d.dias_habiles, d.lic_sin_h, d.desc_med, d.susp, d.vac, d.aus_sin_just);
    const totalHoras = calcTotalHoras(d.dias_habiles, d.descanso_lab, 0, d.susp, d.lic_sin_h, d.desc_med, d.aus_sin_just, d.vel, d.vac, 0);
    const sueldoProp = calcSueldoProporcional(sueldoBase, diasTrab, 30);
    const totalAfecto = round2(sueldoProp + (d.comision || 0) + (d.bono_productiv || 0));
    const totalNoAfecto = round2((d.movilidad || 0) + (d.bono_alimento || 0));
    const totalIngresos = calcTotalIngresos(totalAfecto, totalNoAfecto);
    const baseAfecta = totalAfecto;
    const afpOnp = calcAfpOnpSimple(baseAfecta, afp);
    const vidaLey = calcVidaLey(baseAfecta, tieneVidaLey);
    const totalDesc = calcTotalDescuentos({ afp_onp: afpOnp, vida_ley: vidaLey, ret_jud: d.ret_jud });
    const netoPagar = calcNetoPagar(totalIngresos, totalDesc);
    const essalud = calcEssalud(baseAfecta);

    return { diasTrab, totalHoras, sueldoBase, sueldoProp, afp, totalAfecto, totalNoAfecto, totalIngresos, afpOnp, vidaLey, totalDesc, netoPagar, essalud };
}

// ─── Validación de rangos ───────────────────────────────────────────────────────

/** Número de días calendario del mes (28-31). */
export function diasDelMes(anio: number, mes: number): number {
    return new Date(anio, mes, 0).getDate();
}

export type ValidacionDetalle = {
    /** dias_habiles < 0 o > diasMax */
    diasHabilesInvalido: boolean;
    /** vac + lic_sin_h + susp + aus_sin_just > dias_habiles */
    sumaAusenciasExcede: boolean;
    /** true si hay al menos un error */
    tieneError: boolean;
};

/**
 * Valida los rangos de un detalle de empleado.
 * @param diasMax Número de días del mes (de diasDelMes())
 */
export function validarDetalle(
    detalle: TareoAnalistaDetalle,
    diasMax: number
): ValidacionDetalle {
    const diasHabilesInvalido = detalle.dias_habiles < 0 || detalle.dias_habiles > diasMax;
    const sumaAusencias = detalle.vac + detalle.lic_sin_h + detalle.susp + detalle.aus_sin_just;
    const sumaAusenciasExcede = sumaAusencias > detalle.dias_habiles;
    return {
        diasHabilesInvalido,
        sumaAusenciasExcede,
        tieneError: diasHabilesInvalido || sumaAusenciasExcede,
    };
}

// ─── Detalle vacío ─────────────────────────────────────────────────────────────

export function detalleVacio(tareoAnalistaId: string, empleadoId: string): TareoAnalistaDetalle {
    return {
        tareo_analista_id: tareoAnalistaId,
        empleado_id: empleadoId,
        dias_habiles: 30,
        descanso_lab: 0,
        desc_med: 0,
        vel: 0,
        vac: 0,
        lic_sin_h: 0,
        susp: 0,
        aus_sin_just: 0,
        movilidad: 0,
        comision: 0,
        bono_productiv: 0,
        bono_alimento: 0,
        ret_jud: 0,
    };
}
