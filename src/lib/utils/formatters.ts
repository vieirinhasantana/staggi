
export function formatRelativeTime(isoString?: string): string {
  if (!isoString) return "Nunca executado";
  try {
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return "Agora mesmo";
    if (diffMinutes < 60) return `há ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `há ${diffHours} h`;
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function formatMinutesLabel(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const hours = mins / 60;
  return hours === 1 ? "1 hora" : `${hours} horas`;
}

export function formatCurrency(
  value: number,
  currency: string = "USD",
  minimumFractionDigits: number = 2
): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency === "BRL" ? "BRL" : "USD",
      minimumFractionDigits,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatPercent(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}
