/** Bot API 10 live_photo still sits on photo[]; never OCR the motion clip. */
export function stillFromTelegram(msg: any): { fileId: string; fileUniqueId: string } | null {
  const sizes = msg?.live_photo?.photo ?? msg?.photo;
  if (!Array.isArray(sizes) || !sizes.length) return null;
  const last = sizes[sizes.length - 1];
  if (!last?.file_id) return null;
  return {
    fileId: String(last.file_id),
    fileUniqueId: String(last.file_unique_id ?? last.file_id),
  };
}

export function isLivePhoto(msg: any): boolean {
  return Boolean(msg?.live_photo);
}
