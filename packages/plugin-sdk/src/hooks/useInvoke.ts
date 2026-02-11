import { getPluginContext } from '../context';

/** Returns the invoke proxy for calling Tauri commands allowed by the plugin manifest. */
export function useInvoke() {
  return getPluginContext().invoke;
}
