import { useState } from "react";
import { LANGUAGES, t } from "@/lib/i18n";
import type { LangCode } from "@/lib/types";
import { Screen, Brand, GoldButton } from "@/components/Lux";
import { haptic } from "@/lib/telegram";

export function LangStep({ initial, onDone }: { initial: LangCode; onDone: (l: LangCode) => void }) {
  const [lang, setLang] = useState<LangCode>(initial);

  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-center fade-up">
        <Brand lang={lang} />
        <p className="mb-1 text-center font-display text-xl italic text-[#e7d9ac]">{t(lang, "tagline")}</p>
        <p className="mx-auto mb-8 max-w-xs text-center text-sm leading-relaxed text-[#b9ac86]">
          {t(lang, "welcomeText")}
        </p>

        <div className="eyebrow mb-3 text-center">{t(lang, "chooseLang")}</div>
        <div className="mb-8 grid grid-cols-2 gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                haptic("light");
              }}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                lang === l.code
                  ? "border-[#d4af37] bg-[#d4af37]/10 text-[#f6e7b2]"
                  : "border-[#d4af37]/20 bg-white/[0.02] text-[#b9ac86] hover:border-[#d4af37]/45"
              }`}
            >
              <span className="text-lg">{l.flag}</span>
              <span className="truncate">{l.label}</span>
            </button>
          ))}
        </div>

        <GoldButton onClick={() => onDone(lang)}>{t(lang, "continue")}</GoldButton>
      </div>
    </Screen>
  );
}
