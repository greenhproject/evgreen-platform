import { describe, expect, it } from "vitest";
import { startOfDayInTz, endOfDayInTz, formatIsoDateInTz } from "./timezone";

describe("startOfDayInTz / endOfDayInTz", () => {
  it("convierte el inicio de un día de Bogotá (UTC-5) al instante UTC correcto", () => {
    expect(startOfDayInTz("2026-10-09").toISOString()).toBe("2026-10-09T05:00:00.000Z");
  });

  it("convierte el fin de un día de Bogotá al último milisegundo UTC correcto, sin arrastrar error de redondeo", () => {
    expect(endOfDayInTz("2026-10-09").toISOString()).toBe("2026-10-10T04:59:59.999Z");
  });

  it("usa America/Bogota por defecto cuando no se indica zona", () => {
    expect(startOfDayInTz("2026-01-15").toISOString()).toBe(startOfDayInTz("2026-01-15", "America/Bogota").toISOString());
  });

  it("un registro creado tarde en la noche de Bogotá pero ya al día siguiente en UTC sigue cayendo dentro del día local correcto", () => {
    // 2026-10-09 23:30 Bogotá == 2026-10-10 04:30 UTC: con límites calculados
    // en UTC (el bug original) este registro habría quedado fuera del "hoy"
    // de Bogotá. Con startOfDayInTz/endOfDayInTz debe quedar adentro.
    const lateNightBogota = new Date("2026-10-10T04:30:00.000Z");
    const start = startOfDayInTz("2026-10-09");
    const end = endOfDayInTz("2026-10-09");
    expect(lateNightBogota.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(lateNightBogota.getTime()).toBeLessThanOrEqual(end.getTime());
  });

  it("un registro creado apenas pasada la medianoche UTC pero todavía ayer en Bogotá NO cae en el día de hoy", () => {
    // 2026-10-09 00:30 UTC == 2026-10-08 19:30 Bogotá: todavía es "ayer" para
    // un admin en Bogotá, aunque UTC ya haya cruzado a otro día calendario.
    const justAfterUtcMidnight = new Date("2026-10-09T00:30:00.000Z");
    const start = startOfDayInTz("2026-10-09");
    expect(justAfterUtcMidnight.getTime()).toBeLessThan(start.getTime());
  });
});

describe("formatIsoDateInTz y startOfDayInTz son inversas consistentes", () => {
  it("formatear el startOfDayInTz de un día devuelve ese mismo día", () => {
    const start = startOfDayInTz("2026-10-09");
    expect(formatIsoDateInTz(start)).toBe("2026-10-09");
  });
});
