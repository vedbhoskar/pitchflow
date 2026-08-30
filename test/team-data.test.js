import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const teams = JSON.parse(readFileSync(new URL("../data/teams.json", import.meta.url), "utf8"));

test("the Day 2 SIH order contains the 30 supplied teams in sequence", () => {
  assert.equal(teams.length, 30);
  assert.deepEqual(teams.slice(0, 3).map((team) => team.name), ["KisanTech", "Raghuveer", "TechSpark"]);
  assert.equal(teams.at(-1).name, "Dynamic Titans");
  assert.deepEqual(teams.map((team) => team.number), Array.from({ length: 30 }, (_, index) => String(index + 1).padStart(2, "0")));
});
