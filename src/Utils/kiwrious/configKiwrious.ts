import * as kiwrious_ from "copper3d_plugin_heart_k";
// const {
//   serialService,
//   setBinUrl,
//   setWasm,
// } = require("copper3d_plugin_heart_k");
import {
  SensorReadResult_kiwrious,
  SensorDecodedValue_kiwrious,
  SerialService_kiwrious,
  kiwriousType,
} from "../../types/types";

let serialService: SerialService_kiwrious;
let setBinUrl: (url: string) => void;
let setWasm: (url: string) => void;

if (kiwrious_.default) {
  serialService = kiwrious_.default.serialService;
  setBinUrl = kiwrious_.default.setBinUrl;
  setWasm = kiwrious_.default.setWasm;
} else {
  serialService = kiwrious_.serialService;
  setBinUrl = kiwrious_.setBinUrl;
  setWasm = kiwrious_.setWasm;
}
// const serialService = kiwrious_.default.serialService;
// const setBinUrl = kiwrious_.default.setBinUrl;
// const setWasm = kiwrious_.default.setWasm;

const kiwrious: kiwriousType = {
  serialService,
  setBinUrl,
  setWasm,
};
export default kiwrious;

export function configKiwriousHeart(
  connectBtn: HTMLButtonElement,
  disconnectBtn: HTMLButtonElement,
  binUrl: string,
  wasmUrl: string,
  connectionCallback: (isConnected: boolean) => void,
  heartDataCallback: (heartData: any, status: string, hrVal: number) => void
) {
  let connentKiwrious = false;
  // config kiwrious
  kiwrious.setBinUrl(binUrl);
  kiwrious.setWasm(wasmUrl);

  connectBtn.onclick = async () => {
    connectBtn.disabled = true;
    await kiwrious.serialService.connectAndReadAsync();
    connectBtn.disabled = false;
  };

  disconnectBtn.onclick = async () => {
    disconnectBtn.disabled = true;
    await kiwrious.serialService.disconnectAsync();
    disconnectBtn.disabled = false;
  };

  kiwrious.serialService.onSerialConnection = (isConnected: boolean) => {
    connectionCallback(isConnected);
  };
  kiwrious.serialService.onSerialData = (
    decodedData: SensorReadResult_kiwrious
  ) => {
    const values = decodedData.decodedValues as SensorDecodedValue_kiwrious[];

    const val = values[0].value;
    heartDataCallback(val, val.status, val.heartrate);
    // const status = val.status;
    // const hrVal = val.heartrate;
  };
}
