-- =====================================================================
-- Optimización de base de datos
--  1) Índices para claves foráneas y columnas que la app filtra/ordena.
--     Postgres NO indexa automáticamente las claves foráneas.
--  2) Políticas RLS: envolver auth.uid() y es_administrador_actual() en
--     (SELECT ...) para que se evalúen una vez por consulta y no por fila.
-- Ejecutar completo en Supabase > SQL Editor. Es idempotente: omite
-- columnas inexistentes e índices equivalentes ya creados.
-- =====================================================================

-- 1) ÍNDICES ------------------------------------------------------------
DO $idx$
DECLARE
  spec text[];
  v_table text;
  v_cols text;
  v_where text;
  v_name text;
  v_col_names text[];
  v_missing text;
  v_first_cols int2[];
BEGIN
  -- {tabla, columnas (con orden), condición opcional para índice parcial}
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    -- Catálogo
    ['productos',            'tienda_id, creado_en DESC',   ''],
    ['productos',            'categoria_id',                ''],
    ['productos',            'destacado, vistas_count DESC', 'disponible = true'],
    ['tiendas',              'usuario_id',                  ''],
    ['tiendas',              'estado',                      ''],
    ['tiendas',              'distrito_id',                 ''],
    ['tiendas',              'slug',                        ''],
    ['distritos',            'departamento_id',             ''],
    ['producto_tags',        'tag_id',                      ''],
    -- Usuario
    ['notificaciones',       'usuario_id, created_at DESC', ''],
    ['notificaciones',       'usuario_id',                  'leida = false'],
    ['favoritos',            'usuario_id',                  ''],
    ['favoritos',            'producto_id',                 ''],
    ['favoritos',            'tienda_id',                   ''],
    ['historial_busquedas',  'usuario_id, fecha_hora DESC', ''],
    ['interacciones_clics',  'usuario_id, fecha_hora DESC', ''],
    ['interacciones_clics',  'producto_id',                 ''],
    ['interacciones_clics',  'tienda_id',                   ''],
    ['recomendaciones_ia',   'usuario_id',                  ''],
    ['recomendaciones_ia',   'producto_id',                 ''],
    ['auditorias',           'usuario_id, fecha_hora DESC', ''],
    ['auditorias',           'fecha_hora DESC',             ''],
    -- Ventas y facturación
    ['ventas',               'tienda_id, created_at DESC',  ''],
    ['ventas',               'pedido_id',                   ''],
    ['ventas',               'cliente_id',                  ''],
    ['venta_detalles',       'venta_id',                    ''],
    ['venta_detalles',       'producto_id',                 ''],
    ['facturas',             'tienda_id, fecha DESC',       ''],
    ['facturas',             'pedido_id',                   ''],
    ['facturas',             'venta_id',                    ''],
    ['facturas',             'cliente_id',                  ''],
    ['factura_detalles',     'factura_id',                  ''],
    ['factura_detalles',     'producto_id',                 ''],
    ['pedido_detalles',      'producto_id',                 ''],
    ['pedidos',              'distrito_id',                 ''],
    ['suscripciones',        'tienda_id',                   '']
  ]
  LOOP
    v_table := spec[1];
    v_cols  := spec[2];
    v_where := spec[3];

    IF to_regclass('public.' || v_table) IS NULL THEN
      RAISE NOTICE 'OMITIDO %: la tabla no existe.', v_table;
      CONTINUE;
    END IF;

    SELECT array_agg(btrim(split_part(btrim(c), ' ', 1)) ORDER BY ord)
      INTO v_col_names
    FROM unnest(string_to_array(v_cols, ',')) WITH ORDINALITY AS t(c, ord);

    SELECT string_agg(col, ', ')
      INTO v_missing
    FROM unnest(v_col_names) AS col
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema = 'public' AND ic.table_name = v_table AND ic.column_name = col
    );
    IF v_missing IS NOT NULL THEN
      RAISE NOTICE 'OMITIDO %(%): no existen las columnas %.', v_table, v_cols, v_missing;
      CONTINUE;
    END IF;

    -- ¿Ya hay un índice (no parcial) que empiece por las mismas columnas?
    SELECT array_agg(a.attnum ORDER BY array_position(v_col_names, a.attname::text))
      INTO v_first_cols
    FROM pg_attribute a
    WHERE a.attrelid = ('public.' || v_table)::regclass
      AND a.attname::text = ANY (v_col_names);

    IF v_where = '' AND EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = ('public.' || v_table)::regclass
        AND i.indpred IS NULL
        AND (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(v_first_cols, 1)] = v_first_cols
    ) THEN
      RAISE NOTICE 'YA EXISTE %(%).', v_table, v_cols;
      CONTINUE;
    END IF;

    v_name := left(
      v_table || '_' || array_to_string(v_col_names, '_')
        || CASE WHEN v_where <> '' THEN '_parcial' ELSE '' END || '_idx',
      63
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)%s',
      v_name, v_table, v_cols,
      CASE WHEN v_where <> '' THEN ' WHERE ' || v_where ELSE '' END
    );
    RAISE NOTICE 'CREADO % ON %(%)', v_name, v_table, v_cols;
  END LOOP;
END
$idx$;

-- 2) POLÍTICAS RLS ---------------------------------------------------------
-- auth.uid() y es_administrador_actual() sin (SELECT ...) se recalculan por
-- cada fila. Envueltas, Postgres las evalúa una sola vez por consulta.
DO $rls$
DECLARE
  pol record;
  v_using text;
  v_check text;
  fix_expr text;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual ~ 'auth\.uid\(\)' AND qual !~ 'SELECT auth\.uid\(\)')
        OR (with_check ~ 'auth\.uid\(\)' AND with_check !~ 'SELECT auth\.uid\(\)')
        OR (qual ~ 'es_administrador_actual\(\)' AND qual !~ 'SELECT (public\.)?es_administrador_actual\(\)')
        OR (with_check ~ 'es_administrador_actual\(\)' AND with_check !~ 'SELECT (public\.)?es_administrador_actual\(\)')
      )
  LOOP
    v_using := pol.qual;
    v_check := pol.with_check;

    FOREACH fix_expr IN ARRAY ARRAY['using', 'check'] LOOP
      IF fix_expr = 'using' AND v_using IS NOT NULL THEN
        IF v_using !~ 'SELECT auth\.uid\(\)' THEN
          v_using := regexp_replace(v_using, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
        END IF;
        IF v_using !~ 'SELECT (public\.)?es_administrador_actual\(\)' THEN
          v_using := regexp_replace(v_using, '(public\.)?es_administrador_actual\(\)', '(SELECT public.es_administrador_actual())', 'g');
        END IF;
      ELSIF fix_expr = 'check' AND v_check IS NOT NULL THEN
        IF v_check !~ 'SELECT auth\.uid\(\)' THEN
          v_check := regexp_replace(v_check, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
        END IF;
        IF v_check !~ 'SELECT (public\.)?es_administrador_actual\(\)' THEN
          v_check := regexp_replace(v_check, '(public\.)?es_administrador_actual\(\)', '(SELECT public.es_administrador_actual())', 'g');
        END IF;
      END IF;
    END LOOP;

    EXECUTE format(
      'ALTER POLICY %I ON %I.%I%s%s',
      pol.policyname, pol.schemaname, pol.tablename,
      CASE WHEN v_using IS NOT NULL THEN ' USING (' || v_using || ')' ELSE '' END,
      CASE WHEN v_check IS NOT NULL THEN ' WITH CHECK (' || v_check || ')' ELSE '' END
    );
    RAISE NOTICE 'POLÍTICA OPTIMIZADA %.%', pol.tablename, pol.policyname;
  END LOOP;
END
$rls$;

-- 3) Estadísticas actualizadas para el planificador.
ANALYZE;

-- 4) Resumen: índices de la app.
SELECT tablename AS tabla, indexname AS indice
FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE '%\_idx' ESCAPE '\'
ORDER BY tablename, indexname;
