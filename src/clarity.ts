import { config } from "./config";
import { activate, state, teardown } from "./core";
import { mapProperties } from "./utils";

export function start(customConfig?: IConfig) {
  if (state !== State.Activated) {
    mapProperties(customConfig, null, true, config);
    activate();
  }
}

export function stop() {
  teardown();
}
