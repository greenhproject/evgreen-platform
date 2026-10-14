export const QUOTE_STATUSES = ["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === "string" && QUOTE_STATUSES.includes(value as QuoteStatus);
}

export function isQuoteEditable(status: QuoteStatus): boolean {
  return status === "DRAFT" || status === "SENT";
}

export function canSendQuoteEmail(status: QuoteStatus): boolean {
  return status === "DRAFT" || status === "SENT";
}

export function canDecideQuote(status: QuoteStatus): boolean {
  return status === "DRAFT" || status === "SENT" || status === "VIEWED";
}

export function canTransitionQuoteStatus(currentStatus: QuoteStatus, nextStatus: "ACCEPTED" | "REJECTED" | "EXPIRED"): boolean {
  if (nextStatus === "EXPIRED") return currentStatus === "DRAFT" || currentStatus === "SENT" || currentStatus === "VIEWED";
  return canDecideQuote(currentStatus);
}
