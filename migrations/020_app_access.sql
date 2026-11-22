-- Which pages a person can open, for their role.
-- full: all pages that role already had (today's default when chat_only is false).
-- dashboard: Home and Chat only (Performance, Ask Mandara AI, By spa).
--   No Quick access, Prospects or admin pages.
-- chat: Chat only (today's chat_only).
alter table members add column if not exists app_access text not null default 'full';

update members
set app_access = 'chat'
where chat_only = true and app_access = 'full';
