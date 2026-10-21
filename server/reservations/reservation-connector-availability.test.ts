import { describe, expect, it } from "vitest";
import { isConnectorSelectableForReservationOwner } from "../../shared/reservation-connector-availability";

describe("acceso al conector reservado", () => {
  it("permite al titular seleccionar su conector reservado", () => {
    expect(isConnectorSelectableForReservationOwner("RESERVED", true)).toBe(true);
  });

  it("mantiene bloqueado el conector reservado para otros usuarios", () => {
    expect(isConnectorSelectableForReservationOwner("RESERVED", false)).toBe(false);
  });

  it("mantiene disponible un conector libre", () => {
    expect(isConnectorSelectableForReservationOwner("AVAILABLE", false)).toBe(true);
  });
});
