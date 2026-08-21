// Supabase/Postgres에서 오는 영어 에러 메시지를 사람이 이해할 수 있는 한글로 바꿔줍니다.
// 알려진 패턴이 없으면 원본 메시지를 그대로 보여주되 "오류: " 접두어만 붙입니다.
export function friendlyError(err) {
  const msg = (typeof err === 'string' ? err : err?.message || '') || '';
  const lower = msg.toLowerCase();

  if (lower.includes('permission denied')) return '권한이 없어서 처리하지 못했어요. 관리자에게 문의해주세요.';
  if (lower.includes('email rate limit')) return '요청이 너무 많이 몰렸어요. 1~2분 뒤 다시 시도해주세요.';
  if (lower.includes('invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않아요.';
  if (lower.includes('user already registered') || lower.includes('already registered')) return '이미 가입된 이메일이에요. 로그인을 시도해보세요.';
  if (lower.includes('employee_code')) return '이미 사용 중인 사번이에요. 다른 사번을 입력해주세요.';
  if (lower.includes('duplicate key')) return '이미 등록된 정보예요. 입력 값을 다시 확인해주세요.';
  if (lower.includes('database error saving new user')) return '가입 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.';
  if (lower.includes('jwt') || lower.includes('session') || lower.includes('refresh_token')) return '로그인이 만료됐어요. 다시 로그인해주세요.';
  if (lower.includes('network') || lower.includes('failed to fetch')) return '인터넷 연결을 확인해주세요.';
  if (lower.includes('password') && lower.includes('6')) return '비밀번호는 6자 이상으로 입력해주세요.';
  if (lower.includes('is_month_locked') || lower.includes('row-level security') || lower.includes('row level security')) {
    return '이번 달은 마감되어 수정할 수 없어요. 관리자에게 문의해주세요.';
  }

  return msg ? `오류: ${msg}` : '알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
}
