import { useEffect, useMemo, useState } from "react";
import type { LangCode, Profile, Step } from "@/lib/types";
import { decodeCard, loadProfile, saveProfile } from "@/lib/share";
import { initTelegram, tgUserDefaults } from "@/lib/telegram";
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
          initial={profile.lang}
          onDone={(lang) => {
            update({ ...profile, lang });
            setStep("form");
          }}
        />
      )}

      {step === "form" && (
        <FormStep profile={profile} onBack={() => setStep("lang")} onDone={(p) => (update(p), setStep("photo"))} />
      )}

      {step === "photo" && (
        <PhotoStep profile={profile} onBack={() => setStep("form")} onDone={(p) => (update(p), setStep("video"))} />
      )}

      {step === "video" && (
        <VideoStep profile={profile} onBack={() => setStep("photo")} onDone={(p) => (update(p), setStep("card"))} />
      )}

      {step === "card" && (
        <CardView
          profile={profile}
          mode="own"
          onEdit={() => setStep("form")}
          onOpenPaywall={() => setPaywall(true)}
        />
      )}

      {paywall && (
        <Paywall
          lang={profile.lang}
          onClose={() => setPaywall(false)}
          onActivate={() => {
            update({ ...profile, pro: true });
            setPaywall(false);
          }}
        />
      )}
    </>
  );
}
