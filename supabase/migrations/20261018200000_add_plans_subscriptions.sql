create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('basic', 'premium')),
  name text not null,
  tagline text not null,
  description text not null,
  features text[] not null default '{}'
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  billing_interval text not null default 'monthly'
    check (billing_interval in ('monthly', 'yearly')),
  started_at timestamptz not null default now(),
  current_period_end timestamptz,
  canceled_at timestamptz
);

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

create policy "Plans are readable by signed-in users"
  on public.plans for select to authenticated using (true);

create policy "Users read their own subscription"
  on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- Solo lectura desde la app: las altas y cambios los hace el servidor (service role).
revoke all on public.plans, public.subscriptions from anon, authenticated;
grant select on public.plans, public.subscriptions to authenticated;

insert into public.plans (code, name, tagline, description, features) values
  (
    'basic',
    'IdiomaTrainer Basic',
    'Basic',
    'Empieza a practicar tu inglés con las herramientas esenciales.',
    array[
      'Hasta 5 preguntas de la IA por conversación',
      'Temas cotidianos',
      'Correcciones básicas',
      'Objetivo diario y resumen de progreso'
    ]
  ),
  (
    'premium',
    'IdiomaTrainer Premium',
    'Premium',
    'Disfruta de todas las herramientas para mejorar tu inglés.',
    array[
      'Conversación ilimitada con la IA',
      'Práctica personalizada por nivel',
      'Seguimiento de errores anteriores',
      'Simulaciones de entrevistas laborales',
      'Ejercicios de pronunciación',
      'Plan de mejora adaptativo'
    ]
  );
