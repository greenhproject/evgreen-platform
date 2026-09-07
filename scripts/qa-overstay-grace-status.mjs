import { appRouter } from "../server/routers.ts";

const USER_ID = 570001;

const now = new Date();
const caller = appRouter.createCaller({
  user: {
    id: USER_ID,
    openId: `qa-readonly-${USER_ID}`,
    name: "QA solo lectura",
    email: "qa-readonly@evgreen.local",
    loginMethod: "qa",
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  },
  tenant: null,
  req: {},
  res: {},
});

const status = await caller.overstay.getMyStatus();

if (!status) {
  throw new Error("El endpoint no devolvió el estado post-carga esperado para el usuario auditado.");
}

if (status.transactionId !== 1140021) {
  throw new Error(`Se esperaba la transacción 1140021 y se recibió ${status.transactionId}.`);
}

if (status.stationName !== "EVG diamante") {
  throw new Error(`Se esperaba EVG diamante y se recibió ${status.stationName}.`);
}

if (status.penaltyPerMinute !== 0 || status.overstayEnabled !== false) {
  throw new Error(
    `La tarifa cero no es autoritativa: penalty=${status.penaltyPerMinute}, enabled=${status.overstayEnabled}.`,
  );
}

console.log(JSON.stringify({
  transactionId: status.transactionId,
  stationName: status.stationName,
  status: status.status,
  penaltyPerMinute: status.penaltyPerMinute,
  overstayEnabled: status.overstayEnabled,
  message: "La UI debe mostrar Sin cobro y no anunciar débitos automáticos.",
}, null, 2));
