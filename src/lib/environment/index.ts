// let footprint = "./footprint_court_2k.hdr";
// let sunset = "./venice_sunset_1k.hdr";

let footprint = "";
let sunset = "";
export type environmentType = {
  id: string;
  name: string;
  path: string | null;
  format: string;
};

export function setHDRFilePath(url: string) {
  environments[1].path = url;
}

export const environments: Array<environmentType> = [
  {
    id: "",
    name: "None",
    path: null,
    format: ".hdr",
  },
  {
    id: "venice-sunset",
    name: "Venice Sunset",
    path: sunset,
    format: ".hdr",
  },
  {
    id: "footprint-court",
    name: "Footprint Court (HDR Labs)",
    path: footprint,
    format: ".hdr",
  },
];
