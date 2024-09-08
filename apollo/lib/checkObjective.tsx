import matchesPlayerList from '@deities/athena/lib/matchesPlayerList.tsx';
import Entity from '@deities/athena/map/Entity.tsx';
import { PlayerID, PlayerIDSet } from '@deities/athena/map/Player.tsx';
import Unit, { TransportedUnit } from '@deities/athena/map/Unit.tsx';
import Vector from '@deities/athena/map/Vector.tsx';
import MapData from '@deities/athena/MapData.tsx';
import {
  Criteria,
  Objective,
  ObjectiveID,
  onlyHasDefaultObjective,
} from '@deities/athena/Objectives.tsx';
import isPresent from '@deities/hephaestus/isPresent.tsx';
import { ActionResponse } from '../ActionResponse.tsx';

const destructiveActions = new Set([
  'ActivatePower',
  'AttackBuilding',
  'AttackUnit',
  'EndTurn',
  'ToggleLightning',
]);

const moveActions = new Set(['CreateUnit', 'DropUnit', 'Move', 'Spawn']);

export function isDestructiveAction(actionResponse: ActionResponse) {
  return destructiveActions.has(actionResponse.type);
}

export function shouldCheckDefaultObjectives(
  map: MapData,
  actionResponse: ActionResponse,
) {
  const { objectives } = map.config;
  if (isDestructiveAction(actionResponse)) {
    return (
      onlyHasDefaultObjective(objectives) ||
      objectives.some(
        (objective) =>
          objective.type === Criteria.Default ||
          (objective.type === Criteria.DefeatLabel &&
            matchesPlayerList(objective.players, map.currentPlayer)),
      )
    );
  } else if (actionResponse.type === 'Capture' && actionResponse.building) {
    return (
      onlyHasDefaultObjective(objectives) ||
      objectives.some(
        (objective) =>
          objective.type === Criteria.Default ||
          ((objective.type === Criteria.CaptureAmount ||
            objective.type === Criteria.CaptureLabel) &&
            matchesPlayerList(objective.players, map.currentPlayer)),
      )
    );
  }
  return false;
}

const filterByLabels = (label: PlayerIDSet) => (entity: Entity) =>
  entity.label != null && label.has(entity.label);

const filterUnitsByLabels = (label: PlayerIDSet | undefined) => {
  if (!label?.size) {
    return Boolean;
  }

  return (unit: Unit | TransportedUnit): boolean =>
    (unit.label != null && label?.has(unit.label)) ||
    (unit.isTransportingUnits() &&
      unit.transports.some(
        (unit) =>
          (unit.label != null && label?.has(unit.label)) ||
          filterUnitsByLabels(label)(unit),
      ));
};

const filterNeutral = (entity: Entity) => entity.player === 0;

const filterSelf = (map: MapData, player: PlayerID) => (entity: Entity) =>
  map.matchesPlayer(entity, player);

const filterEnemies = (map: MapData, player: PlayerID) => (entity: Entity) =>
  map.isOpponent(entity, player);

export function capturedByPlayer(map: MapData, player: PlayerID) {
  return map.buildings.filter((building) => map.matchesPlayer(building, player))
    .size;
}

export function destroyedBuildingsByPlayer(map: MapData, player: PlayerID) {
  return map.getPlayer(player).stats.destroyedBuildings;
}

export function rescuedUnitsByPlayer(map: MapData, player: PlayerID) {
  return map.getPlayer(player).stats.rescuedUnits;
}

export function escortedByPlayer(
  map: MapData,
  player: PlayerID,
  vectors: ReadonlySet<Vector>,
  label: PlayerIDSet | undefined,
) {
  return [...vectors]
    .map((vector) => {
      const unit = map.units.get(vector);
      return unit && map.matchesPlayer(unit, player) ? unit : null;
    })
    .filter(isPresent)
    .filter(filterUnitsByLabels(label)).length;
}

function checkObjective(
  previousMap: MapData,
  map: MapData,
  actionResponse: ActionResponse,
  isDestructive: boolean,
  isCapture: boolean,
  isRescue: boolean,
  isMove: boolean,
  objective: Objective,
) {
  const player =
    actionResponse.type === 'AttackUnit' && !actionResponse.unitA
      ? actionResponse.playerB
      : previousMap.currentPlayer;
  const isDefault = objective.type === Criteria.Default;
  const matchesPlayer =
    !isDefault && matchesPlayerList(objective.players, player);
  const isEndTurn = actionResponse.type === 'EndTurn';
  const isSurvivalAndEndTurn =
    objective.type === Criteria.Survival && isEndTurn;
  const targetPlayer = isEndTurn ? actionResponse.next.player : player;
  const ignoreIfOptional = !isDefault && objective.optional;

  if (
    objective.type !== Criteria.Default &&
    objective.completed?.has(
      isSurvivalAndEndTurn ? actionResponse.next.player : player,
    )
  ) {
    return false;
  }

  if (isDestructive) {
    if (!isDefault && isEndTurn) {
      const matchesTargetPlayerList = matchesPlayerList(
        objective.players,
        targetPlayer,
      );
      if (
        (objective.type === Criteria.DefeatAmount &&
          !ignoreIfOptional &&
          !matchesTargetPlayerList &&
          (objective.players?.length ? objective.players : map.active).some(
            (playerID) =>
              map.getPlayer(playerID).stats.destroyedUnits >= objective.amount,
          )) ||
        (objective.type === Criteria.DefeatLabel &&
          !ignoreIfOptional &&
          !matchesTargetPlayerList &&
          map.units
            .filter(filterUnitsByLabels(objective.label))
            .filter(filterSelf(map, targetPlayer)).size === 0 &&
          previousMap.units
            .filter(filterUnitsByLabels(objective.label))
            .filter(filterSelf(previousMap, targetPlayer)).size > 0) ||
        (objective.type === Criteria.DefeatOneLabel &&
          !ignoreIfOptional &&
          !matchesTargetPlayerList &&
          map.units
            .filter(filterUnitsByLabels(objective.label))
            .filter(filterSelf(map, targetPlayer)).size <
            previousMap.units
              .filter(filterUnitsByLabels(objective.label))
              .filter(filterSelf(map, targetPlayer)).size) ||
        (objective.type === Criteria.EscortLabel &&
          !ignoreIfOptional &&
          matchesTargetPlayerList &&
          map.units
            .filter(filterUnitsByLabels(objective.label))
            .filter(filterSelf(map, targetPlayer)).size <
            previousMap.units
              .filter(filterUnitsByLabels(objective.label))
              .filter(filterSelf(map, targetPlayer)).size)
      ) {
        return objective;
      }
    }

    return (
      (objective.type === Criteria.DefeatLabel &&
        matchesPlayer &&
        map.units
          .filter(filterUnitsByLabels(objective.label))
          .filter(filterEnemies(map, player)).size === 0 &&
        previousMap.units
          .filter(filterUnitsByLabels(objective.label))
          .filter(filterEnemies(previousMap, player)).size > 0) ||
      (objective.type === Criteria.DefeatOneLabel &&
        matchesPlayer &&
        map.units
          .filter(filterUnitsByLabels(objective.label))
          .filter(filterEnemies(map, player)).size <
          previousMap.units
            .filter(filterUnitsByLabels(objective.label))
            .filter(filterEnemies(previousMap, player)).size) ||
      (objective.type === Criteria.DefeatAmount &&
        matchesPlayer &&
        (objective.players?.length ? objective.players : map.active).some(
          (playerID) =>
            map.getPlayer(playerID).stats.destroyedUnits >= objective.amount,
        )) ||
      (objective.type === Criteria.CaptureLabel &&
        !ignoreIfOptional &&
        map.buildings
          .filter(filterByLabels(objective.label))
          .filter(filterEnemies(map, player)).size <
          previousMap.buildings
            .filter(filterByLabels(objective.label))
            .filter(filterEnemies(map, player)).size) ||
      (actionResponse.type === 'AttackBuilding' &&
        !actionResponse.building &&
        objective.type === Criteria.DestroyLabel &&
        map.buildings
          .filter(filterByLabels(objective.label))
          .filter(filterEnemies(map, player)).size === 0 &&
        previousMap.buildings
          .filter(filterByLabels(objective.label))
          .filter(filterEnemies(previousMap, player)).size > 0) ||
      (objective.type === Criteria.RescueLabel &&
        !ignoreIfOptional &&
        map.units.filter(filterNeutral).filter(filterByLabels(objective.label))
          .size <
          previousMap.units
            .filter(filterNeutral)
            .filter(filterByLabels(objective.label)).size) ||
      (actionResponse.type === 'AttackUnit' &&
        objective.type === Criteria.RescueAmount &&
        !ignoreIfOptional &&
        map.units.filter(filterNeutral).size +
          rescuedUnitsByPlayer(map, player) <
          objective.amount) ||
      (actionResponse.type === 'AttackBuilding' &&
        !actionResponse.building &&
        objective.type === Criteria.DestroyAmount &&
        matchesPlayer &&
        destroyedBuildingsByPlayer(map, player) >= objective.amount) ||
      (!isEndTurn &&
        objective.type === Criteria.EscortLabel &&
        !matchesPlayer &&
        !ignoreIfOptional &&
        map.units
          .filter(filterUnitsByLabels(objective.label))
          .filter(filterEnemies(map, targetPlayer)).size <
          previousMap.units
            .filter(filterUnitsByLabels(objective.label))
            .filter(filterEnemies(map, targetPlayer)).size) ||
      (isSurvivalAndEndTurn &&
        objective.rounds <= actionResponse.round &&
        matchesPlayerList(objective.players, targetPlayer)) ||
      (objective.type === Criteria.EscortAmount &&
        objective.label?.size &&
        !matchesPlayer &&
        !ignoreIfOptional &&
        map.units
          .filter(filterUnitsByLabels(objective.label))
          .filter(filterEnemies(map, player)).size < objective.amount)
    );
  }

  if (isCapture) {
    return (
      (objective.type === Criteria.CaptureAmount &&
        matchesPlayer &&
        capturedByPlayer(map, player) >= objective.amount) ||
      (objective.type === Criteria.CaptureLabel &&
        matchesPlayer &&
        !map.buildings
          .filter(filterByLabels(objective.label))
          .filter(filterEnemies(map, player)).size &&
        previousMap.buildings
          .filter(filterByLabels(objective.label))
          .filter(filterEnemies(map, player)).size > 0)
    );
  }

  if (isRescue) {
    return (
      (objective.type === Criteria.RescueLabel &&
        matchesPlayer &&
        !map.units.filter(filterNeutral).filter(filterByLabels(objective.label))
          .size &&
        previousMap.units
          .filter(filterNeutral)
          .filter(filterByLabels(objective.label)).size > 0) ||
      (objective.type === Criteria.RescueAmount &&
        matchesPlayer &&
        rescuedUnitsByPlayer(map, player) >= objective.amount)
    );
  }

  if (isMove) {
    if (objective.type === Criteria.EscortLabel && matchesPlayer) {
      const units = map.units
        .filter(filterUnitsByLabels(objective.label))
        .filter((unit) => map.matchesPlayer(unit, player));
      return (
        units.size > 0 &&
        units.filter((_, vector) => !objective.vectors.has(vector)).size === 0
      );
    }

    return (
      objective.type === Criteria.EscortAmount &&
      matchesPlayer &&
      escortedByPlayer(map, player, objective.vectors, objective.label) >=
        objective.amount
    );
  }

  return false;
}

export default function checkObjectives(
  previousMap: MapData,
  map: MapData,
  actionResponse: ActionResponse,
): [ObjectiveID, Objective] | null {
  const { objectives } = map.config;
  if (onlyHasDefaultObjective(objectives)) {
    return null;
  }

  const isDestructive = isDestructiveAction(actionResponse);
  const isCapture =
    !!(actionResponse.type === 'Capture' && actionResponse.building) ||
    actionResponse.type === 'CreateBuilding';

  const isMove = moveActions.has(actionResponse.type);
  const isRescue =
    actionResponse.type === 'Rescue' &&
    map.units.get(actionResponse.to)?.player === actionResponse.player;

  if (isDestructive || isCapture || isMove || isRescue) {
    const check = checkObjective.bind(
      null,
      previousMap,
      map,
      actionResponse,
      isDestructive,
      isCapture,
      isRescue,
      isMove,
    );
    if (objectives.size === 1) {
      const objective = objectives.first();
      if (objective && check(objective)) {
        return [0, objective];
      }
    }

    if (objectives.size === 2) {
      const objectiveA = objectives.first();
      if (objectiveA && check(objectiveA)) {
        return [0, objectiveA];
      }

      const objectiveB = objectives.last();
      if (objectiveB && check(objectiveB)) {
        return [1, objectiveB];
      }
    } else {
      for (const [id, objective] of objectives) {
        if (check(objective)) {
          return [id, objective];
        }
      }
    }
  }

  return null;
}
