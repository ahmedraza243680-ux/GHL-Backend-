/**
 * Canonical location IDs from GHL URLs (business name → internal id + GHL location id).
 */
export const KNOWN_LOCATIONS = [
  {
    businessName: 'Bergen Car Company',
    locationId: 'cmp7ok6hj0006ve1sebz047jb',
    ghlLocationId: 'NDYfMNSuMjNJz3N2CjPd',
  },
  {
    businessName: '551 HVAC',
    locationId: 'cmp7ok64t0004ve1szxaexyzw',
    ghlLocationId: '4diJ9Q8sTqY55I5ihUD7',
  },
  {
    businessName: 'Webtudy',
    locationId: 'cmp7ok6nu0008ve1sn4c7g70x',
    ghlLocationId: 'cFaTJXAmUqSLpoaxQ2fn',
  },
] as const;

export type KnownLocation = (typeof KNOWN_LOCATIONS)[number];

const BY_LOCATION_ID = new Map<string, KnownLocation>(
  KNOWN_LOCATIONS.map((loc) => [loc.locationId, loc]),
);

export function getKnownLocation(businessName: string): KnownLocation | undefined {
  return KNOWN_LOCATIONS.find((loc) => loc.businessName === businessName);
}

export function getKnownLocationById(locationId: string): KnownLocation | undefined {
  return BY_LOCATION_ID.get(locationId);
}

export function getCanonicalLocationId(businessName: string, fallbackId: string): string {
  return getKnownLocation(businessName)?.locationId ?? fallbackId;
}

export function getCanonicalGhlLocationId(
  businessName: string,
  fallbackGhlLocationId: string,
): string {
  return getKnownLocation(businessName)?.ghlLocationId ?? fallbackGhlLocationId;
}

export function applyLocationMapping<
  T extends { id: string; businessName: string; ghlLocationId: string },
>(location: T): T {
  const byName = getKnownLocation(location.businessName);
  if (byName) {
    return {
      ...location,
      id: byName.locationId,
      ghlLocationId: byName.ghlLocationId,
    };
  }

  const byId = getKnownLocationById(location.id);
  if (byId) {
    return {
      ...location,
      businessName: byId.businessName,
      id: byId.locationId,
      ghlLocationId: byId.ghlLocationId,
    };
  }

  return location;
}
