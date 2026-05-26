export function maskNodeRaw(raw: string): string {
  const trimmed = raw.trim();
  const protocolEnd = trimmed.indexOf("://");

  if (protocolEnd < 0) {
    return "***";
  }

  const prefix = trimmed.slice(0, protocolEnd + 3);
  const body = trimmed.slice(protocolEnd + 3);

  if (body.length <= 12) {
    return `${prefix}${body.slice(0, 3)}***`;
  }

  return `${prefix}${body.slice(0, 8)}***${body.slice(-4)}`;
}
