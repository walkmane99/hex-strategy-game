import { UnitEntity } from '@/components/battle/types';

const MOVE_SPEED_MS = 200;

interface TimeArgs {
  current: number;
  delta: number;
  previous: number;
  previousDelta: number;
}

const MovementSystem = (
  entities: Record<string, unknown>,
  { time, dispatch }: { time: TimeArgs; dispatch: (event: object) => void }
): Record<string, unknown> => {
  const delta = Math.min(time.delta, 100);

  for (const key of Object.keys(entities)) {
    if (key === '__config') continue;
    const entity = entities[key] as UnitEntity;
    if (!entity.movePath || entity.movePath.length === 0) continue;

    const { pathSegmentPixels } = entity;
    if (!pathSegmentPixels || pathSegmentPixels.length < 2) {
      entity.movePath = [];
      continue;
    }

    let { pathIndex, pathProgress } = entity;
    const totalSegments = pathSegmentPixels.length - 1;

    pathProgress += delta / MOVE_SPEED_MS;

    while (pathProgress >= 1 && pathIndex < totalSegments - 1) {
      pathProgress -= 1;
      pathIndex += 1;
    }

    if (pathIndex >= totalSegments - 1 && pathProgress >= 1) {
      const finalPixel = pathSegmentPixels[pathSegmentPixels.length - 1];
      const finalPos = entity.movePath[entity.movePath.length - 1];
      entity.pixelX = finalPixel.x;
      entity.pixelY = finalPixel.y;
      entity.movePath = [];
      entity.pathIndex = 0;
      entity.pathProgress = 0;
      dispatch({ type: 'MOVE_COMPLETE', unitId: entity.unitId, finalPos });
    } else {
      const from = pathSegmentPixels[pathIndex];
      const to = pathSegmentPixels[pathIndex + 1];
      const t = Math.min(pathProgress, 1);
      entity.pixelX = from.x + (to.x - from.x) * t;
      entity.pixelY = from.y + (to.y - from.y) * t;
      entity.pathIndex = pathIndex;
      entity.pathProgress = pathProgress;
    }
  }

  return entities;
};

export default MovementSystem;
