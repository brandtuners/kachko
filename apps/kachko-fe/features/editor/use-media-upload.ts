"use client";

import { useCallback, useState } from "react";
import { apiFetch, ApiClientError } from "../../lib/api";
import { useEditor } from "./use-editor";

// Client-side media upload (M6, §10.4). Resizes with the browser's canvas (no
// external dep), requests a server-generated upload target, PUTs raw bytes (local
// mode) or to the R2 presigned URL, then confirms via /media/complete and binds
// the avatar. Works end-to-end locally with zero cloud credentials.
const MAX_DIM = 2048;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function resizeImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, MAX_DIM / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas unavailable"));
      ctx.drawImage(img, 0, 0, width, height);
      const type = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
      canvas.toBlob(
        (blob) => (blob ? resolve({ blob, width, height }) : reject(new Error("resize failed"))),
        type,
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("cannot read image"));
    };
    img.src = url;
  });
}

export function useMediaUpload() {
  const editor = useEditor();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAvatar = useCallback(
    async (file: File) => {
      setError(null);
      if (!ALLOWED.includes(file.type)) {
        setError("Unsupported file type. Use PNG, JPG, WebP or GIF.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("That file is over 5 MB.");
        return;
      }
      setIsUploading(true);
      try {
        const { blob, width, height } = await resizeImage(file);
        const mimeType = blob.type as any;
        const { storageKey, uploadUrl, method, headers } = await apiFetch<{
          storageKey: string;
          uploadUrl: string;
          method: "PUT" | "POST";
          headers: Record<string, string>;
        }>("/media/upload-url", {
          method: "POST",
          body: JSON.stringify({ mimeType, size: blob.size, forAvatar: true }),
        });

        const putRes = await fetch(uploadUrl, { method, headers, body: blob, credentials: "include" });
        if (!putRes.ok) throw new Error("upload failed");

        const result = await apiFetch<{ storageKey: string; url: string; avatarUrl?: string }>("/media/complete", {
          method: "POST",
          body: JSON.stringify({ storageKey, width, height, forAvatar: true }),
        });

        editor.setUserAvatar.mutate(result.avatarUrl ?? result.url);
      } catch (e) {
        if (e instanceof ApiClientError) setError(e.message);
        else setError((e as Error).message ?? "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [editor],
  );

  const removeAvatar = useCallback(() => {
    editor.setUserAvatar.mutate(null);
  }, [editor]);

  return { isUploading, error, uploadAvatar, removeAvatar };
}
