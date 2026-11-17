insert into settings (stage, key, value)
select distinct stage, 'companyProfile', '{"description":"","spas":[],"people":[],"contracts":[],"keywords":[]}'
from settings
on conflict (stage, key) do nothing;
