insert into settings (stage, key, value)
select stage, 'visionModel', 'google/gemini-2.5-flash'
from settings
where key = 'model'
on conflict (stage, key) do nothing;
