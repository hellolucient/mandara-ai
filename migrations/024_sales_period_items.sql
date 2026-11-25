-- Steiners Statistic Entry range exports (Treatment / Retail Summary) by period and spa.
create table if not exists sales_period_items (
  id text primary key,
  stage text not null,
  period_from date not null,
  period_to date not null,
  location text not null,
  kind text not null check (kind in ('treatment', 'retail')),
  item_code text not null default '',
  item_name text not null,
  supplier text not null default '',
  qty double precision not null default 0,
  nett double precision not null default 0,
  imported_at timestamptz not null default now(),
  unique (stage, period_from, period_to, location, kind, item_code, item_name)
);

create index if not exists sales_period_items_stage_range on sales_period_items (stage, period_from, period_to, kind);
create index if not exists sales_period_items_stage_location on sales_period_items (stage, location, period_from, period_to);