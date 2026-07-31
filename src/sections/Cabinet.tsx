import { useState } from "react";
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { Screen, Brand, GoldButton } from "@/components/Lux";
import { loadCardsList, type CardSummary } from "@/lib/cards";

function daysLeft(proUntil?: number): number {
  if (!proUntil) return 0;
  return Math.max(0, Math.ceil((proUntil - Date.now()) / 86_400_000));
}

export function Cabinet({
  profile,
  isOwner,
  onClose,
  onSelect,
  onUpgrade,
  onCreateNew,
  onShareCard,
  onEditCard,
  onDeleteCard,
}: {
  profile: Profile;
  isOwner: boolean;
  onClose: () => void;
  onSelect: (s: CardSummary) => void;
  onUpgrade: () => void;
  onCreateNew: () => void;
  onShareCard: (s: CardSummary) => void;
  onEditCard: (s: CardSummary) => void;
  onDeleteCard: (s: CardSummary) => void;
}) {
  const lang = profile.lang;
  const [cards, setCards] = useState<CardSummary[]>(loadCardsList());
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const proActive = Boolean(profile.pro && (!profile.proUntil || profile.proUntil > Date.now()));

  const pick = async (s: CardSummary) => {
    setBusy(s.id);
    try {
      await onSelect(s);
    } finally {
      setBusy(null);
    }
  };

  const del = async (s: CardSummary) => {
    if (confirmDelete !== s.id) {
      setConfirmDelete(s.id);
      setTimeout(() => setConfirmDelete((c) => (c === s.id ? null : c)), 3000);
      return;
    }
    setConfirmDelete(null);
    setBusy(s.id);
    try {
      await onDeleteCard(s);
      setCards(loadCardsList());
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <div className="fade-up flex flex-1 flex-col">
        <Brand lang={lang} />

        <div className="mb-5 flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-[#f0e8d2]">{t(lang, "cabinet")}</h1>
          {isOwner && (
            <span className="rounded-full border border-[#d4af37]/60 bg-[#d4af37]/15 px-2.5 py-0.5 text-[9px] uppercase tracking-widest text-[#f6e7b2]">
              👑 {t(lang, "ownerBadge")}
            </span>
          )}
        </div>

        {/* Subscription block */}
        <div className="gold-frame mb-5 rounded-2xl p-4">
          <div className="eyebrow mb-2">{t(lang, "subscription")}</div>
          {isOwner ? (
            <p className="font-display text-lg text-[#f6e7b2]">👑 {t(lang, "proForever")}</p>
          ) : proActive ? (
            <p className="font-display text-lg text-[#f6e7b2]">
              ✦ PRO · <span className="gold-text font-semibold">{daysLeft(profile.proUntil)}</span>{" "}
              {t(lang, "daysLeft")}
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-lg text-[#b9ac86]">{t(lang, "freePlan")}</p>
              <button
                onClick={onUpgrade}
                className="btn-gold rounded-xl px-4 py-2 text-xs uppercase tracking-wider"
              >
                {t(lang, "upgradePro")}
              </button>
            </div>
          )}
        </div>

        {/* Cards library */}
        <div className="eyebrow mb-2.5">{t(lang, "myCards")}</div>
        {cards.length === 0 ? (
          <p className="mb-5 text-center text-sm text-[#8a7f5e]">{t(lang, "emptyCards")}</p>
        ) : (
          <div className="mb-5 space-y-2.5">
            {cards.map((c) => {
              const isCurrent = profile.cardId === c.id;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    isCurrent ? "border-[#d4af37] bg-[#d4af37]/[0.07]" : "border-[#d4af37]/20 bg-white/[0.02]"
                  }`}
                >
                  <button onClick={() => pick(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <div className="ring-gold h-11 w-11 shrink-0 overflow-hidden !p-[2px]">
                      {c.photo ? (
                        <img src={c.photo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#14100a] font-display text-lg gold-text">
                          {c.name.trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[#f0e8d2]">
                        {c.name}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] uppercase tracking-widest text-[#d4af37]">
                            {t(lang, "active")}
                          </span>
                        )}
                      </div>
                      {c.company && <div className="truncate text-xs text-[#b9ac86]">{c.company}</div>}
                      <div className="text-[10px] text-[#8a7f5e]">{new Date(c.createdAt).toLocaleDateString()}</div>
                    </div>
                    {!isCurrent && (
                      <span className="shrink-0 text-[10px] uppercase tracking-widest text-[#8a7f5e]">
                        {busy === c.id ? "…" : t(lang, "select")}
                      </span>
                    )}
                  </button>

                  {/* Manage: share / edit / delete */}
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      onClick={() => onShareCard(c)}
                      className="rounded-lg border border-[#d4af37]/30 px-2 py-1 text-xs text-[#d4af37] transition-colors hover:bg-[#d4af37]/10"
                      aria-label={t(lang, "share")}
                      title={t(lang, "share")}
                    >
                      📤
                    </button>
                    <button
                      onClick={() => onEditCard(c)}
                      className="rounded-lg border border-[#d4af37]/30 px-2 py-1 text-xs text-[#d4af37] transition-colors hover:bg-[#d4af37]/10"
                      aria-label={t(lang, "editCard")}
                      title={t(lang, "editCard")}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => del(c)}
                      disabled={busy === c.id}
                      className={`rounded-lg border px-2 py-1 text-xs transition-colors ${
                        confirmDelete === c.id
                          ? "border-red-500/70 bg-red-500/15 text-red-400"
                          : "border-[#d4af37]/20 text-[#8a7f5e] hover:border-red-500/50 hover:text-red-400"
                      }`}
                      aria-label={t(lang, "deleteCard")}
                      title={t(lang, "deleteCard")}
                    >
                      {busy === c.id ? "…" : confirmDelete === c.id ? "?" : "🗑"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-auto space-y-3">
          <GoldButton onClick={onCreateNew}>✦ {t(lang, "createNewCard")}</GoldButton>
          <button onClick={onClose} className="btn-ghost-gold w-full rounded-xl px-5 py-3 text-sm">
            {t(lang, "back")}
          </button>
        </div>
      </div>
    </Screen>
  );
}
