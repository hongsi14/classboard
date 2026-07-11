# 수업자료실 📚

엄마(선생님)와 학생들이 함께 쓰는 수업자료 게시판.
React + Vite + Supabase, Vercel 무료 배포.

## 기능

- 공용 비밀번호로 입장 (링크 아는 사람만)
- 파일 업로드 (PDF, 한글, PPT, 이미지 등 — 최대 50MB) 또는 링크 첨부 (유튜브 영상 등)
- 카테고리 탭 필터 (`src/supabase.js`의 `CATEGORIES`에서 수정)
- 삭제는 비밀번호 재확인

## 설정 순서 (약 20분)

### 1. Supabase 프로젝트 만들기

1. https://supabase.com 가입 → New project (Region: Northeast Asia (Seoul))
2. **Storage** 메뉴 → New bucket → 이름 `materials`, **Public bucket 체크** → 생성
3. **SQL Editor** 메뉴 → `supabase/setup.sql` 내용 붙여넣고 **Run**
4. **Settings > API** 에서 `Project URL`과 `anon public` 키 복사

### 2. 로컬 실행

```bash
npm install
cp .env.example .env      # .env 열어서 위에서 복사한 값 + 비밀번호 입력
npm run dev
```

### 3. GitHub + Vercel 배포

```bash
git init && git add . && git commit -m "init"
# GitHub에 private 레포 만들고 push
```

1. https://vercel.com → Add New Project → 방금 만든 레포 import
2. **Environment Variables**에 세 개 입력:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ACCESS_CODE` (엄마·학생들에게 알려줄 비밀번호)
3. Deploy → 나온 주소를 엄마께 전달!

## 알아둘 것

- **보안 수준**: 비밀번호 게이트는 클라이언트 검사라 "가볍게 막는" 수준입니다. 링크 아는 사람만 쓰는 학급 게시판 용도로는 충분하지만, 민감한 개인정보는 올리지 마세요.
- **용량**: Supabase 무료 티어는 스토리지 1GB / 파일당 50MB. 영상은 유튜브(일부공개)에 올리고 링크로 공유하는 걸 추천.
- **카테고리 변경**: `src/supabase.js`의 `CATEGORIES` 배열 수정 후 다시 배포.
- **비밀번호 변경**: Vercel 환경변수 `VITE_ACCESS_CODE` 수정 → Redeploy.
