-- Per-spa item lines (treatments and retail products) for drill-down and chat.
create table if not exists sales_item_lines (
  id text primary key,
  stage text not null,
  business_date date not null,
  location_id text not null,
  location_name text not null,
  category text not null check (category in ('treatment', 'retail')),
  item_name text not null,
  quantity double precision not null,
  net_sales double precision not null,
  currency text not null,
  unique (stage, business_date, location_id, category, item_name)
);

create index if not exists sales_item_lines_stage_date_loc on sales_item_lines (stage, business_date, location_id);