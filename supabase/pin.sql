-- 상단 고정 마감일 칸 추가 (Supabase > SQL Editor 에서 Run)
alter table posts add column if not exists pinned_until date;
