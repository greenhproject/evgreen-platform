import { describe, expect, it } from "vitest";
import { sqlChunks } from "./runtime-schema-sync.mjs";

describe("sqlChunks", () => {
  it("mantiene una sentencia real precedida por líneas de comentario, sin marcador de breakpoint", () => {
    const sql = [
      "-- Protección de reservas afectadas por indisponibilidad operacional.",
      "-- La extensión de ENUM conserva todos los estados existentes.",
      "ALTER TABLE `reservations` ADD COLUMN `service_issue_code` varchar(80) NULL;",
    ].join("\n");

    expect(sqlChunks(sql)).toEqual([sql]);
  });

  it("descarta un fragmento que es exclusivamente comentarios", () => {
    const sql = ["-- solo comentario", "-- otra línea de comentario"].join("\n");

    expect(sqlChunks(sql)).toEqual([]);
  });

  it("separa correctamente múltiples sentencias por el marcador statement-breakpoint", () => {
    const sql = [
      "-- comentario inicial",
      "CREATE TABLE a (id int);",
      "--> statement-breakpoint",
      "CREATE TABLE b (id int);",
    ].join("\n");

    const chunks = sqlChunks(sql);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain("CREATE TABLE a");
    expect(chunks[1]).toContain("CREATE TABLE b");
  });

  it("descarta entradas vacías o solo espacios en blanco", () => {
    const sql = ["", "   ", "--> statement-breakpoint", "SELECT 1;"].join("\n");

    expect(sqlChunks(sql)).toEqual(["SELECT 1;"]);
  });
});
