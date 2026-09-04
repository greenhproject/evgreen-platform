import { TRPCError } from "@trpc/server";
import {
  EMPTY_CONTRACT_PARTY,
  contractPartyValidationMessage,
  normalizeContractParty,
  validateContractParty,
  type ContractPartyData,
} from "../../shared/contract-parties";

type SpacePartySource = {
  submitterName?: string | null;
  submitterCompany?: string | null;
  submitterEmail?: string | null;
  submitterPhone?: string | null;
  submitterDocument?: string | null;
  letterSignerName?: string | null;
  letterSignerDocument?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
};

export function getContractAllyPrefill(space: SpacePartySource): ContractPartyData {
  return normalizeContractParty({
    ...EMPTY_CONTRACT_PARTY,
    legalName: space.submitterCompany || "",
    representativeName: space.letterSignerName || space.submitterName || "",
    representativeDocument: space.letterSignerDocument || space.submitterDocument || "",
    email: space.submitterEmail || "",
    phone: space.submitterPhone || "",
    notificationAddress: space.address || "",
    domicile: [space.city, space.country].filter(Boolean).join(", "),
  });
}

export function requireValidContractAlly(input: Partial<ContractPartyData>, space: SpacePartySource): ContractPartyData {
  const prefill = getContractAllyPrefill(space);
  const candidate = normalizeContractParty(Object.fromEntries(
    (Object.keys(EMPTY_CONTRACT_PARTY) as Array<keyof ContractPartyData>).map(key => [key, String(input[key] ?? "").trim() || prefill[key]]),
  ) as Partial<ContractPartyData>);
  const validation = validateContractParty(candidate);
  if (!validation.valid) {
    throw new TRPCError({ code: "BAD_REQUEST", message: contractPartyValidationMessage(candidate) || "Complete los datos obligatorios del aliado." });
  }
  return validation.data;
}
