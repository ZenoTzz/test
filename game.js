const ROWS = 7;
const COLS = 8;

const DIRECTIONS = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

const boardElement = document.querySelector("#board");
const statusText = document.querySelector("#statusText");
const stepCount = document.querySelector("#stepCount");
const monsterCount = document.querySelector("#monsterCount");
const editorPanel = document.querySelector("#editorPanel");
const startButton = document.querySelector("#startButton");
const editButton = document.querySelector("#editButton");
const resetButton = document.querySelector("#resetButton");
const clearButton = document.querySelector("#clearButton");
const dpad = document.querySelector("#dpad");
const resultPanel = document.querySelector("#resultPanel");
const resultTitle = document.querySelector("#resultTitle");
const resultMessage = document.querySelector("#resultMessage");
const retryButton = document.querySelector("#retryButton");
const helpDialog = document.querySelector("#helpDialog");

let mode = "editing";
let selectedTool = "player";
let steps = 0;
let monsterSerial = 0;
let initialState = null;
let board = makeEmptyBoard();

function makeEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function loadStarterLayout() {
  board = makeEmptyBoard();
  board[3][1] = { type: "player" };
  board[3][3] = { type: "stone" };
  board[3][4] = { type: "stone" };
  board[1][6] = createMonster();
  board[5][6] = createMonster();
}

function createMonster() {
  monsterSerial += 1;
  return { type: "monster", id: monsterSerial };
}

function cloneBoard(source) {
  return source.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function isInside(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function getPlayer() {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (board[row][col]?.type === "player") return { row, col };
    }
  }
  return null;
}

function getMonsters() {
  const monsters = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (board[row][col]?.type === "monster") {
        monsters.push({ row, col, ...board[row][col] });
      }
    }
  }
  return monsters;
}

function positionKey(row, col) {
  return `${row},${col}`;
}

function render() {
  boardElement.innerHTML = "";
  boardElement.classList.toggle("playing", mode !== "editing");

  const dangerCells = mode === "editing" ? new Set() : getDangerCells();

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cellButton = document.createElement("button");
      const content = board[row][col];
      cellButton.type = "button";
      cellButton.className = "cell";
      cellButton.dataset.row = row;
      cellButton.dataset.col = col;
      cellButton.setAttribute("role", "gridcell");
      cellButton.setAttribute("aria-label", describeCell(row, col, content));

      if (dangerCells.has(positionKey(row, col)) && !content) {
        cellButton.classList.add("danger");
      }

      if (content) {
        const piece = document.createElement("span");
        piece.className = `piece ${content.type}`;
        piece.setAttribute("aria-hidden", "true");
        cellButton.append(piece);
      }

      boardElement.append(cellButton);
    }
  }

  const monsters = getMonsters().length;
  stepCount.textContent = steps;
  monsterCount.textContent = monsters;
  editorPanel.hidden = mode !== "editing";
  startButton.hidden = mode !== "editing";
  editButton.hidden = mode === "editing";
  clearButton.hidden = mode !== "editing";
  dpad.hidden = mode !== "playing";
  resultPanel.hidden = mode !== "failed" && mode !== "cleared";

  if (mode === "editing") statusText.textContent = "布置棋盘";
  if (mode === "playing") statusText.textContent = "躲避中";
  if (mode === "failed") statusText.textContent = "挑战失败";
  if (mode === "cleared") statusText.textContent = "怪物全灭";
}

function describeCell(row, col, content) {
  const label = content
    ? { player: "玩家", stone: "石头", monster: "怪物" }[content.type]
    : "空格";
  return `第 ${row + 1} 行第 ${col + 1} 列，${label}`;
}

function getDangerCells() {
  const danger = new Set();
  for (const monster of getMonsters()) {
    danger.add(positionKey(monster.row, monster.col));
    for (const [rowDelta, colDelta] of Object.values(DIRECTIONS)) {
      const row = monster.row + rowDelta;
      const col = monster.col + colDelta;
      if (isInside(row, col)) danger.add(positionKey(row, col));
    }
  }
  return danger;
}

function placePiece(row, col) {
  if (mode !== "editing") return;

  if (selectedTool === "erase") {
    board[row][col] = null;
  } else if (selectedTool === "player") {
    const currentPlayer = getPlayer();
    if (currentPlayer) board[currentPlayer.row][currentPlayer.col] = null;
    board[row][col] = { type: "player" };
  } else if (selectedTool === "monster") {
    board[row][col] = createMonster();
  } else {
    board[row][col] = { type: selectedTool };
  }

  render();
}

function startGame() {
  const player = getPlayer();
  if (!player) {
    statusText.textContent = "请先放置玩家";
    pulseElement(editorPanel);
    return;
  }

  initialState = cloneBoard(board);
  steps = 0;
  mode = "playing";
  render();

  if (isPlayerInDanger()) {
    finishGame(
      "failed",
      "起点不安全",
      "玩家不能与怪物处于同一格，也不能在怪物的上下左右相邻格。",
    );
  }
}

function movePlayer(directionName) {
  if (mode !== "playing") return;

  const [rowDelta, colDelta] = DIRECTIONS[directionName];
  const player = getPlayer();
  const targetRow = player.row + rowDelta;
  const targetCol = player.col + colDelta;

  if (!isInside(targetRow, targetCol)) return;

  const target = board[targetRow][targetCol];
  if (target?.type === "monster") {
    finishGame("failed", "撞上怪物", "你走进了怪物所在的格子。");
    return;
  }

  if (target?.type === "stone") {
    if (!pushStoneLine(targetRow, targetCol, rowDelta, colDelta)) return;
  } else if (target) {
    return;
  }

  board[player.row][player.col] = null;
  board[targetRow][targetCol] = { type: "player" };
  steps += 1;
  render();

  if (isPlayerInDanger()) {
    finishGame("failed", "进入警戒区", "你停在了怪物的上下左右相邻格。");
    return;
  }

  moveMonsters();
}

function pushStoneLine(startRow, startCol, rowDelta, colDelta) {
  let row = startRow;
  let col = startCol;

  while (isInside(row, col) && board[row][col]?.type === "stone") {
    row += rowDelta;
    col += colDelta;
  }

  if (!isInside(row, col) || board[row][col] !== null) return false;

  while (row !== startRow || col !== startCol) {
    const previousRow = row - rowDelta;
    const previousCol = col - colDelta;
    board[row][col] = board[previousRow][previousCol];
    row = previousRow;
    col = previousCol;
  }

  board[startRow][startCol] = null;
  return true;
}

function moveMonsters() {
  const player = getPlayer();
  const monsters = getMonsters();
  if (!player || monsters.length === 0) return;

  const proposals = monsters.map((monster) => {
    const candidates = getMonsterCandidates(monster, player);
    const target = candidates[0] ?? { row: monster.row, col: monster.col };
    return { monster, target };
  });

  const deadIds = findCollidingMonsters(proposals);

  for (const monster of monsters) {
    board[monster.row][monster.col] = null;
  }

  for (const proposal of proposals) {
    if (deadIds.has(proposal.monster.id)) continue;
    board[proposal.target.row][proposal.target.col] = {
      type: "monster",
      id: proposal.monster.id,
    };
  }

  resolveAdjacentFights();
  render();

  if (isPlayerInDanger()) {
    finishGame("failed", "被怪物逼近", "怪物进入了你的上下左右警戒范围。");
  } else if (getMonsters().length === 0) {
    finishGame("cleared", "怪物全灭", `你用 ${steps} 步让怪物互相厮杀殆尽。`);
  }
}

function getMonsterCandidates(monster, player) {
  const candidates = [];

  for (const [name, [rowDelta, colDelta]] of Object.entries(DIRECTIONS)) {
    const row = monster.row + rowDelta;
    const col = monster.col + colDelta;
    if (!isInside(row, col)) continue;
    if (board[row][col]?.type === "stone") continue;

    candidates.push({
      row,
      col,
      direction: name,
      distance: Math.abs(player.row - row) + Math.abs(player.col - col),
    });
  }

  const directionPriority = ["up", "left", "down", "right"];
  candidates.sort(
    (a, b) =>
      a.distance - b.distance ||
      directionPriority.indexOf(a.direction) - directionPriority.indexOf(b.direction),
  );
  return candidates;
}

function findCollidingMonsters(proposals) {
  const deadIds = new Set();
  const targetGroups = new Map();

  for (const proposal of proposals) {
    const key = positionKey(proposal.target.row, proposal.target.col);
    if (!targetGroups.has(key)) targetGroups.set(key, []);
    targetGroups.get(key).push(proposal);
  }

  for (const group of targetGroups.values()) {
    if (group.length > 1) {
      group.forEach((proposal) => deadIds.add(proposal.monster.id));
    }
  }

  for (let first = 0; first < proposals.length; first += 1) {
    for (let second = first + 1; second < proposals.length; second += 1) {
      const a = proposals[first];
      const b = proposals[second];
      const swapped =
        a.target.row === b.monster.row &&
        a.target.col === b.monster.col &&
        b.target.row === a.monster.row &&
        b.target.col === a.monster.col;

      if (swapped) {
        deadIds.add(a.monster.id);
        deadIds.add(b.monster.id);
      }
    }
  }

  return deadIds;
}

function resolveAdjacentFights() {
  const monsters = getMonsters();
  const deadIds = new Set();

  for (let first = 0; first < monsters.length; first += 1) {
    for (let second = first + 1; second < monsters.length; second += 1) {
      const a = monsters[first];
      const b = monsters[second];
      const distance = Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
      if (distance === 1) {
        deadIds.add(a.id);
        deadIds.add(b.id);
      }
    }
  }

  for (const monster of monsters) {
    if (deadIds.has(monster.id)) board[monster.row][monster.col] = null;
  }
}

function isPlayerInDanger() {
  const player = getPlayer();
  if (!player) return true;
  return getDangerCells().has(positionKey(player.row, player.col));
}

function finishGame(result, title, message) {
  mode = result;
  resultTitle.textContent = title;
  resultMessage.textContent = message;
  render();
}

function retryGame() {
  if (!initialState) return;
  board = cloneBoard(initialState);
  steps = 0;
  mode = "playing";
  render();
}

function returnToEditor() {
  mode = "editing";
  steps = 0;
  resultPanel.hidden = true;
  render();
}

function resetBoard() {
  if (mode === "editing") {
    loadStarterLayout();
    initialState = null;
  } else if (initialState) {
    board = cloneBoard(initialState);
    mode = "playing";
  }
  steps = 0;
  render();
}

function clearBoard() {
  if (mode !== "editing") return;
  board = makeEmptyBoard();
  initialState = null;
  steps = 0;
  render();
}

function pulseElement(element) {
  element.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-5px)" },
      { transform: "translateX(5px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 220 },
  );
}

boardElement.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  placePiece(Number(cell.dataset.row), Number(cell.dataset.col));
});

document.querySelectorAll(".tool").forEach((button) => {
  button.addEventListener("click", () => {
    selectedTool = button.dataset.tool;
    document.querySelectorAll(".tool").forEach((tool) => tool.classList.remove("active"));
    button.classList.add("active");
  });
});

document.addEventListener("keydown", (event) => {
  const keyMap = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
  };

  const direction = keyMap[event.key];
  if (!direction || mode !== "playing") return;
  event.preventDefault();
  movePlayer(direction);
});

dpad.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-direction]");
  if (button) movePlayer(button.dataset.direction);
});

startButton.addEventListener("click", startGame);
editButton.addEventListener("click", returnToEditor);
resetButton.addEventListener("click", resetBoard);
clearButton.addEventListener("click", clearBoard);
retryButton.addEventListener("click", retryGame);
document.querySelector("#helpButton").addEventListener("click", () => helpDialog.showModal());
document.querySelector("#closeHelpButton").addEventListener("click", () => helpDialog.close());
document.querySelector("#understoodButton").addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", (event) => {
  if (event.target === helpDialog) helpDialog.close();
});

loadStarterLayout();
render();
