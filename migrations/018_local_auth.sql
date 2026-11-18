-- Mandara's own sign-in, used when AUTH_MODE=local (Cloudflare hosting).
-- Roles stay in members: admin is everything, manager is Management (contracts and resort data), staff is Spa (no contracts).
-- chat_only limits a person to Chat. spa_location_id is reserved for "only their own spa" later.
alter table members add column if not exists chat_only boolean not null default false;
alter table members add column if not exists spa_location_id text not null default '';

create table if not exists app_users (
  id text primary key,
  stage text not null,
  sub text not null,
  username text not null,
  email text not null default '',
  password_hash text not null,
  must_change_password boolean not null default true,
  disabled boolean not null default false,
  failed_logins int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage, sub)
);

create unique index if not exists app_users_username_idx on app_users (stage, lower(username));

create table if not exists app_sessions (
  token_hash text primary key,
  stage text not null,
  user_id text not null references app_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists app_sessions_user_idx on app_sessions (user_id);
create index if not exists app_sessions_expiry_idx on app_sessions (expires_at)
