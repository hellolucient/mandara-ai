-- Remove sample/fixture data from production stage
-- Sample data should only exist in test/preview/dev stages, never in production

-- Delete sales lines associated with sample days
delete from sales_lines
where day_id in (
  select id from sales_days
  where stage = 'production' and source = 'sample'
);

-- Delete sample sales days
delete from sales_days
where stage = 'production' and source = 'sample';

-- Delete sample documents
delete from chunks
where stage = 'production' and document_id in (
  select id from documents where stage = 'production' and sample = true
);

delete from documents
where stage = 'production' and sample = true;

-- Delete sample locations (only if they have no non-sample sales data)
delete from locations
where stage = 'production'
  and id in ('velifushi', 'north-male', 'south-ari', 'baa', 'male-house')
  and not exists (
    select 1 from sales_lines l
    join sales_days d on d.id = l.day_id
    where d.stage = 'production'
      and l.location_id = locations.id
      and d.source != 'sample'
  );
