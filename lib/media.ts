export interface SignedUrlResult {
  path: string;
  signedUrl: string | null;
  error: string | null;
}

export async function getSignedUrls(
  bucket: string,
  paths: string[],
  expirySeconds = 3600
): Promise<SignedUrlResult[]> {
  const res = await fetch("/api/media/signed", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-expiry": String(expirySeconds) },
    body: JSON.stringify({ bucket, path: paths }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to get signed URLs");
  }
  const data = (await res.json()) as { signed: SignedUrlResult[] };
  return data.signed ?? [];
}

export async function getSignedUrl(
  bucket: string,
  path: string,
  expirySeconds = 3600
): Promise<string | null> {
  const results = await getSignedUrls(bucket, [path], expirySeconds);
  return results[0]?.signedUrl ?? null;
}
