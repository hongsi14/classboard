-- ────────────────────────────────────────────
-- 수업자료실 Supabase 초기 설정
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- (실행 전에 Storage 메뉴에서 'materials' 라는 이름의
--  Public bucket 을 먼저 만들어 두세요)
-- ────────────────────────────────────────────

-- 1. 게시글 테이블
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default '기타',
  description text,
  author text,
  link_url text,
  file_path text,
  file_name text,
  created_at timestamptz not null default now()
);

-- 2. RLS (익명 사용자가 읽기/쓰기/삭제 가능 — 접근 제한은 앱의 비밀번호 게이트가 담당)
alter table posts enable row level security;

drop policy if exists "anon select posts" on posts;
create policy "anon select posts" on posts for select to anon using (true);

drop policy if exists "anon insert posts" on posts;
create policy "anon insert posts" on posts for insert to anon with check (true);

drop policy if exists "anon delete posts" on posts;
create policy "anon delete posts" on posts for delete to anon using (true);

-- 3. Storage 정책 (materials 버킷)
drop policy if exists "anon upload materials" on storage.objects;
create policy "anon upload materials" on storage.objects
  for insert to anon with check (bucket_id = 'materials');

drop policy if exists "anon read materials" on storage.objects;
create policy "anon read materials" on storage.objects
  for select to anon using (bucket_id = 'materials');

drop policy if exists "anon delete materials" on storage.objects;
create policy "anon delete materials" on storage.objects
  for delete to anon using (bucket_id = 'materials');
