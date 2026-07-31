import { useState } from "react";
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { Screen, Brand, GoldButton } from "@/components/Lux";
import { loadCardsList, removeCardSummary, type CardSummary } from "@/lib/cards";

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
}: {
  profile: Profile;
  isOwner: boolean;
  onClose: () => void;
  onSelect: (s: CardSummary) => void;
  onUpgrade: () => void;
}) {
  const lang = profile.lang;
  const [cards, setCards] = useState<CardSummary[]>(loadCardsList());
  const [busy, setBusy] = useState<string | null>(null);

  const proActive = Boolean(profile.pro && (!profile.proUntil || profile.proUntil > Date.now()));

  const pick = async (s: CardSummary) => {
    setBusy(s.id);
    try {
      await onSelect(s);
    } finally {
      setBusy(null);
    }
  };

  const remove = (id: string) => {
    removeCardSummary(id);
    setCards(loadCardsList());
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
                    <button
                      onClick={() => pick(c)}
                      disabled={busy !== null}
                      className="btn-ghost-gold rounded-lg px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      {busy === c.id ? "…" : t(lang, "select")}
                    </button>
                  )}
                  <button
                    onClick={() => remove(c.id)}
                    className="px-1.5 text-xs text-[#8a7f5e] transition-colors hover:text-red-400"
                    aria-label={t(lang, "remove")}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-auto">
          <GoldButton onClick={onClose}>{t(lang, "back")}</GoldButton>
        </div>
      </div>
    </Screen>
  );
}
