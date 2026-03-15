/**
 * 관리자 이메일 목록
 * 여기에 포함된 이메일은 무제한 크레딧을 부여받습니다.
 */
export const ADMIN_EMAILS = [
  'happysukhwan@gmail.com', // 관리자 이메일
]

export function isAdmin(email?: string | null) {
  if (!email) return false
  return ADMIN_EMAILS.includes(email)
}
