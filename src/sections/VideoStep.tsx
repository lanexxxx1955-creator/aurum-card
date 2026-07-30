import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { VIDEO_LIMIT_FREE, VIDEO_LIMIT_PRO, type Profile } from "@/lib/types";
import { Screen, Brand, StepHeader, GoldButton, GhostButton } from "@/components/Lux";
import { saveVideo } from "@/lib/idb";
import { haptic } from "@/lib/telegram";

type RecState = "idle" | "recording" | "review" | "denied";

export function VideoStep({
  profile,
  onDone,
  onBack,
}: {
  profile: Profile;
  onDone: (p: Profile) => void;
  onBack: () => void;
}) {
  const lang = profile.lang;
  const limit = profile.pro ? VIDEO_LIMIT_PRO : VIDEO_LIMIT_FREE;

  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  const script = [t(lang, "script1"), t(lang, "script2"), t(lang, "script3"), t(lang, "script4"), t(lang, "script5")];
  const activeLine = Math.min(script.length - 1, Math.floor((elapsed / limit) * script.length));

  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Bind the camera stream AFTER the <video> element mounts (it only exists
     once state === "recording"); keys force remount between live/review */
  useEffect(() => {
    if (state === "recording" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => undefined);
    }
  }, [state]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: true,
      });
      streamRef.current = stream;
      const mime = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) =>
        typeof MediaRecorder !== "undefined" ? MediaRecorder.isTypeSupported(m) : false,
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: mime || "video/webm" });
        blobRef.current = blob;
        setReviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        setState("review");
      };
      recorderRef.current = rec;
      rec.start(250);

      setElapsed(0);
      setState("recording");
      haptic("medium");
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const sec = (Date.now() - startedAt) / 1000;
        setElapsed(sec);
        if (sec >= limit) stop();
      }, 100);
    } catch {
      setState("denied");
    }
  };

  const stop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopStream();
    haptic("success");
  };

  const retake = () => {
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    setReviewUrl(null);
    blobRef.current = null;
    setElapsed(0);
    setState("idle");
  };

  const useVideo = async () => {
    if (blobRef.current) await saveVideo(blobRef.current);
    onDone({ ...profile, hasVideo: true });
  };

  const R = 84;
  const C = 2 * Math.PI * R;
  const frac = state === "recording" ? Math.min(1, elapsed / limit) : 0;

  return (
    <Screen>
      <div className="fade-up">
        <Brand lang={lang} />
        <StepHeader lang={lang} step={4} total={4} title={t(lang, "recordVideo")} hint={t(lang, "videoHint")} />

        {/* Circular stage */}
        <div className="relative mx-auto mb-5 h-52 w-52">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(212,175,55,0.18)" strokeWidth="3" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="url(#goldgrad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - frac)}
              className="ring-progress"
            />
            <defs>
              <linearGradient id="goldgrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8a6a1f" />
                <stop offset="50%" stopColor="#f6e7b2" />
                <stop offset="100%" stopColor="#d4af37" />
              </linearGradient>
            </defs>
          </svg>

          <div className="absolute inset-[10px] overflow-hidden rounded-full bg-[#14100a]">
            {state === "review" && reviewUrl ? (
              <video key="review" ref={videoRef} src={reviewUrl} className="h-full w-full object-cover" controls playsInline />
            ) : state === "recording" ? (
              <video key="rec" ref={videoRef} className="h-full w-full -scale-x-100 object-cover" playsInline muted />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#d4af37]/60">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
                  <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
                  <path d="m15.5 10.5 6-3.5v10l-6-3.5" strokeLinejoin="round" />
                </svg>
                <span className="text-xs">{limit}s</span>
              </div>
            )}
          </div>

          {state === "recording" && (
            <div className="absolute -top-1 right-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs text-red-400">
              <span className="rec-dot inline-block h-2 w-2 rounded-full bg-red-500" />
              {Math.max(0, Math.ceil(limit - elapsed))} {t(lang, "secLeft")}
            </div>
          )}
        </div>

        {/* Teleprompter */}
        <div className="gold-frame mb-6 rounded-2xl p-4">
          <div className="eyebrow mb-2.5 text-center">{t(lang, "scriptTitle")}</div>
          <ol className="space-y-1.5">
            {script.map((line, i) => (
              <li
                key={i}
                className={`flex items-baseline gap-2.5 rounded-lg px-2 py-1 font-display text-lg transition-colors ${
                  state === "recording" && i === activeLine
                    ? "bg-[#d4af37]/12 text-[#f6e7b2]"
                    : "text-[#b9ac86]"
                }`}
              >
                <span className="text-xs text-[#d4af37]/60">{i + 1}.</span>
                {line}
              </li>
            ))}
          </ol>
        </div>

        {state === "denied" && <p className="mb-4 text-center text-sm text-red-400">{t(lang, "cameraDenied")}</p>}

        <div className="space-y-3">
          {state === "idle" || state === "denied" ? (
            <>
              <GoldButton onClick={start}>{t(lang, "startRec")}</GoldButton>
              <GhostButton onClick={() => onDone(profile)}>{t(lang, "skip")}</GhostButton>
            </>
          ) : state === "recording" ? (
            <GoldButton onClick={stop}>{t(lang, "stopRec")}</GoldButton>
          ) : (
            <>
              <GoldButton onClick={useVideo}>{t(lang, "useVideo")}</GoldButton>
              <GhostButton onClick={retake}>{t(lang, "retake")}</GhostButton>
            </>
          )}
          {state !== "recording" && <GhostButton onClick={onBack}>{t(lang, "back")}</GhostButton>}
        </div>
      </div>
    </Screen>
  );
}
