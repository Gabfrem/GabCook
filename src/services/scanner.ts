/* ==========================================================================
   SCANNER DE CODES-BARRES : caméra -> code -> Open Food Facts.
   Deux décodeurs : BarcodeDetector quand le navigateur l'a (Chrome Android),
   sinon ZXing, chargé à la demande (indispensable sur iPhone).
   ========================================================================== */
import type { OffProduct } from "../core/off";

export interface ScanSession {
  stop(): void;
}
type Status = (msg: string, err?: boolean) => void;

function videoPrete(v: HTMLVideoElement, alive: () => boolean, msMax = 6000): Promise<boolean> {
  return new Promise((res) => {
    const t0 = Date.now();
    const check = () => {
      if (!alive()) return res(false);
      if (v.videoWidth > 0 && v.readyState >= 2) return res(true);
      if (Date.now() - t0 > msMax) return res(false);
      setTimeout(check, 120);
    };
    check();
  });
}

export async function startScanner(video: HTMLVideoElement, onCode: (code: string) => void, status: Status): Promise<ScanSession | null> {
  let alive = true;
  let stream: MediaStream | null = null;
  let loop: ReturnType<typeof setTimeout> | null = null;
  let controls: { stop(): void } | null = null;
  const session: ScanSession = {
    stop() {
      alive = false;
      if (loop) clearTimeout(loop);
      try {
        controls && controls.stop();
      } catch {
        /* ignore */
      }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      try {
        video.srcObject = null;
      } catch {
        /* ignore */
      }
    }
  };
  if (!isSecureContext) {
    status("La caméra exige une connexion sécurisée (https).", true);
    return null;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    status("Ce navigateur ne donne pas accès à la caméra. Photographie le code.", true);
    return null;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
  } catch (e: any) {
    status(e && e.name === "NotAllowedError" ? "Accès à la caméra refusé. Tu peux photographier le code." : "Caméra indisponible. Photographie le code.", true);
    return null;
  }
  video.srcObject = stream;
  try {
    await video.play();
  } catch {
    /* ignore */
  }
  status("Démarrage de la caméra…");
  const pret = await videoPrete(video, () => alive);
  if (!alive) return session;
  if (!pret) {
    status("La caméra ne renvoie pas d'image. Photographie le code.", true);
    return session;
  }
  const BD = (window as any).BarcodeDetector;
  if (BD) {
    let det: any;
    try {
      det = new BD({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
    } catch {
      det = new BD();
    }
    const tick = async () => {
      if (!alive) return;
      try {
        const codes = await det.detect(video);
        if (codes && codes.length) onCode(codes[0].rawValue);
      } catch {
        /* ignore */
      }
      loop = setTimeout(tick, 280);
    };
    status("Vise le code-barres du produit");
    void tick();
    return session;
  }
  status("Préparation du lecteur…");
  try {
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    if (!alive) return session;
    const reader = new BrowserMultiFormatReader();
    controls = await reader.decodeFromVideoElement(video, (res) => {
      if (res && alive) onCode(res.getText());
    });
    status("Vise le code-barres du produit");
  } catch {
    status("Lecteur indisponible. Photographie le code.", true);
  }
  return session;
}

/** Lit un code-barres sur une photo (plus fiable quand la lecture en direct peine). */
export async function decodeImageFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const BD = (window as any).BarcodeDetector;
    if (BD) {
      const img = new Image();
      img.src = url;
      await img.decode();
      const codes = await new BD().detect(img);
      return codes && codes.length ? codes[0].rawValue : null;
    }
    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const r = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
    return r ? r.getText() : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function lookupProduct(code: string): Promise<OffProduct | null> {
  try {
    const r = await fetch(
      "https://world.openfoodfacts.org/api/v2/product/" + code + ".json?fields=product_name,product_name_fr,quantity,product_quantity,categories_tags,brands"
    );
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.status === 1 ? (j.product as OffProduct) : null;
  } catch {
    return null;
  }
}
