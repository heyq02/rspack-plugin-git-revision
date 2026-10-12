export function removeEmptyLines(value: string): string {
  return value.replace(/[\s\r\n]+$/, '');
}
