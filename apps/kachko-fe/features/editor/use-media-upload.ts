"use client";

import { useCallback, useState } from "react";
import { apiFetch, ApiClientError } from "../../lib/api";
import { useEditor } from "./use-editor";
import type { MediaAsset, MediaUploadTarget } from "@kachko/types";

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

  const uploadFile = useCallback(
    async (file: File, forAvatar: boolean): Promise<MediaAsset | undefined> => {
      setError(null);
      if (!ALLOWED.includes(file.type)) {
        setError("Unsupported file type. Use PNG, JPG, WebP or GIF.");
        return undefined;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("That file is over 5 MB.");
        return undefined;
      }
      setIsUploading(true);
      try {
        const { blob, width, height } = await resizeImage(file);
        const mimeType = blob.type;
        const { storageKey, uploadUrl, method, headers } = await apiFetch<MediaUploadTarget>("/media/upload-url", {
          method: "POST",
          body: JSON.stringify({ mimeType, size: blob.size, forAvatar }),
        });

        let putRes: Response;
        try {
          putRes = await fetch(uploadUrl, { method, headers, body: blob,
            credentials: uploadUrl.startsWith("/") ? "include" : "omit" });
        } catch {
          throw new Error(
            uploadUrl.startsWith("/")
              ? "Could not reach the upload service."
              : "Could not reach R2. Check the bucket CORS policy and try again.",
          );
        }
        if (!putRes.ok) throw new Error(`R2 upload failed (${putRes.status}).`);

        const result = await apiFetch<MediaAsset>("/media/complete", {
          method: "POST",
          body: JSON.stringify({ storageKey, width, height, forAvatar }),
        });
        if (forAvatar) await editor.refetch();
        return result;
      } catch (e) {
        if (e instanceof ApiClientError) setError(e.message);
        else setError((e as Error).message ?? "Upload failed");
        return undefined;
      } finally {
        setIsUploading(false);
      }
    },
    [editor],
  );

  const uploadAvatar = useCallback((file: File) => uploadFile(file, true), [uploadFile]);
  const uploadImage = useCallback((file: File) => uploadFile(file, false), [uploadFile]);

  const removeAvatar = useCallback(async () => {
    setError(null);
    try {
      await apiFetch("/media/avatar", { method: "DELETE" });
      await editor.refetch();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not remove avatar");
    }
  }, [editor]);

  return { isUploading, error, uploadAvatar, uploadImage, removeAvatar };
}
