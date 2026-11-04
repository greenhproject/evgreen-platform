import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  id: '1170006',
  auth: { user: { id: 570001, name: 'Titular', email: 'fixture@example.invalid' } as any, loading: false },
  query: { data: undefined as any, error: null as any, isPending: false, isFetching: false, refetch: vi.fn() },
}));
vi.mock('wouter', () => ({ useParams: () => ({ transactionId: state.id }), useLocation: () => ['/', vi.fn()] }));
vi.mock('@/lib/trpc', () => ({ trpc: {
  transactions: { getById: { useQuery: () => state.query } },
  banners: { getActive: { useQuery: () => ({ data: [] }) }, recordImpression: { useMutation: () => ({ mutate: vi.fn() }) } },
} }));
vi.mock('@/_core/hooks/useAuth', () => ({ useAuth: () => state.auth }));
vi.mock('@/components/SessionFeedbackModal', () => ({ default: () => null }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
import ChargingSummary from '../../client/src/pages/user/ChargingSummary';

function html() { return renderToStaticMarkup(React.createElement(ChargingSummary)); }
const completed = {
  id:1170006, status:'COMPLETED', startTime:'2026-11-04T01:48:15Z', endTime:'2026-11-04T08:26:17Z',
  durationMinutes:398, kwhConsumed:'31.92', appliedPricePerKwh:1104, pricePerKwh:1000,
  energyCost:35241.89, sessionCost:2000, timeCost:0, overstayCost:0,totalCost:37241.89,
  stationName:'Estación aislada', connectorType:'GBT_AC',connectorId:1,chargeType:'AC',chargeMode:'full_charge',startMethod:'APP',stopReason:'EVDisconnected',
};

describe('Pantalla real de resumen de carga', () => {
  beforeEach(() => {
    vi.stubGlobal('React', React);
    state.id = '1170006';
    state.auth.user = {id:570001,name:'Titular',email:'fixture@example.invalid'};
    state.auth.loading = false;
    state.query.data = undefined;
    state.query.error = null;
    state.query.isPending = false;
    state.query.isFetching = false;
  });
  it('no anuncia pérdida de transacción ante un fallo interno y ofrece una consulta, no un cobro', () => {
    state.query.error = {data:{code:'INTERNAL_SERVER_ERROR'}};
    expect(html()).toContain('No pudimos cargar el resumen');
    expect(html()).toContain('Reintentar consulta');
    expect(html()).not.toContain('Transacción no encontrada');
  });
  it('distingue NOT_FOUND, FORBIDDEN y enlace malformado', () => {
    state.query.error = {data:{code:'NOT_FOUND'}};
    expect(html()).toContain('Transacción no encontrada');
    state.query.error = {data:{code:'FORBIDDEN'}};
    expect(html()).toContain('Sin acceso a esta transacción');
    state.query.error = null;
    state.id = '1170006abc';
    expect(html()).toContain('Enlace de carga inválido');
  });
  it('espera autenticación o consulta inicial, sin mostrar ausencia como NOT_FOUND', () => {
    state.auth.loading = true;
    expect(html()).toContain('Cargando resumen');
    state.auth.loading = false;
    state.query.isPending = true;
    expect(html()).toContain('Cargando resumen');
    state.auth.user = null;
    state.query.isPending = false;
    expect(html()).toContain('Necesitas iniciar sesión');
  });
  it('no muestra recibo final mientras la transacción siga en progreso', () => {
    state.query.data = {...completed, status:'IN_PROGRESS', endTime:null};
    expect(html()).toContain('Finalizando carga');
    expect(html()).toContain('Actualizar estado');
    expect(html()).not.toContain('¡Carga Completada!');
  });
  it('conserva un recibo válido ante error de actualización, pero no al perder permisos', () => {
    state.query.data = completed;
    state.query.error = {data:{code:'INTERNAL_SERVER_ERROR'}};
    expect(html()).toContain('Mostramos el último resumen recibido');
    expect(html()).toContain('¡Carga Completada!');
    state.query.error = {data:{code:'FORBIDDEN'}};
    expect(html()).toContain('Sin acceso a esta transacción');
    expect(html()).not.toContain('¡Carga Completada!');
  });
});
