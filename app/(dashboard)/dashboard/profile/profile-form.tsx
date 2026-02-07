"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSignedUrl } from "@/lib/media";
import { updateProfileAvatar, updateProfileName } from "@/app/actions/profile";
import formStyles from "@/components/forms.module.css";

interface ProfileFormProps {
  userId: string;
  initialFullName: string;
  initialEmail: string;
  avatarSignedUrl: string | null;
}

export default function ProfileForm({
  userId,
  initialFullName,
  initialEmail,
  avatarSignedUrl,
}: ProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(avatarSignedUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: false });
    setUploading(false);
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    const { error: updateErr } = await updateProfileAvatar(userId, path);
    if (updateErr) {
      setError(updateErr);
      return;
    }
    try {
      const signed = await getSignedUrl("avatars", path);
      setAvatarUrl(signed);
    } catch {
      setAvatarUrl(`/api/media/signed?bucket=avatars&path=${encodeURIComponent(path)}`);
    }
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const { error: updateErr } = await updateProfileName(userId, fullName || null);
    setSaving(false);
    if (updateErr) {
      setError(updateErr);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className={`${formStyles.form} ${formStyles.formMax}`}>
      <div className={formStyles.formGroup}>
        <label className={formStyles.formLabel}>
          Photo
        </label>
        <div className={formStyles.formRow}>
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt=""
              width={64}
              height={64}
              className={formStyles.avatarImg}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            disabled={uploading}
          />
        </div>
        {uploading && <p className={formStyles.formHint}>Uploading…</p>}
      </div>
      <div className={formStyles.formGroup}>
        <label htmlFor="fullName" className={formStyles.formLabel}>
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={formStyles.formInput}
        />
      </div>
      <div className={formStyles.formGroup}>
        <label className={formStyles.formLabel}>
          Email
        </label>
        <input
          type="text"
          value={initialEmail}
          disabled
          className={formStyles.formInputDisabled}
        />
        <p className={formStyles.formHint}>
          Email is managed by your account.
        </p>
      </div>
      {error && <p className={formStyles.formError}>{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className={`${formStyles.formSubmit} ${formStyles.formSubmitStart}`}
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
