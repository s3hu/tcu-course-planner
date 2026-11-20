import type { SupabaseClient } from "@supabase/supabase-js";

export const cloudConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let pendingClient: Promise<SupabaseClient> | null = null;

export function getCloudClient(): Promise<SupabaseClient> {
  if (!cloudConfigured) return Promise.reject(new Error("アカウント保存の接続設定が完了していません。"));
  if (!pendingClient) pendingClient = import("@supabase/supabase-js").then(({ createClient }) => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
  ));
  return pendingClient;
}

export async function releaseCloudClient() {
  const previous = pendingClient;
  pendingClient = null;
  const client = await previous?.catch(() => null);
  await client?.auth.dispose();
}

export function authEmailRedirectTo({ origin, pathname }: Pick<Location, "origin" | "pathname">) {
  return origin + pathname;
}

type DatasetState = { datasetId: string };
type Sanitize<T extends DatasetState> = (value: unknown) => T | null;

export async function readCloudPlan<T extends DatasetState>(userId: string, datasetId: string, sanitize: Sanitize<T>) {
  const client = await getCloudClient();
  const { data, error } = await client.from("course_plans").select("state,revision")
    .eq("user_id", userId).eq("dataset_id", datasetId).maybeSingle();
  if (error) throw new Error("保存したプランを読み込めませんでした。接続設定を確認してから再試行してください。");
  if (!data) return null;
  const state = sanitize(data.state);
  if (!state || state.datasetId !== datasetId) {
    throw new Error("保存したプランの形式が異なります。現在の保存内容は上書きしていません。");
  }
  return { state, revision: Number(data.revision) };
}

export async function writeCloudPlan<T extends DatasetState>(
  userId: string, datasetId: string, sanitize: Sanitize<T>, state: T, revision: number | null,
) {
  const clean = sanitize(state);
  if (!clean || clean.datasetId !== datasetId) throw new Error("保存するプランの形式を確認してください。");
  const client = await getCloudClient();
  if (revision === null) {
    const { data, error } = await client.from("course_plans")
      .insert({ user_id: userId, dataset_id: datasetId, state: clean, revision: 1 }).select("revision").single();
    if (error) throw new Error("初回保存に失敗しました。別の端末で作成済みの場合は、ログインし直して読み込んでください。");
    return Number(data.revision);
  }
  const { data, error } = await client.from("course_plans").update({ state: clean, revision: revision + 1 })
    .eq("user_id", userId).eq("dataset_id", datasetId).eq("revision", revision).select("revision").maybeSingle();
  if (error) throw new Error("保存できませんでした。入力は画面に残っています。プランを書き出すか、接続を確認してください。");
  if (!data) throw new Error("別の端末でプランが更新されました。上書きを止めています。今のプランを書き出し、再ログインして最新の内容を読み込んでください。");
  return Number(data.revision);
}
