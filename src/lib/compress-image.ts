import imageCompression from "browser-image-compression";

const MAX_SIZE_MB = 0.3; // 300KB
const MAX_WIDTH_OR_HEIGHT = 1920;

export async function compressImage(file: File): Promise<File> {
  // If the file is already small enough, return it as-is
  if (file.size <= MAX_SIZE_MB * 1024 * 1024) {
    return file;
  }

  const options = {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
    useWebWorker: true,
    fileType: file.type as string,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error("Image compression failed:", error);
    // Return original if compression fails
    return file;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
