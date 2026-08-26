import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

export { formatBytes, formatDuration } from "@/lib/media-format";

export type LocalCreatorMedia = {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  durationMs: number | null;
  origin: "library" | "files";
};

function inferVideoFile(name: string, mimeType: string | null) {
  return Boolean(mimeType?.startsWith("video/")) || /\.(mp4|mov|m4v|webm)$/i.test(name);
}

export async function selectVideoFromLibrary(): Promise<LocalCreatorMedia | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["videos"],
    quality: 1,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  });

  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? "Creator video",
    mimeType: asset.mimeType ?? null,
    size: asset.fileSize ?? null,
    durationMs: asset.duration ?? null,
    origin: "library",
  };
}

export async function selectVideoFromFiles(): Promise<LocalCreatorMedia | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (!inferVideoFile(asset.name, asset.mimeType ?? null)) {
    throw new Error("Choose an MP4, MOV, M4V, or WebM video.");
  }

  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? null,
    size: asset.size ?? null,
    durationMs: null,
    origin: "files",
  };
}
