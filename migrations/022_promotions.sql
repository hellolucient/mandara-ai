-- Promotion summary imports (treatment and retail) by date range.
create table if not exists promo_periods (
  id text primary key,
  stage text not null,
  period_from date not null,
  period_to date not null,
  kind text not null check (kind in ('treatment', 'retail')),
  currency text not null default 'USD',
  total_qty double precision,
  guest double precision,
  nett double precision,
  tax double precision,
  service double precision,
  total_usd double precision not null,
  spa_totals jsonb not null default '{}',
  imported_at timestamptz not null default now(),
  unique (stage, period_from, period_to, kind)
);

create table if not exists promo_lines (
  id text primary key,
  stage text not null,
  period_from date not null,
  period_to date not null,
  kind text not null check (kind in ('treatment', 'retail')),
  location_id text not null,
  location_name text not null,
  promo_code text not null,
  description text not null default '',
  qty double precision not null default 0,
  usd double precision not null default 0,
  unique (stage, period_from, period_to, kind, location_id, promo_code)
);

create index if not exists promo_lines_stage_range on promo_lines (stage, period_from, period_to, kind);
create index if not exists promo_lines_lookup on promo_lines (stage, kind, period_to);