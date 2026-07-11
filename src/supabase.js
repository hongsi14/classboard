import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const BUCKET = 'materials'

// 카테고리는 여기서 자유롭게 수정하세요
export const CATEGORIES = ['수업자료', '과제', '공지', '참고링크', '기타']

export const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE || '1234'
