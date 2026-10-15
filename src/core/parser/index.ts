import { parseWon } from '../money';
import type { SourceApp } from '../model';
import { FORMAT_RULES } from './formats';
import { classifyNonTx } from './nonTx';
import type { ParseResult } from './types';

export type { ParsedTx, ParseResult, FormatRule, NonTxReason } from './types';
export { FORMAT_RULES } from './formats';

export function parseNotification(text: string, sourceApp: SourceApp): ParseResult {
  const t = text.trim();
  const nonTx = classifyNonTx(t);
  if (nonTx) return { status: 'non_tx', reason: nonTx };

  for (const rule of FORMAT_RULES) {
    if (sourceApp !== 'paste' && !rule.apps.includes(sourceApp)) continue;
    const tx = rule.parse(t);
    if (tx) return { status: 'tx', ruleId: rule.id, ruleVersion: rule.version, tx };
  }
  return fallback(t);
}

function fallback(t: string): ParseResult {
  const hasKeyword = /승인|결제|취소|환불|사용/.test(t);
  const amt = /([\d,]+)\s*원/.exec(t);
  const foreign = /(USD|EUR|JPY|CNY|\$)\s*[\d,.]+|해외/.test(t);
  if (!hasKeyword || (!amt && !foreign)) return { status: 'non_tx', reason: 'not_transaction' };
  return {
    status: 'unsupported',
    ruleId: 'fallback',
    ruleVersion: 1,
    tx: {
      kind: /취소|환불/.test(t) ? 'cancel' : 'approval',
      amount: amt ? parseWon(amt[1]) ?? undefined : undefined,
      installment: /\d+\s*개월/.test(t),
      foreign,
    },
  };
}
