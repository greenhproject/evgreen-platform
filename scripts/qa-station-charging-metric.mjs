import { appRouter } from "../server/routers.ts";

const TARGET_STATION_ID = Number(process.env.QA_STATION_ID || 150001);

async function main() {
  const caller = appRouter.createCaller({
    user: { id: 1, openId: "qa-read-only", role: "admin" },
    tenant: { organizationId: null, organization: null },
    req: { headers: {} },
    res: {},
  });

  const stations = await caller.stations.listAll();
  const station = stations.find(item => item.id === TARGET_STATION_ID);
  if (!station) throw new Error(`Estación ${TARGET_STATION_ID} no encontrada`);

  const connectors = station.evses.map(evse => ({
    id: evse.id,
    evseIdLocal: evse.evseIdLocal,
    persistedStatus: evse.connectorStatus,
    operationalStatus: evse.operationalStatus,
    operationalStatusSource: evse.operationalStatusSource,
    activeTransactionId: evse.activeTransactionId,
    isCharging: evse.isCharging,
    isAvailable: evse.isAvailable,
  }));

  const result = {
    stationId: station.id,
    stationName: station.name,
    availableCount: connectors.filter(connector => connector.isAvailable).length,
    chargingCount: connectors.filter(connector => connector.isCharging).length,
    totalConnectors: connectors.length,
    connectors,
  };

  console.log(JSON.stringify(result, null, 2));

  const hasActiveTransaction = connectors.some(connector => connector.activeTransactionId !== null);
  if (hasActiveTransaction && result.chargingCount === 0) {
    throw new Error("Regresión: existe transacción activa pero el contador Cargando es 0");
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
