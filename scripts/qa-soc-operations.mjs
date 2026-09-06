import { eq, isNotNull } from "drizzle-orm";
import { chargingStations } from "../drizzle/schema.ts";
import { getDb } from "../server/db.ts";
import { appRouter } from "../server/routers.ts";

function createCaller(role, organizationId = null) {
  return appRouter.createCaller({
    user: { id: 1, openId: "qa-read-only", role },
    tenant: { organizationId, organization: null },
    req: { headers: {} },
    res: {},
  });
}

async function main() {
  const database = await getDb();
  if (!database) throw new Error("DB no disponible");

  const adminSnapshot = await createCaller("admin").noc.getNetworkSnapshot();
  const activeSessions = adminSnapshot.stations.flatMap(station =>
    station.evses
      .filter(evse => evse.currentTx)
      .map(evse => ({
        stationId: station.id,
        stationName: station.name,
        evseId: evse.id,
        chargeType: evse.chargeType,
        transactionId: evse.currentTx.transactionId,
        soc: evse.currentTx.soc,
        socSource: evse.currentTx.socSource,
        canCalibrateSoc: evse.currentTx.canCalibrateSoc,
        energySinceCalibrationKwh: evse.currentTx.energySinceCalibrationKwh,
      }))
  );

  const [tenantStation] = await database
    .select({ organizationId: chargingStations.organizationId })
    .from(chargingStations)
    .where(isNotNull(chargingStations.organizationId))
    .limit(1);

  let tenantCheck = { skipped: true };
  if (tenantStation?.organizationId) {
    const organizationId = tenantStation.organizationId;
    const allowedStations = await database
      .select({ id: chargingStations.id })
      .from(chargingStations)
      .where(eq(chargingStations.organizationId, organizationId));
    const allowedIds = new Set(allowedStations.map(station => station.id));
    const tenantSnapshot = await createCaller("user", organizationId).noc.getNetworkSnapshot();
    tenantCheck = {
      skipped: false,
      organizationId,
      stationCount: tenantSnapshot.stations.length,
      onlyOwnStations: tenantSnapshot.stations.every(station => allowedIds.has(station.id)),
      canCalibrateSoc: tenantSnapshot.access.canCalibrateSoc,
    };
  }

  console.log(JSON.stringify({
    adminCanCalibrateSoc: adminSnapshot.access.canCalibrateSoc,
    activeSessions,
    tenantCheck,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
