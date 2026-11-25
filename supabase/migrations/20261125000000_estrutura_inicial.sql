-- App de pedidos Volta às Aulas 2027 - Papel & Magia
-- Estrutura inicial: equipe autorizada, pedidos, clientes e configurações.
-- Os documentos guardam o mesmo formato JSON usado na versão 1.0 do app.

-- 1. Equipe: só estes e-mails podem criar conta e ver os dados
create table public.equipe (
  email text primary key check (email = lower(email)),
  nome text not null,
  criado_em timestamptz not null default now()
);
alter table public.equipe enable row level security;

create or replace function public.eh_da_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.equipe e
    where e.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.eh_da_equipe() from public, anon;
grant execute on function public.eh_da_equipe() to authenticated;

create policy "equipe ve a equipe" on public.equipe
  for select to authenticated using ((select public.eh_da_equipe()));

-- 2. Cadastro: bloqueia e-mails fora da equipe e já confirma os da equipe
create or replace function public.antes_de_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.equipe e where e.email = lower(new.email)) then
    raise exception 'Este e-mail não tem acesso ao app da Papel & Magia.';
  end if;
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;
revoke all on function public.antes_de_criar_usuario() from public, anon, authenticated;

create trigger antes_de_criar_usuario
  before insert on auth.users
  for each row execute function public.antes_de_criar_usuario();

-- 3. Tabelas de dados (um documento JSON por linha)
create or replace function public.marcar_atualizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['pedidos', 'clientes', 'config'] loop
    execute format($f$
      create table public.%1$I (
        id text primary key,
        data jsonb not null default '{}'::jsonb,
        criado_em timestamptz not null default now(),
        atualizado_em timestamptz not null default now(),
        atualizado_por uuid default auth.uid()
      );
      alter table public.%1$I enable row level security;
      create policy "equipe le" on public.%1$I for select to authenticated using ((select public.eh_da_equipe()));
      create policy "equipe cria" on public.%1$I for insert to authenticated with check ((select public.eh_da_equipe()));
      create policy "equipe altera" on public.%1$I for update to authenticated using ((select public.eh_da_equipe())) with check ((select public.eh_da_equipe()));
      create policy "equipe apaga" on public.%1$I for delete to authenticated using ((select public.eh_da_equipe()));
      create trigger marcar_atualizacao before update on public.%1$I
        for each row execute function public.marcar_atualizacao();
      alter publication supabase_realtime add table public.%1$I;
    $f$, t);
  end loop;
end;
$$;

-- 4. Atualização parcial (junta os campos novos no documento, sem apagar os outros)
create or replace function public.mesclar_documento(tabela text, doc_id text, campos jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tabela not in ('pedidos', 'clientes', 'config') then
    raise exception 'Tabela inválida';
  end if;
  execute format('update public.%I set data = data || $1 where id = $2', tabela) using campos, doc_id;
  if not found then
    raise exception 'Documento não encontrado' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.mesclar_documento(text, text, jsonb) from public, anon;
grant execute on function public.mesclar_documento(text, text, jsonb) to authenticated;

-- 5. Equipe autorizada (25/11/2026)
insert into public.equipe (email, nome) values
  ('maninhoservicosdigitais@gmail.com', 'Manoel'),
  ('papelemagia@icloud.com', 'Paola');
