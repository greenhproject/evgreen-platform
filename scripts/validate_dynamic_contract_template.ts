import { mkdir, readFile, writeFile } from "node:fs/promises";
import mammoth from "mammoth";
import { appendContractSignatureBlocks, generateContractPdf, sha256 } from "../server/contracts/contract-pdf-service";
import { normalizeContractVariables, renderContractTemplate, unresolvedContractVariables } from "../shared/site-contracts";

const sourcePath = "/home/ubuntu/green-ev-platform/docs/Contrato_Aliado_EVGreen_V2_PLANTILLA_DINAMICA.docx";
const outputDir = "/home/ubuntu/contract-template-validation";

const values = normalizeContractVariables({
  GHP_RAZON_SOCIAL: "Green House Project S.A.S.",
  GHP_NIT: "901.447.678-0",
  GHP_REPRESENTANTE: "Representante Legal de Prueba",
  GHP_DOCUMENTO_REPRESENTANTE: "1.000.000.000",
  GHP_CARGO_REPRESENTANTE: "Representante Legal",
  GHP_DOMICILIO: "Mosquera, Cundinamarca",
  GHP_DIRECCION: "Dirección corporativa de prueba",
  GHP_CORREO_NOTIFICACIONES: "legal@greenhproject.com",
  GHP_TELEFONO: "+57 300 000 0000",
  MARCA_COMERCIAL: "EVGreen",
  ALIADO_RAZON_SOCIAL: "EDS DEMOSTRACIÓN S.A.S.",
  ALIADO_NIT: "900.000.000-1",
  ALIADO_REPRESENTANTE: "Representante EDS de Prueba",
  ALIADO_DOCUMENTO_REPRESENTANTE: "80.000.000",
  ALIADO_CARGO_REPRESENTANTE: "Representante Legal",
  ALIADO_DOMICILIO: "Bogotá D.C.",
  ALIADO_DIRECCION_NOTIFICACIONES: "Avenida de prueba # 1-01",
  ALIADO_CORREO_NOTIFICACIONES: "legal@eds-ejemplo.test",
  ALIADO_TELEFONO: "+57 310 000 0000",
  SITIO_NOMBRE: "EDS DEMOSTRACIÓN",
  SITIO_DIRECCION: "Autopista de prueba km 1",
  SITIO_CIUDAD: "Bogotá D.C.",
  SITIO_DEPARTAMENTO: "Cundinamarca",
  AREA_CEDIDA_M2: "180",
  PUESTOS_PARQUEO: "4",
  PLANO_ANEXO_URL: "Anexo técnico incorporado al expediente",
  PARTICIPACION_ALIADO_PORCENTAJE: "10",
  PLAZO_INICIAL_ANOS: "10",
  PRORROGA_ANOS: "5",
  PLAZO_PAGO_DIAS_HABILES: "15",
  FECHA_CIERRE_LIQUIDACION: "Último día calendario de cada mes",
  VERSION_PLANTILLA: "2.3-dinamica",
  CIUDAD_FIRMA: "Bogotá D.C.",
  FECHA_FIRMA: "pendiente de firma",
});

async function main() {
  const source = await readFile(sourcePath);
  const converted = await mammoth.convertToHtml({ buffer: source });
  const unresolvedBefore = unresolvedContractVariables(converted.value, values);
  if (unresolvedBefore.length > 0) {
    throw new Error(`Faltan valores de prueba para: ${unresolvedBefore.join(", ")}`);
  }

  const rendered = renderContractTemplate(converted.value, values);
  const unresolvedAfter = Array.from(rendered.matchAll(/{{\s*([A-Z0-9_]+)\s*}}/g), match => match[1]);
  if (unresolvedAfter.length > 0) throw new Error(`Quedaron marcadores sin resolver: ${unresolvedAfter.join(", ")}`);

  const withSignatures = appendContractSignatureBlocks(rendered, {
    allyName: values.ALIADO_RAZON_SOCIAL,
    allyRepresentative: values.ALIADO_REPRESENTANTE,
    allyDocument: values.ALIADO_DOCUMENTO_REPRESENTANTE,
    operatorName: values.GHP_RAZON_SOCIAL,
    operatorRepresentative: values.GHP_REPRESENTANTE,
    operatorDocument: values.GHP_DOCUMENTO_REPRESENTANTE,
  });
  const hash = sha256(withSignatures);
  const pdf = await generateContractPdf({ contractHtml: withSignatures, contractNumber: "EVG-VALIDACION-0001", contentHash: hash });
  if (!pdf.subarray(0, 4).equals(Buffer.from("%PDF"))) throw new Error("El archivo generado no es un PDF válido.");

  await mkdir(outputDir, { recursive: true });
  await writeFile(`${outputDir}/contrato-dinamico-renderizado.html`, withSignatures, "utf8");
  await writeFile(`${outputDir}/contrato-dinamico-prueba.pdf`, pdf);
  console.log(JSON.stringify({ markersResolved: true, htmlLength: withSignatures.length, pdfBytes: pdf.length, contentHash: hash }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
