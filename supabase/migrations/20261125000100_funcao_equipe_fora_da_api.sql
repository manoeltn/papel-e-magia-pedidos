-- Tira a função de checagem da equipe do esquema público (não fica exposta na API)
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;
alter function public.eh_da_equipe() set schema privado;
