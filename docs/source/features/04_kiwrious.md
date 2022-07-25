# Copper3d Plugin (Kiwrious Heart)

## How to use in Copper3d

- see `tutorial 10`

## Useage

- install

```bash
npm i copper3d_plugin_kiwrious
```

- Step1: load `.wasm` file

```js
import * as copper3d_plugin_kiwrious from "copper3d_plugin_heart_k";
copper3d_plugin_kiwrious.setWasm("/791f4146c35521990ba3e84e823a55f3.wasm");
copper3d_plugin_kiwrious.setBinUrl(
  "/kiwrious-config/f1877cdf3dec53d47652f14c1e1b12c1.bin"
);
```

- Step2: connect Kiwrious

```js
await copper3d_plugin_kiwrious.serialService.connectAndReadAsync();
```

- Step3: detect connect (optional)

```js
copper3d_plugin_kiwrious.serialService.onSerialConnection = (
  isConnected: boolean
) => {
  console.log(isConnected);
};
```

- Step4: get Heart data

```js
copper3d_plugin_kiwrious.serialService.onSerialData = (decodedData) => {
  const values = decodedData.decodedValues;

  const val = values[0].value;
  const status = val.status;
  const hrVal = val.heartrate;

  $kiwriousValue.innerText = status;

  if (status === "Ready") {
    $kiwriousValue.innerText = hrVal.toString();
  }
};
```

- Step5: disconnect

```js
await copper3d_plugin_kiwrious.serialService.disconnectAsync();
```
