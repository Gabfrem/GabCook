/* Fonctions de l'appareil : son, vibration, écran allumé, notifications, voix,
   partage, presse-papier, compression des photos. Tout est « best effort ». */

let audioCtx: AudioContext | null = null;
let alarmIv: ReturnType<typeof setInterval> | null = null;
let wakeLock: any = null;

export function unlockAudio() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    audioCtx = audioCtx || new AC();
    if (audioCtx && audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    /* ignore */
  }
}
function beep(freq: number, dur: number) {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator(),
      g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    o.connect(g);
    g.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    /* ignore */
  }
}
function ring() {
  beep(880, 0.28);
  setTimeout(() => beep(1150, 0.28), 320);
  setTimeout(() => beep(880, 0.32), 640);
  try {
    navigator.vibrate && navigator.vibrate([300, 140, 300, 140, 500]);
  } catch {
    /* ignore */
  }
}
export function startAlarm() {
  if (alarmIv) return;
  ring();
  alarmIv = setInterval(ring, 1700);
}
export function stopAlarm() {
  if (alarmIv) {
    clearInterval(alarmIv);
    alarmIv = null;
  }
  try {
    navigator.vibrate && navigator.vibrate(0);
  } catch {
    /* ignore */
  }
}
export async function acquireWake() {
  try {
    if ("wakeLock" in navigator) wakeLock = await (navigator as any).wakeLock.request("screen");
  } catch {
    /* ignore */
  }
}
export function releaseWake() {
  try {
    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* ignore */
  }
}
export function requestNotify() {
  try {
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
  } catch {
    /* ignore */
  }
}
export function notify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, icon: "/icons/icon-192.png" });
  } catch {
    /* ignore */
  }
}
export function vibrate(ms: number | number[]) {
  try {
    navigator.vibrate && navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}

/* ---------- lecture à voix haute ---------- */
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;
export function speak(text: string) {
  if (!canSpeak()) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 1;
    const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.toLowerCase().startsWith("fr"));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}
export function stopSpeaking() {
  try {
    if (canSpeak()) speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

/* ---------- partage ---------- */
export async function copyText(t: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    /* repli ci-dessous */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
/** Feuille de partage du téléphone, sinon presse-papier. Renvoie ce qui a été fait. */
export async function shareOrCopy(data: { title: string; text?: string; url?: string }): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (e: any) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  const t = [data.text, data.url].filter(Boolean).join("\n");
  return (await copyText(t)) ? "copied" : "failed";
}

/* ---------- photos ---------- */
/** Redimensionne une photo (côté le plus long = max) en JPEG. */
export function compressPhoto(file: File, max = 1080, quality = 0.82): Promise<{ dataUrl: string; blob: Blob } | null> {
  return new Promise((resolve) => {
    if (!file || (file.type && !/^image\//.test(file.type))) return resolve(null);
    const img = new Image(),
      url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width,
          h = img.naturalHeight || img.height;
        if (!w || !h) {
          URL.revokeObjectURL(url);
          return resolve(null);
        }
        const sc = Math.min(1, max / Math.max(w, h));
        w = Math.round(w * sc);
        h = Math.round(h * sc);
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        cv.getContext("2d")!.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const dataUrl = cv.toDataURL("image/jpeg", quality);
        cv.toBlob((b) => resolve({ dataUrl, blob: b || dataUrlToBlob(dataUrl) }), "image/jpeg", quality);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
/** Petit carré (avatar). */
export function squareThumb(file: File, size = 160): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file || !/^image\//.test(file.type || "image/")) return resolve(null);
    const img = new Image(),
      url = URL.createObjectURL(file);
    img.onload = () => {
      const w = img.naturalWidth,
        h = img.naturalHeight,
        s = Math.min(w, h);
      const cv = document.createElement("canvas");
      cv.width = size;
      cv.height = size;
      cv.getContext("2d")!.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      try {
        resolve(cv.toDataURL("image/jpeg", 0.82));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: (head.match(/:(.*?);/) || [, "image/jpeg"])[1] });
}

export const IOS = typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
export const STANDALONE = typeof window !== "undefined" && (matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);
