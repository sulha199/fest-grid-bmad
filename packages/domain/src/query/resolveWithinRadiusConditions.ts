import { QueryCondition, TerminalCondition, isGroupCondition } from "./queryDsl.js";
import { validateRadiusKm } from "../user-locations/validateLocationInput.js";
import { InvalidUserLocationInputError } from "../user-locations/validateLocationInput.js";

export class UnknownLocationPreferenceError extends Error {
  constructor(public readonly locationPreferenceId: string) {
    super(`Unknown or inaccessible locationPreferenceId: ${locationPreferenceId}`);
    this.name = "UnknownLocationPreferenceError";
  }
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
}

// Resolves every `withinRadius` terminal condition anywhere in the (possibly nested AND/OR) tree,
// replacing `value: { locationPreferenceId, radiusKm }` with `value: { latitude, longitude, radiusKm }`
// so buildDrizzleWhere never needs to perform a DB lookup itself. Ad-hoc `{ latitude, longitude, radiusKm }`
// conditions (AC1a) are validated and passed through as-is — they are already in the shape buildDrizzleWhere expects.
export function resolveWithinRadiusConditions(
  condition: QueryCondition | null | undefined,
  locationsById: Map<string, LocationPoint>
): QueryCondition | null | undefined {
  if (!condition) return condition;

  if (isGroupCondition(condition)) {
    return {
      operator: condition.operator,
      conditions: condition.conditions.map(c => resolveWithinRadiusConditions(c, locationsById) as QueryCondition),
    };
  }

  if (condition.operator !== "withinRadius") {
    return condition;
  }

  const { locationPreferenceId, latitude, longitude, radiusKm } = (condition.value ?? {}) as {
    locationPreferenceId?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
  };

  const hasLocationPreferenceId = typeof locationPreferenceId === "string" && !!locationPreferenceId;
  const hasCoordinates = typeof latitude === "number" && typeof longitude === "number";

  if (hasLocationPreferenceId === hasCoordinates) {
    // Either both present or neither present — AC1a requires exactly one of the two shapes.
    throw new InvalidUserLocationInputError(
      "withinRadius value must supply exactly one of locationPreferenceId or { latitude, longitude }"
    );
  }

  validateRadiusKm(radiusKm as number);

  if (hasCoordinates) {
    // Ad-hoc shape (AC1a): no lookup, no ownership check — already in the resolved shape.
    return condition;
  }

  const point = locationsById.get(locationPreferenceId as string);
  if (!point) {
    throw new UnknownLocationPreferenceError(locationPreferenceId as string);
  }

  return {
    ...condition,
    value: { latitude: point.latitude, longitude: point.longitude, radiusKm },
  } satisfies TerminalCondition;
}
