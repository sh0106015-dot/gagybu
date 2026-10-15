/** 한 번에 분석하는 최대 문자 수 (실수로 큰 텍스트를 붙여넣는 경우 대비) */
export const MAX_PASTE_MESSAGES = 50;

/**
 * 여러 문자를 한꺼번에 붙여넣은 텍스트를 문자 단위로 나눈다.
 * 빈 줄로 나누고, 빈 줄 없이 이어진 "[Web발신]" 문자도 각각 나눈다.
 * 여러 줄짜리 카카오톡 알림은 빈 줄이 없으면 한 문자로 본다.
 */
export function splitMessages(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .flatMap((chunk) => chunk.split(/\n(?=\s*\[Web발신\])/))
    .map((m) => m.trim())
    .filter(Boolean)
    .slice(0, MAX_PASTE_MESSAGES);
}
