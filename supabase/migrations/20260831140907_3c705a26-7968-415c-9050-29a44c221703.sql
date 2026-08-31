select cron.schedule(
  'auditar-anexos-diario',
  '40 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gestao-saude-sms-oriximina.vercel.app/api/public/hooks/auditar-anexos',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "438096095978c233e3338c88801c3265"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);