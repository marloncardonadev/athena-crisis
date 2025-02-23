import {
  getHealUnitTypes,
  getSkillPowerDamage,
  Skill,
} from '@deities/athena/info/Skill.tsx';
import {
  Dragon,
  Flamethrower,
  InfernoJetpack,
  Pioneer,
  UnitInfo,
  Zombie,
} from '@deities/athena/info/Unit.tsx';
import assignDeterministicUnitNames from '@deities/athena/lib/assignDeterministicUnitNames.tsx';
import getAirUnitsToRecover from '@deities/athena/lib/getAirUnitsToRecover.tsx';
import matchesActiveType from '@deities/athena/lib/matchesActiveType.tsx';
import updatePlayers from '@deities/athena/lib/updatePlayers.tsx';
import { HealAmount } from '@deities/athena/map/Configuration.tsx';
import Player from '@deities/athena/map/Player.tsx';
import Unit from '@deities/athena/map/Unit.tsx';
import Vector from '@deities/athena/map/Vector.tsx';
import MapData from '@deities/athena/MapData.tsx';
import { VisionT } from '@deities/athena/Vision.tsx';

const conversions = new Map<Skill, Readonly<{ from: UnitInfo; to: UnitInfo }>>([
  [Skill.SpawnUnitInfernoJetpack, { from: Flamethrower, to: InfernoJetpack }],
  [Skill.UnlockZombie, { from: Pioneer, to: Zombie }],
]);

const getAllOpponents = (
  map: MapData,
  player: Player,
  vision: VisionT | null,
) =>
  map.units.filter(
    (unit, vector) =>
      (!vision || vision.isVisible(map, vector)) &&
      map.isNonNeutralOpponent(player, unit),
  );

export function getUnitsToDamage(
  map: MapData,
  player: Player,
  skill: Skill,
  vision: VisionT | null,
) {
  if (skill === Skill.BuyUnitOctopus) {
    return getAllOpponents(map, player, vision);
  } else if (skill === Skill.BuyUnitDragon) {
    const vectors = new Set(
      [
        ...map.units
          .filter(
            (unit) =>
              unit.id === Dragon.id &&
              !unit.isCompleted() &&
              map.matchesPlayer(unit, player),
          )
          .keys(),
      ].flatMap((vector) => vector.adjacent()),
    );

    return getAllOpponents(map, player, vision).filter((_, vector) =>
      vectors.has(vector),
    );
  }

  return null;
}

export function onPowerUnitUpgrade(skill: Skill, unit: Unit) {
  if (skill === Skill.RecoverAirUnits) {
    return unit.recover();
  }

  const conversion = conversions.get(skill);
  if (conversion) {
    return unit.maybeConvert(conversion.from, conversion.to);
  }

  return null;
}

export function onPowerUnitOpponentEffect(
  skill: Skill,
  map: MapData,
  vector: Vector,
  unit: Unit,
) {
  const damage = getSkillPowerDamage(skill);
  if (damage > 0) {
    const newUnit = unit.modifyHealth(-damage);
    const isDead = newUnit.isDead();
    const count = isDead ? newUnit.count() : 0;
    return map.copy({
      teams: updatePlayers(map.teams, [
        map.getCurrentPlayer().modifyStatistics({
          damage,
          destroyedUnits: count,
        }),
        map.getPlayer(unit).modifyStatistics({
          lostUnits: count,
        }),
      ]),
      units: isDead ? map.units.delete(vector) : map.units.set(vector, newUnit),
    });
  }

  return null;
}

export default function applyPower(skill: Skill, map: MapData) {
  const healTypes = getHealUnitTypes(skill);
  const player = map.getCurrentPlayer();

  if (healTypes) {
    map = map.copy({
      units: map.units.map((unit) =>
        map.matchesPlayer(player, unit) &&
        matchesActiveType(healTypes, unit, null)
          ? unit.modifyHealth(HealAmount)
          : unit,
      ),
    });
  }

  if (skill === Skill.RecoverAirUnits) {
    map = map.copy({
      units: map.units.merge(
        getAirUnitsToRecover(map, player).map((unit) => unit.recover()),
      ),
    });
  }

  const conversion = conversions.get(skill);
  if (conversion) {
    const newUnits = map.units
      .filter((unit) => map.matchesPlayer(player, unit))
      .map((unit) => unit.maybeConvert(conversion.from, conversion.to));

    map = map.copy({
      units: map.units.merge(
        map.units,
        assignDeterministicUnitNames(map, newUnits),
      ),
    });
  }

  const units = getUnitsToDamage(map, player, skill, null);
  if (units) {
    for (const [vector, unit] of units) {
      map = onPowerUnitOpponentEffect(skill, map, vector, unit) || map;
    }
  }

  return map;
}
