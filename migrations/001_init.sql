create table if not exists settings (
  stage text not null,
  key text not null,
  value text not null,
  primary key (stage, key)
);

create table if not exists members (
  stage text not null,
  sub text not null,
  email text not null default '',
  name text not null default '',
  role text not null check (role in ('admin', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (stage, sub)
);

create table if not exists role_invites (
  stage text not null,
  email text not null,
  role text not null check (role in ('admin', 'manager', 'staff')),
  primary key (stage, email)
);

create table if not exists conversations (
  id text primary key,
  stage text not null,
  owner_sub text not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_owner_idx
  on conversations (stage, owner_sub, updated_at desc);

create table if not exists messages (
  id text primary key,
  conversation_id text not null references conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  attachment_name text not null default '',
  citations text not null default '[]',
  mode text not null default '',
  model text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on messages (conversation_id, created_at);

create table if not exists documents (
  id text not null,
  stage text not null,
  title text not null,
  filename text not null,
  mime text not null,
  visibility text not null check (visibility in ('company', 'restricted')),
  sample boolean not null default false,
  uploaded_by text not null,
  byte_size int not null default 0,
  created_at timestamptz not null default now(),
  primary key (stage, id)
);

create table if not exists chunks (
  id text primary key,
  stage text not null,
  document_id text not null,
  ordinal int not null,
  content text not null,
  tsv tsvector not null,
  foreign key (stage, document_id) references documents (stage, id) on delete cascade
);

create index if not exists chunks_tsv_idx on chunks using gin (tsv);
create index if not exists chunks_document_idx on chunks (stage, document_id, ordinal);

create table if not exists locations (
  id text not null,
  stage text not null,
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  primary key (stage, id)
);

create table if not exists sales_days (
  id text primary key,
  stage text not null,
  business_date date not null,
  source text not null check (source in ('sample', 'import', 'dsr')),
  currency text not null,
  complete boolean not null default true,
  note text not null default '',
  extracted_at timestamptz not null default now(),
  unique (stage, business_date)
);

create table if not exists sales_lines (
  id text primary key,
  day_id text not null references sales_days (id) on delete cascade,
  location_id text not null,
  location_name text not null,
  net_sales double precision,
  treatments int,
  budget double precision,
  unique (day_id, location_id)
);

create index if not exists sales_lines_day_idx on sales_lines (day_id);

create table if not exists agent_runs (
  id text primary key,
  stage text not null,
  agent text not null,
  trigger text not null,
  status text not null,
  actor text not null default '',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  business_date date,
  summary text not null default '',
  report text not null default '',
  log text not null default '',
  error text not null default ''
);

create index if not exists agent_runs_idx on agent_runs (stage, started_at desc);

create table if not exists usage_events (
  id text primary key,
  stage text not null,
  member_sub text not null,
  purpose text not null,
  model text not null,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  cost_usd double precision not null default 0,
  cost_known boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_idx on usage_events (stage, created_at desc);
