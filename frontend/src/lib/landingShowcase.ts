/**
 * Public vehicle ids chosen for the guest landing.
 * Empty hides "כלים מהקהילה" until real, suitable passports are listed here.
 * Ids still have to appear in the public explore response; this list does not bypass visibility.
 */
export const LANDING_SHOWCASE_IDS: readonly string[] = [];

export function selectLandingShowcase<T extends { id: string }>(
  vehicles: readonly T[],
  ids: readonly string[] = LANDING_SHOWCASE_IDS,
): T[] {
  const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  return ids.flatMap((id) => {
    const vehicle = byId.get(id);
    return vehicle ? [vehicle] : [];
  });
}
