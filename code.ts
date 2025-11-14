//
// PLUGIN SCRIPT (COM LOGS DE DEBUG)
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
  console.log("🚀 Plugin iniciado");
  figma.showUI(__html__, { themeColors: true, width: 480, height: 97 });
  figma.ui.onmessage = handleUIMessage;
  figma.on("selectionchange", handleSelectionChange);
  console.log("✅ UI e listeners configurados");
}

async function handleUIMessage(msg: PluginMessage): Promise<void> {
  console.log("📨 Mensagem recebida da UI:", msg.type);

  if (msg.type === "ui-ready" && !hasRunOnOpen) {
    console.log("🎬 UI pronta - verificando seleção inicial");
    hasRunOnOpen = true;
    const selection = figma.currentPage.selection;
    console.log(`   Seleção inicial: ${selection.length} item(s)`);

    if (selection.length === 2) {
      console.log(`   Tipos: [${selection[0].type}, ${selection[1].type}]`);
    }

    if (
      selection.length === 2 &&
      selection.every((node) => node.type === "VECTOR")
    ) {
      console.log(
        "✅ Dois vetores selecionados - executando alinhamento automático",
      );
      executeAlignment();
    } else {
      console.log(
        "⚠️  Seleção inicial não atende critérios - chamando handleSelectionChange",
      );
      handleSelectionChange();
    }
  } else if (msg.type === "run-calculation") {
    console.log("▶️  Botão 'Make it touch' pressionado");
    executeAlignment();
  } else if (msg.type === "orientation-changed" && msg.orientation) {
    console.log(`🔄 Orientação alterada para: ${msg.orientation}`);
    currentOrientation = msg.orientation;
  } else if (msg.type === "copy-value") {
    figma.notify(`Copied "${msg.value}"`);
  } else if (msg.type === "notify" && msg.message) {
    figma.notify(msg.message);
  }
}

function handleSelectionChange(): void {
  console.log("\n📋 === SELECTION CHANGE ===");
  const selection = figma.currentPage.selection;
  console.log(`   Total selecionado: ${selection.length}`);

  if (selection.length !== 2) {
    console.log(
      `   ❌ Não são 2 itens (${selection.length}) - enviando feedback negativo`,
    );
    sendSelectionFeedback(false);
    return;
  }

  const types = selection.map((n) => n.type);
  console.log(`   Tipos: [${types.join(", ")}]`);

  if (!selection.every((node) => node.type === "VECTOR")) {
    console.log("   ❌ Nem todos são VECTOR - enviando feedback negativo");
    sendSelectionFeedback(false);
    return;
  }

  const nodeA = selection[0] as VectorNode;
  const nodeB = selection[1] as VectorNode;

  console.log(`   Node A: "${nodeA.name}"`);
  console.log(`   Node B: "${nodeB.name}"`);
  console.log(
    `   Node A vertices: ${nodeA.vectorNetwork.vertices?.length ?? 0}`,
  );
  console.log(
    `   Node B vertices: ${nodeB.vectorNetwork.vertices?.length ?? 0}`,
  );

  const detectedOrientation = detectOrientation(nodeA, nodeB);
  console.log(`   🧭 Orientação detectada: ${detectedOrientation}`);

  if (detectedOrientation === null) {
    console.log("   ❌ Seleção inválida (diagonal ou já se tocando)");
    sendSelectionFeedback(false);
    return;
  }

  currentOrientation = detectedOrientation;

  const spacing =
    detectedOrientation === "horizontal"
      ? getCurrentHorizontalSpacing(nodeA, nodeB)
      : getCurrentVerticalSpacing(nodeA, nodeB);

  console.log(`   📏 Espaçamento calculado: ${spacing}`);

  if (spacing !== null) {
    const roundedSpacing = Math.round(spacing);
    console.log(
      `   ✅ Enviando feedback positivo: ${roundedSpacing}, orientação: ${detectedOrientation}`,
    );
    sendSelectionFeedback(true, roundedSpacing.toString(), detectedOrientation);
  } else {
    console.log("   ❌ Spacing é null - dimensões não podem ser lidas");
    sendFeedbackToUI("Could Not Read Layer Dimensions");
  }
}

function executeAlignment(): void {
  console.log("\n⚡ === EXECUTE ALIGNMENT ===");
  const selection = figma.currentPage.selection;
  console.log(`   Seleção atual: ${selection.length} item(s)`);

  if (selection.length !== 2) {
    console.log(`   ❌ Não são 2 itens - abortando`);
    sendFeedbackToUI("Select Two Vector Layers to Align");
    return;
  }

  if (!selection.every((node) => node.type === "VECTOR")) {
    console.log("   ❌ Nem todos são VECTOR - abortando");
    sendFeedbackToUI("Select Two Vector Layers to Align");
    return;
  }

  const nodeA = selection[0] as VectorNode;
  const nodeB = selection[1] as VectorNode;

  console.log(`   Alinhando: "${nodeA.name}" e "${nodeB.name}"`);
  console.log(`   Orientação atual: ${currentOrientation}`);

  const result =
    currentOrientation === "horizontal"
      ? getOptimalHorizontalAlignment(nodeA, nodeB)
      : getOptimalVerticalAlignment(nodeA, nodeB);

  console.log(
    `   Resultado do alinhamento:`,
    result ? "✅ Encontrado" : "❌ Null",
  );

  if (result) {
    const { nodeToMove, distanceToMove, finalSpacing } = result;
    console.log(`   Node a mover: "${nodeToMove.name}"`);
    console.log(`   Distância: ${distanceToMove}`);
    console.log(`   Espaçamento final: ${finalSpacing}`);

    const beforePos =
      currentOrientation === "horizontal" ? nodeToMove.x : nodeToMove.y;

    if (currentOrientation === "horizontal") {
      nodeToMove.x += distanceToMove;
    } else {
      nodeToMove.y += distanceToMove;
    }

    const afterPos =
      currentOrientation === "horizontal" ? nodeToMove.x : nodeToMove.y;
    console.log(`   Posição antes: ${beforePos}`);
    console.log(`   Posição depois: ${afterPos}`);

    const displayValue = parseFloat(finalSpacing.toFixed(4)).toString();
    console.log(`   ✅ Enviando resultado: ${displayValue}`);
    figma.ui.postMessage({ type: "result-calculated", value: displayValue });
  } else {
    console.log("   ❌ Nenhum ponto alinhável encontrado");
    sendFeedbackToUI("No Alignable Point Found");
  }
}

function sendFeedbackToUI(message: string): void {
  console.log(`   📤 Enviando feedback para UI: "${message}"`);
  figma.ui.postMessage({ type: "result-calculated", value: message });
}

function sendSelectionFeedback(
  hasSelection: boolean,
  value?: string,
  orientation?: "horizontal" | "vertical",
): void {
  console.log(
    `   📤 Enviando selection feedback: hasSelection=${hasSelection}, value=${value}, orientation=${orientation}`,
  );
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

  console.log(`      🔍 detectOrientation:`);
  console.log(`         Node A bounds:`, boundsA);
  console.log(`         Node B bounds:`, boundsB);

  if (!boundsA || !boundsB) {
    console.log(`         ⚠️  Bounds ausentes - retornando null`);
    return null;
  }

  // Teste de sobreposição de projeções:
  // Se tivessem altura infinita, se sobreporiam no eixo X?
  const overlapX = !(
    boundsA.x + boundsA.width <= boundsB.x ||
    boundsB.x + boundsB.width <= boundsA.x
  );

  // Se tivessem largura infinita, se sobreporiam no eixo Y?
  const overlapY = !(
    boundsA.y + boundsA.height <= boundsB.y ||
    boundsB.y + boundsB.height <= boundsA.y
  );

  console.log(`         Overlap X (altura infinita): ${overlapX}`);
  console.log(`         Overlap Y (largura infinita): ${overlapY}`);
  console.log(
    `         Ranges X: A[${boundsA.x}, ${boundsA.x + boundsA.width}] B[${boundsB.x}, ${boundsB.x + boundsB.width}]`,
  );
  console.log(
    `         Ranges Y: A[${boundsA.y}, ${boundsA.y + boundsA.height}] B[${boundsB.y}, ${boundsB.y + boundsB.height}]`,
  );

  let orientation: "horizontal" | "vertical" | null;

  if (!overlapX && !overlapY) {
    // Diagonal - nenhum movimento em X ou Y os faria se tocar
    console.log(`         ❌ Diagonal detectada - seleção não válida`);
    orientation = null;
  } else if (overlapX && overlapY) {
    // Já estão se sobrepondo/tocando
    console.log(`         ❌ Já estão se tocando - seleção não válida`);
    orientation = null;
  } else if (overlapX && !overlapY) {
    // Estão um sobre o outro (se sobrepõem no X, mas não no Y)
    console.log(`         ✅ Estão um sobre o outro`);
    orientation = "vertical";
  } else {
    // !overlapX && overlapY
    // Estão lado a lado (se sobrepõem no Y, mas não no X)
    console.log(`         ✅ Estão lado a lado`);
    orientation = "horizontal";
  }

  console.log(`         → Orientação: ${orientation}`);

  return orientation;
}

function getCurrentHorizontalSpacing(
  nodeA: VectorNode,
  nodeB: VectorNode,
): number | null {
  const boundsA = nodeA.absoluteBoundingBox;
  const boundsB = nodeB.absoluteBoundingBox;

  console.log(`      📐 getCurrentHorizontalSpacing`);

  if (!boundsA || !boundsB) {
    console.log(`         ❌ Bounds ausentes`);
    return null;
  }

  const leftBounds = boundsA.x < boundsB.x ? boundsA : boundsB;
  const rightBounds = boundsA.x < boundsB.x ? boundsB : boundsA;
  const spacing = rightBounds.x - (leftBounds.x + leftBounds.width);

  console.log(
    `         Left bounds: x=${leftBounds.x}, width=${leftBounds.width}`,
  );
  console.log(`         Right bounds: x=${rightBounds.x}`);
  console.log(`         → Spacing: ${spacing}`);

  return spacing;
}

function getCurrentVerticalSpacing(
  nodeA: VectorNode,
  nodeB: VectorNode,
): number | null {
  const boundsA = nodeA.absoluteBoundingBox;
  const boundsB = nodeB.absoluteBoundingBox;

  console.log(`      📐 getCurrentVerticalSpacing`);

  if (!boundsA || !boundsB) {
    console.log(`         ❌ Bounds ausentes`);
    return null;
  }

  const topBounds = boundsA.y < boundsB.y ? boundsA : boundsB;
  const bottomBounds = boundsA.y < boundsB.y ? boundsB : boundsA;
  const spacing = bottomBounds.y - (topBounds.y + topBounds.height);

  console.log(
    `         Top bounds: y=${topBounds.y}, height=${topBounds.height}`,
  );
  console.log(`         Bottom bounds: y=${bottomBounds.y}`);
  console.log(`         → Spacing: ${spacing}`);

  return spacing;
}

function getOptimalHorizontalAlignment(
  nodeA: VectorNode,
  nodeB: VectorNode,
): AlignmentResult | null {
  console.log(`      🎯 getOptimalHorizontalAlignment`);

  const boundsA = nodeA.absoluteBoundingBox;
  const boundsB = nodeB.absoluteBoundingBox;
  if (!boundsA || !boundsB) {
    console.log(`         ❌ Bounds ausentes`);
    return null;
  }

  const leftNode = boundsA.x < boundsB.x ? nodeA : nodeB;
  const rightNode = boundsA.x < boundsB.x ? nodeB : nodeA;

  console.log(`         Left node: "${leftNode.name}"`);
  console.log(`         Right node: "${rightNode.name}"`);

  const optionA = calculatePreciseHorizontalDistance(leftNode, rightNode);
  const optionB = calculateInverseHorizontalDistance(leftNode, rightNode);

  console.log(`         Option A (move right):`, optionA);
  console.log(`         Option B (move left):`, optionB);

  if (!optionA && !optionB) {
    console.log(`         ❌ Nenhuma opção válida`);
    return null;
  }

  const leftNodeBounds = leftNode === nodeA ? boundsA : boundsB;
  const rightNodeBounds = rightNode === nodeA ? boundsA : boundsB;

  if (
    optionA &&
    (!optionB || Math.abs(optionA.distance) <= Math.abs(optionB.distance))
  ) {
    const { distance } = optionA;
    const finalSpacing =
      rightNodeBounds.x + distance - (leftNodeBounds.x + leftNodeBounds.width);
    console.log(
      `         ✅ Escolhido: Option A - distance=${distance}, finalSpacing=${finalSpacing}`,
    );
    return { distanceToMove: distance, nodeToMove: rightNode, finalSpacing };
  } else if (optionB) {
    const { distance } = optionB;
    const finalSpacing =
      rightNodeBounds.x - (leftNodeBounds.x + distance + leftNodeBounds.width);
    console.log(
      `         ✅ Escolhido: Option B - distance=${distance}, finalSpacing=${finalSpacing}`,
    );
    return { distanceToMove: distance, nodeToMove: leftNode, finalSpacing };
  }
  return null;
}

function calculatePreciseHorizontalDistance(
  leftNode: VectorNode,
  rightNode: VectorNode,
): { distance: number } | null {
  console.log(
    `         → calcPreciseHoriz: left="${leftNode.name}", right="${rightNode.name}"`,
  );

  const rightmostPoint = findRightmostPoint(leftNode);
  console.log(`            Rightmost point of left:`, rightmostPoint);

  if (!rightmostPoint) return null;

  const intersectionX = findLeftmostXAtY(rightNode, rightmostPoint.y);
  console.log(
    `            Leftmost X at Y=${rightmostPoint.y}:`,
    intersectionX,
  );

  if (intersectionX === Infinity) return null;

  const distance = rightmostPoint.x - intersectionX;
  console.log(`            → Distance: ${distance}`);
  return { distance };
}

function calculateInverseHorizontalDistance(
  leftNode: VectorNode,
  rightNode: VectorNode,
): { distance: number } | null {
  console.log(
    `         → calcInverseHoriz: left="${leftNode.name}", right="${rightNode.name}"`,
  );

  const leftmostPoint = findLeftmostPoint(rightNode);
  console.log(`            Leftmost point of right:`, leftmostPoint);

  if (!leftmostPoint) return null;

  const intersectionX = findRightmostXAtY(leftNode, leftmostPoint.y);
  console.log(
    `            Rightmost X at Y=${leftmostPoint.y}:`,
    intersectionX,
  );

  if (intersectionX === -Infinity) return null;

  const distance = leftmostPoint.x - intersectionX;
  console.log(`            → Distance: ${distance}`);
  return { distance };
}

function getOptimalVerticalAlignment(
  nodeA: VectorNode,
  nodeB: VectorNode,
): AlignmentResult | null {
  console.log(`      🎯 getOptimalVerticalAlignment`);

  const boundsA = nodeA.absoluteBoundingBox;
  const boundsB = nodeB.absoluteBoundingBox;
  if (!boundsA || !boundsB) {
    console.log(`         ❌ Bounds ausentes`);
    return null;
  }

  const topNode = boundsA.y < boundsB.y ? nodeA : nodeB;
  const bottomNode = boundsA.y < boundsB.y ? nodeB : nodeA;

  console.log(`         Top node: "${topNode.name}"`);
  console.log(`         Bottom node: "${bottomNode.name}"`);

  const optionA = calculatePreciseVerticalDistance(topNode, bottomNode);
  const optionB = calculateInverseVerticalDistance(topNode, bottomNode);

  console.log(`         Option A (move bottom):`, optionA);
  console.log(`         Option B (move top):`, optionB);

  if (!optionA && !optionB) {
    console.log(`         ❌ Nenhuma opção válida`);
    return null;
  }

  const topNodeBounds = topNode === nodeA ? boundsA : boundsB;
  const bottomNodeBounds = bottomNode === nodeA ? boundsA : boundsB;

  if (
    optionA &&
    (!optionB || Math.abs(optionA.distance) <= Math.abs(optionB.distance))
  ) {
    const { distance } = optionA;
    const finalSpacing =
      bottomNodeBounds.y + distance - (topNodeBounds.y + topNodeBounds.height);
    console.log(
      `         ✅ Escolhido: Option A - distance=${distance}, finalSpacing=${finalSpacing}`,
    );
    return { distanceToMove: distance, nodeToMove: bottomNode, finalSpacing };
  } else if (optionB) {
    const { distance } = optionB;
    const finalSpacing =
      bottomNodeBounds.y - (topNodeBounds.y + distance + topNodeBounds.height);
    console.log(
      `         ✅ Escolhido: Option B - distance=${distance}, finalSpacing=${finalSpacing}`,
    );
    return { distanceToMove: distance, nodeToMove: topNode, finalSpacing };
  }
  return null;
}

function calculatePreciseVerticalDistance(
  topNode: VectorNode,
  bottomNode: VectorNode,
): { distance: number } | null {
  console.log(
    `         → calcPreciseVert: top="${topNode.name}", bottom="${bottomNode.name}"`,
  );

  const bottommostPoint = findBottommostPoint(topNode);
  console.log(`            Bottommost point of top:`, bottommostPoint);

  if (!bottommostPoint) return null;

  const intersectionY = findTopmostYAtX(bottomNode, bottommostPoint.x);
  console.log(
    `            Topmost Y at X=${bottommostPoint.x}:`,
    intersectionY,
  );

  if (intersectionY === Infinity) return null;

  const distance = bottommostPoint.y - intersectionY;
  console.log(`            → Distance: ${distance}`);
  return { distance };
}

function calculateInverseVerticalDistance(
  topNode: VectorNode,
  bottomNode: VectorNode,
): { distance: number } | null {
  console.log(
    `         → calcInverseVert: top="${topNode.name}", bottom="${bottomNode.name}"`,
  );

  const topmostPoint = findTopmostPoint(bottomNode);
  console.log(`            Topmost point of bottom:`, topmostPoint);

  if (!topmostPoint) return null;

  const intersectionY = findBottommostYAtX(topNode, topmostPoint.x);
  console.log(
    `            Bottommost Y at X=${topmostPoint.x}:`,
    intersectionY,
  );

  if (intersectionY === -Infinity) return null;

  const distance = topmostPoint.y - intersectionY;
  console.log(`            → Distance: ${distance}`);
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
