export type ImageLike = {
  type?: string;
  name?: string;
};

export type PreparedImage = {
  blob: Blob;
  contentType: string;
  extension: string;
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

const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "jpe",
  "jfif",
  "png",
  "webp",
  "heic",
  "heif",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "avif",
];

export function resolveImageContentType(file: ImageLike): string | null {
  const reported = (file.type ?? "").toLowerCase().trim();

  if (MIME_ALIASES[reported]) {
    return MIME_ALIASES[reported];
  }

  const extension = (file.name ?? "").split(".").pop()?.toLowerCase() ?? "";

  return EXTENSION_MIME[extension] ?? null;
}

export function looksLikeImage(file: ImageLike): boolean {
  if ((file.type ?? "").toLowerCase().startsWith("image/")) {
    return true;
  }

  const extension = (file.name ?? "").split(".").pop()?.toLowerCase() ?? "";

  return IMAGE_EXTENSIONS.includes(extension);
}

async function decodeImage(
  file: Blob
): Promise<{ width: number; height: number; source: CanvasImageSource; revoke?: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        source: bitmap,
        revoke: () => bitmap.close(),
      };
    } catch {
      // fall through to the <img> decoder
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not read that image."));
    image.src = objectUrl;
  });

  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    source: image,
    revoke: () => URL.revokeObjectURL(objectUrl),
  };
}

export async function prepareAvatarImage(
  file: File,
  maxDimension = 1024,
  quality = 0.85
): Promise<PreparedImage> {
  const decoded = await decodeImage(file);

  try {
    const scale = Math.min(
      1,
      maxDimension / Math.max(decoded.width, decoded.height)
    );
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not process that image.");
    }

    context.drawImage(decoded.source, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", quality)
    );

    if (!blob) {
      throw new Error("Could not process that image.");
    }

    return { blob, contentType: "image/jpeg", extension: "jpg" };
  } finally {
    decoded.revoke?.();
  }
}
