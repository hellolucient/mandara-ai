-- Mark sessions that were opened with a temporary password, so the forced
-- first-sign-in change can skip asking for that password again.
alter table app_sessions add column if not exists from_temp_password boolean not null default false;

update app_sessions s
set from_temp_password = true
from app_users u
where s.user_id = u.id and u.must_change_password = true and s.from_temp_password = false;
