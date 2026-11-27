// Module Worker of the tree data (contract D15.6): builds TreeData off the main thread and hands
// every typed array over without copy. Free of three, like build.ts.
import { PALETTES } from '../../content/palettes.ts';
import type { PaletteId } from '../../content/palettes.ts';
import { buildTreeData, transferables } from './build.ts';
import type { DeviceProfile } from './cloud.ts';
import type { GrowthMode } from './skeleton.ts';

export interface BuildRequest {
  id: number;
  profile: DeviceProfile;
  mode: GrowthMode;
  seed: number;
  palette: PaletteId;
}

addEventListener('message', (e: MessageEvent<BuildRequest>) => {
  const { id, profile, mode, seed, palette } = e.data;
  try {
    const data = buildTreeData({ profile, mode, seed, palette: PALETTES[palette], now: () => performance.now() });
    postMessage({ id, data }, { transfer: transferables(data) });
  } catch (err) {
    postMessage({ id, error: String(err) });
  }
});
