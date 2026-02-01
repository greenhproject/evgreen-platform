/**
 * Tests para validar la configuración de los nuevos componentes de UI
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Componentes de UI - Validación de archivos", () => {
  const clientSrcPath = path.join(process.cwd(), "client/src");

  describe("AuthScreen", () => {
    it("debe existir el archivo AuthScreen.tsx", () => {
      const filePath = path.join(clientSrcPath, "components/AuthScreen.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("debe contener el componente AuthScreen", () => {
      const filePath = path.join(clientSrcPath, "components/AuthScreen.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("export function AuthScreen");
      expect(content).toContain("LoginForm");
      expect(content).toContain("RegisterForm");
    });

    it("debe usar framer-motion para animaciones", () => {
      const filePath = path.join(clientSrcPath, "components/AuthScreen.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("framer-motion");
      expect(content).toContain("motion.");
    });

    it("debe integrar con OAuth de Manus", () => {
      const filePath = path.join(clientSrcPath, "components/AuthScreen.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("getLoginUrl");
    });
  });

  describe("Tutorial", () => {
    it("debe existir el archivo Tutorial.tsx", () => {
      const filePath = path.join(clientSrcPath, "components/Tutorial.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("debe contener el hook useTutorial", () => {
      const filePath = path.join(clientSrcPath, "components/Tutorial.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("export function useTutorial");
    });

    it("debe definir los pasos del tutorial", () => {
      const filePath = path.join(clientSrcPath, "components/Tutorial.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("TUTORIAL_STEPS");
      expect(content).toContain("welcome");
      expect(content).toContain("map");
      expect(content).toContain("scan");
    });

    it("debe persistir estado en localStorage", () => {
      const filePath = path.join(clientSrcPath, "components/Tutorial.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("localStorage.getItem");
      expect(content).toContain("localStorage.setItem");
      expect(content).toContain("evgreen_tutorial_completed");
    });

    it("debe exportar TutorialButton", () => {
      const filePath = path.join(clientSrcPath, "components/Tutorial.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("export function TutorialButton");
    });
  });

  describe("Onboarding", () => {
    it("debe existir el archivo Onboarding.tsx", () => {
      const filePath = path.join(clientSrcPath, "components/Onboarding.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("debe contener el hook useOnboarding", () => {
      const filePath = path.join(clientSrcPath, "components/Onboarding.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("useOnboarding");
    });

    it("debe definir slides del onboarding", () => {
      const filePath = path.join(clientSrcPath, "components/Onboarding.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("slides");
    });
  });

  describe("getLoginUrl en trpc.ts", () => {
    it("debe existir la función getLoginUrl", () => {
      const filePath = path.join(clientSrcPath, "lib/trpc.ts");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("export function getLoginUrl");
    });

    it("debe construir URL con parámetros correctos", () => {
      const filePath = path.join(clientSrcPath, "lib/trpc.ts");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("VITE_OAUTH_PORTAL_URL");
      expect(content).toContain("VITE_APP_ID");
      expect(content).toContain("redirect_url");
    });
  });
});

describe("Firebase Cloud Messaging - Validación de archivos", () => {
  const serverPath = path.join(process.cwd(), "server");

  describe("FCM Service", () => {
    it("debe existir el archivo fcm.ts", () => {
      const filePath = path.join(serverPath, "firebase/fcm.ts");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("debe exportar funciones de notificación", () => {
      const filePath = path.join(serverPath, "firebase/fcm.ts");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("sendPushNotification");
      expect(content).toContain("sendChargingCompleteNotification");
      expect(content).toContain("sendLowBalanceNotification");
    });

    it("debe manejar múltiples tokens", () => {
      const filePath = path.join(serverPath, "firebase/fcm.ts");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("sendPushNotificationToMultiple");
    });

    it("debe soportar topics", () => {
      const filePath = path.join(serverPath, "firebase/fcm.ts");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("subscribeToTopic");
      expect(content).toContain("unsubscribeFromTopic");
      expect(content).toContain("sendToTopic");
    });
  });

  describe("Push Router", () => {
    it("debe existir el archivo push-router.ts", () => {
      const filePath = path.join(serverPath, "push/push-router.ts");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("debe definir endpoints de registro de token", () => {
      const filePath = path.join(serverPath, "push/push-router.ts");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("registerToken");
    });

    it("debe definir endpoints de test de notificaciones", () => {
      const filePath = path.join(serverPath, "push/push-router.ts");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("sendTestNotification");
    });
  });
});
