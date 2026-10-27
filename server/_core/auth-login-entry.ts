import type { Express, Request, Response } from "express";

export const LOGIN_ENTRY_PATH = "/login";
export const AUTH_LOGIN_PATH = "/api/auth/login";

/**
 * Expone una URL web estable para entrar a la cuenta antes de que el fallback
 * de la SPA pueda mostrar la landing comercial. No recibe destinos dinámicos
 * ni modifica el callback OAuth.
 */
export function registerLoginEntryRoute(app: Express): void {
  app.get(LOGIN_ENTRY_PATH, (_req: Request, res: Response) => {
    res.redirect(302, AUTH_LOGIN_PATH);
  });
}
