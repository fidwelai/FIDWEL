export type ImageLike = {
  type?: string;
  name?: string;
};

const MIME_ALIASES: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/png": "image/png",
  "image/x-png": "image/png",
  "image/webp": "image/webp",
};

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function resolveImageContentType(file: ImageLike): string | null {
  const reported = (file.type ?? "").toLowerCase().trim();

  if (MIME_ALIASES[reported]) {
    return MIME_ALIASES[reported];
  }

  const extension = (file.name ?? "").split(".").pop()?.toLowerCase() ?? "";

  return EXTENSION_MIME[extension] ?? null;
}
