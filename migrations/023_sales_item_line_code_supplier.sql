-- Optional SKU and supplier from Steiners Statistic Retail/Treatment Summary imports.
alter table sales_item_lines add column if not exists item_code text;
alter table sales_item_lines add column if not exists supplier text;