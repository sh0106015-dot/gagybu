import type { SourceApp } from '../model';

export interface ParsedTx {
  kind: 'approval' | 'cancel';
  amount?: number;
  merchant?: string;
  cardName?: string;
  cardLast4?: string;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  approvalNo?: string;
  installment: boolean;
  foreign: boolean;
}

export type NonTxReason = 'ad' | 'otp' | 'bill_payment' | 'info' | 'not_transaction';

export type ParseResult =
  | { status: 'non_tx'; reason: NonTxReason }
  | { status: 'tx' | 'unsupported'; ruleId: string; ruleVersion: number; tx: ParsedTx };

export interface FormatRule {
  id: string;
  version: number;
  label: string;
  apps: SourceApp[];
  example: string;
  parse(text: string): ParsedTx | null;
}
