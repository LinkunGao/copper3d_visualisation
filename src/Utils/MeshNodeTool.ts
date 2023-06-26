import * as THREE from "three";
import { IMeshNodes } from "../types/types";
import { getWightsL3L3L3, calcDistance, perturbRandom } from "./utils";

export class Node {
  id: string;
  p: number[];
  elements: Array<Element> = [];
  constructor(id: string, p: number[]) {
    this.id = id;
    this.p = p;
  }
}

export class Element {
  id: string;
  basis: string[];
  nodes: Array<Node>;
  constructor(id: string, basis: string[], nodes: Array<Node>) {
    this.id = id;
    this.basis = basis;
    this.nodes = nodes;
  }
}

export class MeshNodeTool {
  nodes: { [key: string]: Node } = {};
  elements: { [key: string]: Element } = {};

  addNode(id: string, p: number[]) {
    this.nodes[id] = new Node(id, p);
  }
  addElement(id: string, basis: string[], nodeIds: string[]) {
    let nodes: Array<Node> = [];
    for (let nid in nodeIds) {
      let enid = nodeIds[nid];
      nodes.push(this.nodes[enid]);
    }
    let element = new Element(id, basis, nodes);
    this.elements[id] = element;
    for (let idx in element.nodes) {
      element.nodes[idx].elements.push(element);
    }
  }

  loadMesh(json: IMeshNodes) {
    for (let nid in json.nodes) {
      this.addNode(nid, json.nodes[nid]);
    }
    for (let eid in json.elements) {
      let elem = json.elements[eid];
      this.addElement(eid, elem.basis, elem.nodes);
    }
  }

  evaluate(elementId: string, xi: number[]) {
    let w = getWightsL3L3L3(xi);
    return evaluateElement(this.elements[elementId], w);
  }

  find(point: THREE.Vector3, startingNodeId: string) {
    let pt = [point.x, point.y, point.z];
    let nodeMaterialPoints = this.getNodeMaterialPoints(startingNodeId);

    for (let i in nodeMaterialPoints) {
      let mpt = nodeMaterialPoints[i];
      let x = this.evaluate(mpt.elementId, mpt.xi);
      let r = calcDistance(x, pt);
      mpt.error = r;
    }
    let t0 = new Date().getTime();
    let n = 0;
    for (let step = 0; step < 10000; step++) {
      for (let i in nodeMaterialPoints) {
        let mpt = nodeMaterialPoints[i];
        let xi = perturbRandom(mpt.xi, 0.1);
        let x = this.evaluate(mpt.elementId, xi);
        let r = calcDistance(x, pt);
        if (r < mpt.error) {
          mpt.error = r;
          mpt.xi = xi;
          if (r < 1.0) {
            console.log(
              "Time: (" +
                n +
                ") " +
                (new Date().getTime() - t0) +
                "ms Error: " +
                r
            );
            return mpt;
          }
        }
      }
      n = step;
    }
    let bestIndex = 0;
    let bestError = nodeMaterialPoints[0].error;
    for (let i in nodeMaterialPoints) {
      let mpt = nodeMaterialPoints[i];
      if (mpt.error < bestError) {
        bestIndex = Number(i);
        bestError = mpt.error;
      }
    }
    let mpt = nodeMaterialPoints[bestIndex];
    console.log(
      "Time: (" +
        n +
        ") " +
        (new Date().getTime() - t0) +
        "ms Error: " +
        mpt.error
    );
    return mpt;
  }

  search(point: THREE.Vector3, startingNodeId: string, tol: number) {
    let pt = [point.x, point.y, point.z];
    let nodeMaterialPoints = this.getNodeMaterialPoints(startingNodeId);
    for (let i in nodeMaterialPoints) {
      let mpt = nodeMaterialPoints[i];
      let x = this.evaluate(mpt.elementId, mpt.xi);
      mpt.error = calcDistance(x, pt);
    }

    let t0 = new Date().getTime();
    let xiStepSize = [0.1, 0.01, 0.001];
    for (let i in nodeMaterialPoints) {
      let mpt = nodeMaterialPoints[i];
      let numDims = mpt.xi.length;
      let nIter = 0;
      let go = true;
      while (go || nIter < 10) {
        let minErr = 1 * mpt.error;
        let minXi;

        for (let xiIdx in xiStepSize) {
          let dXi = xiStepSize[xiIdx];
          for (let dim = 0; dim < numDims; dim++) {
            let xi = mpt.xi.slice();
            xi[dim] += dXi;
            if (xi[dim] >= 0 && xi[dim] <= 1) {
              let x = this.evaluate(mpt.elementId, mpt.xi);
              let err = calcDistance(x, pt);
              if (err < minErr) {
                minErr = err;
                minXi = xi;
                if (err < tol) {
                  mpt.error = err;
                  mpt.xi = xi;
                  console.log(
                    "Time 1: " +
                      (new Date().getTime() - t0) +
                      "ms Error: " +
                      mpt.error
                  );
                  return mpt;
                }
              }
            } else {
            }

            xi = mpt.xi.slice();
            xi[dim] -= dXi;
            if (xi[dim] >= 0 && xi[dim] <= 1) {
              let x = this.evaluate(mpt.elementId, mpt.xi);
              let err = calcDistance(x, pt);
              if (err < minErr) {
                minErr = err;
                minXi = xi;
                if (err < tol) {
                  mpt.error = err;
                  mpt.xi = xi;
                  console.log(
                    "Time 2: " +
                      (new Date().getTime() - t0) +
                      "ms Error: " +
                      mpt.error
                  );
                  return mpt;
                }
              }
            } else {
            }
          }
        }

        if (minXi === null || minXi === undefined) {
          go = false;
        } else {
          mpt.xi = minXi;
          mpt.error = minErr;
        }
        nIter++;
      }
    }

    let bestIndex = 0;
    let bestError = nodeMaterialPoints[0].error;
    for (let i in nodeMaterialPoints) {
      let mpt = nodeMaterialPoints[i];
      if (mpt.error < bestError) {
        bestIndex = Number(i);
        bestError = mpt.error;
      }
    }
    let mpt = nodeMaterialPoints[bestIndex];
    console.log(
      "Time 3: " + (new Date().getTime() - t0) + "ms Error: " + mpt.error
    );
    return mpt;
  }

  getNodeMaterialPoints(nodeId: string) {
    let materialPoints: {
      elementId: string;
      xi: number[];
      [key: string]: any;
    }[] = [];
    let node = this.nodes[nodeId];
    for (let eid in node.elements) {
      let element = node.elements[eid];
      let nodeIdx = element.nodes.indexOf(node);
      let xi0 = (nodeIdx % 4) / 3;
      let xi1 = Math.floor((nodeIdx % 16) / 4) / 3;
      let xi2 = Math.floor(nodeIdx / 16) / 3;
      materialPoints.push({ elementId: element.id, xi: [xi0, xi1, xi2] });
    }
    return materialPoints;
  }
}

function evaluateElement(element: Element, weights: number[]) {
  let x = [0, 0, 0];
  for (let f = 0; f < 3; f++) {
    for (let i = 0; i < weights.length; i++) {
      x[f] += weights[i] * element.nodes[i].p[f];
    }
  }
  return x;
}
