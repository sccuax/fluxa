import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { apiFetch } from "../services/apiClient";

// Extracted from ProfilePicture.tsx (its original sole call site) once
// ManageProfileScreen needed the exact same upload flow behind a separate
// "Change photo" trigger instead of a click on the avatar itself - both now
// share this hook rather than duplicating the POST /api/profile/avatar
// call. Behavior is unchanged from the original: picking a file previews it
// instantly via a local object URL (revoked on unmount/replacement) while
// the real upload happens in the background; onUploaded reports the
// persisted URL back up once it resolves.
export function useAvatarUpload(onUploaded: (url: string) => void) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("file", file);

    try {
      const { image } = await apiFetch<{ image: string }>("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      onUploaded(image);
    } catch (error) {
      // Best-effort, same fail-open stance as this app's other background
      // requests - the local preview already shows the picked photo, so a
      // failed upload doesn't leave the trigger looking broken, it just
      // won't have actually persisted (reverts to the last real avatar on
      // the next remount/reload).
      console.error("Avatar upload failed", error);
    }
  }

  return {
    preview,
    inputRef,
    openFilePicker: () => inputRef.current?.click(),
    handleFileChange,
  };
}
