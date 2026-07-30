import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { Screen, Brand, GoldButton, GhostButton } from "@/components/Lux";
import { buildCardUrl, downloadVCard, drawQr } from "@/lib/share";
import { loadVideo } from "@/lib/idb";
import { uploadGreetingVideo, telegramVideoUrl, BotApiError } from "@/lib/botapi";
import { BOT_USERNAME, proxyConfigured } from "@/lib/config";
import { haptic, openLink, shareViaTelegram, getInitData } from "@/lib/telegram";

type CloudStatus = "idle" | "uploading" | "cloud" | "need-start" | "error";

export function CardView({
  profile,
  mode,
  onEdit,
  onOpenPaywall,
  onCreateOwn,
  onProfileChange,
}: {
  profile: Profile;
  mode: "own" | "shared";
  onEdit?: () => void;
  onOpenPaywall?: () => void;
  onCreateOwn?: () => void;
  onProfileChange?: (p: Profile) => void;
}) {
  const lang = profile.lang;
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [cloud, setCloud] = useState<CloudStatus>(profile.videoFileId ? "cloud" : "idle");
  const qrRef = useRef<HTMLCanvasElement>(null);
  const uploadStarted = useRef(false);

  const cardUrl = buildCardUrl(profile);

  /* Own card: play the local recording; push it to Telegram cloud once */
  useEffect(() => {
    if (mode !== "own" || !profile.hasVideo) return;
    loadVideo().then((b) => b && setVideoUrl((u) => u ?? URL.createObjectURL(b)));
  }, [mode, profile.hasVideo]);

  useEffect(() => {
    if (mode !== "own" || !profile.hasVideo || profile.videoFileId || uploadStarted.current) return;
    const initData = getInitData();
    if (!initData || !proxyConfigured()) return; // browser preview or proxy not deployed yet
    uploadStarted.current = true;
    setCloud("uploading");
    (async () => {
      try {
        const blob = await loadVideo();
        if (!blob) throw new Error("no local video");
        const fileId = await uploadGreetingVideo(initData, blob);
        onProfileChange?.({ ...profile, videoFileId: fileId });
        setCloud("cloud");
      } catch (e) {
        if (e instanceof BotApiError && (e.code === 403 || /initiate|blocked/i.test(e.message))) {
          setCloud("need-start");
        } else {
          setCloud("error");
        }
        uploadStarted.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, profile.hasVideo, profile.videoFileId]);

  /* Shared card: stream the greeting video from Telegram cloud via the proxy */
  useEffect(() => {
    if (mode !== "shared" || !profile.videoFileId) return;
    setVideoUrl(telegramVideoUrl(profile.videoFileId));
  }, [mode, profile.videoFileId]);

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
          <div className="ring-gold relative mx-auto mb-5 h-40 w-40 overflow-hidden">
            {media}
            {videoUrl && !showVideo && (
              <button
                onClick={() => setShowVideo(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors hover:bg-black/25"
                aria-label={t(lang, "recordVideo")}
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d4af37] pl-1 text-xl text-[#17120a] shadow-[0_0_30px_rgba(212,175,55,0.6)]">
                  ▶
                </span>
              </button>
            )}
          </div>

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

        {/* Cloud status (own card, after recording) */}
        {mode === "own" && profile.hasVideo && cloud !== "idle" && (
          <p className="mb-4 text-center text-[11px] leading-relaxed text-[#8a7f5e]">
            {cloud === "uploading" && "☁️ Загружаем видео в облако Telegram…"}
            {cloud === "cloud" && "✓ Видео в облаке Telegram — получатели увидят его в визитке"}
            {cloud === "error" && "⚠ Не удалось загрузить видео в облако. Попробуем ещё раз при следующем открытии."}
            {cloud === "need-start" && (
              <>
                ⚠ Чтобы видео попало в облако, откройте чат с ботом и нажмите Start:{" "}
                <a
                  href={`https://t.me/${BOT_USERNAME}`}
                  onClick={(e) => {
                    e.preventDefault();
                    openLink(`https://t.me/${BOT_USERNAME}?start=cloud`);
                  }}
                  className="text-[#d4af37] underline"
                >
                  @{BOT_USERNAME}
                </a>
              </>
            )}
          </p>
        )}

        {/* Actions */}
        {mode === "own" ? (
          <div className="space-y-3">
            <GoldButton onClick={share}>{t(lang, "share")}</GoldButton>
            <div className="flex gap-3">
              <GhostButton onClick={onEdit}>{t(lang, "editCard")}</GhostButton>
              {!profile.pro && <GhostButton onClick={onOpenPaywall}>✦ {t(lang, "proTitle")}</GhostButton>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <GoldButton onClick={onCreateOwn}>{t(lang, "createOwn")}</GoldButton>
            {profile.hasVideo && !profile.videoFileId && (
              <p className="text-center text-[11px] leading-relaxed text-[#8a7f5e]">{t(lang, "videoNotShared")}</p>
            )}
          </div>
        )}
      </div>
    </Screen>
  );
}
