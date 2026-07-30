import { useState } from "react";
import { t } from "@/lib/i18n";
import type { LangCode } from "@/lib/types";
import { payWithInvoice, shareViaTelegram, getInitData } from "@/lib/telegram";
import { createProInvoiceLink, BotApiError } from "@/lib/botapi";
import { proxyConfigured } from "@/lib/config";

function PlanColumn({
  title,
  price,
  features,
  highlight,
}: {
  title: string;
  price?: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-2xl border p-4 ${
        highlight ? "border-[#d4af37] bg-[#d4af37]/[0.07]" : "border-[#d4af37]/20 bg-white/[0.02]"
      }`}
    >
      <div className={`font-display text-xl font-semibold ${highlight ? "gold-text" : "text-[#e7d9ac]"}`}>{title}</div>
      {price && <div className="mt-0.5 text-xs text-[#cdbf95]">{price}</div>}
      <ul className="mt-3 space-y-2">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-snug text-[#cdbf95]">
            <span className={highlight ? "text-[#d4af37]" : "text-[#8a7f5e]"}>✦</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Paywall({
  lang,
  onClose,
  onActivate,
}: {
  lang: LangCode;
  onClose: () => void;
  onActivate: () => void;
}) {
  const [state, setState] = useState<"idle" | "paying" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const livePayments = proxyConfigured() && Boolean(getInitData());

  const buy = async () => {
    setState("paying");
    setErrorMsg("");
    try {
      let result: "paid" | "demo" | "cancelled";
      if (livePayments) {
        try {
          const invoiceUrl = await createProInvoiceLink(getInitData());
          result = await payWithInvoice(invoiceUrl);
        } catch (e) {
          // Provider token not set on the worker yet → honest demo mode
          if (e instanceof BotApiError && e.code === 501) result = await payWithInvoice(undefined);
          else throw e;
        }
      } else {
        result = await payWithInvoice(undefined); // demo simulation
      }
      if (result === "paid" || result === "demo") {
        setState("done");
        setTimeout(onActivate, 900);
      } else {
        setState("idle");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Payment error");
      setState("error");
    }
  };

  const invite = () => {
    shareViaTelegram(`${location.origin}${location.pathname}`, t(lang, "tagline"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center">
      <div className="gold-frame max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl fade-up">
        <div className="mb-1 text-center font-display text-3xl font-semibold gold-text">{t(lang, "proTitle")}</div>
        <p className="mb-5 text-center text-sm text-[#b9ac86]">{t(lang, "proSubtitle")}</p>

        <div className="mb-5 flex gap-3">
          <PlanColumn
            title={t(lang, "freePlan")}
            features={[t(lang, "f1"), t(lang, "f2"), t(lang, "f3"), t(lang, "f4")]}
          />
          <PlanColumn
            title={t(lang, "proPlan")}
            price={t(lang, "proPrice")}
            highlight
            features={[t(lang, "p1"), t(lang, "p2"), t(lang, "p3"), t(lang, "p4"), t(lang, "p5")]}
          />
        </div>

        <button
          onClick={buy}
          disabled={state === "paying" || state === "done"}
          className="btn-gold mb-2 w-full rounded-xl px-5 py-3.5 text-sm uppercase tracking-wider disabled:opacity-50"
        >
          {state === "done" ? `✓ ${t(lang, "proActivated")}` : state === "paying" ? "…" : t(lang, "buyPro")}
        </button>

        {state === "error" && <p className="mb-2 text-center text-xs text-red-400">{errorMsg}</p>}
        {!livePayments && <p className="mb-5 text-center text-[10px] text-[#8a7f5e]">{t(lang, "demoPayNote")}</p>}

        <div className="mb-5 rounded-2xl border border-[#d4af37]/20 bg-white/[0.02] p-4 text-center">
          <div className="mb-1 font-display text-lg text-[#e7d9ac]">{t(lang, "refTitle")}</div>
          <p className="mb-3 text-xs text-[#b9ac86]">{t(lang, "refText")}</p>
          <button onClick={invite} className="btn-ghost-gold rounded-xl px-5 py-2 text-xs uppercase tracking-wider">
            {t(lang, "invite")}
          </button>
        </div>

        <button onClick={onClose} className="w-full text-center text-xs uppercase tracking-widest text-[#8a7f5e]">
          {t(lang, "later")}
        </button>
      </div>
    </div>
  );
}
