-- Prospects: potential new resort spa deals. Administrators only (enforced in src/lib/prospects-store.ts).
-- "status" is the pipeline stage (watching ... lost). "stage" is the workspace (production or preview), as in every table.
create table if not exists prospects (
  id text primary key,
  stage text not null,
  key text not null,
  name text not null,
  property_type text not null default '',
  atoll text not null default '',
  brand_group text not null default '',
  owner_company text not null default '',
  management_company text not null default '',
  keys int,
  tier text not null default '',
  spa_name text not null default '',
  spa_operator text not null default '',
  spa_managed_by text not null default '',
  spa_model text not null default '',
  mandara_history text not null default '',
  priority text not null default '' check (priority in ('A', 'B', 'C', 'X', '')),
  verdict text not null default '',
  status text not null default 'watching'
    check (status in ('watching', 'researching', 'ready', 'in_talks', 'proposal', 'won', 'lost')),
  timing text not null default '',
  timing_date date,
  est_spa_revenue double precision,
  est_fee double precision,
  gm_name text not null default '',
  gm_since text not null default '',
  gm_background text not null default '',
  spa_manager text not null default '',
  approach text not null default '',
  owner_links text not null default '',
  notes text not null default '',
  confidence text not null default '',
  intel_date date,
  sources text not null default '[]',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage, key)
);

create index if not exists prospects_stage_idx on prospects (stage, status);

create table if not exists prospect_notes (
  id text primary key,
  stage text not null,
  prospect_id text not null references prospects (id) on delete cascade,
  note_date date not null,
  body text not null,
  author text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists prospect_notes_idx on prospect_notes (prospect_id, note_date desc, created_at desc);

create table if not exists prospect_signals (
  id text primary key,
  stage text not null,
  prospect_id text not null references prospects (id) on delete cascade,
  signal_date date not null,
  type text not null check (type in ('news', 'job_ad', 'new_gm', 'development', 'other')),
  summary text not null,
  source_url text not null default '',
  dedupe text not null,
  added_by text not null default '',
  created_at timestamptz not null default now(),
  unique (stage, dedupe)
);

create index if not exists prospect_signals_idx on prospect_signals (stage, signal_date desc, created_at desc)
