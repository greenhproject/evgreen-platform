import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const supportSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/user/Support.tsx"), "utf8");
const layoutSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/layouts/UserLayout.tsx"), "utf8");
const chargingBannerSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/ActiveChargingBanner.tsx"), "utf8");

describe("composición móvil de soporte", () => {
  it("reserva el viewport dinámico, el scroll de mensajes y un compositor de escritura visible", () => {
    expect(layoutSource).toContain('h-[100dvh] min-h-[100dvh] overflow-hidden');
    expect(layoutSource).toContain('flex-1 min-h-0 overflow-auto overscroll-contain');
    expect(layoutSource).toContain('sticky bottom-0 z-50 shrink-0');

    expect(supportSource).toContain('flex h-full min-h-0 flex-col overflow-hidden');
    expect(supportSource).toContain('flex-1 min-h-0 overflow-y-auto overscroll-contain');
    expect(supportSource).toContain('shrink-0 border-t border-border bg-background');
    expect(supportSource).toContain('pb-[max(0.75rem,env(safe-area-inset-bottom))]');
    expect(supportSource).not.toContain('h-[calc(100vh-64px)]');
  });

  it("no superpone el acceso global de carga sobre la pantalla de soporte", () => {
    expect(chargingBannerSource).toContain('const isOnSupportPage = location === "/support" || location.startsWith("/support/")');
    expect(chargingBannerSource).toContain('isOnChargingPage || isOnSupportPage');
  });
});
