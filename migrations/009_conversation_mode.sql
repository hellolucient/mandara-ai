-- Add mode column to conversations table
-- mode can be 'general' (default) or 'mandara'
-- general: normal model chat with web search when needed, no sales routing
-- mandara: answers only from Mandara data (profile, docs, sales), no web search

alter table conversations add column mode text not null default 'general';
create index conversations_mode_idx on conversations (stage, owner_sub, mode, updated_at desc);
