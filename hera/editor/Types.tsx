import { Action } from '@deities/apollo/Action.tsx';
import { Effects, Scenario } from '@deities/apollo/Effects.tsx';
import { Decorator } from '@deities/athena/info/Decorator.tsx';
import Building from '@deities/athena/map/Building.tsx';
import Unit from '@deities/athena/map/Unit.tsx';
import MapData from '@deities/athena/MapData.tsx';
import { ObjectivesWithVectors } from '@deities/athena/Objectives.tsx';
import { Edges } from '../lib/Edges.tsx';
import { MapCreator } from '../ui/MapDetails.tsx';

export type EditorMode =
  | 'conditions'
  | 'decorators'
  | 'design'
  | 'effects'
  | 'entity'
  | 'evaluation'
  | 'restrictions'
  | 'settings'
  | 'setup';

export type EntityUndoKey =
  | 'fuel'
  | 'health'
  | 'leader'
  | `ammo-${string}`
  | `behavior-${string}`
  | `label-${string}`
  | `player-${string}`
  | `skill-${string}`;

type UndoKey =
  | `biome-${string}`
  | 'checkpoint'
  | 'initial'
  | `design-${'building' | 'decorator' | 'tile' | 'unit'}-${string}`
  | `entity-${'building' | 'unit'}-${EntityUndoKey}-${string}-${string}`
  | `resize-${string}-${string}`;

export type UndoEntry = readonly [UndoKey, MapData];
export type UndoStack = ReadonlyArray<UndoEntry>;
export type DrawingMode =
  | 'regular'
  | 'horizontal'
  | 'vertical'
  | 'horizontal-vertical'
  | 'diagonal';

export type EditorState = Readonly<{
  action?: Readonly<{ action: Action; actionId: number }>;
  drawingMode: DrawingMode;
  effects: Effects;
  isDrawing: boolean;
  isErasing: boolean;
  mode: EditorMode;
  objective?: readonly [objective: ObjectivesWithVectors, objectiveId: number];
  scenario: Scenario;
  selected?: Readonly<{
    building?: Building;
    decorator?: Decorator;
    eraseBuildings?: boolean;
    eraseDecorators?: boolean;
    eraseTiles?: boolean;
    eraseUnits?: boolean;
    tile?: number;
    unit?: Unit;
  }>;
  undoStack: UndoStack;
  undoStackIndex: number | null;
}>;

export type SaveMapFunction = (currentMap: MapData, type?: MapSaveType) => void;
export type SetEditorStateFunction = (editor: Partial<EditorState>) => void;
export type SetMapFunction = (
  type: 'biome' | 'cleanup' | 'heal' | 'reset' | 'resize' | 'teams' | 'units',
  map: MapData,
) => void;

type MapSaveType = 'New' | 'Update' | 'Disk' | 'Export';
export type MapCreateVariables = Readonly<{
  effects: Effects;
  map: MapData;
  mapName: string;
  tags: ReadonlyArray<string>;
}>;

export type MapUpdateVariables = MapCreateVariables &
  Readonly<{
    id: string;
  }>;

export type MapCreateFunction = (
  variables: MapCreateVariables,
  setSaveState: (state: MapEditorSaveState) => void,
) => void;
export type MapUpdateFunction = (
  variables: MapUpdateVariables,
  type: MapSaveType,
  setSaveState: (state: MapEditorSaveState) => void,
) => void;

export type MapObject = Readonly<{
  campaigns: Edges<
    Readonly<{
      id: string;
      name: string;
      slug: string;
    }>
  >;
  creator: MapCreator;
  effects: string;
  id: string;
  name: string;
  slug: string;
  state: string;
  tags: ReadonlyArray<string>;
}>;

export type PreviousMapEditorState = Readonly<{
  effects: string;
  map: MapData;
}>;

export type MapEditorSaveMessageId =
  | 'invalid-name'
  | 'invalid-map'
  | 'invalid-permission'
  | 'name-exists'
  | 'saved'
  | string;

export type MapEditorSaveState = Readonly<
  | {
      id: MapEditorSaveMessageId;
    }
  | {
      message: string;
    }
>;
