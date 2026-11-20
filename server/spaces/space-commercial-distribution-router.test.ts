import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableName } from 'drizzle-orm';
import type { TrpcContext } from '../_core/context';
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), settings: vi.fn(), allyPdf: vi.fn(), investorPdf: vi.fn(), put: vi.fn() }));
vi.mock('../db', () => ({ getDb: mocks.getDb, getPlatformSettings: mocks.settings }));
vi.mock('../storage', () => ({ storagePut: mocks.put }));
vi.mock('./ally-space-pdf-service', () => ({ generateAllySpacePdf: mocks.allyPdf }));
vi.mock('./prospecto-pdf-service', () => ({ generateProspectoPdf: mocks.investorPdf }));
import { spacesRouter } from './spaces-router';

function context(role: string | null = 'admin'): TrpcContext {
  return { user: role ? { id: 9, role, openId: 'isolated', name: 'Mock admin' } : null, req: { headers: {}, protocol: 'https', socket: {} }, res: {} } as TrpcContext;
}
function memoryDb(spaceOverrides = {}, projectOverrides = {}) {
  const space: any = { id: 18, code: 'SPE-2026-0018', spaceName: 'Mock isolated space', spaceType: 'parking', city: 'Bogotá', address: 'Calle 1', spaceStatus: 'approved', crowdfundingProjectId: 42, estimatedInvestmentCop: 1_000_000_000, estimatedPowerKw: 240, estimatedChargerCount: 2, estimatedDailyVehicles: 700, estimatedEvPercent: 10, is24Hours: 1, hasSolarPanels: 0, solarCoveragePercent: '0.00', solarEnergyCostPerKwh: null, solarProgramEnabled: 0, transformerCapacityKva: '1000', electricalViability: 'viable', ...spaceOverrides };
  const project: any = { id: 42, status: 'DRAFT', targetAmount: 1_000_000_000, totalPowerKw: 240, financialProjectionSnapshot: { assumptions: { hostSharePercent: 8, investorSharePercent: 62.25, evgreenSharePercent: 37.75 } }, ...projectOverrides };
  const writes: any[] = [];
  const rows = (table: any) => getTableName(table) === 'space_submissions' ? [space] : getTableName(table) === 'crowdfunding_projects' ? [project] : [];
  const db: any = {
    select: vi.fn(() => ({ from: (table: any) => {
      const query: any = { where: () => query, orderBy: () => query, limit: async () => rows(table), then: (resolve: any) => Promise.resolve(rows(table)).then(resolve) }; return query;
    } })),
    update: vi.fn((table: any) => ({ set: (values: any) => ({ where: async () => { writes.push({ table: getTableName(table), values }); Object.assign(rows(table)[0] ?? {}, values); } }) })),
    insert: vi.fn((table: any) => ({ values: async (values: any) => { writes.push({ table: getTableName(table), values }); return [{ insertId: 42 }]; } })),
  };
  db.transaction = vi.fn(async (fn: any) => fn(db));
  return { db, space, project, writes };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.settings.mockResolvedValue({ precioVentaDefault: 1800, costoEnergiaRed: 850, eficienciaCargaDc: 92 });
  mocks.allyPdf.mockResolvedValue(Buffer.from('%PDF-mock'));
  mocks.investorPdf.mockResolvedValue(Buffer.from('%PDF-mock'));
  mocks.put.mockResolvedValue({ url: 'https://example.invalid/mock.pdf' });
});
describe('reparto de Espacios: endpoints reales con BD aislada mockeada', () => {
  it('detalle hereda el proyecto sin guardar por el mero hecho de consultarlo', async () => {
    const state = memoryDb(); mocks.getDb.mockResolvedValue(state.db);
    const result = await spacesRouter.createCaller(context()).admin.getById({ id: 18 });
    expect(result.commercialDistribution).toEqual({ allySharePercent: 8, investorSharePercent: 62.25, evgreenSharePercent: 37.75, source: 'PROJECT' });
    expect(state.writes).toHaveLength(0);
  });
  it('editar guarda los tres porcentajes, sincroniza proyecto y recalcula ROI', async () => {
    const state = memoryDb(); mocks.getDb.mockResolvedValue(state.db);
    const caller = spacesRouter.createCaller(context());
    await caller.admin.updateSpace({ id: 18, allySharePercent: 3.75, investorSharePercent: 80, evgreenSharePercent: 20 });
    expect(state.space).toMatchObject({ allySharePercent: '3.75', investorSharePercent: '80.00', evgreenSharePercent: '20.00' });
    expect(state.project.financialProjectionSnapshot.assumptions).toMatchObject({ hostSharePercent: 3.75, investorSharePercent: 80, evgreenSharePercent: 20 });
    expect(Number(state.space.estimatedRoiPercent)).toBeGreaterThan(0);
    expect((await caller.admin.getById({ id: 18 })).commercialDistribution.source).toBe('SPACE');
    expect(state.db.transaction).toHaveBeenCalled();
    for (const write of state.writes.filter(w => w.table === 'crowdfunding_projects')) {
      expect(write.values).not.toHaveProperty('hostSharePercent');
      expect(write.values).not.toHaveProperty('investorSharePercent');
      expect(write.values).not.toHaveProperty('evgreenSharePercent');
    }
  });
  it('editar otro campo no sobreescribe el reparto guardado', async () => {
    const state = memoryDb({ allySharePercent: '0.00', investorSharePercent: '100.00', evgreenSharePercent: '0.00' }); mocks.getDb.mockResolvedValue(state.db);
    await spacesRouter.createCaller(context()).admin.updateSpace({ id: 18, spaceName: 'Nombre actualizado' });
    expect(state.space.allySharePercent).toBe('0.00');
    expect(state.space.investorSharePercent).toBe('100.00');
  });
  it('un error de cálculo impide guardar el acuerdo parcialmente', async () => {
    const state = memoryDb({ estimatedEvPercent: 101 }); mocks.getDb.mockResolvedValue(state.db);
    await expect(spacesRouter.createCaller(context()).admin.updateSpace({ id: 18, allySharePercent: 3.75, investorSharePercent: 80, evgreenSharePercent: 20 })).rejects.toThrow();
    expect(state.writes).toHaveLength(0);
  });
  it('publicar guarda y hereda el reparto elegido, no un default del tipo', async () => {
    const state = memoryDb(); mocks.getDb.mockResolvedValue(state.db);
    await spacesRouter.createCaller(context()).admin.publishToCrowdfunding({ id: 18, allySharePercent: 15, investorSharePercent: 82, evgreenSharePercent: 18 });
    expect(state.space).toMatchObject({ spaceStatus: 'published', allySharePercent: '15.00', investorSharePercent: '82.00', evgreenSharePercent: '18.00' });
    expect(state.project).toMatchObject({ status: 'OPEN' });
    expect(state.project.financialProjectionSnapshot.assumptions).toMatchObject({ hostSharePercent: 15, investorSharePercent: 82, evgreenSharePercent: 18 });
    expect(state.project.financialProjectionSnapshot.assumptions.investorSharePercent).toBe(82);
    expect(state.db.transaction).toHaveBeenCalled();
  });
  it('publicar sin cambios preserva y materializa la herencia existente', async () => {
    const state = memoryDb(); mocks.getDb.mockResolvedValue(state.db);
    await spacesRouter.createCaller(context()).admin.publishToCrowdfunding({ id: 18 });
    expect(state.space.allySharePercent).toBe('8.00');
    expect(state.project.financialProjectionSnapshot.assumptions.investorSharePercent).toBe(62.25);
  });
  it('ambos PDF usan la distribución guardada; aliado recibe solo su porcentaje', async () => {
    const state = memoryDb({ allySharePercent: '3.75', investorSharePercent: '80.00', evgreenSharePercent: '20.00' }); mocks.getDb.mockResolvedValue(state.db);
    const caller = spacesRouter.createCaller(context());
    await caller.generateAllySpacePdf({ submissionId: 18 });
    await caller.generateProspectoPdf({ submissionId: 18, capexIncludesGridUpgrade: true, technicalConditionNote: "Ampliación incluida exclusivamente en el fixture mockeado." });
    expect(mocks.allyPdf).toHaveBeenCalledWith(expect.objectContaining({ allySharePercent: 3.75 }));
    expect(mocks.allyPdf.mock.calls[0][0]).not.toHaveProperty('investorSharePercent');
    expect(mocks.investorPdf).toHaveBeenCalledWith(expect.objectContaining({ allySharePercent: 3.75, investorSharePercent: 80, platformSharePercent: 20 }));
    expect(state.writes).toHaveLength(0);
  });
  it('0 aliado se conserva en ambos PDFs', async () => {
    const state = memoryDb({ allySharePercent: '0.00', investorSharePercent: '100.00', evgreenSharePercent: '0.00' }); mocks.getDb.mockResolvedValue(state.db);
    const caller = spacesRouter.createCaller(context());
    await caller.generateAllySpacePdf({ submissionId: 18 });
    await caller.generateProspectoPdf({ submissionId: 18, capexIncludesGridUpgrade: true, technicalConditionNote: "Ampliación incluida exclusivamente en el fixture mockeado." });
    expect(mocks.allyPdf.mock.calls[0][0].allySharePercent).toBe(0);
    expect(mocks.investorPdf.mock.calls[0][0].platformSharePercent).toBe(0);
  });
  it('valida rangos, precisión y pareja antes de acceder a la BD', async () => {
    const caller = spacesRouter.createCaller(context());
    await expect(caller.admin.updateSpace({ id: 18, allySharePercent: 10 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller.admin.publishToCrowdfunding({ id: 18, allySharePercent: 3.751, investorSharePercent: 60, evgreenSharePercent: 40 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it('el público y comercial no pueden negociar porcentajes a través de endpoints', async () => {
    const state = memoryDb(); mocks.getDb.mockResolvedValue(state.db);
    await expect(spacesRouter.createCaller(context('comercial')).admin.updateSpace({ id: 18, allySharePercent: 15, investorSharePercent: 60, evgreenSharePercent: 40 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(spacesRouter.createCaller(context('comercial')).admin.publishToCrowdfunding({ id: 18, allySharePercent: 15, investorSharePercent: 60, evgreenSharePercent: 40 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(spacesRouter.createCaller(context(null)).submit({ submitterName: 'Mock', submitterEmail: 'mock@example.invalid', submitterPhone: '0000000', spaceName: 'Mock', spaceType: 'parking', address: 'Calle 1', city: 'Bogotá', allySharePercent: 15, investorSharePercent: 60, evgreenSharePercent: 40 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(state.writes).toHaveLength(0);
  });
});
