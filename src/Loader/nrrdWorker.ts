import {
  createNrrdWorkerState,
  handleLoadMessage,
  handleAbortMessage,
  type NrrdWorkerCommand,
  type NrrdWorkerMessage,
} from "./nrrdWorkerCore";

/**
 * The real Worker entry point -- a thin `self.onmessage` wrapper around `nrrdWorkerCore.ts`,
 * which holds every bit of actual logic (fetch dedup, cancellation, parse). Bundled inline
 * (see the `?worker&inline` import in `copperNrrdLoader.ts`) so the plugin build never needs
 * to serve a second file: the plugin's UMD bundle is uploaded as a single `code/` tree and
 * mounted at an unpredictable base path, and an inlined worker has no separate URL to
 * resolve.
 *
 * One `self` per Worker instance, and one Worker instance per `copperNrrdLoader.ts` module
 * (see its module-level `sharedWorker`) -- so this state is naturally scoped to one worker's
 * lifetime, with no cross-instance leakage to guard against.
 */
const state = createNrrdWorkerState();

self.onmessage = (event: MessageEvent<NrrdWorkerCommand>) => {
  const msg = event.data;
  if (msg.cmd === "load") {
    void handleLoadMessage(state, msg, (message: NrrdWorkerMessage, transfer?: Transferable[]) => {
      self.postMessage(message, transfer ?? []);
    });
  } else if (msg.cmd === "abort") {
    handleAbortMessage(state, msg);
  }
};
