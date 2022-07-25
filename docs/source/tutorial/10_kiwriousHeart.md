# Kiwrious Heart

## use kiwrious copper3d plugin directly

- config html environment

```html
<template>
  <div id="bg" ref="base_container">
    <div id="kiwrious">
      <button
        class="grid-child"
        id="btn-kiwrious-connect"
        ref="btn_kiwrious_connect"
      >
        Connect Kiwrious
      </button>
      <button
        class="grid-child"
        id="btn-kiwrious-disconnect"
        ref="btn_kiwrious_disconnect"
      >
        Disconnect Kiwrious
      </button>
      <div
        class="rightChartDescription"
        id="kiwrious-value"
        ref="kiwriousValues"
      ></div>
    </div>
  </div>
</template>
<style>
  #kiwrious {
    position: fixed;
  }
</style>
```

- config copper3d

```ts
import * as Copper from "gltfloader-plugin-test";
import "gltfloader-plugin-test/dist/css/style.css";
import { getCurrentInstance, onMounted } from "vue";

let refs = null;
let appRenderer: Copper.copperRenderer;
let bg: HTMLDivElement;

let connect: HTMLButtonElement;
let disconnect: HTMLButtonElement;
let kiwriousValue: HTMLDivElement;

onMounted(() => {
  let { $refs } = (getCurrentInstance() as any).proxy;
  refs = $refs;

  bg = refs.base_container;
  connect = refs.btn_kiwrious_connect;
  disconnect = refs.btn_kiwrious_disconnect;
  kiwriousValue = refs.kiwriousValues;

  appRenderer = new Copper.copperRenderer(bg, {
    guiOpen: true,
    camera: true,
    performance: true,
    light: true,
  });

  startKiwrious();
  appRenderer.closeGui();
  appRenderer.animate();
});
```

- setup kiwrious

```ts
function startKiwrious() {
  Copper.kiwrious.setWasm("kiwrious-config/libunicorn.out.wasm");
  Copper.kiwrious.setBinUrl("kiwrious-config/prog.bin");
  Copper.kiwrious.serialService.onSerialConnection = (isConnected: boolean) => {
    console.log(isConnected);
    connect.style.display = isConnected ? "none" : "block";
    disconnect.style.display = isConnected ? "block" : "none";
  };
  connect.onclick = async () => {
    connect.disabled = true;
    await Copper.kiwrious.serialService.connectAndReadAsync();
    connect.disabled = false;
  };
  disconnect.onclick = async () => {
    disconnect.disabled = true;
    await Copper.kiwrious.serialService.disconnectAsync();
    disconnect.disabled = false;
  };
  Copper.kiwrious.serialService.onSerialData = (
    decodedData: Copper.SensorReadResult_kiwrious
  ) => {
    const values =
      decodedData.decodedValues as Copper.SensorDecodedValue_kiwrious[];

    const val = values[0].value;
    const status = val.status;
    const hrVal = val.heartrate;

    kiwriousValue.innerText = status;

    if (status === "Ready") {
      kiwriousValue.innerText = (hrVal / 2).toString();
    }
  };
}
```

## use copper3d

```ts
function startKiwrious() {
  const connectionCallback = (isConnected: boolean) => {
    console.log(isConnected);
    connect.style.display = isConnected ? "none" : "block";
    disconnect.style.display = isConnected ? "block" : "none";
  };
  const heartDataCallback = (heartData: any, status: string, hrVal: number) => {
    const val = heartData;

    console.log(val);

    kiwriousValue.innerText = status;

    if (status === "Ready") {
      kiwriousValue.innerText = (hrVal / 2).toString();
    }
  };
  Copper.configKiwriousHeart(
    connect,
    disconnect,
    "/kiwrious-config/prog.bin",
    "/kiwrious-config/libunicorn.out.wasm",
    connectionCallback,
    heartDataCallback
  );
}
```
