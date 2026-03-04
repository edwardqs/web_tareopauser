-- ============================================================
-- RPC: consolidar_tareo_maestro
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Consolida todos los tareos de analistas (estado: cerrado u
-- obs_levantadas) en el Tareo Maestro de forma ATÓMICA.
--
-- PL/pgSQL garantiza que el DELETE + INSERT ocurren dentro de
-- una sola transacción: si algo falla, el estado anterior se
-- restaura automáticamente (rollback implícito).
--
-- Uso desde TypeScript:
--   await supabase.rpc('consolidar_tareo_maestro', { p_anio: 2026, p_mes: 3 })
-- ============================================================

CREATE OR REPLACE FUNCTION consolidar_tareo_maestro(
    p_anio INT,
    p_mes  INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER          -- Ejecuta con permisos del owner, bypassea RLS
SET search_path = public
AS $$
DECLARE
    v_maestro_id UUID;
    v_filas      INT := 0;
BEGIN
    -- ── 1. Obtener o crear el header del Tareo Maestro ──────────────────────
    SELECT id INTO v_maestro_id
    FROM   tareo_maestro
    WHERE  anio = p_anio AND mes = p_mes
    LIMIT  1;

    IF v_maestro_id IS NULL THEN
        INSERT INTO tareo_maestro (anio, mes, estado)
        VALUES (p_anio, p_mes, 'abierto')
        RETURNING id INTO v_maestro_id;
    ELSE
        UPDATE tareo_maestro
        SET    updated_at = NOW()
        WHERE  id = v_maestro_id;
    END IF;

    -- ── 2. Borrar consolidación anterior (dentro de la misma transacción) ──
    DELETE FROM tareo_maestro_detalle
    WHERE  tareo_maestro_id = v_maestro_id;

    -- ── 3. Insertar filas de todos los tareos listos ────────────────────────
    --       (estado: 'cerrado' u 'obs_levantadas')
    --       Incluye comision, bono_productiv, bono_alimento que la versión
    --       anterior en TypeScript omitía por error.
    INSERT INTO tareo_maestro_detalle (
        tareo_maestro_id,
        empleado_id,
        sede,
        business_unit,
        dias_habiles,
        descanso_lab,
        desc_med,
        vel,
        vac,
        lic_sin_h,
        susp,
        aus_sin_just,
        movilidad,
        comision,
        bono_productiv,
        bono_alimento,
        ret_jud,
        origen_analista_id
    )
    SELECT
        v_maestro_id,
        d.empleado_id,
        ta.sede,
        ta.business_unit,
        d.dias_habiles,
        d.descanso_lab,
        d.desc_med,
        d.vel,
        d.vac,
        d.lic_sin_h,
        d.susp,
        d.aus_sin_just,
        d.movilidad,
        COALESCE(d.comision,       0),
        COALESCE(d.bono_productiv, 0),
        COALESCE(d.bono_alimento,  0),
        COALESCE(d.ret_jud,        0),
        ta.id
    FROM  tareos_analista ta
    JOIN  tareos_analista_detalle d ON d.tareo_analista_id = ta.id
    WHERE ta.anio  = p_anio
      AND ta.mes   = p_mes
      AND ta.estado IN ('cerrado', 'obs_levantadas');

    GET DIAGNOSTICS v_filas = ROW_COUNT;

    -- ── 4. Marcar el maestro como concretado ────────────────────────────────
    UPDATE tareo_maestro
    SET    estado     = 'concretado',
           updated_at = NOW()
    WHERE  id = v_maestro_id;

    RETURN jsonb_build_object(
        'ok',         true,
        'maestro_id', v_maestro_id,
        'filas',      v_filas
    );

EXCEPTION WHEN OTHERS THEN
    -- PL/pgSQL hace rollback automático de todo lo anterior
    RETURN jsonb_build_object(
        'ok',    false,
        'error', SQLERRM
    );
END;
$$;

-- Dar permisos de ejecución al rol anon (cliente Supabase)
GRANT EXECUTE ON FUNCTION consolidar_tareo_maestro(INT, INT) TO anon;
GRANT EXECUTE ON FUNCTION consolidar_tareo_maestro(INT, INT) TO authenticated;
