-- Apply manually to the TEST project only after deploying and testing maintenance.
-- Requires pg_cron, pg_net and Vault enabled through Supabase Integrations.
-- Create Vault secrets seollek_project_url and seollek_maintenance_secret in the dashboard first.
-- Never paste actual secrets into this repository or command history.
do $$begin
 if not exists(select 1 from vault.decrypted_secrets where name='seollek_project_url' and decrypted_secret like 'https://%')
 or not exists(select 1 from vault.decrypted_secrets where name='seollek_maintenance_secret' and length(decrypted_secret)>=32)
 then raise exception 'Configure and verify the real Vault secrets first';end if;
 if exists(select 1 from cron.job where jobname='seollek-cleanup') then raise exception 'Job already exists; inspect it instead of creating a duplicate';end if;
end $$;
select cron.schedule('seollek-cleanup','*/5 * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='seollek_project_url')||'/functions/v1/maintenance',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='seollek_maintenance_secret')),
  body:='{"action":"maintenance"}'::jsonb,
  timeout_milliseconds:=10000
 );
$job$);
