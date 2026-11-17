-- Budgets: monthly budget targets per spa location
create table if not exists budgets (
  id text primary key,
  stage text not null,
  location_id text not null,
  location_name text not null,
  year integer not null,
  month integer not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  unique (stage, location_id, year, month)
);

create index if not exists budgets_stage_year_month on budgets(stage, year, month);
