-- 관리자 글 표시용 칸 추가 (Supabase > SQL Editor 에서 Run)
alter table posts add column if not exists is_admin boolean not null default false;
