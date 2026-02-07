import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_BUCKETS = new Set(["team-logos"]);
const DEFAULT_EXPIRY_SECONDS = 3600;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { bucket: string; path: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { bucket, path: paths } = body;
  if (!bucket || !Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ error: "bucket and path[] required" }, { status: 400 });
  }

  const isPublic = PUBLIC_BUCKETS.has(bucket);
  if (!isPublic) {
    const { data: relsData } = await supabase
      .from("parent_player_relationships")
      .select("player_id")
      .eq("parent_id", user.id);
    const rels = (relsData ?? []) as { player_id: string }[];
    const allowedIds = new Set<string>([user.id, ...rels.map((r) => r.player_id)]);
    for (const path of paths) {
      const firstSegment = path.split("/")[0];
      if (!firstSegment || !allowedIds.has(firstSegment)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const expiry = Math.min(Number(request.headers.get("x-expiry")) || DEFAULT_EXPIRY_SECONDS, 86400);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, expiry, { download: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const signed = (data ?? []).map(({ path, signedUrl, error: e }) => ({
    path,
    signedUrl: e ? null : signedUrl,
    error: e ?? null,
  }));
  return NextResponse.json({ signed });
}
