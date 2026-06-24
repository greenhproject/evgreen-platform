/**
 * Servicio de envío de cotizaciones por email
 * Genera PDF (HTML), envía email premium con adjunto
 */
import { Resend } from "resend";
import { buildEmailParams } from "../utils/email-helper";
import { generateQuoteHTML } from "./quote-pdf";
import { generateQuoteEmailHTML, generateQuoteEmailSubject } from "./quote-email";
import { storagePut } from "../storage";

const resend = new Resend(process.env.Resend ?? "");

const FROM_EMAIL = "EVGreen <admin@evgreen.lat>";
const CC_EMAIL = "gerencia@greenhproject.com";

interface SendQuoteParams {
  quoteNumber: string;
  createdAt: Date | string;
  expiresAt: Date | string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientCompany: string | null;
  clientCity: string | null;
  clientNotes: string | null;
  advisorName: string | null;
  subtotal: number;
  discount: number;
  total: number;
  publicToken: string;
  items: Array<{
    productName: string;
    productPowerKw: string;
    productChargeType: string;
    productConnector: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    includesTransformer: boolean;
    cableMetersIncluded: number;
  }>;
  settings: {
    companyName: string;
    companyNit: string;
    companyPhone: string;
    companyEmail: string;
    companyWebsite: string;
    evgreenFeePercent: number;
    ownerSharePercent: number;
    headerMessage: string;
    footerMessage: string;
    termsAndConditions: string;
    exclusions: string;
    benefitsDescription: string;
  };
  baseUrl: string;
  financialModel?: {
    evgreenSharePercent: number;
    investorSharePercent: number;
    hostSharePercent: number;
  };
  projection?: {
    show: boolean;
    energyCostPerKwh: number;
    salePricePerKwh: number;
    dailyHours: number;
    scenario: string;
    totalKw: number;
  };
}

/**
 * Envía la cotización por email con PDF adjunto
 */
export async function sendQuoteEmail(params: SendQuoteParams): Promise<{ success: boolean; error?: string; pdfUrl?: string }> {
  try {
    const publicUrl = `${params.baseUrl}/cotizacion/${params.publicToken}`;

    // 1. Generar HTML del PDF
    const pdfHTML = await generateQuoteHTML({
      ...params,
      publicUrl,
    });

    // 2. Subir el HTML como archivo para referencia (el PDF se genera client-side o se usa el HTML)
    const pdfFileName = `quotes/${params.quoteNumber.replace(/\s/g, "-")}.html`;
    const { url: pdfUrl } = await storagePut(
      pdfFileName,
      Buffer.from(pdfHTML, "utf-8"),
      "text/html"
    );

    // 3. Generar email HTML
    const emailHTML = generateQuoteEmailHTML({
      clientName: params.clientName,
      clientEmail: params.clientEmail,
      quoteNumber: params.quoteNumber,
      total: params.total,
      advisorName: params.advisorName,
      publicUrl,
      companyName: params.settings.companyName,
      companyPhone: params.settings.companyPhone,
      companyEmail: params.settings.companyEmail,
      companyWebsite: params.settings.companyWebsite,
      expiresAt: params.expiresAt,
    });

    const subject = generateQuoteEmailSubject({
      quoteNumber: params.quoteNumber,
      clientName: params.clientName,
    });

    // 4. Enviar email con Resend
    const emailParams = buildEmailParams({
      from: FROM_EMAIL,
      to: params.clientEmail,
      subject,
      html: emailHTML,
      replyTo: params.settings.companyEmail || "gerencia@greenhproject.com",
    });

    const result = await resend.emails.send({
      ...emailParams,
      cc: CC_EMAIL,
    });

    if (result.error) {
      console.error("[QuoteEmail] Error sending:", result.error);
      return { success: false, error: result.error.message };
    }

    console.log(`[QuoteEmail] Sent ${params.quoteNumber} to ${params.clientEmail} (id: ${result.data?.id})`);
    return { success: true, pdfUrl };
  } catch (err: any) {
    console.error("[QuoteEmail] Exception:", err);
    return { success: false, error: err.message || "Error desconocido" };
  }
}
