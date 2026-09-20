/** 65_000 -> "1:05"; under ten seconds shows tenths: 7_300 -> "0:07.3". */
export function formatTime(ms: number): string {
  if (ms < 10_000) {
    const tenths = Math.floor(ms / 100);
    return `0:0${Math.floor(tenths / 10)}.${tenths % 10}`;
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
