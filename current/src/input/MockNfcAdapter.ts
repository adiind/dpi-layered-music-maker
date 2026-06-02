import type { LayerId } from "../types/music";
import type { InputListener, LayerInputAdapter, ResolveNextOption } from "./InputAdapter";

const KEY_TO_LAYER: Record<string, LayerId> = {
  "1": "foundation",
  "2": "texture",
  "3": "drums",
  "4": "keys",
  "5": "solo",
};

export class KeyboardNfcMockAdapter implements LayerInputAdapter {
  constructor(private readonly resolveNextOption: ResolveNextOption) {}

  connect(listener: InputListener) {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;

      const layerId = KEY_TO_LAYER[event.key];
      if (!layerId) return;

      listener({
        layerId,
        optionId: this.resolveNextOption(layerId),
        source: "keyboard",
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }
}

export const layerKeyHint = (layerId: LayerId) =>
  Object.entries(KEY_TO_LAYER).find(([, value]) => value === layerId)?.[0] ?? "";
