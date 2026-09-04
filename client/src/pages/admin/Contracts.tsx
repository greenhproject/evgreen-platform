import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, CheckCircle2, ClipboardCheck, Download, Eye, FileCheck2, FileOutput, FileSearch, FileSignature, FileText, History, Landmark, Link2, Loader2, Pencil, Plus, Send, Settings2, ShieldCheck, Tags, Trash2, Upload, XCircle } from "lucide-react";
import type { ContractVariableName } from "@shared/site-contracts";
import { CONTRACT_PARTY_FIELD_LABELS, EMPTY_CONTRACT_PARTY, contractPartyValidationMessage, validateContractParty, type ContractPartyData, type ContractPartyField } from "@shared/contract-parties";

type ContractAction = { id: number; type: "manual" | "docusign" | "cancel" | "verify" | "reject" } | null;

const STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "border-slate-500/30 bg-slate-500/10 text-slate-300" },
  READY: { label: "Listo para formalizar", className: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
  DOCUSIGN_SENT: { label: "Enviado a DocuSign", className: "border-violet-500/30 bg-violet-500/10 text-violet-300" },
  DOCUSIGN_COMPLETED: { label: "Firmado por DocuSign", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  DOCUSIGN_DECLINED: { label: "Rechazado en DocuSign", className: "border-red-500/30 bg-red-500/10 text-red-300" },
  DOCUSIGN_VOIDED: { label: "Anulado", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  DOCUSIGN_EXPIRED: { label: "Expirado", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  MANUAL_PDF_ISSUED: { label: "PDF emitido", className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" },
  MANUAL_PDF_RETURNED: { label: "PDF devuelto", className: "border-orange-500/30 bg-orange-500/10 text-orange-300" },
  MANUAL_PDF_VERIFIED: { label: "Firma manuscrita verificada", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  MANUAL_PDF_REJECTED: { label: "PDF manual rechazado", className: "border-red-500/30 bg-red-500/10 text-red-300" },
  CANCELLED: { label: "Cancelado", className: "border-slate-500/30 bg-slate-500/10 text-slate-300" },
};

function formatDate(value?: string | Date | null) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin registro" : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function downloadBase64Pdf(base64: string, fileName: string) {
  const bytes = Uint8Array.from(window.atob(base64), character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { label: status, className: "border-slate-500/30 bg-slate-500/10 text-slate-300" };
  return <Badge className={`border px-2 py-1 font-medium ${meta.className}`}>{meta.label}</Badge>;
}

function SectionTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
    </div>
    {action}
  </div>;
}

function PartyFields({ prefix, title, value, onChange, errors = {} }: { prefix: string; title: string; value: ContractPartyData; onChange: (next: ContractPartyData) => void; errors?: Partial<Record<ContractPartyField, string>> }) {
  const set = (key: ContractPartyField, next: string) => onChange({ ...value, [key]: next });
  const fieldClass = "min-w-0 space-y-1.5";
  const fieldId = (key: ContractPartyField) => `contract-${prefix.toLowerCase()}-${key}`;
  const inputProps = (key: ContractPartyField) => ({ id: fieldId(key), "data-contract-field": key, "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `${fieldId(key)}-error` : undefined, className: errors[key] ? "border-red-400/70 focus-visible:ring-red-400" : undefined });
  const error = (key: ContractPartyField) => errors[key] ? <p id={`${fieldId(key)}-error`} className="text-xs leading-5 text-red-300">{errors[key]}</p> : null;
  return <section className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-5">
    <p className="mb-4 text-sm font-semibold text-white">{title}</p>
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <div className={`${fieldClass} md:col-span-2`}><Label htmlFor={fieldId("legalName")}>Razón social</Label><Input {...inputProps("legalName")} value={value.legalName} onChange={event => set("legalName", event.target.value)} placeholder={`${prefix} razón social`} />{error("legalName")}</div>
      <div className={fieldClass}><Label htmlFor={fieldId("taxId")}>NIT</Label><Input {...inputProps("taxId")} value={value.taxId} onChange={event => set("taxId", event.target.value)} placeholder="900.000.000-0" />{error("taxId")}</div>
      <div className={fieldClass}><Label htmlFor={fieldId("email")}>Correo para firma</Label><Input {...inputProps("email")} type="email" value={value.email} onChange={event => set("email", event.target.value)} placeholder="correo@empresa.com" />{error("email")}</div>
      <div className={fieldClass}><Label htmlFor={fieldId("representativeName")}>Representante autorizado</Label><Input {...inputProps("representativeName")} value={value.representativeName} onChange={event => set("representativeName", event.target.value)} />{error("representativeName")}</div>
      <div className={fieldClass}><Label htmlFor={fieldId("representativeDocument")}>Documento del representante</Label><Input {...inputProps("representativeDocument")} value={value.representativeDocument} onChange={event => set("representativeDocument", event.target.value)} inputMode="numeric" />{error("representativeDocument")}</div>
      <div className={fieldClass}><Label htmlFor={fieldId("representativeTitle")}>Cargo</Label><Input {...inputProps("representativeTitle")} value={value.representativeTitle} onChange={event => set("representativeTitle", event.target.value)} placeholder="Representante legal" />{error("representativeTitle")}</div>
      <div className={fieldClass}><Label htmlFor={fieldId("phone")}>Teléfono</Label><Input {...inputProps("phone")} value={value.phone} onChange={event => set("phone", event.target.value)} />{error("phone")}</div>
      <div className={`${fieldClass} md:col-span-2`}><Label htmlFor={fieldId("notificationAddress")}>Dirección de notificaciones</Label><Input {...inputProps("notificationAddress")} value={value.notificationAddress} onChange={event => set("notificationAddress", event.target.value)} />{error("notificationAddress")}</div>
      <div className={`${fieldClass} md:col-span-2`}><Label htmlFor={fieldId("domicile")}>Domicilio</Label><Input {...inputProps("domicile")} value={value.domicile} onChange={event => set("domicile", event.target.value)} placeholder="Ciudad, Colombia" />{error("domicile")}</div>
    </div>
  </section>;
}

const emptyParty = { ...EMPTY_CONTRACT_PARTY };

function readableContractError(message: string): string {
  try {
    const issues = JSON.parse(message);
    if (Array.isArray(issues)) {
      const fields = issues.map(issue => issue?.path?.[0] === "ally" ? issue?.path?.[1] as ContractPartyField : null).filter(Boolean) as ContractPartyField[];
      if (fields.length) return `Complete los datos obligatorios del aliado: ${[...new Set(fields)].map(field => CONTRACT_PARTY_FIELD_LABELS[field] || field).join(", ")}.`;
    }
  } catch {
    // Los mensajes de negocio del servidor ya son legibles.
  }
  return message;
}

export default function AdminContracts() {
  const utils = trpc.useUtils();
  const [templateDialog, setTemplateDialog] = useState(false);
  const [templateReviewId, setTemplateReviewId] = useState<number | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<any | null>(null);
  const [deleteTemplateConfirmation, setDeleteTemplateConfirmation] = useState("");
  const [contractDialog, setContractDialog] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [ally, setAlly] = useState({ ...emptyParty });
  const [allyErrors, setAllyErrors] = useState<Partial<Record<ContractPartyField, string>>>({});
  const [variables, setVariables] = useState({ PARTICIPACION_ALIADO_PORCENTAJE: "10", PLAZO_INICIAL_ANOS: "10", PRORROGA_ANOS: "5", PLAZO_PAGO_DIAS_HABILES: "15", FECHA_CIERRE_LIQUIDACION: "Último día calendario de cada mes", AREA_CEDIDA_M2: "", PUESTOS_PARQUEO: "", PLANO_ANEXO_URL: "", MARCA_COMERCIAL: "EVGreen" });
  const [contractAction, setContractAction] = useState<ContractAction>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const signedPdfInput = useRef<HTMLInputElement>(null);
  const [manualUploadContractId, setManualUploadContractId] = useState<number | null>(null);

  const { data: templates = [], isLoading: templatesLoading } = trpc.contracts.listTemplates.useQuery();
  const { data: spaces = [] } = trpc.contracts.listEligibleSpaces.useQuery();
  const { data: contracts = [], isLoading: contractsLoading } = trpc.contracts.listContracts.useQuery();
  const { data: docusign } = trpc.contracts.getDocusignConfig.useQuery();
  const { data: operatorProfile } = trpc.contracts.getContractOperatorProfile.useQuery();
  const activeTemplates = useMemo(() => templates.filter((item: any) => item.status === "ACTIVE"), [templates]);
  const selectableTemplates = useMemo(() => templates.filter((item: any) => item.status !== "RETIRED"), [templates]);
  const availableSpaces = useMemo(() => spaces.filter((item: any) => item.canCreateContract), [spaces]);

  const invalidate = () => Promise.all([utils.contracts.listTemplates.invalidate(), utils.contracts.listContracts.invalidate(), utils.contracts.listEligibleSpaces.invalidate(), utils.contracts.getDocusignConfig.invalidate(), utils.contracts.getContractOperatorProfile.invalidate()]);
  const createContract = trpc.contracts.createContract.useMutation({ onSuccess: result => { toast.success(`Contrato ${result.contractNumber} creado y congelado.`); setContractDialog(false); invalidate(); }, onError: error => toast.error(readableContractError(error.message)) });
  const previewContract = trpc.contracts.previewContractPdf.useMutation({
    onSuccess: result => {
      downloadBase64Pdf(result.pdfBase64, `${result.contractNumber}-v${result.templateVersion}.pdf`);
      toast.success(`Vista previa v${result.templateVersion} generada sin emitir ni activar el contrato.`);
    },
    onError: error => toast.error(readableContractError(error.message)),
  });
  const deleteTemplate = trpc.contracts.deleteDraftTemplate.useMutation({
    onSuccess: () => {
      toast.success("El borrador duplicado fue eliminado del centro contractual.");
      if (templateReviewId === templateToDelete?.id) setTemplateReviewId(null);
      setTemplateToDelete(null);
      setDeleteTemplateConfirmation("");
      invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const issueManual = trpc.contracts.issueManualPdf.useMutation({ onSuccess: result => {
    const shareUrl = result.sharePath ? new URL(result.sharePath, window.location.origin).toString() : "";
    if (shareUrl && navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(() => toast.success("PDF emitido y enlace temporal copiado para compartir con la EDS.")).catch(() => toast.success("PDF emitido; copie el enlace desde la lista de contratos."));
    else toast.success("PDF final emitido para firma manuscrita.");
    if (result.pdfUrl) window.open(result.pdfUrl, "_blank", "noopener,noreferrer");
    invalidate();
  }, onError: error => toast.error(error.message) });
  const sendDocusign = trpc.contracts.sendToDocusign.useMutation({ onSuccess: () => { toast.success("Contrato enviado a DocuSign en el orden configurado."); invalidate(); }, onError: error => toast.error(error.message) });
  const cancelContract = trpc.contracts.cancelContract.useMutation({ onSuccess: () => { toast.success("Contrato cancelado y registrado en el expediente."); setContractAction(null); invalidate(); }, onError: error => toast.error(error.message) });
  const verifyManual = trpc.contracts.verifyManualSignedPdf.useMutation({ onSuccess: () => { toast.success("El resultado de la revisión manual quedó registrado."); setContractAction(null); invalidate(); }, onError: error => toast.error(error.message) });
  const uploadManual = trpc.contracts.uploadManualSignedPdf.useMutation({ onSuccess: () => { toast.success("PDF firmado recibido; queda pendiente de verificación administrativa."); setManualUploadContractId(null); invalidate(); }, onError: error => toast.error(error.message) });

  const selectedSpace = spaces.find((item: any) => String(item.id) === selectedSpaceId) as any;
  const selectedTemplate = templates.find((item: any) => String(item.id) === selectedTemplateId) as any;
  const validatedAlly = () => {
    const validation = validateContractParty(ally);
    setAllyErrors(validation.fieldErrors);
    if (!validation.valid) {
      const firstField = validation.invalidFields[0];
      window.setTimeout(() => document.querySelector<HTMLInputElement>(`[data-contract-field="${firstField}"]`)?.focus(), 0);
      toast.error(contractPartyValidationMessage(ally) || "Complete los datos obligatorios del aliado.");
      return null;
    }
    setAlly(validation.data);
    return validation.data;
  };
  const startContract = () => {
    if (!selectedSpaceId || !selectedTemplateId) return toast.error("Selecciona el espacio formalizado y la plantilla activa.");
    if (!selectedSpace?.canCreateContract) return toast.error(selectedSpace?.eligibilityReason || "Este espacio no puede recibir un nuevo contrato.");
    if (selectedTemplate?.status !== "ACTIVE") return toast.error("La emisión exige una plantilla activa y aprobada jurídicamente. Use la vista previa para revisar borradores.");
    if (!operatorProfile?.isVerified) return toast.error("Confirme primero los datos legales permanentes de Green House Project SAS.");
    const validAlly = validatedAlly();
    if (!validAlly) return;
    createContract.mutate({ submissionId: Number(selectedSpaceId), templateId: Number(selectedTemplateId), variables, ally: validAlly });
  };
  const startPreview = () => {
    if (!selectedSpaceId || !selectedTemplateId) return toast.error("Selecciona un espacio y una plantilla para generar la vista previa.");
    const validAlly = validatedAlly();
    if (!validAlly) return;
    previewContract.mutate({ submissionId: Number(selectedSpaceId), templateId: Number(selectedTemplateId), variables, ally: validAlly });
  };

  const loadSpaceData = (id: string) => {
    setSelectedSpaceId(id);
    const space: any = spaces.find((item: any) => String(item.id) === id);
    if (space) {
      setAlly({ ...emptyParty, ...(space.allyPrefill || {}), legalName: space.allyPrefill?.legalName || space.submitterCompany || "", representativeName: space.letterSignerName || space.submitterName || "", representativeDocument: space.letterSignerDocument || space.submitterDocument || "" });
      setAllyErrors({});
      setVariables(previous => ({ ...previous, AREA_CEDIDA_M2: space.availableAreaM2?.toString() || previous.AREA_CEDIDA_M2, PUESTOS_PARQUEO: space.parkingSpots?.toString() || previous.PUESTOS_PARQUEO }));
    }
  };

  const onManualFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const id = manualUploadContractId;
    if (!file || !id) return;
    if (file.type !== "application/pdf") return toast.error("Selecciona un PDF firmado.");
    if (file.size > 10 * 1024 * 1024) return toast.error("El PDF firmado no puede superar 10 MB.");
    try { uploadManual.mutate({ id, fileName: file.name, fileBase64: await readFileAsBase64(file) }); } catch (error: any) { toast.error(error.message); }
    event.target.value = "";
  };

  return <div className="min-h-full bg-[#07110d] text-slate-100">
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <SectionTitle eyebrow="Formalización de sitios" title="Expediente contractual" description="Cree un contrato desde una plantilla aprobada, congele sus variables y elija firma electrónica DocuSign o PDF para firma manuscrita. Cada ruta conserva un historial independiente y auditable." action={<Button onClick={() => setContractDialog(true)} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"><Plus className="mr-2 h-4 w-4" />Nuevo contrato</Button>} />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"><FileCheck2 className="h-5 w-5 text-emerald-400" /><p className="mt-4 text-2xl font-semibold">{activeTemplates.length}</p><p className="text-sm text-slate-400">Plantillas activas para contratos futuros</p></div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"><ClipboardCheck className="h-5 w-5 text-blue-400" /><p className="mt-4 text-2xl font-semibold">{availableSpaces.length}</p><p className="text-sm text-slate-400">Espacios formalizados disponibles</p><p className="mt-1 text-xs text-slate-500">{spaces.length} cartas o formalizaciones registradas</p></div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"><ShieldCheck className="h-5 w-5 text-violet-400" /><p className="mt-4 text-sm font-semibold text-white">{docusign?.ready ? "DocuSign listo" : "DocuSign pendiente"}</p><p className="text-sm text-slate-400">{docusign?.ready ? "Configuración y conexión disponibles" : "Configure y pruebe la integración antes de enviar"}</p></div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold text-white">Dos modalidades, un mismo contrato congelado</h2><p className="mt-1 text-sm text-slate-400">El hash, la versión y las variables no cambian entre la emisión electrónica y la descarga para firma manual.</p></div><div className="flex flex-wrap gap-2"><ContractOperatorProfileSettings /><Button variant="outline" onClick={() => setTemplateDialog(true)}><Upload className="mr-2 h-4 w-4" />Cargar plantilla</Button><DocusignSettings /></div></div>
        <div className="mt-6 grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-4"><FileSignature className="h-5 w-5 text-violet-300" /><p className="mt-3 font-medium text-white">Firma electrónica DocuSign</p><p className="mt-1 text-sm leading-6 text-slate-400">Envía en secuencia al representante de la EDS y luego a Green House Project SAS. Al finalizar, se almacena el contrato y certificado del proveedor.</p></div><div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4"><FileOutput className="h-5 w-5 text-cyan-300" /><p className="mt-3 font-medium text-white">PDF para firma manuscrita</p><p className="mt-1 text-sm leading-6 text-slate-400">Descarga el PDF final con bloques de firma. Al retornar firmado, Administración lo carga y verifica sin atribuirle certificación electrónica.</p></div></div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.6fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">Plantillas y versiones</h2><p className="mt-1 text-sm text-slate-400">Cambie condiciones creando una nueva versión; las expedidas quedan inmutables.</p></div><History className="h-5 w-5 text-slate-500" /></div><div className="mt-5 space-y-3">{templatesLoading ? <Loader2 className="animate-spin text-emerald-400" /> : templates.length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-400">Aún no hay plantillas. Cargue el DOCX revisado por Legal.</p> : templates.map((template: any) => <div key={template.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-white">{template.name}</p><p className="mt-1 text-xs text-slate-500">v{template.version} · {template.sourceFilename}</p></div><StatusBadge status={template.status} /></div><p className="mt-3 text-xs text-slate-500">SHA-256: {template.contentHash.slice(0, 16)}… · {template.contractCount || 0} contrato{template.contractCount === 1 ? "" : "s"} asociado{template.contractCount === 1 ? "" : "s"}</p><div className="mt-3 flex flex-wrap items-center gap-2"><Button size="sm" variant="ghost" onClick={() => setTemplateReviewId(template.id)}><Pencil className="mr-1.5 h-3.5 w-3.5" />{template.status === "DRAFT" ? "Revisar y activar" : "Ver versión"}</Button>{template.canDelete ? <Button size="sm" variant="ghost" className="text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => { setTemplateToDelete(template); setDeleteTemplateConfirmation(""); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Eliminar borrador</Button> : <span className="text-xs text-slate-500">{template.deletionBlockReason}</span>}</div></div>)}</div></div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">Contratos por sitio</h2><p className="mt-1 text-sm text-slate-400">Control de emisión, firma, devolución y verificación.</p></div><Landmark className="h-5 w-5 text-emerald-400" /></div><div className="mt-5 space-y-3">{contractsLoading ? <Loader2 className="animate-spin text-emerald-400" /> : contracts.length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-400">No se han emitido contratos todavía.</p> : contracts.map((contract: any) => <article key={contract.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-white">{contract.spaceName}</p><StatusBadge status={contract.status} /></div><p className="mt-1 text-sm text-slate-400">{contract.contractNumber} · {contract.city} · {contract.templateName} v{contract.templateVersion}</p><p className="mt-2 text-xs text-slate-500">Actualizado {formatDate(contract.updatedAt)} · SHA-256 {contract.contentHash.slice(0, 16)}…</p></div><div className="flex flex-wrap gap-2">{contract.draftPdfUrl && <Button size="sm" variant="outline" onClick={() => window.open(contract.draftPdfUrl, "_blank", "noopener,noreferrer")}><Download className="mr-1.5 h-3.5 w-3.5" />PDF</Button>}{contract.status === "READY" && <><Button size="sm" variant="outline" onClick={() => setContractAction({ id: contract.id, type: "manual" })}><FileOutput className="mr-1.5 h-3.5 w-3.5" />Emitir manual</Button><Button size="sm" disabled={!docusign?.ready} onClick={() => setContractAction({ id: contract.id, type: "docusign" })}><Send className="mr-1.5 h-3.5 w-3.5" />DocuSign</Button></>}{contract.status === "MANUAL_PDF_ISSUED" && <Button size="sm" variant="outline" onClick={() => { setManualUploadContractId(contract.id); signedPdfInput.current?.click(); }}><Upload className="mr-1.5 h-3.5 w-3.5" />Cargar firmado</Button>}{contract.status === "MANUAL_PDF_RETURNED" && <><Button size="sm" onClick={() => setContractAction({ id: contract.id, type: "verify" })}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Verificar</Button><Button size="sm" variant="outline" onClick={() => setContractAction({ id: contract.id, type: "reject" })}><XCircle className="mr-1.5 h-3.5 w-3.5" />Rechazar</Button></>}{!["DOCUSIGN_COMPLETED", "MANUAL_PDF_VERIFIED", "CANCELLED"].includes(contract.status) && <Button size="sm" variant="ghost" className="text-red-300 hover:text-red-200" onClick={() => setContractAction({ id: contract.id, type: "cancel" })}>Anular</Button>}</div></div></article>)}</div></div>
      </section>
      <input ref={signedPdfInput} className="hidden" type="file" accept="application/pdf" onChange={onManualFile} />
    </div>

    <TemplateDialog open={templateDialog} onOpenChange={setTemplateDialog} onCreated={invalidate} />
    <TemplateReviewDialog templateId={templateReviewId} onOpenChange={open => !open && setTemplateReviewId(null)} onSaved={invalidate} />
    <Dialog open={contractDialog} onOpenChange={setContractDialog}>
      <DialogContent className="grid max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden bg-[#09130f] p-0 text-slate-100 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] xl:max-w-[1400px]">
        <DialogHeader className="border-b border-white/10 px-4 py-4 pr-12 sm:px-6">
          <DialogTitle>Nuevo contrato de concesión</DialogTitle>
          <DialogDescription>Seleccione un negocio formalizado, complete los datos y revise el documento antes de emitirlo.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6">
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <div className="min-w-0 space-y-1.5"><Label>Espacio con carta firmada o formalización registrada</Label><select className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={selectedSpaceId} onChange={event => loadSpaceData(event.target.value)}><option value="">Seleccionar espacio</option>{spaces.map((space: any) => <option value={space.id} key={space.id} disabled={!space.canCreateContract}>{space.spaceName} · {space.city} · {space.code}{space.canCreateContract ? "" : ` · ${space.eligibilityReason}`}</option>)}</select><p className="text-xs leading-5 text-slate-500">Se muestran firmas digitales y formalizaciones manuales. Un expediente vigente aparece protegido.</p></div>
            <div className="min-w-0 space-y-1.5"><Label>Plantilla para vista previa o emisión</Label><select className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={selectedTemplateId} onChange={event => setSelectedTemplateId(event.target.value)}><option value="">Seleccionar plantilla</option>{selectableTemplates.map((template: any) => <option value={template.id} key={template.id}>{template.name} · v{template.version} · {STATUS_META[template.status]?.label || template.status}</option>)}</select></div>
          </section>
          {selectedSpace && <div className={`rounded-xl border p-3 text-sm ${selectedSpace.canCreateContract ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-100" : "border-amber-400/20 bg-amber-400/5 text-amber-100"}`}><p className="font-medium">{selectedSpace.formalizationSource === "DIGITAL_LETTER" ? "Carta firmada digitalmente" : "Formalización manual registrada"} · {formatDate(selectedSpace.formalizedAt)}</p><p className="mt-1 text-xs opacity-80">{selectedSpace.eligibilityReason} · {selectedSpace.address}</p><p className="mt-2 text-xs font-medium">{selectedSpace.letterSignerDocument ? "Nombre y documento del firmante precargados desde la constancia digital." : "Esta formalización no conserva documento del firmante; complete y verifique ese dato antes de generar el contrato."}</p></div>}
          {selectedTemplate?.status === "DRAFT" && <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-100">Esta versión permanece en borrador. Puede descargar una vista previa, pero no emitir contratos hasta completar la revisión jurídica y activarla.</div>}
          {Object.keys(allyErrors).length > 0 && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100"><p className="font-semibold">Complete los datos del aliado antes de continuar</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{Object.values(allyErrors).map(message => <li key={message}>{message}</li>)}</ul></div>}
          <div className="grid min-w-0 gap-5 2xl:grid-cols-2"><PartyFields prefix="EDS" title="Parte 1 · EDS o aliado del sitio" value={ally} errors={allyErrors} onChange={next => { setAlly(next); setAllyErrors(validateContractParty(next).fieldErrors); }} /><section className="min-w-0 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-white">Parte 2 · Green House Project SAS</p><Badge className={operatorProfile?.isVerified ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}>{operatorProfile?.isVerified ? "Perfil confirmado" : "Configuración pendiente"}</Badge></div>{operatorProfile?.profile && <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-xs text-slate-500">Razón social</p><p className="font-medium text-white">{operatorProfile.profile.legalName}</p></div><div><p className="text-xs text-slate-500">NIT</p><p className="font-medium text-white">{operatorProfile.profile.taxId}</p></div><div><p className="text-xs text-slate-500">Representante</p><p className="font-medium text-white">{operatorProfile.profile.representativeName || "Pendiente"}</p></div><div><p className="text-xs text-slate-500">Documento</p><p className="font-medium text-white">{operatorProfile.profile.representativeDocument || "Pendiente"}</p></div><div className="sm:col-span-2"><p className="text-xs text-slate-500">Dirección de notificaciones</p><p className="font-medium text-white">{operatorProfile.profile.notificationAddress || "Pendiente"}</p></div></div>}<p className="mt-4 text-xs leading-5 text-slate-400">Estos datos se administran una sola vez y el servidor los congela en cada expediente. No pueden reemplazarse desde este formulario.</p></section></div>
          <section className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-5"><p className="mb-4 text-sm font-semibold text-white">Condiciones parametrizadas</p><div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">{Object.entries(variables).map(([key, value]) => <div className="min-w-0 space-y-1.5" key={key}><Label className="text-xs leading-tight">{key.replaceAll("_", " ")}</Label><Input value={value} onChange={event => setVariables(previous => ({ ...previous, [key]: event.target.value }))} /></div>)}</div></section>
        </div>
        <DialogFooter className="flex flex-col-reverse gap-2 border-t border-white/10 bg-[#09130f] px-4 py-4 sm:flex-row sm:justify-end sm:px-6"><Button className="w-full sm:w-auto" variant="outline" onClick={() => setContractDialog(false)}>Cancelar</Button><Button className="w-full sm:w-auto" variant="outline" onClick={startPreview} disabled={previewContract.isPending || !selectedSpace?.canCreateContract || !operatorProfile?.isComplete}>{previewContract.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}Descargar vista previa</Button><Button className="w-full sm:w-auto" onClick={startContract} disabled={createContract.isPending || selectedTemplate?.status !== "ACTIVE" || !selectedSpace?.canCreateContract || !operatorProfile?.isVerified}>{createContract.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Generar contrato congelado</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={Boolean(contractAction)} onOpenChange={open => !open && setContractAction(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{contractAction?.type === "manual" ? "Emitir PDF para firma manuscrita" : contractAction?.type === "docusign" ? "Enviar contrato a DocuSign" : contractAction?.type === "verify" ? "Verificar PDF firmado manualmente" : contractAction?.type === "reject" ? "Rechazar PDF manuscrito" : "Anular contrato"}</AlertDialogTitle><AlertDialogDescription>{contractAction?.type === "manual" ? "El PDF se descargará con la versión, variables y hash ya congelados. Luego podrá cargarse el escaneo firmado." : contractAction?.type === "docusign" ? "Se enviará el mismo PDF congelado primero al representante de la EDS y después al representante de Green House Project SAS." : "Esta decisión se registrará de forma permanente en el expediente contractual."}</AlertDialogDescription></AlertDialogHeader>{["verify", "reject", "cancel"].includes(contractAction?.type || "") && <Textarea value={decisionNote} onChange={event => setDecisionNote(event.target.value)} placeholder="Explique la verificación, rechazo o motivo de anulación (mínimo 10 caracteres)." />}<AlertDialogFooter><AlertDialogCancel>Volver</AlertDialogCancel><AlertDialogAction onClick={() => { if (!contractAction) return; if (["verify", "reject", "cancel"].includes(contractAction.type) && decisionNote.trim().length < 10) return toast.error("Registra una nota de al menos 10 caracteres."); if (contractAction.type === "manual") issueManual.mutate({ id: contractAction.id }); if (contractAction.type === "docusign") sendDocusign.mutate({ id: contractAction.id }); if (contractAction.type === "verify") verifyManual.mutate({ id: contractAction.id, accepted: true, note: decisionNote.trim() }); if (contractAction.type === "reject") verifyManual.mutate({ id: contractAction.id, accepted: false, note: decisionNote.trim() }); if (contractAction.type === "cancel") cancelContract.mutate({ id: contractAction.id, reason: decisionNote.trim() }); }}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

    <AlertDialog open={Boolean(templateToDelete)} onOpenChange={open => { if (!open && !deleteTemplate.isPending) { setTemplateToDelete(null); setDeleteTemplateConfirmation(""); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar borrador contractual</AlertDialogTitle>
          <AlertDialogDescription>Esta acción retira definitivamente la versión del centro contractual. Solo está permitida para borradores que nunca han sido usados; las versiones activas, retiradas o asociadas a contratos permanecen protegidas.</AlertDialogDescription>
        </AlertDialogHeader>
        {templateToDelete && <div className="space-y-3"><div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm"><p className="font-medium text-foreground">{templateToDelete.name}</p><p className="mt-1 text-muted-foreground">Versión {templateToDelete.version} · {templateToDelete.sourceFilename}</p></div><div><Label htmlFor="delete-template-version">Escriba <strong>{templateToDelete.version}</strong> para confirmar</Label><Input id="delete-template-version" value={deleteTemplateConfirmation} onChange={event => setDeleteTemplateConfirmation(event.target.value)} autoComplete="off" /></div></div>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTemplate.isPending}>Conservar borrador</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 text-white hover:bg-red-500" disabled={!templateToDelete || deleteTemplateConfirmation.trim() !== templateToDelete.version || deleteTemplate.isPending} onClick={event => { event.preventDefault(); if (templateToDelete) deleteTemplate.mutate({ id: templateToDelete.id, confirmVersion: deleteTemplateConfirmation.trim() }); }}>{deleteTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Eliminar definitivamente</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

function TemplateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState("Contrato de concesión de sitio");
  const [version, setVersion] = useState("1.0");
  const [file, setFile] = useState<File | null>(null);
  const [sourceMode, setSourceMode] = useState<"UPLOAD" | "GOOGLE_DRIVE">("UPLOAD");
  const [googleUrl, setGoogleUrl] = useState("");
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const resetAnalysis = () => {
    setAnalysis(null);
    setMappings({});
    setPreview(null);
    setStep(1);
  };
  const close = () => {
    resetAnalysis();
    setFile(null);
    setGoogleUrl("");
    onOpenChange(false);
  };
  const buildSource = async () => {
    if (sourceMode === "GOOGLE_DRIVE") {
      if (!googleUrl.trim()) throw new Error("Pegue un enlace de Google Docs o Drive con acceso de lectura.");
      return { kind: "GOOGLE_DRIVE" as const, sourceUrl: googleUrl.trim() };
    }
    if (!file) throw new Error("Seleccione un archivo DOCX o PDF.");
    if (file.size > 10 * 1024 * 1024) throw new Error("La plantilla no puede superar 10 MB.");
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".docx") && !lowerName.endsWith(".pdf")) throw new Error("Seleccione un archivo DOCX o PDF.");
    return {
      kind: "UPLOAD" as const,
      filename: file.name,
      contentType: lowerName.endsWith(".pdf") ? "application/pdf" as const : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const,
      fileBase64: await readFileAsBase64(file),
    };
  };

  const analyze = trpc.contracts.analyzeTemplateSource.useMutation({
    onSuccess: result => {
      setAnalysis(result);
      setMappings(Object.fromEntries(result.markers.map((marker: any) => [marker.rawName, marker.suggestedVariable || ""])));
      setPreview(null);
      setStep(2);
      toast.success(`${result.markers.length} campos dinámicos detectados. Revise cada asociación.`);
    },
    onError: error => toast.error(error.message),
  });
  const previewMapping = trpc.contracts.previewTemplateMapping.useMutation({
    onSuccess: result => {
      setPreview(result);
      setStep(3);
      toast.success("Mapeo validado. Revise visualmente el documento antes de guardarlo.");
    },
    onError: error => toast.error(error.message),
  });
  const create = trpc.contracts.createTemplateFromMappedSource.useMutation({
    onSuccess: result => {
      toast.success(`Plantilla ${result.sourceFormat === "PDF_ACROFORM" ? "PDF rellenable" : "DOCX"} guardada como borrador. Requiere aprobación jurídica antes de activarse.`);
      onCreated();
      close();
    },
    onError: error => toast.error(error.message),
  });

  const startAnalysis = async () => {
    try { analyze.mutate({ source: await buildSource() }); } catch (error: any) { toast.error(error.message); }
  };
  const startPreview = async () => {
    if (!analysis) return;
    const pending = analysis.markers.filter((marker: any) => !mappings[marker.rawName]);
    if (pending.length) return toast.error(`Asocie los ${pending.length} campos pendientes antes de continuar.`);
    const completedMappings = mappings as Record<string, ContractVariableName>;
    try { previewMapping.mutate({ source: await buildSource(), expectedSourceHash: analysis.sourceHash, mappings: completedMappings }); } catch (error: any) { toast.error(error.message); }
  };
  const saveTemplate = async () => {
    if (!analysis || !preview) return toast.error("Genere y revise la vista previa antes de guardar.");
    if (name.trim().length < 3 || !version.trim()) return toast.error("Complete el nombre y la versión jurídica.");
    const completedMappings = mappings as Record<string, ContractVariableName>;
    try {
      create.mutate({ name, version, source: await buildSource(), expectedSourceHash: analysis.sourceHash, previewFingerprint: preview.fingerprint, mappings: completedMappings });
    } catch (error: any) { toast.error(error.message); }
  };
  const setMapping = (rawName: string, variable: string) => {
    setMappings(previous => ({ ...previous, [rawName]: variable }));
    setPreview(null);
    setStep(2);
  };
  const mappedCount = analysis?.markers.filter((marker: any) => mappings[marker.rawName]).length || 0;

  return <Dialog open={open} onOpenChange={nextOpen => nextOpen ? onOpenChange(true) : close()}>
    <DialogContent className="grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden bg-[#09130f] p-0 text-slate-100 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] xl:max-w-6xl">
      <DialogHeader className="border-b border-white/10 px-4 py-4 pr-12 sm:px-6">
        <DialogTitle>Importar y mapear plantilla contractual</DialogTitle>
        <DialogDescription>Analice la fuente, asocie cada marcador con un dato de EVGreen y valide visualmente antes de guardar el borrador.</DialogDescription>
        <div className="grid grid-cols-3 gap-2 pt-3 text-xs">
          {[{ id: 1, label: "Fuente", icon: FileSearch }, { id: 2, label: "Mapeo", icon: Tags }, { id: 3, label: "Vista previa", icon: Eye }].map(item => <div key={item.id} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 ${step === item.id ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : step > item.id ? "border-white/10 bg-white/5 text-slate-300" : "border-white/5 text-slate-600"}`}><item.icon className="h-3.5 w-3.5" />{item.label}</div>)}
        </div>
      </DialogHeader>

      <div className="min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6">
        {step === 1 && <div className="mx-auto max-w-3xl space-y-5">
          <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label>Nombre de la plantilla</Label><Input value={name} onChange={event => setName(event.target.value)} /></div><div className="space-y-1.5"><Label>Versión jurídica</Label><Input value={version} onChange={event => setVersion(event.target.value)} placeholder="Ej. 3.0" /></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><Button variant={sourceMode === "UPLOAD" ? "default" : "outline"} onClick={() => { setSourceMode("UPLOAD"); resetAnalysis(); }}><Upload className="mr-2 h-4 w-4" />Archivo DOCX o PDF</Button><Button variant={sourceMode === "GOOGLE_DRIVE" ? "default" : "outline"} onClick={() => { setSourceMode("GOOGLE_DRIVE"); resetAnalysis(); }}><Link2 className="mr-2 h-4 w-4" />Google Docs o Drive</Button></div>
          {sourceMode === "UPLOAD" ? <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/50 p-5"><Label>Archivo contractual</Label><Input className="mt-2" type="file" accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" onChange={event => { setFile(event.target.files?.[0] || null); resetAnalysis(); }} /><p className="mt-3 text-xs leading-5 text-slate-500">DOCX detecta cualquier texto entre doble llave. PDF solo funciona como plantilla dinámica cuando contiene campos rellenables AcroForm; un PDF plano se carga posteriormente como documento firmado manualmente.</p></div> : <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"><Label>Enlace compartido</Label><Input className="mt-2" type="url" value={googleUrl} onChange={event => { setGoogleUrl(event.target.value); resetAnalysis(); }} placeholder="https://docs.google.com/document/d/.../edit" /><p className="mt-3 text-xs leading-5 text-slate-500">El enlace debe permitir lectura. Google Docs se exporta de forma segura a DOCX; Drive puede contener DOCX o PDF rellenable. No se solicitan credenciales de Google.</p></div>}
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm leading-6 text-emerald-100"><strong>El análisis no guarda nada.</strong> Primero detecta los marcadores, propone etiquetas y calcula el hash del archivo.</div>
        </div>}

        {step === 2 && analysis && <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-white">{analysis.filename}</p><p className="mt-1 text-xs text-slate-500">{analysis.sourceFormat === "PDF_ACROFORM" ? `PDF rellenable · ${analysis.pageCount} páginas` : "Documento Word"} · SHA-256 {analysis.sourceHash.slice(0, 16)}…</p></div><Badge className="w-fit border-emerald-400/30 bg-emerald-400/10 text-emerald-200">{mappedCount}/{analysis.markers.length} asociados</Badge></div>
          <div className="grid gap-4 lg:grid-cols-2">{analysis.markers.map((marker: any) => <div key={marker.rawName} className={`min-w-0 rounded-xl border p-4 ${mappings[marker.rawName] ? "border-emerald-400/20 bg-emerald-400/5" : "border-amber-400/30 bg-amber-400/5"}`}><div className="mb-3 flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-mono text-sm text-white">{`{{${marker.rawName}}}`}</p><p className="mt-1 text-xs text-slate-500">{marker.occurrences} aparición{marker.occurrences === 1 ? "" : "es"}{marker.suggestedVariable ? " · sugerencia automática" : " · requiere asociación"}</p></div>{mappings[marker.rawName] && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />}</div><Label>Dato dinámico asociado</Label><select className="mt-1 h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm" value={mappings[marker.rawName] || ""} onChange={event => setMapping(marker.rawName, event.target.value)}><option value="">Seleccionar etiqueta…</option>{analysis.catalog.map((variable: any) => <option key={variable.name} value={variable.name}>{variable.label} · {variable.name}</option>)}</select>{mappings[marker.rawName] && <p className="mt-2 text-xs text-emerald-200/70">Ejemplo: {analysis.catalog.find((variable: any) => variable.name === mappings[marker.rawName])?.sampleValue}</p>}</div>)}</div>
          {analysis.warnings.length > 0 && <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-amber-100">Advertencias de conversión: {analysis.warnings.join(" · ")}</div>}
        </div>}

        {step === 3 && analysis && preview && <div className="grid min-h-[520px] gap-5 xl:grid-cols-[340px_minmax(0,1fr)]"><aside className="space-y-4"><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4"><p className="font-medium text-emerald-100">Mapeo completo y validado</p><p className="mt-2 text-xs leading-5 text-emerald-100/70">{preview.variables.length} variables canónicas. Si cambia una asociación deberá generar nuevamente la vista previa.</p></div><div className="max-h-[410px] space-y-2 overflow-y-auto pr-1">{analysis.markers.map((marker: any) => { const variable = analysis.catalog.find((item: any) => item.name === mappings[marker.rawName]); return <div key={marker.rawName} className="rounded-lg border border-white/10 bg-slate-950/50 p-3 text-xs"><p className="font-mono text-slate-400">{`{{${marker.rawName}}}`}</p><p className="mt-1 font-medium text-white">{variable?.label}</p><p className="mt-1 text-emerald-300">{variable?.sampleValue}</p></div>; })}</div></aside><section className="min-h-[520px] overflow-hidden rounded-xl border border-white/10 bg-white">{preview.previewHtml ? <iframe title="Vista previa de la plantilla" className="h-[70vh] min-h-[520px] w-full bg-white" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#111;padding:32px;line-height:1.45}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px}img{max-width:100%}</style></head><body>${preview.previewHtml}</body></html>`} /> : <object aria-label="Vista previa PDF rellenable" className="h-[70vh] min-h-[520px] w-full" data={`data:application/pdf;base64,${preview.previewPdfBase64}`} type="application/pdf"><p className="p-6 text-slate-900">El navegador no puede mostrar el PDF incrustado.</p></object>}</section></div>}
      </div>

      <DialogFooter className="flex flex-col-reverse gap-2 border-t border-white/10 bg-[#09130f] px-4 py-4 sm:flex-row sm:justify-between sm:px-6">
        <div>{step > 1 && <Button className="w-full sm:w-auto" variant="ghost" onClick={() => { setPreview(null); setStep(step === 3 ? 2 : 1); }}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row"><Button className="w-full sm:w-auto" variant="outline" onClick={close}>Cancelar</Button>{step === 1 && <Button className="w-full sm:w-auto" onClick={startAnalysis} disabled={analyze.isPending}>{analyze.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Analizar fuente</Button>}{step === 2 && <Button className="w-full sm:w-auto" onClick={startPreview} disabled={previewMapping.isPending || mappedCount !== analysis?.markers.length}>{previewMapping.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Validar y previsualizar</Button>}{step === 3 && <Button className="w-full sm:w-auto" onClick={saveTemplate} disabled={create.isPending}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar como borrador</Button>}</div>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function TemplateReviewDialog({ templateId, onOpenChange, onSaved }: { templateId: number | null; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const { data: template, isLoading } = trpc.contracts.getTemplate.useQuery({ id: templateId || 0 }, { enabled: Boolean(templateId) });
  const [htmlContent, setHtmlContent] = useState("");
  const [legalReviewNote, setLegalReviewNote] = useState("");

  useEffect(() => {
    if (template) {
      setHtmlContent(template.htmlContent);
      setLegalReviewNote(template.legalReviewNote || "");
    }
  }, [template]);

  const update = trpc.contracts.updateDraftTemplate.useMutation({
    onSuccess: () => { toast.success("Borrador actualizado; la versión activa no se modificó."); onSaved(); },
    onError: error => toast.error(error.message),
  });
  const activate = trpc.contracts.activateTemplate.useMutation({
    onSuccess: () => { toast.success("Nueva versión activada solo para contratos futuros."); onSaved(); onOpenChange(false); },
    onError: error => toast.error(error.message),
  });
  const isDraft = template?.status === "DRAFT";
  const savedMappings = template?.variableSchema && typeof template.variableSchema === "object" && "mappings" in template.variableSchema
    ? Object.entries((template.variableSchema as any).mappings || {})
    : [];
  const sourceFormat = template?.variableSchema && typeof template.variableSchema === "object" && "sourceFormat" in template.variableSchema
    ? String((template.variableSchema as any).sourceFormat || "DOCX")
    : "DOCX";
  const noteReady = legalReviewNote.trim().length >= 20;
  const markersReady = Boolean(template?.markerValidation?.valid);
  const operatorReady = Boolean(template?.operatorProfile?.isVerified);
  const activationReady = Boolean(isDraft && noteReady && markersReady && operatorReady);

  return <Dialog open={Boolean(templateId)} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto bg-[#09130f] text-slate-100">
      <DialogHeader>
        <DialogTitle>{template ? `${template.name} · v${template.version}` : "Plantilla contractual"}</DialogTitle>
        <DialogDescription>Revise las variables y el contenido antes de activar esta versión. La activación retira la versión anterior solo para nuevos contratos; los expedientes existentes permanecen inmutables.</DialogDescription>
      </DialogHeader>
      {isLoading || !template ? <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-emerald-400" /></div> : <div className="space-y-4 py-3">
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-400"><span className="font-semibold text-slate-200">Archivo fuente:</span> {template.sourceFilename} · {sourceFormat === "PDF_ACROFORM" ? "PDF rellenable" : "DOCX"} · SHA-256 {template.contentHash}</div>
        {savedMappings.length > 0 && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4"><p className="text-sm font-semibold text-emerald-100">Mapeo guardado · {savedMappings.length} campos</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{savedMappings.map(([rawName, variable]) => <div key={rawName} className="min-w-0 rounded-lg border border-white/10 bg-slate-950/50 p-3 text-xs"><p className="truncate font-mono text-slate-400">{`{{${rawName}}}`}</p><p className="mt-1 truncate font-medium text-white">{String(variable)}</p></div>)}</div></div>}
        {isDraft && <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-sm font-semibold text-white">Requisitos para activar</p><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">{[{ ready: markersReady, label: "Marcadores válidos", detail: template.markerValidation?.message }, { ready: operatorReady, label: "Datos legales GHP", detail: operatorReady ? "Perfil confirmado por Administración." : `Pendientes: ${template.operatorProfile?.missingFields?.join(", ") || "confirmación del perfil"}.` }, { ready: noteReady, label: "Aprobación documentada", detail: noteReady ? "Nota de revisión suficiente." : `Escriba al menos 20 caracteres (${legalReviewNote.trim().length}/20).` }].map(item => <div key={item.label} className={`rounded-lg border p-3 ${item.ready ? "border-emerald-400/20 bg-emerald-400/5" : "border-amber-400/20 bg-amber-400/5"}`}><p className={`font-medium ${item.ready ? "text-emerald-200" : "text-amber-200"}`}>{item.ready ? "Listo" : "Pendiente"} · {item.label}</p><p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p></div>)}</div></div>}
        <div><Label>Nota de revisión jurídica y comercial</Label><Textarea value={legalReviewNote} onChange={event => setLegalReviewNote(event.target.value)} placeholder="Indique aprobación, responsable y alcance de los cambios de esta versión." /></div>
        <div><Label>Contenido HTML importado</Label><Textarea rows={16} value={htmlContent} disabled={!isDraft} onChange={event => setHtmlContent(event.target.value)} className="font-mono text-xs leading-5" /><p className="mt-2 text-xs text-slate-500">Use marcadores como <code>{"{{ALIADO_RAZON_SOCIAL}}"}</code>. Solo las versiones en borrador pueden editarse.</p></div>
      </div>}
      <DialogFooter>
        {isDraft && <>
          <Button variant="outline" onClick={() => update.mutate({ id: template.id, htmlContent, legalReviewNote })} disabled={update.isPending}>Guardar borrador</Button>
          <Button onClick={() => activate.mutate({ id: template.id, htmlContent, legalReviewNote })} disabled={activate.isPending || !activationReady} title={activationReady ? "Activar esta versión" : "Complete los tres requisitos indicados arriba"}>{activate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Activar para nuevos contratos</Button>
        </>}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function ContractOperatorProfileSettings() {
  const utils = trpc.useUtils();
  const { data } = trpc.contracts.getContractOperatorProfile.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyParty });
  const [confirmed, setConfirmed] = useState(false);
  const save = trpc.contracts.saveContractOperatorProfile.useMutation({
    onSuccess: () => {
      toast.success("Datos legales de Green House Project SAS confirmados y disponibles para todos los contratos.");
      utils.contracts.getContractOperatorProfile.invalidate();
      utils.contracts.getTemplate.invalidate();
      utils.contracts.listTemplates.invalidate();
      setConfirmed(false);
      setOpen(false);
    },
    onError: error => toast.error(error.message),
  });
  const openDialog = () => {
    setForm({ ...emptyParty, ...(data?.profile || {}) });
    setConfirmed(false);
    setOpen(true);
  };

  return <>
    <Button variant="outline" onClick={openDialog} disabled={!data}><ShieldCheck className="mr-2 h-4 w-4" />Datos legales GHP{data?.isVerified ? " · Confirmados" : " · Pendientes"}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden bg-[#09130f] p-0 text-slate-100 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-3xl">
        <DialogHeader className="border-b border-white/10 px-4 py-4 pr-12 sm:px-6">
          <DialogTitle>Perfil legal permanente del operador</DialogTitle>
          <DialogDescription>Estos datos se precargan desde la configuración central y el servidor los congela en cada contrato emitido.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100">Confirme el nombre y documento del representante contra el certificado de existencia y representación legal vigente. El sistema no infiere ni corrige apellidos desde plantillas históricas.</div>
          <PartyFields prefix="GHP" title="Green House Project SAS" value={form} onChange={setForm} />
          {(data?.missingFields?.length ?? 0) > 0 && <p className="rounded-lg border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-400">Actualmente faltan: {data?.missingFields?.join(", ")}.</p>}
          <label className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm leading-6 text-emerald-100"><input className="mt-1 h-4 w-4" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Confirmo que estos datos corresponden a la información legal vigente y autorizo su uso para contratos futuros.</span></label>
        </div>
        <DialogFooter className="flex flex-col-reverse gap-2 border-t border-white/10 bg-[#09130f] px-4 py-4 sm:flex-row sm:justify-end sm:px-6"><Button className="w-full sm:w-auto" variant="outline" onClick={() => setOpen(false)} disabled={save.isPending}>Cancelar</Button><Button className="w-full sm:w-auto" onClick={() => save.mutate({ profile: form as any, confirmCurrent: true })} disabled={!confirmed || save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar y confirmar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function DocusignSettings() {
  const utils = trpc.useUtils();
  const { data } = trpc.contracts.getDocusignConfig.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const save = trpc.contracts.saveDocusignConfig.useMutation({
    onSuccess: () => { toast.success("Configuración DocuSign guardada."); utils.contracts.getDocusignConfig.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const test = trpc.contracts.testDocusignConnection.useMutation({
    onSuccess: result => { result.success ? toast.success(result.message) : toast.error(result.message); utils.contracts.getDocusignConfig.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const openDialog = () => {
    setForm({ environment: data?.environment || "SANDBOX", enabled: data?.enabled || false, integrationKey: data?.integrationKey || "", userId: data?.userId || "", accountId: data?.accountId || "", consentRedirectUri: data?.consentRedirectUri || "", privateKey: "", webhookSecret: "" });
    setOpen(true);
  };
  return <>
    <Button variant="outline" onClick={openDialog}><Settings2 className="mr-2 h-4 w-4" />DocuSign</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto bg-[#09130f] text-slate-100">
        <DialogHeader><DialogTitle>Configuración segura de DocuSign</DialogTitle><DialogDescription>Las credenciales permanecen cifradas y enmascaradas. Guarde, otorgue consentimiento JWT y pruebe la conexión antes de habilitar envíos. Configure DocuSign Connect con <code>/api/docusign/webhook</code> y HMAC.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-3 sm:grid-cols-2">
          <div><Label>Entorno</Label><select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.environment} onChange={event => setForm({ ...form, environment: event.target.value })}><option value="SANDBOX">Sandbox / demo</option><option value="PRODUCTION">Producción</option></select></div>
          <div className="flex items-end gap-2"><input id="docusign-enabled" type="checkbox" checked={form.enabled} onChange={event => setForm({ ...form, enabled: event.target.checked })} /><Label htmlFor="docusign-enabled">Habilitar envíos DocuSign</Label></div>
          <div className="sm:col-span-2"><Label>Integration Key</Label><Input value={form.integrationKey} onChange={event => setForm({ ...form, integrationKey: event.target.value })} /></div>
          <div><Label>User ID de servicio</Label><Input value={form.userId} onChange={event => setForm({ ...form, userId: event.target.value })} /></div>
          <div><Label>Account ID</Label><Input value={form.accountId} onChange={event => setForm({ ...form, accountId: event.target.value })} /></div>
          <div className="sm:col-span-2"><Label>URI de retorno configurada en DocuSign</Label><Input type="url" value={form.consentRedirectUri} onChange={event => setForm({ ...form, consentRedirectUri: event.target.value })} placeholder="https://app.evgreen.lat/admin/contracts" /></div>
          <div className="sm:col-span-2"><Label>Clave privada RSA {data?.hasPrivateKey ? "(deje vacía para conservarla)" : ""}</Label><Textarea rows={4} value={form.privateKey} onChange={event => setForm({ ...form, privateKey: event.target.value })} placeholder="-----BEGIN RSA PRIVATE KEY-----" /></div>
          <div className="sm:col-span-2"><Label>Secreto HMAC de DocuSign Connect {data?.hasWebhookSecret ? "(deje vacío para conservarlo)" : ""}</Label><Input type="password" value={form.webhookSecret} onChange={event => setForm({ ...form, webhookSecret: event.target.value })} /></div>
        </div>
        {data?.consentUrl && <a className="block rounded-lg border border-violet-400/30 bg-violet-400/10 p-3 text-sm font-medium text-violet-100 hover:bg-violet-400/15" href={data.consentUrl} target="_blank" rel="noreferrer">1. Otorgar consentimiento JWT en DocuSign</a>}
        {data?.lastTestMessage && <p className={`rounded-lg p-3 text-sm ${data.lastTestStatus === "SUCCESS" ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"}`}>{data.lastTestMessage}</p>}
        <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>3. Probar conexión</Button><Button onClick={() => save.mutate(form)} disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
