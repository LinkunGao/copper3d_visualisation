import {
  createNrrdWorkerState,
  handleLoadMessage,
  handleAbortMessage,
} from "../../Loader/nrrdWorkerCore";

/**
 * An in-process double for the real NRRD worker, driving the exact same
 * `nrrdWorkerCore.ts` logic the real worker entry (`nrrdWorker.ts`) uses -- just relayed
 * through plain function calls instead of a real `postMessage` boundary. jsdom (this repo's
 * test environment) has no `Worker` implementation, so tests install this via
 * `__setNrrdWorkerFactoryForTests` instead of letting `copperNrrdLoader.ts` construct a real
 * one.
 *
 * Because everything still runs in one JS realm, there is no real structured-clone/transfer
 * happening here -- the "transferred" buffer is just handed over by reference. That is fine
 * for exercising dedup/cancellation/min-max logic (this module's actual job), but it cannot
 * catch a bug where the real worker forgot to include a buffer in its transfer list. Real
 * cross-realm transfer is exercised by manual/perf verification against the built app.
 */
export function createInProcessNrrdWorker() {
  const state = createNrrdWorkerState();
  const fake: { postMessage: (msg: any) => void; onmessage: ((ev: MessageEvent) => void) | null } = {
    postMessage: () => {},
    onmessage: null,
  };

  fake.postMessage = (msg: any) => {
    if (msg.cmd === "load") {
      void handleLoadMessage(state, msg, (message) => {
        fake.onmessage?.({ data: message } as MessageEvent);
      });
    } else if (msg.cmd === "abort") {
      handleAbortMessage(state, msg);
    }
  };

  return fake;
}
