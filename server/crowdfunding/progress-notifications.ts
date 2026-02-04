/**
 * Crowdfunding Progress Notifications Service
 * Servicio para enviar notificaciones automáticas cuando los proyectos alcanzan hitos de financiamiento
 */

import { Resend } from "resend";
import { getDb } from "../db";
import { users, notifications } from "../../drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { sendPushNotificationToMultiple, NotificationType } from "../firebase/fcm";

// Inicializar Resend
const resendApiKey = process.env.RESEND_API_KEY || "re_CeRTmETR_MHxYaF2sShjXcmSmZKE5qSzr";
const resend = new Resend(resendApiKey);

// Hitos de progreso que disparan notificaciones
export const PROGRESS_MILESTONES = [50, 75, 100] as const;
export type ProgressMilestone = typeof PROGRESS_MILESTONES[number];

// Interfaz para el proyecto de crowdfunding
interface CrowdfundingProject {
  id: number;
  name: string;
  city: string;
  zone: string;
  targetAmount: number;
  raisedAmount: number;
  status: string;
}

// Interfaz para participación
interface Participation {
  id: number;
  investorId: number;
  amount: number;
  participationPercent: number;
  paymentStatus: string;
}

// Resultado del envío de notificaciones
export interface ProgressNotificationResult {
  milestone: number;
  projectId: number;
  projectName: string;
  investorsNotified: number;
  pushSent: number;
  emailSent: number;
  inAppCreated: number;
}

/**
 * Obtener inversionistas de un proyecto específico
 */
async function getProjectInvestors(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.execute(sql`
    SELECT DISTINCT u.id, u.email, u.name, u.fcm_token as fcmToken, u.notify_promotions as notifyPromotions
    FROM users u
    INNER JOIN crowdfunding_participations cp ON u.id = cp.investor_id
    WHERE cp.project_id = ${projectId}
    AND cp.payment_status = 'COMPLETED'
    AND u.is_active = 1
  `);

  return (result as unknown as Array<{
    id: number;
    email: string;
    name: string;
    fcmToken: string | null;
    notifyPromotions: boolean;
  }>);
}

/**
 * Obtener todos los inversionistas (para notificaciones de proyectos nuevos o completados)
 */
async function getAllInvestors() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      fcmToken: users.fcmToken,
      notifyPromotions: users.notifyPromotions,
    })
    .from(users)
    .where(and(
      eq(users.isActive, true),
      eq(users.role, "investor" as any)
    ));
}

/**
 * Calcular el porcentaje de progreso de un proyecto
 */
export function calculateProgress(raisedAmount: number, targetAmount: number): number {
  if (targetAmount <= 0) return 0;
  return (raisedAmount / targetAmount) * 100;
}

/**
 * Determinar si se debe enviar una notificación de hito
 */
export function shouldNotifyMilestone(
  previousProgress: number,
  currentProgress: number,
  milestone: ProgressMilestone
): boolean {
  return previousProgress < milestone && currentProgress >= milestone;
}

/**
 * Generar el mensaje de notificación según el hito
 */
function getMilestoneMessage(milestone: ProgressMilestone, project: CrowdfundingProject): { title: string; message: string } {
  const location = `${project.city} - ${project.zone}`;
  
  switch (milestone) {
    case 50:
      return {
        title: "🎯 ¡50% alcanzado!",
        message: `La estación de ${location} ha alcanzado el 50% de su meta de financiamiento. ¡Estamos a mitad de camino!`,
      };
    case 75:
      return {
        title: "🚀 ¡75% alcanzado!",
        message: `La estación de ${location} ha alcanzado el 75% de su meta. ¡Solo falta un poco más para completar el proyecto!`,
      };
    case 100:
      return {
        title: "🎉 ¡Proyecto completamente financiado!",
        message: `¡Felicitaciones! La estación de ${location} ha alcanzado el 100% de su meta de financiamiento. Pronto comenzará la construcción.`,
      };
    default:
      return {
        title: "Actualización de proyecto",
        message: `La estación de ${location} ha alcanzado un nuevo hito de financiamiento.`,
      };
  }
}

/**
 * Enviar notificaciones de progreso a los inversionistas
 */
export async function sendProgressNotification(
  project: CrowdfundingProject,
  milestone: ProgressMilestone,
  notifyAllInvestors: boolean = false
): Promise<ProgressNotificationResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result: ProgressNotificationResult = {
    milestone,
    projectId: project.id,
    projectName: project.name,
    investorsNotified: 0,
    pushSent: 0,
    emailSent: 0,
    inAppCreated: 0,
  };

  try {
    // Obtener inversionistas (del proyecto o todos según el caso)
    const investors = notifyAllInvestors 
      ? await getAllInvestors()
      : await getProjectInvestors(project.id);

    if (investors.length === 0) {
      console.log(`[CrowdfundingNotify] No investors found for project ${project.id}`);
      return result;
    }

    result.investorsNotified = investors.length;
    const { title, message } = getMilestoneMessage(milestone, project);

    // 1. Crear notificaciones in-app
    const notificationValues = investors.map((investor) => ({
      userId: investor.id,
      title,
      message,
      type: "SUCCESS" as const,
      isRead: false,
      data: JSON.stringify({
        type: "crowdfunding_milestone",
        projectId: project.id,
        milestone,
        city: project.city,
        zone: project.zone,
      }),
    }));

    // Insertar en lotes
    const batchSize = 100;
    for (let i = 0; i < notificationValues.length; i += batchSize) {
      const batch = notificationValues.slice(i, i + batchSize);
      await db.insert(notifications).values(batch);
      result.inAppCreated += batch.length;
    }

    // 2. Enviar push notifications
    const pushTokens = investors
      .filter((inv) => inv.fcmToken && inv.notifyPromotions)
      .map((inv) => inv.fcmToken as string);

    if (pushTokens.length > 0) {
      try {
        const pushResult = await sendPushNotificationToMultiple(
          pushTokens,
          {
            type: "promotion",
            title,
            body: message,
            data: {
              type: "crowdfunding_milestone",
              projectId: project.id.toString(),
              milestone: milestone.toString(),
            },
          }
        );
        result.pushSent = pushResult.success;
      } catch (pushError) {
        console.error("[CrowdfundingNotify] Push error:", pushError);
      }
    }

    // 3. Enviar emails (solo para hito del 100%)
    if (milestone === 100) {
      const emailRecipients = investors.filter((inv) => inv.email);
      
      for (const investor of emailRecipients.slice(0, 50)) { // Limitar a 50 emails
        try {
          await resend.emails.send({
            from: "EVGreen <notificaciones@evgreen.lat>",
            to: investor.email || "",
            subject: title,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0;">🎉 ¡Proyecto Completado!</h1>
                </div>
                <div style="padding: 30px; background: #f9fafb;">
                  <p style="font-size: 16px; color: #374151;">Hola ${investor.name || 'Inversionista'},</p>
                  <p style="font-size: 16px; color: #374151;">${message}</p>
                  <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #22c55e;">
                    <h3 style="margin: 0 0 10px 0; color: #111827;">Detalles del proyecto:</h3>
                    <p style="margin: 5px 0; color: #6b7280;"><strong>Ubicación:</strong> ${project.city} - ${project.zone}</p>
                    <p style="margin: 5px 0; color: #6b7280;"><strong>Meta alcanzada:</strong> $${project.targetAmount.toLocaleString('es-CO')} COP</p>
                  </div>
                  <p style="font-size: 14px; color: #6b7280;">Te mantendremos informado sobre el avance de la construcción.</p>
                </div>
                <div style="background: #111827; padding: 20px; text-align: center;">
                  <p style="color: #9ca3af; margin: 0; font-size: 12px;">EVGreen - Energía para el futuro</p>
                </div>
              </div>
            `,
          });
          result.emailSent++;
        } catch (emailError) {
          console.error(`[CrowdfundingNotify] Email error for ${investor.email}:`, emailError);
        }
      }
    }

    console.log(`[CrowdfundingNotify] Milestone ${milestone}% notification sent for project ${project.id}:`, result);
    return result;

  } catch (error) {
    console.error("[CrowdfundingNotify] Error:", error);
    throw error;
  }
}

/**
 * Verificar y enviar notificaciones de hitos después de una actualización de monto
 */
export async function checkAndNotifyMilestones(
  project: CrowdfundingProject,
  previousRaisedAmount: number
): Promise<ProgressNotificationResult[]> {
  const results: ProgressNotificationResult[] = [];
  
  const previousProgress = calculateProgress(previousRaisedAmount, project.targetAmount);
  const currentProgress = calculateProgress(project.raisedAmount, project.targetAmount);

  for (const milestone of PROGRESS_MILESTONES) {
    if (shouldNotifyMilestone(previousProgress, currentProgress, milestone)) {
      const result = await sendProgressNotification(
        project,
        milestone,
        milestone === 100 // Notificar a todos los inversionistas cuando se complete
      );
      results.push(result);
    }
  }

  return results;
}
