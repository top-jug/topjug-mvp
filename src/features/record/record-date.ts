export function shiftRecordMonth(year: number, month: number, delta: number) {
  const shifted = new Date(year, month + delta, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
}
