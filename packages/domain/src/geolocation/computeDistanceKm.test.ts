import test from "node:test";
import assert from "node:assert/strict";
import { computeDistanceKm } from "./computeDistanceKm.js";

test("computeDistanceKm", async (t) => {
  await t.test("returns 0 for identical points (exercises the positive-side acos clamp)", () => {
    const point = { latitude: 51.5074, longitude: -0.1278 };
    assert.strictEqual(computeDistanceKm(point, point), 0);
  });

  await t.test("handles antipodal points safely (exercises the negative-side acos clamp)", () => {
    const northPole = { latitude: 90, longitude: 0 };
    const southPole = { latitude: -90, longitude: 0 };
    const distance = computeDistanceKm(northPole, southPole);
    // Half the great-circle circumference of a 6371km-radius sphere: 6371 * PI.
    assert.ok(Math.abs(distance - 6371 * Math.PI) < 0.01);
  });

  await t.test("computes the known real-world distance between London and Paris", () => {
    const london = { latitude: 51.5074, longitude: -0.1278 };
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const distance = computeDistanceKm(london, paris);
    assert.ok(Math.abs(distance - 343.56) < 1);
  });

  await t.test("is symmetric (viewer/target order does not change the result)", () => {
    const a = { latitude: -6.2, longitude: 106.8 };
    const b = { latitude: -6.1, longitude: 106.9 };
    assert.strictEqual(computeDistanceKm(a, b), computeDistanceKm(b, a));
  });
});
