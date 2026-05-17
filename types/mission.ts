import { OffsetCoord } from './map';

export interface MissionMetadata {
  keyUnitIds?: string[];
  escapeTiles?: OffsetCoord[];
  hqLocation?: OffsetCoord;
  baseLocations?: {
    player: OffsetCoord;
    enemy: OffsetCoord;
  };
  payloadUnitId?: string;
  controlPoints?: OffsetCoord[];
}
