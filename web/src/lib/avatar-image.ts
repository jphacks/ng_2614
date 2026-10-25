// 先生のキャラクター（F-20）の画像を、正方形の小さな JPEG（data URL）にする。ブラウザでだけ使う。
// 中央を正方形に切り抜いてから縮める。透明な部分は白で埋める

export const AVATAR_SIZE = 256;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 縮める前の上限
const JPEG_QUALITY = 0.85;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。別の画像を選んでください。"));
    };
    img.src = url;
  });
}

export async function toAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイル（PNG、JPEG など）を選んでください。");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("画像が大きすぎます（10MB まで）。");
  }
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (side === 0) {
    throw new Error("画像を読み込めませんでした。別の画像を選んでください。");
  }

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像を処理できませんでした。");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
