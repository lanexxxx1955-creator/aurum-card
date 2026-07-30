import { useRef } from "react";
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { Screen, Brand, StepHeader, GoldButton, GhostButton } from "@/components/Lux";
import { compressPhoto } from "@/lib/share";
import { haptic } from "@/lib/telegram";

export function PhotoStep({
  profile,
  onDone,
  onBack,
}: {
  profile: Profile;
  onDone: (p: Profile) => void;
  onBack: () => void;
}) {
  const lang = profile.lang;
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (file?: File | null) => {
    if (!file) return;
    const dataUrl = await compressPhoto(file);
    haptic("medium");
    onDone({ ...profile, photo: dataUrl });
  };

  return (
    <Screen>
      <div className="fade-up">
        <Brand lang={lang} />
        <StepHeader lang={lang} step={3} total={4} title={t(lang, "uploadPhoto")} hint={t(lang, "photoHint")} />

        <div className="mb-8 flex flex-col items-center">
          <button
            onClick={() => fileRef.current?.click()}
            className="ring-gold mb-6 block h-44 w-44 overflow-hidden"
          >
            {profile.photo ? (
              <img src={profile.photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#14100a]">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="1.2">
                  <path d="M12 16V8m0 0-3.5 3.5M12 8l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="9.2" />
                </svg>
              </div>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <GhostButton onClick={() => fileRef.current?.click()}>
            {profile.photo ? t(lang, "changePhoto") : t(lang, "choosePhoto")}
          </GhostButton>
        </div>

        <div className="space-y-3">
          <GoldButton onClick={() => onDone(profile)}>{t(lang, "next")}</GoldButton>
          <GhostButton onClick={() => onDone({ ...profile, photo: undefined })}>{t(lang, "skip")}</GhostButton>
          <GhostButton onClick={onBack}>{t(lang, "back")}</GhostButton>
        </div>
      </div>
    </Screen>
  );
}
