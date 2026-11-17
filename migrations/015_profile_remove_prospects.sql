-- Prospects now live in the admin-only Prospects tab. Remove deal and negotiation content from the
-- company profile the assistant answers from, without touching anything else an administrator saved.
-- Removes only: the two description sentences about Manhattan Grand and Thulusdhoo, spas with status
-- negotiation or declined or naming Manhattan, Hulhumale, Thulusdhoo or VISSNA, contacts, people and
-- contracts naming them (and contracts in draft or not proceeding), the keywords VISSNA, Visana and
-- Manhattan Grand, and admin-note lines about Naeem, Thompey, the guest-house spa or those deals.
-- Idempotent: a profile with none of these is left exactly as it is.
update settings as s
set value = c.cleaned::text
from (
  select stage, key, original,
    original
    || case when jsonb_typeof(original->'description') = 'string' then jsonb_build_object('description',
         regexp_replace(regexp_replace(original->>'description',
           '\s*Manhattan Grand / Hulhumal[eé] is in negotiation\.', '', 'g'),
           '\s*The Thulusdhoo \(VISSNA\) deal is not proceeding\.', '', 'g'))
       else '{}'::jsonb end
    || case when jsonb_typeof(original->'spas') = 'array' then jsonb_build_object('spas', coalesce((
         select jsonb_agg(e order by i) from jsonb_array_elements(original->'spas') with ordinality as t(e, i)
         where not (coalesce(e->>'status', '') in ('negotiation', 'declined')
                    or e::text ~* '(manhattan|hulhumal|thulusdhoo|vissna|visana)')), '[]'::jsonb))
       else '{}'::jsonb end
    || case when jsonb_typeof(original->'people') = 'array' then jsonb_build_object('people', coalesce((
         select jsonb_agg(e order by i) from jsonb_array_elements(original->'people') with ordinality as t(e, i)
         where not e::text ~* '(manhattan|hulhumal|thulusdhoo|vissna|visana)'), '[]'::jsonb))
       else '{}'::jsonb end
    || case when jsonb_typeof(original->'contacts') = 'array' then jsonb_build_object('contacts', coalesce((
         select jsonb_agg(e order by i) from jsonb_array_elements(original->'contacts') with ordinality as t(e, i)
         where not e::text ~* '(manhattan|hulhumal|thulusdhoo|vissna|visana)'), '[]'::jsonb))
       else '{}'::jsonb end
    || case when jsonb_typeof(original->'contracts') = 'array' then jsonb_build_object('contracts', coalesce((
         select jsonb_agg(e order by i) from jsonb_array_elements(original->'contracts') with ordinality as t(e, i)
         where not (lower(coalesce(e->>'status', '')) in ('draft', 'not proceeding')
                    or e::text ~* '(manhattan|hulhumal|thulusdhoo|vissna|visana)')), '[]'::jsonb))
       else '{}'::jsonb end
    || case when jsonb_typeof(original->'keywords') = 'array' then jsonb_build_object('keywords', coalesce((
         select jsonb_agg(e order by i) from jsonb_array_elements(original->'keywords') with ordinality as t(e, i)
         where not lower(e #>> '{}') in ('vissna', 'visana', 'manhattan grand')), '[]'::jsonb))
       else '{}'::jsonb end
    || case when jsonb_typeof(original->'adminNotes') = 'string' then jsonb_build_object('adminNotes',
         regexp_replace(original->>'adminNotes',
           '^- [^\n]*(naeem|thompey|guest-house spa|manhattan|hulhumal|thulusdhoo|vissna)[^\n]*(\n|$)', '', 'gin'))
       else '{}'::jsonb end
    as cleaned
  from (
    select stage, key, value::jsonb as original
    from settings
    where key = 'companyProfile' and left(btrim(value), 1) = '{'
  ) as profiles
) as c
where s.stage = c.stage and s.key = c.key and c.cleaned is distinct from c.original
