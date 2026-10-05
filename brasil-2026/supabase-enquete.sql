-- Enquete "Qual é o maior problema do Brasil hoje?" — guia Brasil 2026 em Raio-X
-- Cole este script inteiro no Supabase: menu SQL Editor > New query > Run.
--
-- Privacidade: não guarda nome, e-mail, login nem IP. Guarda só a opção escolhida,
-- um identificador aleatório do aparelho (para impedir voto duplo) e um hash
-- irreversível do IP com sal secreto (só para barrar votação automatizada em massa).
-- Ninguém de fora lê a tabela: o site só consegue chamar as funções votar() e parcial().

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.votos (
  id          bigint generated always as identity primary key,
  dispositivo uuid        not null unique,
  opcao       text        not null check (opcao in
                ('seguranca','saude','economia','emprego','corrupcao','educacao','fome','ambiente','outro')),
  ip_hash     text,
  criado_em   timestamptz not null default now()
);
create index if not exists votos_ip_hash_criado_em on public.votos (ip_hash, criado_em);

-- Sal secreto, gerado aleatoriamente no seu projeto e nunca exposto.
create table if not exists public.enquete_sal (sal text not null);
insert into public.enquete_sal (sal)
  select encode(extensions.gen_random_bytes(32), 'hex')
  where not exists (select 1 from public.enquete_sal);

-- RLS ligado e sem políticas: acesso direto às tabelas fica bloqueado para o público.
alter table public.votos enable row level security;
alter table public.enquete_sal enable row level security;
revoke all on public.votos, public.enquete_sal from anon, authenticated;

create or replace function public.votar(p_dispositivo uuid, p_opcao text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ip   text;
  v_hash text;
  v_qtd  int;
begin
  if p_dispositivo is null or p_opcao is null or p_opcao not in
     ('seguranca','saude','economia','emprego','corrupcao','educacao','fome','ambiente','outro') then
    return 'invalido';
  end if;

  v_ip := split_part(coalesce(
            nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1);
  select encode(digest(v_ip || sal, 'sha256'), 'hex') into v_hash from public.enquete_sal limit 1;

  -- Até 30 votos por hora vindos da mesma rede (redes de celular e Wi-Fi públicos
  -- compartilham IP, por isso o limite não é 1).
  select count(*) into v_qtd from public.votos
   where ip_hash = v_hash and criado_em > now() - interval '1 hour';
  if v_qtd >= 30 then
    return 'limite';
  end if;

  insert into public.votos (dispositivo, opcao, ip_hash) values (p_dispositivo, p_opcao, v_hash);
  return 'ok';
exception
  when unique_violation then
    return 'ja_votou';
end;
$$;

create or replace function public.parcial()
returns table (opcao text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select opcao, count(*)::bigint from public.votos group by opcao;
$$;

revoke all on function public.votar(uuid, text) from public;
revoke all on function public.parcial() from public;
grant execute on function public.votar(uuid, text) to anon, authenticated;
grant execute on function public.parcial() to anon, authenticated;
