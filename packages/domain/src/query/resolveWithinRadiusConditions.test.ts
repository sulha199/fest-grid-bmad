/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveWithinRadiusConditions,
  UnknownLocationPreferenceError,
  LocationPoint,
} from "./resolveWithinRadiusConditions.js";
import { InvalidUserLocationInputError } from "../user-locations/validateLocationInput.js";
import { QueryCondition } from "./queryDsl.js";

test("resolveWithinRadiusConditions", async (t) => {
  const locationsById = new Map<string, LocationPoint>([
    ["loc-home", { latitude: -6.2, longitude: 106.8 }],
    ["loc-work", { latitude: -6.1, longitude: 106.9 }],
  ]);

  await t.test("resolves a single top-level withinRadius condition", () => {
    const condition: QueryCondition = {
      field: "scheduleCoordinates",
      operator: "withinRadius",
      value: { locationPreferenceId: "loc-home", radiusKm: 10 },
    };

    const resolved = resolveWithinRadiusConditions(condition, locationsById);
    assert.deepEqual(resolved, {
      field: "scheduleCoordinates",
      operator: "withinRadius",
      value: { latitude: -6.2, longitude: 106.8, radiusKm: 10 },
    });
  });

  await t.test("resolves multiple different locationPreferenceIds nested inside an or/and tree (AC5)", () => {
    const condition: QueryCondition = {
      operator: "and",
      conditions: [
        {
          field: "title",
          operator: "contains",
          value: "Festival",
        },
        {
          operator: "or",
          conditions: [
            {
              field: "scheduleCoordinates",
              operator: "withinRadius",
              value: { locationPreferenceId: "loc-home", radiusKm: 15 },
            },
            {
              field: "scheduleCoordinates",
              operator: "withinRadius",
              value: { locationPreferenceId: "loc-work", radiusKm: 5 },
            },
          ],
        },
      ],
    };

    const resolved = resolveWithinRadiusConditions(condition, locationsById);
    assert.deepEqual(resolved, {
      operator: "and",
      conditions: [
        {
          field: "title",
          operator: "contains",
          value: "Festival",
        },
        {
          operator: "or",
          conditions: [
            {
              field: "scheduleCoordinates",
              operator: "withinRadius",
              value: { latitude: -6.2, longitude: 106.8, radiusKm: 15 },
            },
            {
              field: "scheduleCoordinates",
              operator: "withinRadius",
              value: { latitude: -6.1, longitude: 106.9, radiusKm: 5 },
            },
          ],
        },
      ],
    });
  });

  await t.test("passes through an ad-hoc { latitude, longitude, radiusKm } condition unchanged after validation (AC1a)", () => {
    const condition: QueryCondition = {
      field: "scheduleCoordinates",
      operator: "withinRadius",
      value: { latitude: -6.3, longitude: 106.7, radiusKm: 20 },
    };

    const resolved = resolveWithinRadiusConditions(condition, locationsById);
    assert.deepEqual(resolved, condition);
  });

  await t.test("throws InvalidUserLocationInputError when a value supplies both locationPreferenceId and coordinates, and when it supplies neither (AC1a)", () => {
    assert.throws(
      () => {
        resolveWithinRadiusConditions(
          {
            field: "scheduleCoordinates",
            operator: "withinRadius",
            value: { locationPreferenceId: "loc-home", latitude: -6.2, longitude: 106.8, radiusKm: 10 },
          },
          locationsById
        );
      },
      (err: any) => err instanceof InvalidUserLocationInputError && err.message.includes("supply exactly one of")
    );

    assert.throws(
      () => {
        resolveWithinRadiusConditions(
          {
            field: "scheduleCoordinates",
            operator: "withinRadius",
            value: { radiusKm: 10 },
          },
          locationsById
        );
      },
      (err: any) => err instanceof InvalidUserLocationInputError && err.message.includes("supply exactly one of")
    );
  });

  await t.test("passes through non-withinRadius terminal conditions and other group conditions unchanged", () => {
    const condition: QueryCondition = {
      field: "category",
      operator: "eq",
      value: "music",
    };
    const resolved = resolveWithinRadiusConditions(condition, locationsById);
    assert.deepEqual(resolved, condition);

    const groupCondition: QueryCondition = {
      operator: "and",
      conditions: [condition],
    };
    const resolvedGroup = resolveWithinRadiusConditions(groupCondition, locationsById);
    assert.deepEqual(resolvedGroup, groupCondition);
  });

  await t.test("throws UnknownLocationPreferenceError for an id not present in locationsById", () => {
    assert.throws(
      () => {
        resolveWithinRadiusConditions(
          {
            field: "scheduleCoordinates",
            operator: "withinRadius",
            value: { locationPreferenceId: "loc-unknown", radiusKm: 10 },
          },
          locationsById
        );
      },
      (err: any) => err instanceof UnknownLocationPreferenceError && err.locationPreferenceId === "loc-unknown"
    );
  });

  await t.test("throws for radiusKm outside 1-50 on both shapes", () => {
    // Saved location shape
    assert.throws(
      () => {
        resolveWithinRadiusConditions(
          {
            field: "scheduleCoordinates",
            operator: "withinRadius",
            value: { locationPreferenceId: "loc-home", radiusKm: 0 },
          },
          locationsById
        );
      },
      InvalidUserLocationInputError
    );

    assert.throws(
      () => {
        resolveWithinRadiusConditions(
          {
            field: "scheduleCoordinates",
            operator: "withinRadius",
            value: { locationPreferenceId: "loc-home", radiusKm: 51 },
          },
          locationsById
        );
      },
      InvalidUserLocationInputError
    );

    // Ad-hoc shape
    assert.throws(
      () => {
        resolveWithinRadiusConditions(
          {
            field: "scheduleCoordinates",
            operator: "withinRadius",
            value: { latitude: -6.2, longitude: 106.8, radiusKm: 0 },
          },
          locationsById
        );
      },
      InvalidUserLocationInputError
    );

    assert.throws(
      () => {
        resolveWithinRadiusConditions(
          {
            field: "scheduleCoordinates",
            operator: "withinRadius",
            value: { latitude: -6.2, longitude: 106.8, radiusKm: 51 },
          },
          locationsById
        );
      },
      InvalidUserLocationInputError
    );
  });

  await t.test("handles null or undefined input cleanly", () => {
    assert.equal(resolveWithinRadiusConditions(null, locationsById), null);
    assert.equal(resolveWithinRadiusConditions(undefined, locationsById), undefined);
  });
});
