import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const monitorSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/user/ChargingMonitor.tsx"),
  "utf8",
);

const routerSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/charging/charging-router.ts"),
  "utf8",
);

const indexSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/_core/index.ts"),
  "utf8",
);

describe("truthful charge stop experience", () => {
  it("keeps the user on the monitor while a real charger confirms the stop", () => {
    const stoppingSuccessBlock = monitorSource.slice(
      monitorSource.indexOf("const stopChargeMutation"),
      monitorSource.indexOf("// Actualizar tiempo transcurrido"),
    );

    expect(stoppingSuccessBlock).toContain('result.status === "stopping"');
    const pendingBranch = stoppingSuccessBlock.slice(
      stoppingSuccessBlock.indexOf('setStopRequestedInUi(result.status === "stopping")'),
      stoppingSuccessBlock.indexOf("onError:"),
    );
    expect(pendingBranch).toContain("setStopRequestedInUi");
    expect(pendingBranch).not.toContain("setLocation(");
  });

  it("renders a finalizing state and disables duplicate stop commands", () => {
    expect(monitorSource).toContain("Finalizando con el cargador");
    expect(monitorSource).toContain("disabled={stopChargeMutation.isPending || isStopFinalizing}");
    expect(monitorSource).toContain("Reintentar detener carga");
  });

  it("never locally completes a real unconfirmed remote stop", () => {
    const stopHandler = routerSource.slice(
      routerSource.indexOf("stopCharge: protectedProcedure"),
      routerSource.indexOf("getHistory: protectedProcedure"),
    );

    expect(stopHandler).toContain("requestStopTransaction");
    expect(stopHandler).not.toContain("await completeTransactionLocally(transactionId, transaction)");
    expect(indexSource).toContain("/api/scheduled/charge-stop-reconciliation");
    expect(indexSource).toContain("reconcileTimedOutChargeStopRequests");
  });
});
