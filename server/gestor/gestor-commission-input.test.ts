import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GESTOR_COMMISSION_PERCENT,
  MAX_GESTOR_COMMISSION_PERCENT,
  parseGestorCommissionPercentInput,
} from "../../shared/gestor-commission";
import {
  spaceGestorAssignmentInput,
  stationGestorAssignmentInput,
} from "./gestor-assignment-input";

const spacesSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/admin/Spaces.tsx"), "utf8");

describe("comisión editable del gestor comercial", () => {
  it("conserva vacío temporal, cero y decimales localizados válidos", () => {
    expect(DEFAULT_GESTOR_COMMISSION_PERCENT).toBe(3.75);
    expect(parseGestorCommissionPercentInput("")).toBeUndefined();
    expect(parseGestorCommissionPercentInput("0")).toBe(0);
    expect(parseGestorCommissionPercentInput("3.75")).toBe(3.75);
    expect(parseGestorCommissionPercentInput("3,75")).toBe(3.75);
    expect(parseGestorCommissionPercentInput("12.34")).toBe(12.34);
    expect(parseGestorCommissionPercentInput(String(MAX_GESTOR_COMMISSION_PERCENT))).toBe(MAX_GESTOR_COMMISSION_PERCENT);
  });

  it("rechaza datos que no caben en el DECIMAL(5,2) o exceden la política comercial", () => {
    expect(parseGestorCommissionPercentInput("-1")).toBeUndefined();
    expect(parseGestorCommissionPercentInput("30.01")).toBeUndefined();
    expect(parseGestorCommissionPercentInput("3.756")).toBeUndefined();
    expect(parseGestorCommissionPercentInput("comisión")).toBeUndefined();
  });

  it("envía el nombre de campo del contrato sin ocultar el error de tipos", () => {
    expect(spacesSource).toContain("gestorCommissionPercent,");
    expect(spacesSource).not.toContain("commissionPercent: parseFloat(gestorForm.commissionPercent)");
    expect(spacesSource).not.toContain("asignarGestorMutation.mutate({ spaceId: id, gestorId: parseInt(gestorForm.gestorId), commissionPercent:");
    expect(spacesSource).toContain('type="text" inputMode="decimal"');
    expect(spacesSource).toContain("gestorCommissionPercent === undefined");
  });

  it("exige la comisión explícita en el servidor y rechaza una clave mal escrita", () => {
    expect(spaceGestorAssignmentInput.parse({ spaceId: 1, gestorId: 2, gestorCommissionPercent: 0 })).toEqual({
      spaceId: 1,
      gestorId: 2,
      gestorCommissionPercent: 0,
    });
    expect(stationGestorAssignmentInput.parse({ stationId: 1, gestorId: 2, gestorCommissionPercent: 12.34 })).toEqual({
      stationId: 1,
      gestorId: 2,
      gestorCommissionPercent: 12.34,
    });
    expect(() => spaceGestorAssignmentInput.parse({ spaceId: 1, gestorId: 2, commissionPercent: 3.75 })).toThrow();
    expect(() => spaceGestorAssignmentInput.parse({ spaceId: 1, gestorId: 2, gestorCommissionPercent: 30.01 })).toThrow();
    expect(() => spaceGestorAssignmentInput.parse({ spaceId: 1, gestorId: 2, gestorCommissionPercent: 3.756 })).toThrow();
  });
});
