import { useEffect, useMemo, useState } from "react";
import type { LangCode, Profile, Step } from "@/lib/types";
import { decodeCard, loadProfile, saveProfile } from "@/lib/share";
import { initTelegram, tgUserDefaults } from "@/lib/telegram";
import { PRO_DAYS } from "@/lib/config";
import { LangStep } from "@/sections/LangStep";
import { FormStep } from "@/sections/FormStep";
import { PhotoStep } from "@/sections/PhotoStep";
import { VideoStep } from "@/sections/VideoStep";
import { CardView } from "@/sections/CardView";
import { Paywall } from "@/sections/Paywall";

function detectInitialLang(): LangCode {
  const nav = navigator.language?.slice(0, 2).toLowerCase();
  const known: LangCode[] = ["en", "ru", "be", "kk", "uz", "az", "hy", "ky", "tg", "tk", "ro"];
  return (known as string[]).includes(nav) ? (nav as LangCode) : "en";
}

export default function App() {
  const shared = useMemo(() => decodeCard(location.hash), []);
  const [step, setStep] = useState<Step>("lang");
  const [paywall, setPaywall] = useState(false);
  const [showShared, setShowShared] = useState(!!shared);
  const [profile, setProfile] = useState<Profile>(() => {
    const saved = loadProfile();
    if (saved) return saved;
    const tgDef = tgUserDefaults();
    return {
      name: tgDef.name ?? "",
      tg: tgDef.tg ?? "",
      lang: detectInitialLang(),
    };
  });

  useEffect(() => {
    initTelegram();
    if (!shared && loadProfile()) setStep("card");
  }, [shared]);

  const update = (p: Profile) => {
    setProfile(p);
    saveProfile(p);
  };

  // PRO expires after proUntil; expired PRO silently falls back to Free
  const proActive = Boolean(profile.pro && (!profile.proUntil || profile.proUntil > Date.now()));
  const view: Profile = { ...profile, pro: proActive };

  if (showShared && shared) {
    return (
      <CardView
        profile={shared}
        mode="shared"
        onCreateOwn={() => {
          history.replaceState(null, "", location.pathname);
          setShowShared(false);
          setStep("lang");
        }}
      />
    );
  }

  return (
    <>
      {step === "lang" && (
        <LangStep
          initial={view.lang}
          onDone={(lang) => {
            update({ ...profile, lang });
            setStep("form");
          }}
        />
      )}

      {step === "form" && (
        <FormStep profile={view} onBack={() => setStep("lang")} onDone={(p) => (update(p), setStep("photo"))} />
      )}

      {step === "photo" && (
        <PhotoStep profile={view} onBack={() => setStep("form")} onDone={(p) => (update(p), setStep("video"))} />
      )}

      {step === "video" && (
        <VideoStep profile={view} onBack={() => setStep("photo")} onDone={(p) => (update(p), setStep("card"))} />
      )}

      {step === "card" && (
        <CardView
          profile={view}
          mode="own"
          onEdit={() => setStep("form")}
          onOpenPaywall={() => setPaywall(true)}
          onProfileChange={update}
        />
      )}

      {paywall && (
        <Paywall
          lang={view.lang}
          onClose={() => setPaywall(false)}
          onActivate={() => {
            update({ ...profile, pro: true, proUntil: Date.now() + PRO_DAYS * 24 * 60 * 60 * 1000 });
            setPaywall(false);
          }}
        />
      )}
    </>
  );
}
