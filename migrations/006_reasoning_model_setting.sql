insert into settings (stage, key, value)
select stage, 'reasoningModel', 'deepseek/deepseek-r1'
from settings
where key = 'model'
on conflict (stage, key) do nothing;
