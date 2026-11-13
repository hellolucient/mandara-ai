alter table messages add column if not exists images text not null default '[]';
update settings set value = 'openrouter/auto' where key = 'model' and value = 'google/gemini-2.5-flash';
