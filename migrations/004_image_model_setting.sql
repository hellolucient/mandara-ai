insert into settings (stage, key, value)
select stage, 'imageModel', 'google/gemini-2.5-flash-image'
from settings
where key = 'model'
on conflict (stage, key) do nothing;
