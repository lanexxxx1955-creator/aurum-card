import { useState } from "react";
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { Screen, Brand, StepHeader, GoldButton, GhostButton } from "@/components/Lux";

interface FieldDef {
  key: keyof Profile;
  req?: boolean;
  ph: string;
  type?: string;
}

export function FormStep({
  profile,
  onDone,
  onBack,
}: {
  profile: Profile;
  onDone: (p: Profile) => void;
  onBack: () => void;
}) {
  const lang = profile.lang;
  const [p, setP] = useState<Profile>(profile);
  const [error, setError] = useState(false);

  const fields: FieldDef[] = [
    { key: "name", req: true, ph: t(lang, "namePh") },
    { key: "tg", req: true, ph: "@username" },
    { key: "phone", ph: t(lang, "phonePh"), type: "tel" },
    { key: "company", ph: t(lang, "companyPh") },
    { key: "field", ph: t(lang, "fieldPh") },
    { key: "position", ph: t(lang, "positionPh") },
  ];

  const submit = () => {
    if (!p.name.trim() || !p.tg.trim()) {
      setError(true);
      return;
    }
    onDone({ ...p, tg: p.tg.trim().replace(/^@/, ""), name: p.name.trim() });
  };

  return (
    <Screen>
      <div className="fade-up">
        <Brand lang={lang} />
        <StepHeader lang={lang} step={2} total={4} title={t(lang, "aboutYou")} hint={t(lang, "formHint")} />

        <div className="mb-6 space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1.5 flex items-baseline justify-between text-xs uppercase tracking-widest text-[#d4af37]/80">
                <span>{t(lang, f.key)}</span>
                <span className="text-[10px] normal-case tracking-normal text-[#8a7f5e]">
                  {f.req ? t(lang, "required") : t(lang, "optional")}
                </span>
              </label>
              <input
                type={f.type ?? "text"}
                value={(p[f.key] as string) ?? ""}
                placeholder={f.ph}
                onChange={(e) => {
                  setP({ ...p, [f.key]: e.target.value });
                  setError(false);
                }}
                className={`lux-input w-full rounded-xl px-4 py-3 text-sm ${
                  error && f.req && !(p[f.key] as string)?.trim() ? "!border-red-500/70" : ""
                }`}
              />
            </div>
          ))}
        </div>

        {error && <p className="mb-4 text-center text-sm text-red-400">{t(lang, "fillRequired")}</p>}

        <div className="space-y-3">
          <GoldButton onClick={submit}>{t(lang, "next")}</GoldButton>
          <GhostButton onClick={onBack}>{t(lang, "back")}</GhostButton>
        </div>
      </div>
    </Screen>
  );
}
