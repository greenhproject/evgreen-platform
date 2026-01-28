import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "./config";
import * as db from "../db";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function handleStripeWebhook(req: Request, res: Response) {
  if (!stripe) {
    console.error("[Stripe Webhook] Stripe not configured");
    return res.status(500).json({ error: "Stripe not configured" });
  }

  const sig = req.headers["stripe-signature"];

  if (!sig) {
    console.error("[Stripe Webhook] No signature provided");
    return res.status(400).json({ error: "No signature provided" });
  }

  let event: Stripe.Event;

  try {
    // En desarrollo sin webhook secret, parsear directamente
    if (!webhookSecret) {
      event = req.body as Stripe.Event;
      console.warn("[Stripe Webhook] No webhook secret configured - skipping signature verification");
    } else {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    }
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Manejar eventos de prueba
  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`[Stripe Webhook] Payment succeeded: ${paymentIntent.id}`);
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Stripe Webhook] Invoice paid: ${invoice.id}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`[Stripe Webhook] Invoice payment failed: ${invoice.id}`);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Error processing event:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const type = session.metadata?.type;

  if (!userId) {
    console.error("[Stripe Webhook] No user_id in session metadata");
    return;
  }

  console.log(`[Stripe Webhook] Checkout completed for user ${userId}, type: ${type}`);

  switch (type) {
    case "wallet_recharge": {
      const amount = parseInt(session.metadata?.amount || "0");
      if (amount > 0) {
        // Agregar saldo a la billetera del usuario
        await db.addUserWalletBalance(parseInt(userId), amount);
        
        // Registrar la transacción de pago
        await db.createPaymentRecord({
          userId: parseInt(userId),
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
          type: "wallet_recharge",
          amount,
          currency: session.currency || "cop",
          status: "completed",
        });
        
        console.log(`[Stripe Webhook] Added ${amount} to wallet for user ${userId}`);
      }
      break;
    }

    case "subscription": {
      const planId = session.metadata?.plan_id;
      const subscriptionId = session.subscription as string;
      
      // Actualizar suscripción del usuario
      await db.updateUserSubscription(parseInt(userId), {
        stripeSubscriptionId: subscriptionId,
        planId: planId || "basic",
        status: "active",
      });
      
      console.log(`[Stripe Webhook] Subscription ${planId} activated for user ${userId}`);
      break;
    }

    case "charging_session": {
      const transactionId = session.metadata?.transaction_id;
      
      if (transactionId) {
        // Marcar la transacción de carga como pagada
        await db.updateTransactionPaymentStatus(transactionId, {
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
          paymentStatus: "paid",
        });
        
        console.log(`[Stripe Webhook] Charging session ${transactionId} marked as paid`);
      }
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unknown checkout type: ${type}`);
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log(`[Stripe Webhook] Subscription created: ${subscription.id}`);
  // La lógica principal se maneja en checkout.session.completed
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`[Stripe Webhook] Subscription updated: ${subscription.id}, status: ${subscription.status}`);
  
  // Buscar usuario por subscription ID y actualizar estado
  const user = await db.getUserByStripeSubscriptionId(subscription.id);
  if (user) {
    await db.updateUserSubscription(user.id, {
      status: subscription.status,
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`[Stripe Webhook] Subscription deleted: ${subscription.id}`);
  
  // Buscar usuario y cancelar suscripción
  const user = await db.getUserByStripeSubscriptionId(subscription.id);
  if (user) {
    await db.updateUserSubscription(user.id, {
      status: "canceled",
      stripeSubscriptionId: null,
    });
  }
}
