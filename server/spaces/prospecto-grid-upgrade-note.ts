/**
 * Compone la divulgación técnica del prospecto a partir de la nota manual y
 * de la especificación estructurada del transformador propuesta en Espacios.
 * Las notas históricas de texto libre nunca se interpretan como datos técnicos.
 */
export function buildProspectoGridUpgradeNote(technicalNotes: unknown, manualNote?: string): string | undefined {
  const notes = manualNote?.trim();
  let proposedTransformerKva: number | null = null;
  let requiresNewTransformer = false;

  if (typeof technicalNotes === "string" && technicalNotes.trim()) {
    try {
      const parsed = JSON.parse(technicalNotes) as { requiresNewTransformer?: unknown; proposedTransformerKva?: unknown };
      requiresNewTransformer = parsed.requiresNewTransformer === true;
      const numeric = Number(parsed.proposedTransformerKva);
      proposedTransformerKva = Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    } catch {
      // Las notas históricas pueden ser texto libre; no se infieren especificaciones técnicas desde ellas.
    }
  }

  const transformerNote = requiresNewTransformer && proposedTransformerKva
    ? `La ampliación contempla un transformador propuesto de ${proposedTransformerKva} kVA, sujeto a diseño definitivo, cotización y aprobación del operador de red.`
    : undefined;

  return [notes, transformerNote].filter(Boolean).join(" ") || undefined;
}
