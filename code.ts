//
// PLUGIN SCRIPT
//
//                     -(}-
//                      (\_  ._~''
//           ,_  _,.--..( ,_.+  (`\
//     -~.__--=_/'(    ` ) /  (  `'   aa
//              ,_/ \ /'.__,. ).
//           `_/     `\_  ._/ ` \ ,
//                      `
//

interface PluginMessage {
  type:
    | "ui-ready"
    | "orientation-changed"
    | "run-calculation"
    | "copy-value"
    | "notify";
  orientation?: "horizontal" | "vertical";
  value?: number | string;
  message?: string;
}

interface Point {
  x: number;
  y: number;
}

interface AlignmentResult {
  distanceToMove: number;
  nodeToMove: VectorNode;
  finalSpacing: number;
}

let currentOrientation: "horizontal" | "vertical" = "horizontal";
let hasRunOnOpen = false;

function main(): void {
  figma.showUI(__html__, { themeColors: true, width: 480, height: 97 });
  figma.ui.onmessage = handleUIMessage;
  figma.on("selectionchange", handleSelectionChange);
}

async function handleUIMessage(msg: PluginMessage): Promise<void> {
  if (msg.type === "ui-ready" && !hasRunOnOpen) {
    hasRunOnOpen = true;
    const selection = figma.currentPage.selection;
    if (
      selection.length === 2 &&
      selection.every((node) => node.type === "VECTOR")
    ) {
      executeAlignment();
    } else {
      handleSelectionChange();
    }
  } else if (msg.type === "run-calculation") {
    executeAlignment();
  } else if (msg.type === "orientation-changed" && msg.orientation) {
    currentOrientation = msg.orientation;
  } else if (msg.type === "copy-value") {
    figma.notify(`Copied "${msg.value}"`);
  } else if (msg.type === "notify" && msg.message) {
    figma.notify(msg.message);
  }
}

function handleSelectionChange(): void {
  const selection = figma.currentPage.selection;

  if (selection.length !== 2) {
    sendSelectionFeedback(false);
    return;
  }

  if (!selection.every((node) => node.type === "VECTOR")) {
    sendSelectionFeedback(false);
    return;
  }

  const nodeA = selection[0] as VectorNode;
  const nodeB = selection[1] as VectorNode;

  const detectedOrientation = detectOrientation(nodeA, nodeB);

  if (detectedOrientation === null) {
    sendSelectionFeedback(false);
    return;
  }

  currentOrientation = detectedOrientation;

  const spacing =
    detectedOrientation === "horizontal"
      ? getCurrentHorizontalSpacing(nodeA, nodeB)
      : getCurrentVerticalSpacing(nodeA, nodeB);

  if (spacing !== null) {
    const roundedSpacing = Math.round(spacing);
    sendSelectionFeedback(true, roundedSpacing.toString(), detectedOrientation);
  } else {
    sendFeedbackToUI("Could Not Read Layer Dimensions");
  }
}

function executeAlignment(): void {
  const selection = figma.currentPage.selection;

  if (
    selection.length !== 2 ||
    !selection.every((node) => node.type === "VECTOR")
  ) {
    sendFeedbackToUI("Select Two Vector Layers to Align");
    return;
  }

  const nodeA = selection[0] as VectorNode;
  const nodeB = selection[1] as VectorNode;

  const result =
    currentOrientation === "horizontal"
      ? getOptimalHorizontalAlignment(nodeA, nodeB)
      : getOptimalVerticalAlignment(nodeA, nodeB);

  if (result) {
    const { nodeToMove, distanceToMove, finalSpacing } = result;
    if (currentOrientation === "horizontal") {
      nodeToMove.x += distanceToMove;
    } else {
      nodeToMove.y += distanceToMove;
    }
    const displayValue = parseFloat(finalSpacing.toFixed(4)).toString();
    figma.ui.postMessage({ type: "result-calculated", value: displayValue });
  } else {
    sendFeedbackToUI("No Alignable Point Found");
  }
}

function sendFeedbackToUI(message: string): void {
  figma.ui.postMessage({ type: "result-calculated", value: message });
}

function sendSelectionFeedback(
  hasSelection: boolean,
  value?: string,
  orientation?: "horizontal" | "vertical",
): void {
  figma.ui.postMessage({
    type: "selection-changed",
    hasSelection,
    value,
    orientation,
  });
}

function detectOrientation(
  nodeA: VectorNode,
  nodeB: VectorNode,
): "horizontal" | "vertical" | null {
  const boundsA = nodeA.absoluteBoundingBox;
  const boundsB = nodeB.absoluteBoundingBox;

  if (!boundsA || !boundsB) {
    return null;
  }

  const overlapX = !(
    boundsA.x + boundsA.width <= boundsB.x ||
    boundsB.x + boundsB.width <= boundsA.x
  );
  const overlapY = !(
    boundsA.y + boundsA.height <= boundsB.y ||
    boundsB.y + boundsB.height <= boundsA.y
  );

  let orientation: "horizontal" | "vertical" | null;

  if (!overlapX && !overlapY) {
    orientation = null;
  } else if (overlapX && overlapY) {
    orientation = null;
  } else if (overlapX && !overlapY) {
    orientation = "vertical";
  } else {
    orientation = "horizontal";
  }

  return orientation;
}

function getCurrentHorizontalSpacing(
  nodeA: VectorNode,
  nodeB: VectorNode,
): number | null {
  const boundsA = nodeA.absoluteBoundingBox;
  const boundsB = nodeB.absoluteBoundingBox;

  if (!boundsA || !boundsB) {
    return null;
  }

  const leftBounds = boundsA.x < boundsB.x ? boundsA : boundsB;
  const rightBounds = boundsA.x < boundsB.x ? boundsB : boundsA;
  const spacing = rightBounds.x - (leftBounds.x + leftBounds.width);

  return spacing;
}

function getCurrentVerticalSpacing(
  nodeA: VectorNode,
  nodeB: VectorNode,
): number | null {
  const boundsA = nodeA.absoluteBoundingBox;
  const boundsB = nodeB.absoluteBoundingBox;

  if (!boundsA || !boundsB) {
    return null;
  }

  const topBounds = boundsA.y < boundsB.y ? boundsA : boundsB;
  const bottomBounds = boundsA.y < boundsB.y ? boundsB : boundsA;
  const spacing = bottomBounds.y - (topBounds.y + topBounds.height);

  return spacing;
}

function getOptimalHorizontalAlignment(
  nodeA: VectorNode,
  nodeB: VectorNode,
): AlignmentResult | null {
  const boundsA = nodeA.absoluteBoundingBox;
  const boundsB = nodeB.absoluteBoundingBox;
  if (!boundsA || !boundsB) {
    return null;
  }

  const leftNode = boundsA.x < boundsB.x ? nodeA : nodeB;
  const rightNode = boundsA.x < boundsB.x ? nodeB : nodeA;
  const leftNodeBounds = leftNode === nodeA ? boundsA : boundsB;
  const rightNodeBounds = rightNode === nodeA ? boundsA : boundsB;

  const optionA = calculatePreciseHorizontalDistance(leftNode, rightNode);
  const optionB = calculateInverseHorizontalDistance(leftNode, rightNode);

  if (!optionA && !optionB) {
    return null;
  }

  if (
    optionA &&
    (!optionB || Math.abs(optionA.distance) <= Math.abs(optionB.distance))
  ) {
    const { distance } = optionA;
    const finalSpacing =
      rightNodeBounds.x + distance - (leftNodeBounds.x + leftNodeBounds.width);
    return { distanceToMove: distance, nodeToMove: rightNode, finalSpacing };
  } else if (optionB) {
    const { distance } = optionB;
    const finalSpacing =
      rightNodeBounds.x - (leftNodeBounds.x + distance + leftNodeBounds.width);
    return { distanceToMove: distance, nodeToMove: leftNode, finalSpacing };
  }
  return null;
}

function calculatePreciseHorizontalDistance(
  leftNode: VectorNode,
  rightNode: VectorNode,
): { distance: number } | null {
  const rightmostPoint = findRightmostPoint(leftNode);
  if (!rightmostPoint) return null;

  // Tentar encontrar interseção na altura exata
  let intersectionX = findLeftmostXAtY(rightNode, rightmostPoint.y);

  // Se não encontrou (micropixels de diferença), buscar no início do rightNode
  if (intersectionX === Infinity) {
    const rightBounds = rightNode.absoluteBoundingBox;
    if (!rightBounds) return null;

    // Determinar onde buscar baseado na posição relativa
    let searchY: number;
    if (rightmostPoint.y < rightBounds.y) {
      // Ponto está acima do rightNode, buscar no topo
      searchY = rightBounds.y;
    } else if (rightmostPoint.y > rightBounds.y + rightBounds.height) {
      // Ponto está abaixo do rightNode, buscar na base
      searchY = rightBounds.y + rightBounds.height;
    } else {
      // Ponto está dentro do range, tentar pequena tolerância
      searchY = rightmostPoint.y + 0.5;
      intersectionX = findLeftmostXAtY(rightNode, searchY);
      if (intersectionX === Infinity) {
        searchY = rightmostPoint.y - 0.5;
      }
    }

    intersectionX = findLeftmostXAtY(rightNode, searchY);
  }

  if (intersectionX === Infinity) return null;

  const distance = rightmostPoint.x - intersectionX;
  return { distance };
}

function calculateInverseHorizontalDistance(
  leftNode: VectorNode,
  rightNode: VectorNode,
): { distance: number } | null {
  const leftmostPoint = findLeftmostPoint(rightNode);
  if (!leftmostPoint) return null;

  let intersectionX = findRightmostXAtY(leftNode, leftmostPoint.y);

  if (intersectionX === -Infinity) {
    const leftBounds = leftNode.absoluteBoundingBox;
    if (!leftBounds) return null;

    let searchY: number;
    if (leftmostPoint.y < leftBounds.y) {
      searchY = leftBounds.y;
    } else if (leftmostPoint.y > leftBounds.y + leftBounds.height) {
      searchY = leftBounds.y + leftBounds.height;
    } else {
      searchY = leftmostPoint.y + 0.5;
      intersectionX = findRightmostXAtY(leftNode, searchY);
      if (intersectionX === -Infinity) {
        searchY = leftmostPoint.y - 0.5;
      }
    }

    intersectionX = findRightmostXAtY(leftNode, searchY);
  }

  if (intersectionX === -Infinity) return null;

  const distance = leftmostPoint.x - intersectionX;
  return { distance };
}

function getOptimalVerticalAlignment(
  nodeA: VectorNode,
  nodeB: VectorNode,
): AlignmentResult | null {
  const boundsA = nodeA.absoluteBoundingBox;
  const boundsB = nodeB.absoluteBoundingBox;
  if (!boundsA || !boundsB) {
    return null;
  }

  const topNode = boundsA.y < boundsB.y ? nodeA : nodeB;
  const bottomNode = boundsA.y < boundsB.y ? nodeB : nodeA;
  const topNodeBounds = topNode === nodeA ? boundsA : boundsB;
  const bottomNodeBounds = bottomNode === nodeA ? boundsA : boundsB;

  const optionA = calculatePreciseVerticalDistance(topNode, bottomNode);
  const optionB = calculateInverseVerticalDistance(topNode, bottomNode);

  if (!optionA && !optionB) {
    return null;
  }

  if (
    optionA &&
    (!optionB || Math.abs(optionA.distance) <= Math.abs(optionB.distance))
  ) {
    const { distance } = optionA;
    const finalSpacing =
      bottomNodeBounds.y + distance - (topNodeBounds.y + topNodeBounds.height);
    return { distanceToMove: distance, nodeToMove: bottomNode, finalSpacing };
  } else if (optionB) {
    const { distance } = optionB;
    const finalSpacing =
      bottomNodeBounds.y - (topNodeBounds.y + distance + topNodeBounds.height);
    return { distanceToMove: distance, nodeToMove: topNode, finalSpacing };
  }
  return null;
}

function calculatePreciseVerticalDistance(
  topNode: VectorNode,
  bottomNode: VectorNode,
): { distance: number } | null {
  const bottommostPoint = findBottommostPoint(topNode);
  if (!bottommostPoint) return null;

  let intersectionY = findTopmostYAtX(bottomNode, bottommostPoint.x);

  if (intersectionY === Infinity) {
    const bottomBounds = bottomNode.absoluteBoundingBox;
    if (!bottomBounds) return null;

    let searchX: number;
    if (bottommostPoint.x < bottomBounds.x) {
      searchX = bottomBounds.x;
    } else if (bottommostPoint.x > bottomBounds.x + bottomBounds.width) {
      searchX = bottomBounds.x + bottomBounds.width;
    } else {
      searchX = bottommostPoint.x + 0.5;
      intersectionY = findTopmostYAtX(bottomNode, searchX);
      if (intersectionY === Infinity) {
        searchX = bottommostPoint.x - 0.5;
      }
    }

    intersectionY = findTopmostYAtX(bottomNode, searchX);
  }

  if (intersectionY === Infinity) return null;

  const distance = bottommostPoint.y - intersectionY;
  return { distance };
}

function calculateInverseVerticalDistance(
  topNode: VectorNode,
  bottomNode: VectorNode,
): { distance: number } | null {
  const topmostPoint = findTopmostPoint(bottomNode);
  if (!topmostPoint) return null;

  let intersectionY = findBottommostYAtX(topNode, topmostPoint.x);

  if (intersectionY === -Infinity) {
    const topBounds = topNode.absoluteBoundingBox;
    if (!topBounds) return null;

    let searchX: number;
    if (topmostPoint.x < topBounds.x) {
      searchX = topBounds.x;
    } else if (topmostPoint.x > topBounds.x + topBounds.width) {
      searchX = topBounds.x + topBounds.width;
    } else {
      searchX = topmostPoint.x + 0.5;
      intersectionY = findBottommostYAtX(topNode, searchX);
      if (intersectionY === -Infinity) {
        searchX = topmostPoint.x - 0.5;
      }
    }

    intersectionY = findBottommostYAtX(topNode, searchX);
  }

  if (intersectionY === -Infinity) return null;

  const distance = topmostPoint.y - intersectionY;
  return { distance };
}

function findRightmostPoint(node: VectorNode): Point | null {
  if (!node.absoluteRenderBounds) return null;
  const { vertices } = node.vectorNetwork;
  if (!vertices) return null;
  let extremePoint: Point = { x: -Infinity, y: 0 };
  const nodeX = node.absoluteRenderBounds.x;
  const nodeY = node.absoluteRenderBounds.y;
  for (const v of vertices) {
    if (v.x > extremePoint.x) extremePoint = { x: v.x, y: v.y };
  }
  return extremePoint.x === -Infinity
    ? null
    : { x: extremePoint.x + nodeX, y: extremePoint.y + nodeY };
}

function findLeftmostPoint(node: VectorNode): Point | null {
  if (!node.absoluteRenderBounds) return null;
  const { vertices } = node.vectorNetwork;
  if (!vertices) return null;
  let extremePoint: Point = { x: Infinity, y: 0 };
  const nodeX = node.absoluteRenderBounds.x;
  const nodeY = node.absoluteRenderBounds.y;
  for (const v of vertices) {
    if (v.x < extremePoint.x) extremePoint = { x: v.x, y: v.y };
  }
  return extremePoint.x === Infinity
    ? null
    : { x: extremePoint.x + nodeX, y: extremePoint.y + nodeY };
}

function findBottommostPoint(node: VectorNode): Point | null {
  if (!node.absoluteRenderBounds) return null;
  const { vertices } = node.vectorNetwork;
  if (!vertices) return null;
  let extremePoint: Point = { x: 0, y: -Infinity };
  const nodeX = node.absoluteRenderBounds.x;
  const nodeY = node.absoluteRenderBounds.y;
  for (const v of vertices) {
    if (v.y > extremePoint.y) extremePoint = { x: v.x, y: v.y };
  }
  return extremePoint.y === -Infinity
    ? null
    : { x: extremePoint.x + nodeX, y: extremePoint.y + nodeY };
}

function findTopmostPoint(node: VectorNode): Point | null {
  if (!node.absoluteRenderBounds) return null;
  const { vertices } = node.vectorNetwork;
  if (!vertices) return null;
  let extremePoint: Point = { x: 0, y: Infinity };
  const nodeX = node.absoluteRenderBounds.x;
  const nodeY = node.absoluteRenderBounds.y;
  for (const v of vertices) {
    if (v.y < extremePoint.y) extremePoint = { x: v.x, y: v.y };
  }
  return extremePoint.y === Infinity
    ? null
    : { x: extremePoint.x + nodeX, y: extremePoint.y + nodeY };
}

function findLeftmostXAtY(node: VectorNode, y: number): number {
  if (!node.absoluteRenderBounds) return Infinity;
  const { vertices, segments } = node.vectorNetwork;
  if (!vertices || !segments) return Infinity;
  const nodeX = node.absoluteRenderBounds.x;
  const nodeY = node.absoluteRenderBounds.y;
  const absVertices: Point[] = vertices.map((v) => ({
    x: v.x + nodeX,
    y: v.y + nodeY,
  }));
  let extremeX = Infinity;
  for (const seg of segments) {
    const p1 = absVertices[seg.start];
    const p2 = absVertices[seg.end];
    if ((y >= p1.y && y <= p2.y) || (y >= p2.y && y <= p1.y)) {
      let ix: number;
      if (p1.x === p2.x) ix = p1.x;
      else if (p1.y === p2.y) ix = Math.min(p1.x, p2.x);
      else ix = p1.x + ((y - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y);
      if (ix < extremeX) extremeX = ix;
    }
  }
  return extremeX;
}

function findRightmostXAtY(node: VectorNode, y: number): number {
  if (!node.absoluteRenderBounds) return -Infinity;
  const { vertices, segments } = node.vectorNetwork;
  if (!vertices || !segments) return -Infinity;
  const nodeX = node.absoluteRenderBounds.x;
  const nodeY = node.absoluteRenderBounds.y;
  const absVertices: Point[] = vertices.map((v) => ({
    x: v.x + nodeX,
    y: v.y + nodeY,
  }));
  let extremeX = -Infinity;
  for (const seg of segments) {
    const p1 = absVertices[seg.start];
    const p2 = absVertices[seg.end];
    if ((y >= p1.y && y <= p2.y) || (y >= p2.y && y <= p1.y)) {
      let ix: number;
      if (p1.x === p2.x) ix = p1.x;
      else if (p1.y === p2.y) ix = Math.max(p1.x, p2.x);
      else ix = p1.x + ((y - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y);
      if (ix > extremeX) extremeX = ix;
    }
  }
  return extremeX;
}

function findTopmostYAtX(node: VectorNode, x: number): number {
  if (!node.absoluteRenderBounds) return Infinity;
  const { vertices, segments } = node.vectorNetwork;
  if (!vertices || !segments) return Infinity;
  const nodeX = node.absoluteRenderBounds.x;
  const nodeY = node.absoluteRenderBounds.y;
  const absVertices: Point[] = vertices.map((v) => ({
    x: v.x + nodeX,
    y: v.y + nodeY,
  }));
  let extremeY = Infinity;
  for (const seg of segments) {
    const p1 = absVertices[seg.start];
    const p2 = absVertices[seg.end];
    if ((x >= p1.x && x <= p2.x) || (x >= p2.x && x <= p1.x)) {
      let iy: number;
      if (p1.y === p2.y) iy = p1.y;
      else if (p1.x === p2.x) iy = Math.min(p1.y, p2.y);
      else iy = p1.y + ((x - p1.x) * (p2.y - p1.y)) / (p2.x - p1.x);
      if (iy < extremeY) extremeY = iy;
    }
  }
  return extremeY;
}

function findBottommostYAtX(node: VectorNode, x: number): number {
  if (!node.absoluteRenderBounds) return -Infinity;
  const { vertices, segments } = node.vectorNetwork;
  if (!vertices || !segments) return -Infinity;
  const nodeX = node.absoluteRenderBounds.x;
  const nodeY = node.absoluteRenderBounds.y;
  const absVertices: Point[] = vertices.map((v) => ({
    x: v.x + nodeX,
    y: v.y + nodeY,
  }));
  let extremeY = -Infinity;
  for (const seg of segments) {
    const p1 = absVertices[seg.start];
    const p2 = absVertices[seg.end];
    if ((x >= p1.x && x <= p2.x) || (x >= p2.x && x <= p1.x)) {
      let iy: number;
      if (p1.y === p2.y) iy = p1.y;
      else if (p1.x === p2.x) iy = Math.max(p1.y, p2.y);
      else iy = p1.y + ((x - p1.x) * (p2.y - p1.y)) / (p2.x - p1.x);
      if (iy > extremeY) extremeY = iy;
    }
  }
  return extremeY;
}

main();
