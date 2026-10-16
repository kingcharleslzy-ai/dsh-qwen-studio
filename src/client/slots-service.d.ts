/**
 * Ambient typing for the `slots` service on the cordis Context.
 *
 * DSH 0.1.5 stopped publishing `@deepseek-ai/dsh-client-runtime` — the host
 * bundles the slot runtime internally — so the `declare module
 * '@deepseek-ai/cordis'` augmentation that used to reach this plugin
 * transitively (through the 0.1.1-rc.2 settings/conversation peers) no
 * longer resolves after the dependency tree moved to 0.1.5-rc.1. This local
 * declaration restores the `ctx.slots` face for exactly the surface this
 * plugin consumes: `register` (the SlotCore typed API, verbatim) plus
 * `inject` (declaration-lifetime effects). The rest of the runtime wrapper
 * (install/renderSlot/snapshot/...) is host-internal and intentionally not
 * mirrored. Slot keys stay `string`: the DSH seat names this plugin targets
 * ('tool.call.toolview', 'conversation.view', 'settings.plugins.tab',
 * 'conversation.input.right', 'sidebar.right.pane.tab') arrive as plain
 * strings, and every registration site already narrows through its own cast.
 */
import type { SlotCore } from "@deepseek-ai/dsh-client-ui-slots";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Slot registry provided by the DSH browser runtime (host-internal since 0.1.5). */
    slots: {
      register: SlotCore["register"];
      inject(
        key: string,
        callback: () => (() => void) | Iterable<() => void>,
      ): () => void;
    };
  }
}
