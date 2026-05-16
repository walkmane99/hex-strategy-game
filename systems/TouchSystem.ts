import { pixelToOffset } from '@/utils/pixelToHex';
import { ConfigEntity } from '@/components/battle/types';

interface Touch {
  id: string;
  type: string;
  event: { locationX: number; locationY: number };
}

const TouchSystem = (
  entities: Record<string, unknown>,
  { touches, dispatch }: { touches: Touch[]; dispatch: (event: object) => void }
): Record<string, unknown> => {
  const config = entities.__config as (ConfigEntity & { scale: number }) | undefined;
  if (config?.isAnimating) return entities;

  const taps = touches.filter((t) => t.type === 'end');
  if (taps.length === 0) return entities;

  const scale = config?.scale ?? 1;
  const { locationX, locationY } = taps[0].event;
  const hex = pixelToOffset(locationX, locationY, scale);

  if (hex) {
    dispatch({ type: 'HEX_TAPPED', hex });
  }

  return entities;
};

export default TouchSystem;
