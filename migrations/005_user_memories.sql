create table if not exists user_memories (
  id text primary key,
  stage text not null,
  user_sub text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists user_memories_user_idx on user_memories (stage, user_sub, created_at desc);
