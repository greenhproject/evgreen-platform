import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appPath = resolve(process.cwd(), "client/src/App.tsx");
const landingPath = resolve(process.cwd(), "client/src/pages/Landing.tsx");

describe("acceso web explícito", () => {
  const appSource = readFileSync(appPath, "utf8");
  const landingSource = readFileSync(landingPath, "utf8");

  it("expone un enlace visible de inicio de sesión en la landing", () => {
    expect(landingSource).toContain('href="/login"');
    expect(landingSource).toContain("Iniciar sesión");
  });

  it("registra /login como ruta pública y respaldo cliente", () => {
    expect(appSource).toContain('"/login"');
    expect(appSource).toContain('<Route path="/login">');
    expect(appSource).toContain("window.location.replace(getLoginUrl())");
  });

  it("muestra acceso explícito y no la landing cuando una ruta protegida no tiene sesión", () => {
    const protectedRoute = appSource.slice(
      appSource.indexOf("function ProtectedRoute"),
      appSource.indexOf("function AdvertiserPortalRoute"),
    );

    expect(protectedRoute).toContain("return <LoginScreen />;");
    expect(protectedRoute).not.toContain("return <Landing />;");
  });
});
