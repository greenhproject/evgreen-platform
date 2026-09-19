import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/user/Map.tsx"), "utf8");
const reservationsSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/user/Reservations.tsx"), "utf8");

describe("visibilidad de reservas activas", () => {
  it("reconoce reservationStatus y conserva la próxima reserva visible en el mapa", () => {
    expect(mapSource).toContain('r.reservationStatus === "ACTIVE"');
    expect(mapSource).toContain("refetchInterval: 30_000");
    expect(mapSource).not.toContain("r.status !== 'ACTIVE'");
  });

  it("muestra datos enriquecidos y navegación segura hacia la estación", () => {
    expect(reservationsSource).toContain("stationName || \"Estación\"");
    expect(reservationsSource).toContain("setLocation(`/station/${reservation.stationId}`)");
    expect(reservationsSource).toContain("30 minutos o más antes: reembolso completo");
  });
});
