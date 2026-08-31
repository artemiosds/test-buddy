select cron.unschedule('mural-lembretes-diario') where exists (select 1 from cron.job where jobname = 'mural-lembretes-diario');

select cron.schedule(
  'mural-lembretes-diario',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gestao-saude-sms-oriximina.vercel.app/api/public/hooks/mural-lembretes',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "438096095978c233e3338c88801c3266861329a07ddd362a26576a4293f36f28"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);