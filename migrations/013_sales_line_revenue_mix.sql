-- Optional split of each location's daily net sales into treatment and retail revenue.
-- Nullable: older imports and sources that do not split revenue leave them empty.
alter table sales_lines add column if not exists treatment_sales double precision;
alter table sales_lines add column if not exists retail_sales double precision
