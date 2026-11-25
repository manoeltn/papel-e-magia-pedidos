-- EXECUTE não altera FOUND no PL/pgSQL; usa GET DIAGNOSTICS para saber se achou o documento
create or replace function public.mesclar_documento(tabela text, doc_id text, campos jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare n integer;
begin
  if tabela not in ('pedidos', 'clientes', 'config') then
    raise exception 'Tabela inválida';
  end if;
  execute format('update public.%I set data = data || $1 where id = $2', tabela) using campos, doc_id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Documento não encontrado' using errcode = 'P0002';
  end if;
end;
$$;
