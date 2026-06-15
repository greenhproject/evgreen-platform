import { describe, expect, it } from "vitest";

/**
 * Tests for investor station listing logic that combines
 * owned stations + crowdfunding participation stations.
 * These tests validate the business logic without hitting the database.
 */

// Simulate the getInvestorAllStations logic
interface OwnedStation {
  id: number;
  name: string;
  ownerId: number;
}

interface CrowdfundingParticipation {
  projectId: number;
  stationId: number | null;
  investorId: number;
  participationPercent: string;
  projectName: string;
}

function combineInvestorStations(
  ownedStations: OwnedStation[],
  participations: CrowdfundingParticipation[]
): Array<{
  id: number;
  name: string;
  ownershipType: 'owned' | 'crowdfunding';
  participationPercent: string;
  crowdfundingProjectId: number | null;
  crowdfundingProjectName: string | null;
}> {
  const ownedIds = new Set(ownedStations.map(s => s.id));
  
  const result: Array<{
    id: number;
    name: string;
    ownershipType: 'owned' | 'crowdfunding';
    participationPercent: string;
    crowdfundingProjectId: number | null;
    crowdfundingProjectName: string | null;
  }> = [];
  
  // Add owned stations
  for (const station of ownedStations) {
    result.push({
      id: station.id,
      name: station.name,
      ownershipType: 'owned',
      participationPercent: '100.0000',
      crowdfundingProjectId: null,
      crowdfundingProjectName: null,
    });
  }
  
  // Add crowdfunding stations (only those with a linked station and not already owned)
  for (const p of participations) {
    if (p.stationId && !ownedIds.has(p.stationId)) {
      result.push({
        id: p.stationId,
        name: p.projectName,
        ownershipType: 'crowdfunding',
        participationPercent: p.participationPercent,
        crowdfundingProjectId: p.projectId,
        crowdfundingProjectName: p.projectName,
      });
    }
  }
  
  return result;
}

// Simulate auto-station creation for crowdfunding projects
function autoCreateStationForProject(project: {
  name: string;
  city: string;
  zone: string;
  address?: string;
  chargerCount?: number;
  chargerPowerKw?: number;
  evgreenSharePercent?: string;
  investorSharePercent?: string;
  hostSharePercent?: string;
  energyPurchaseCostPerKwh?: string;
}): {
  stationName: string;
  stationAddress: string;
  evgreenSharePercent: string;
  investorSharePercent: string;
  hostSharePercent: string;
  energyPurchaseCostPerKwh: string;
  connectorCount: number;
} {
  return {
    stationName: project.name,
    stationAddress: project.address || `${project.zone}, ${project.city}`,
    evgreenSharePercent: project.evgreenSharePercent || '30.00',
    investorSharePercent: project.investorSharePercent || '70.00',
    hostSharePercent: project.hostSharePercent || '10.00',
    energyPurchaseCostPerKwh: project.energyPurchaseCostPerKwh || '800.00',
    connectorCount: project.chargerCount || 4,
  };
}

describe("Investor Station Listing - Combined Sources", () => {
  it("shows only owned stations when no crowdfunding participations", () => {
    const owned: OwnedStation[] = [
      { id: 1, name: "EVG Diamante Oriental", ownerId: 65 },
    ];
    const participations: CrowdfundingParticipation[] = [];
    
    const result = combineInvestorStations(owned, participations);
    
    expect(result).toHaveLength(1);
    expect(result[0].ownershipType).toBe('owned');
    expect(result[0].participationPercent).toBe('100.0000');
  });

  it("shows both owned and crowdfunding stations", () => {
    const owned: OwnedStation[] = [
      { id: 1, name: "EVG Diamante Oriental", ownerId: 65 },
    ];
    const participations: CrowdfundingParticipation[] = [
      { projectId: 1, stationId: 210001, investorId: 65, participationPercent: '5.0000', projectName: 'Estación Bogotá Norte' },
    ];
    
    const result = combineInvestorStations(owned, participations);
    
    expect(result).toHaveLength(2);
    expect(result[0].ownershipType).toBe('owned');
    expect(result[0].name).toBe('EVG Diamante Oriental');
    expect(result[1].ownershipType).toBe('crowdfunding');
    expect(result[1].name).toBe('Estación Bogotá Norte');
    expect(result[1].participationPercent).toBe('5.0000');
    expect(result[1].crowdfundingProjectId).toBe(1);
  });

  it("does not duplicate stations that are both owned and in crowdfunding", () => {
    const owned: OwnedStation[] = [
      { id: 210001, name: "Estación Bogotá Norte", ownerId: 65 },
    ];
    const participations: CrowdfundingParticipation[] = [
      { projectId: 1, stationId: 210001, investorId: 65, participationPercent: '5.0000', projectName: 'Estación Bogotá Norte' },
    ];
    
    const result = combineInvestorStations(owned, participations);
    
    // Should not duplicate - owned takes precedence
    expect(result).toHaveLength(1);
    expect(result[0].ownershipType).toBe('owned');
  });

  it("excludes crowdfunding participations without a linked station", () => {
    const owned: OwnedStation[] = [];
    const participations: CrowdfundingParticipation[] = [
      { projectId: 1, stationId: null, investorId: 65, participationPercent: '5.0000', projectName: 'Proyecto sin estación' },
    ];
    
    const result = combineInvestorStations(owned, participations);
    
    expect(result).toHaveLength(0);
  });

  it("handles multiple crowdfunding participations", () => {
    const owned: OwnedStation[] = [
      { id: 1, name: "Mi estación propia", ownerId: 65 },
    ];
    const participations: CrowdfundingParticipation[] = [
      { projectId: 1, stationId: 210001, investorId: 65, participationPercent: '5.0000', projectName: 'Bogotá Norte' },
      { projectId: 2, stationId: 210002, investorId: 65, participationPercent: '3.5000', projectName: 'Medellín Poblado' },
      { projectId: 3, stationId: 210003, investorId: 65, participationPercent: '10.0000', projectName: 'Cali Ciudad Jardín' },
    ];
    
    const result = combineInvestorStations(owned, participations);
    
    expect(result).toHaveLength(4);
    expect(result.filter(s => s.ownershipType === 'owned')).toHaveLength(1);
    expect(result.filter(s => s.ownershipType === 'crowdfunding')).toHaveLength(3);
  });
});

describe("Auto-Station Creation for Crowdfunding", () => {
  it("creates station with default financial model when none specified", () => {
    const station = autoCreateStationForProject({
      name: "Estación Bogotá Norte",
      city: "Bogotá",
      zone: "Usaquén / Zona Norte",
    });
    
    expect(station.stationName).toBe("Estación Bogotá Norte");
    expect(station.stationAddress).toBe("Usaquén / Zona Norte, Bogotá");
    expect(station.evgreenSharePercent).toBe('30.00');
    expect(station.investorSharePercent).toBe('70.00');
    expect(station.hostSharePercent).toBe('10.00');
    expect(station.energyPurchaseCostPerKwh).toBe('800.00');
    expect(station.connectorCount).toBe(4);
  });

  it("creates station with custom financial model", () => {
    const station = autoCreateStationForProject({
      name: "Estación Premium",
      city: "Medellín",
      zone: "El Poblado",
      address: "Cra 43A #11-50",
      chargerCount: 8,
      chargerPowerKw: 150,
      evgreenSharePercent: '25.00',
      investorSharePercent: '65.00',
      hostSharePercent: '10.00',
      energyPurchaseCostPerKwh: '750.00',
    });
    
    expect(station.stationName).toBe("Estación Premium");
    expect(station.stationAddress).toBe("Cra 43A #11-50");
    expect(station.evgreenSharePercent).toBe('25.00');
    expect(station.investorSharePercent).toBe('65.00');
    expect(station.hostSharePercent).toBe('10.00');
    expect(station.connectorCount).toBe(8);
  });

  it("uses address from zone+city when no explicit address provided", () => {
    const station = autoCreateStationForProject({
      name: "Test",
      city: "Cali",
      zone: "Ciudad Jardín",
    });
    
    expect(station.stationAddress).toBe("Ciudad Jardín, Cali");
  });

  it("financial model: EVGreen + Investor = 100%, Host is separate", () => {
    const station = autoCreateStationForProject({
      name: "Test",
      city: "Bogotá",
      zone: "Centro",
    });
    
    // EVGreen + Investor must sum to 100% (they split the net after host)
    const evInvTotal = parseFloat(station.evgreenSharePercent) +
      parseFloat(station.investorSharePercent);
    expect(evInvTotal).toBe(100);
    
    // Host is a separate percentage (0-50%) on gross margin
    const hostPct = parseFloat(station.hostSharePercent);
    expect(hostPct).toBeGreaterThanOrEqual(0);
    expect(hostPct).toBeLessThanOrEqual(50);
  });
});
