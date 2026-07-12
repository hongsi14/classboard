-- ────────────────────────────────────────────
-- 탭(게시판) 테이블: 화면에서 추가/이름변경/삭제 가능하게
-- Supabase > SQL Editor 에 붙여넣고 Run
-- ────────────────────────────────────────────

create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table boards enable row level security;

drop policy if exists "anon select boards" on boards;
create policy "anon select boards" on boards for select to anon using (true);

drop policy if exists "anon insert boards" on boards;
create policy "anon insert boards" on boards for insert to anon with check (true);

drop policy if exists "anon update boards" on boards;
create policy "anon update boards" on boards for update to anon using (true);

drop policy if exists "anon delete boards" on boards;
create policy "anon delete boards" on boards for delete to anon using (true);

-- 기본 탭 세트 (이미 있으면 건너뜀)
insert into boards (name, position) values
  ('공지사항', 0),
  ('1학년 과학', 1),
  ('2학년 과학', 2),
  ('3학년 과학', 3),
  ('기타 자료실', 4),
  ('Q&A', 5)
on conflict (name) do nothing;
