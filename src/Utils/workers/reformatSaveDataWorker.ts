import { paintImageType } from "../../types/types";

addEventListener("message", (event) => {
  const data = event.data;
  if (data.type === "reformat") {
    // 在 Worker 中执行计算量大的代码
    const masks = restructData(
      data.masksData,
      data.len,
      data.width,
      data.height
    );
    const result = {
      masks,
      type: "reformat",
    };
    // 发送计算结果到主线程
    postMessage(result);
  } else if (data.type === "saveBlob") {
    const result = convertReformatDataToBlob(data.maskData);
    postMessage({
      type: "saveBlob",
      data: result,
    });
  }
});

function deepCopy(obj: any): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj);
  }

  if (obj instanceof Array) {
    let copiedArray = [];
    for (let i = 0; i < obj.length; i++) {
      copiedArray[i] = deepCopy(obj[i]);
    }
    return copiedArray;
  }

  if (obj instanceof Uint8ClampedArray) {
    let copiedArray = [];
    for (let i = 0; i < obj.length; i++) {
      copiedArray[i] = deepCopy(obj[i]);
    }
    return copiedArray;
  }

  if (obj instanceof Object) {
    let copiedObject: any = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        copiedObject[key] = deepCopy(obj[key]);
      }
    }
    return copiedObject;
  }

  throw new Error("Unable to copy obj! Its type isn't supported.");
}

function pruningData(originArr: paintImageType[]) {
  let pruningArray = [];
  for (let i = 0; i < originArr.length; i++) {
    pruningArray.push(originArr[i].image.data);
  }
  return pruningArray;
}

function restructData(
  originArr: paintImageType[],
  len: number,
  width: number,
  height: number
) {
  const reformatData = [];

  let start: unknown = new Date();

  // const copiedArray = deepCopy(originArr) as paintImageType[];

  let end: unknown = new Date();
  let timeDiff = (end as number) - (start as number); // time difference in milliseconds

  let start_c: unknown = new Date();
  for (let i = 0; i < len; i++) {
    let exportTemp = {
      sliceIndex: 0,
      dataFormat:
        "RGBA - Each successive 4-digit number forms a pixel point in data array",
      width,
      height,
      voxelSpacing: 0,
      spaceOrigin: 0,
      data: [],
    };

    exportTemp.sliceIndex = originArr[i].index;

    // const imageData = copiedArray[i].image;

    // const temp = Array.from(imageData.data).map((x) => Number(x));
    // const temp = [];
    const copiedArray = originArr[i].image.data.slice();
    const temp = [...copiedArray];
    // for (let j = 0; j < imageData.data.length; j++) {
    //   temp.push(imageData.data[j]);
    // }

    (exportTemp as any).data = temp;
    reformatData.push(exportTemp);
  }
  let end_c: unknown = new Date();
  let timeDiff_c = (end_c as number) - (start_c as number);
  return reformatData;
}

function convertReformatDataToBlob(maskData: any) {
  try {
    const blob = new Blob([JSON.stringify(maskData)], {
      type: "text/plain;charset=utf-8",
    });
    // saveFileAsJson(blob, name);
    return blob;
  } catch (error) {
    console.log(error);

    return false;
  }
}

export { pruningData, restructData, convertReformatDataToBlob };
