UPDATE public.municipio_config
SET parametros = jsonb_set(parametros, '{financeiro,tributos,iss}', '{"regime":"contratados","somente_autonomo":false}'::jsonb, true)
WHERE id = 'd2a00e36-783d-4536-bbcc-d04aaa1bd49f';