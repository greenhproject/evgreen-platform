import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import http from "http";
import {
  AUTH_LOGIN_PATH,
  LOGIN_ENTRY_PATH,
  registerLoginEntryRoute,
} from "./auth-login-entry";

describe("entrada web de autenticación", () => {
  const app = express();
  const server = http.createServer(app);
  let baseUrl = "";

  beforeAll(async () => {
    registerLoginEntryRoute(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("redirige /login de forma fija al inicio Auth0", async () => {
    const response = await fetch(`${baseUrl}${LOGIN_ENTRY_PATH}`, { redirect: "manual" });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(AUTH_LOGIN_PATH);
  });

  it("no acepta una redirección de retorno controlada por el navegador", async () => {
    const response = await fetch(`${baseUrl}${LOGIN_ENTRY_PATH}?next=https://untrusted.example`, {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(AUTH_LOGIN_PATH);
  });
});
