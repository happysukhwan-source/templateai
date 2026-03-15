import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// =============================================
// Supabase에 아래 테이블을 만들어주세요:
//
// 1) profiles 테이블
//    - id: uuid (auth.users.id 참조)
//    - email: text
//    - free_credits: int (기본값 5)
//    - paid_credits: int (기본값 0)
//    - created_at: timestamp
//
// 2) conversions 테이블
//    - id: uuid
//    - user_id: uuid (profiles.id 참조)
//    - original_filename: text
//    - svg_result: text
//    - created_at: timestamp
//    - is_free: boolean
// =============================================
