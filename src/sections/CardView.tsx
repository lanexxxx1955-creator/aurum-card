import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { Screen, Brand, GoldButton, GhostButton } from "@/components/Lux";
import { buildCardUrl, downloadVCard, drawQr } from "@/lib/share";
import { loadVideo } from "@/lib/idb";
import { haptic, openLink, shareViaTelegram } from "@/lib/telegram";

export function CardView({
  profile,
  mode,
  onEdit,
  onOpenPaywall,
  onCreateOwn,
}: {
  profile: Profile;
  mode: "own" | "shared";
  onEdit?: () => void;
  onOpenPaywall?: () => void;
  onCreateOwn?: () => void;
}) {
  const lang = profile.lang;
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);

  const cardUrl = buildCardUrl(profile);

  useEffect(() => {
    if (mode === "own" && profile.hasVideo) {
      loadVideo().then((b) => b && setVideoUrl(URL.createObjectURL(b)));
    }
  }, [mode, profile.hasVideo]);

  useEffect(() => {
    if (showQr && qrRef.current) drawQr(qrRef.current, cardUrl);
  }, [showQr, cardUrl]);

  const share = () => {
    haptic("success");
    shareViaTelegram(cardUrl, `${t(lang, "shareText")} — ${profile.name}`);
  };

  const media = showVideo && videoUrl ? (
    <video src={videoUrl} className="h-full w-full object-cover" controls autoPlay playsInline />
  ) : profile.photo ? (
    <img src={profile.photo} alt={profile.name} className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-[#14100a] font-display text-5xl gold-text">
      {profile.name.trim().charAt(0).toUpperCase()}
    </div>
  );

  return (
    <Screen>
      <div className="fade-up flex flex-1 flex-col">
        <Brand lang={lang} />

        <div className="gold-frame relative mb-5 rounded-3xl px-6 py-8 text-center">
          {/* Watermark */}
          {!profile.pro && (
            <div className="absolute right-4 top-4 z-10 rounded-full border border-[#d4af37]/30 px-2.5 py-0.5 text-[9px] uppercase tracking-widest text-[#d4af37]/60">
              {t(lang, "madeWith")}
            </div>
          )}

          {/* Photo / video circle */}
          <div className="ring-gold mx-auto mb-5 h-40 w-40 overflow-hidden">
            {media}
          </div>

          {videoUrl && !showVideo && (
            <button
              onClick={() => setShowVideo(true)}
              className="btn-ghost-gold mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs"
            >
              ▶ {t(lang, "recordVideo")}
            </button>
          )}

          <h1 className="font-display text-3xl font-semibold leading-tight text-[#f6e7b2]">{profile.name}</h1>

          {(profile.position || profile.company) && (
            <p className="mt-1.5 text-sm text-[#cdbf95]">
              {[profile.position, profile.company].filter(Boolean).join(" · ")}
            </p>
          )}
          {profile.field && <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#8a7f5e]">{profile.field}</p>}

          <div className="mx-auto my-5 w-28 gold-line" />

          {/* Contact actions */}
          <div className="flex justify-center gap-3">
            <a
              href={`https://t.me/${profile.tg.replace(/^@/, "")}`}
              onClick={(e) => {
                e.preventDefault();
                openLink(`https://t.me/${profile.tg.replace(/^@/, "")}`);
              }}
              className="btn-gold flex-1 rounded-xl px-4 py-3 text-sm"
            >
              {t(lang, "writeTG")}
            </a>
            {profile.phone && (
              <a href={`tel:${profile.phone}`} className="btn-ghost-gold flex-1 rounded-xl px-4 py-3 text-sm">
                {t(lang, "call")}
              </a>
            )}
            <button onClick={() => downloadVCard(profile)} className="btn-ghost-gold flex-1 rounded-xl px-4 py-3 text-sm">
              {t(lang, "saveContact")}
            </button>
          </div>

          {/* QR */}
          <button onClick={() => setShowQr((v) => !v)} className="mt-4 text-[11px] uppercase tracking-widest text-[#d4af37]/60">
            QR
          </button>
          {showQr && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <canvas ref={qrRef} className="rounded-xl border border-[#d4af37]/30" />
              <span className="text-[10px] text-[#8a7f5e]">{t(lang, "scanQr")}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {mode === "own" ? (
          <div className="space-y-3">
            <GoldButton onClick={share}>{t(lang, "share")}</GoldButton>
            <div className="flex gap-3">
              <GhostButton onClick={onEdit}>{t(lang, "editCard")}</GhostButton>
              {!profile.pro && <GhostButton onClick={onOpenPaywall}>✦ {t(lang, "proTitle")}</GhostButton>}
            </div>
            {profile.hasVideo && !profile.pro && (
              <p className="text-center text-[11px] leading-relaxed text-[#8a7f5e]">{t(lang, "videoNotShared")}</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <GoldButton onClick={onCreateOwn}>{t(lang, "createOwn")}</GoldButton>
            {profile.hasVideo && (
              <p className="text-center text-[11px] leading-relaxed text-[#8a7f5e]">{t(lang, "videoNotShared")}</p>
            )}
          </div>
        )}
      </div>
    </Screen>
  );
}
