export type SpacePipelineActionKind =
  | "send_letter"
  | "await_external_signature"
  | "publish"
  | "advance_commercial";

export type SpacePipelineAction = {
  kind: SpacePipelineActionKind;
  title: string;
  description: string;
  confirmLabel: string;
};

/**
 * Define el siguiente hito visible del pipeline. La formalización interna no
 * pertenece a esta secuencia: es una excepción administrativa separada.
 */
export function getSpacePipelineAction(status: string): SpacePipelineAction | null {
  switch (status) {
    case "approved":
      return {
        kind: "send_letter",
        title: "Enviar carta de intención",
        description: "El espacio está aprobado. Al confirmar, se enviará la carta y el pipeline pasará a Carta enviada.",
        confirmLabel: "Enviar carta y avanzar",
      };
    case "letter_sent":
      return {
        kind: "await_external_signature",
        title: "Esperando firma externa",
        description: "La carta ya fue enviada. El pipeline avanzará automáticamente cuando el responsable la firme. Esta acción no formaliza ni publica el espacio.",
        confirmLabel: "Entendido",
      };
    case "letter_accepted":
      return {
        kind: "publish",
        title: "Publicar en crowdfunding",
        description: "La carta fue aceptada. Puedes continuar con la publicación y definir la meta de inversión.",
        confirmLabel: "Continuar a publicación",
      };
    case "published":
    case "funded":
    case "in_construction":
      return {
        kind: "advance_commercial",
        title: "Mover en pipeline",
        description: "Registra el siguiente hito operativo de la oferta.",
        confirmLabel: "Continuar",
      };
    default:
      return null;
  }
}
