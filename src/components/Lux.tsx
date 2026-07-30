import type { ReactNode } from "react";
import { t, LANGUAGES } from "@/lib/i18n";
import type { LangCode } from "@/lib/types";

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-10 pt-8">{children}</div>
  );
}

export function Brand({ lang }: { lang: LangCode }) {
  return (
    <div className="mb-6 text-center">
      <div className="font-display text-3xl font-semibold tracking-wide gold-text">{t(lang, "appName")}</div>
      <div className="mx-auto mt-2 w-24 gold-line shimmer" />
    </div>
  );
}

export function StepHeader({
  lang,
  step,
  total,
  title,
  hint,
}: {
  lang: LangCode;
  step: number;
  total: number;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-6">
      <div className="eyebrow mb-2">{t(lang, "stepOf", { a: step, b: total })}</div>
      <div className="mb-3 flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-[3px] flex-1 rounded-full ${i < step ? "bg-[#d4af37]" : "bg-[#d4af37]/15"}`}
          />
        ))}
      </div>
      <h1 className="font-display text-2xl font-semibold text-[#f0e8d2]">{title}</h1>
      {hint && <p className="mt-1 text-sm text-[#b9ac86]">{hint}</p>}
    </div>
  );
}

export function GoldButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-gold w-full rounded-xl px-5 py-3.5 text-sm uppercase tracking-wider disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="btn-ghost-gold w-full rounded-xl px-5 py-3 text-sm">
      {children}
    </button>
  );
}

export function LangFlag({ code }: { code: LangCode }) {
  const l = LANGUAGES.find((x) => x.code === code);
  return <span>{l?.flag}</span>;
}
