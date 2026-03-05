-- 1. Agregar columna 'rol' a employees si no existe
-- Esto es necesario para que las políticas RLS funcionen y para eliminar la dependencia de 'position'
ALTER TABLE employees ADD COLUMN IF NOT EXISTS rol text DEFAULT 'analista';

-- 2. Migración inicial de datos: Asignar rol basado en 'position'
-- Ajusta los filtros ILIKE según los cargos reales de tu empresa
UPDATE employees 
SET rol = 'jefe' 
WHERE position ILIKE '%JEFE%' OR position ILIKE '%GERENTE%' OR position ILIKE '%HEAD%';

-- Asegurar que el resto sea 'analista' (ya cubierto por DEFAULT, pero por seguridad en registros existentes)
UPDATE employees 
SET rol = 'analista' 
WHERE rol IS NULL;

-- 3. Habilitar RLS en tablas principales
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareo_employee_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareos_analista ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareo_maestro ENABLE ROW LEVEL SECURITY;

-- 4. Definir Políticas de Seguridad (RLS)

-- Política para 'employees':
-- Todos los usuarios autenticados pueden ver empleados (necesario para tareo)
CREATE POLICY "Empleados visibles para todos" 
ON employees FOR SELECT 
TO authenticated 
USING (true);

-- Política para 'tareos_analista':
-- Analistas solo ven y editan sus propios tareos. Jefes ven todo (opcional) o solo suyos si también tarean.
-- Aquí asumimos que Jefes pueden ver todo o gestionar todo.
CREATE POLICY "Analistas ven sus propios tareos" 
ON tareos_analista FOR ALL 
TO authenticated 
USING (analista_id = auth.uid()::text OR (SELECT rol FROM employees WHERE id = auth.uid()::text) = 'jefe');

-- Política para 'tareo_employee_config':
-- Jefe puede ver y editar todo. Analistas lectura global (simplificación).
CREATE POLICY "Configuración visible para todos" 
ON tareo_employee_config FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Solo Jefe edita configuración" 
ON tareo_employee_config FOR ALL 
TO authenticated 
USING ((SELECT rol FROM employees WHERE id = auth.uid()::text) = 'jefe');

-- Política para 'tareo_maestro':
-- Jefe administra. Analistas solo lectura.
CREATE POLICY "Tareo Maestro lectura global" 
ON tareo_maestro FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Solo Jefe administra Tareo Maestro" 
ON tareo_maestro FOR ALL 
TO authenticated 
USING ((SELECT rol FROM employees WHERE id = auth.uid()::text) = 'jefe');
