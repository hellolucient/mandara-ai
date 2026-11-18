-- Optional workbook fields from the reconciled master list: lead status (Warm lead ... Not proceeding)
-- and JC notes & contacts. Both stay administrator-only, like every prospects column.
alter table prospects add column if not exists lead_status text not null default '';
alter table prospects add column if not exists jc_notes text not null default '';
create index if not exists prospects_lead_status_idx on prospects (stage, lead_status)
