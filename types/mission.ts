import { OffsetCoord } from './map';

export interface MissionMetadata {
  keyUnitIds?: string[];
  escapeTiles?: OffsetCoord[];
  hqLocation?: OffsetCoord;
  baseLocations?: OffsetCoord[];
  payloadUnitId?: string;
  controlPoints?: OffsetCoord[];
}
