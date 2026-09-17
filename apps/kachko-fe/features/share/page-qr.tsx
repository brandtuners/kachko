"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { IconDownload } from "../../components/icons";

export function PageQr({ url, username, size = 224 }: { url: string; username: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setFailed(false);
    if (!url) return () => { active = false; };
    void QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 1024,
      color: { dark: "#111312", light: "#ffffff" },
    }).then((value) => {
      if (active) setDataUrl(value);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [size, url]);

  if (failed) {
    return <p className="grid aspect-square place-items-center rounded-2xl bg-[#f4f6ef] p-5 text-center text-sm text-[#b4322c]" style={{ width: size }}>Couldn&apos;t generate this QR code.</p>;
  }

  if (!dataUrl) {
    return <div className="grid aspect-square place-items-center rounded-2xl bg-[#f4f6ef]" style={{ width: size }} aria-label="Generating QR code"><span className="h-7 w-7 animate-spin rounded-full border-2 border-[#dfe3d6] border-t-[#111312]" /></div>;
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <div className="rounded-2xl border border-[#e5e8df] bg-white p-3 shadow-[0_12px_35px_-18px_rgba(17,19,18,.35)]">
        {/* A generated data URL is already a complete local image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} width={size} height={size} alt={`QR code for @${username}`} className="block h-auto max-w-full" />
      </div>
      <a href={dataUrl} download={`kachko-${username}-qr.png`} className="k-btn-line !rounded-full">
        <IconDownload className="h-4 w-4" />
        Download QR
      </a>
    </div>
  );
}
