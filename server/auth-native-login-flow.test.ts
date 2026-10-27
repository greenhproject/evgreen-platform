import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(process.cwd());
const constSource = readFileSync(resolve(projectRoot, "client/src/const.ts"), "utf8");
const mainSource = readFileSync(resolve(projectRoot, "client/src/main.tsx"), "utf8");
const appSource = readFileSync(resolve(projectRoot, "client/src/App.tsx"), "utf8");
const authHookSource = readFileSync(
  resolve(projectRoot, "client/src/_core/hooks/useAuth.ts"),
  "utf8",
);

describe("flujo OAuth nativo de EVGreen", () => {
  it("no cierra preventivamente una Custom Tab al abrir un nuevo login", () => {
    const openLoginBrowser = constSource.slice(
      constSource.indexOf("export async function openLoginBrowser"),
      constSource.indexOf("\n}", constSource.indexOf("export async function openLoginBrowser")) + 2,
    );

    expect(openLoginBrowser).toContain("NATIVE_LOGIN_SESSION_KEY");
    expect(openLoginBrowser).toContain("await Browser.open");
    expect(openLoginBrowser).toContain("NATIVE_LOGIN_ACTIVE_KEY");
    expect(openLoginBrowser).toContain("clearNativeLoginAttempt(sk)");
    expect(openLoginBrowser).not.toContain("await Browser.close()");
  });

  it("sólo intenta reclamar una sesión cuando finaliza la Custom Tab del login activo", () => {
    const browserFinished = mainSource.slice(
      mainSource.indexOf("Browser.addListener('browserFinished'"),
      mainSource.indexOf("CapacitorApp.addListener('appUrlOpen'"),
    );

    expect(browserFinished).toContain("const activeSk = sessionStorage.getItem(NATIVE_LOGIN_ACTIVE_KEY)");
    expect(browserFinished).toContain("if (!sk || activeSk !== sk) return;");
    expect(browserFinished).toContain("if (claimed) {");
    expect(browserFinished).toContain("clearNativeLoginAttempt(sk)");
    expect(browserFinished).toContain("window.dispatchEvent(new Event('evgreen-auth-updated'))");
    expect(browserFinished.indexOf("if (claimed) {")).toBeLessThan(
      browserFinished.indexOf("window.dispatchEvent(new Event('evgreen-auth-updated'))"),
    );
  });

  it("usa el mismo inicio seguro desde el acceso manual y limpia intentos al cerrar sesión", () => {
    const loginScreen = appSource.slice(
      appSource.indexOf("function LoginScreen()"),
      appSource.indexOf("function LoginEntryRoute"),
    );

    expect(loginScreen).toContain("await openLoginBrowser()");
    expect(loginScreen).not.toContain("Browser.open({ url:");
    expect(authHookSource).toContain("clearNativeLoginAttempt();");
  });
});
