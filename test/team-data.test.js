import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const teams = JSON.parse(readFileSync(new URL("../data/teams.json", import.meta.url), "utf8"));

test("the SIH order contains the 35 real teams in the supplied sequence", () => {
  assert.equal(teams.length, 35);
  assert.deepEqual(teams.slice(0, 3).map((team) => team.name), ["AquaHex", "Team HAVOC", "NeuralNexus"]);
  assert.equal(teams.at(-1).name, "LaPeace");
  assert.deepEqual(teams.map((team) => team.number), Array.from({ length: 35 }, (_, index) => String(index + 1).padStart(2, "0")));
});
