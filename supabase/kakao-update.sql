-- 댓글 사진/관리자 표시 + Q&A 답변완료 칸 (Supabase > SQL Editor 에서 Run)
alter table comments add column if not exists is_admin boolean not null default false;
alter table comments add column if not exists image_path text;
alter table posts add column if not exists answered boolean not null default false;
