-- ────────────────────────────────────────────
-- 게시판 업데이트: 본문 칸 + 댓글 테이블
-- Supabase > SQL Editor 에 붙여넣고 Run
-- ────────────────────────────────────────────

alter table posts add column if not exists content text;

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author text,
  content text not null,
  created_at timestamptz not null default now()
);

alter table comments enable row level security;

drop policy if exists "anon select comments" on comments;
create policy "anon select comments" on comments for select to anon using (true);

drop policy if exists "anon insert comments" on comments;
create policy "anon insert comments" on comments for insert to anon with check (true);

drop policy if exists "anon delete comments" on comments;
create policy "anon delete comments" on comments for delete to anon using (true);
