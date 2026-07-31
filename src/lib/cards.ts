/* Local library of previously shared cards (for the user cabinet) */

export interface CardSummary {
  id: string;
  name: string;
  company?: string;
  photo?: string;
  createdAt: number;
}

const KEY = "aurum-cards";
const MAX_CARDS = 20;

export function loadCardsList(): CardSummary[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as CardSummary[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function upsertCardSummary(s: CardSummary): void {
  const list = loadCardsList().filter((c) => c.id !== s.id);
  list.unshift(s);
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_CARDS)));
  } catch {
    /* quota */
  }
}

export function removeCardSummary(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadCardsList().filter((c) => c.id !== id)));
  } catch {
    /* quota */
  }
}

export function clearCardsList(): void {
  localStorage.removeItem(KEY);
}
