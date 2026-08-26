export type UploadReceipt = { id: string; status: "uploading" | "processing" | "ready" | "failed" };

export function sourceUploadTitle(source: { name: string }) {
  return source.name.replace(/\.[^.]+$/, "").trim().slice(0, 200) || "Creator source";
}

export function parseUploadReceipt(payload: unknown): UploadReceipt {
  const data = (payload as { data?: Partial<UploadReceipt> })?.data;
  if (!data?.id || !data.status) throw new Error("The private source upload response was incomplete.");
  return { id: data.id, status: data.status } as UploadReceipt;
}
