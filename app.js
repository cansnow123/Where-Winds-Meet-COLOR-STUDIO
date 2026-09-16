const PRESET_COLORS = {
  R: "#ff4d4f",
  O: "#ff9f1c",
  Y: "#ffd93d",
  G: "#73d13d",
  C: "#36cfc9",
  B: "#4d7cff",
  P: "#b37feb",
  W: "#f5f5f5"
};

const PRESET_LABELS = {
  R: "赤红",
  O: "橙金",
  Y: "明黄",
  G: "青绿",
  C: "湖青",
  B: "深蓝",
  P: "紫绛",
  W: "霜白"
};

const STORAGE_KEYS = {
  visualDraft: "yanyun-color-studio-visual-draft"
};

const DEFAULT_SAMPLE = "我去 这频道牛啊 全是玩燕云的";

const DEFAULT_GRADIENT_PALETTE = [
  "#ff99c8",
  "#f9c74f",
  "#90be6d",
  "#43aa8b",
  "#9b8cf2",
  "#ff6b9c"
];

const GRADIENT_SEGMENTATION = {
  minLength: 8,
  minCharsPerSegment: 3,
  maxSegments: 18,
  targetColorDistance: 32,
  maxColorStep: 72,
  maxDirectionChanges: 5,
  softBreakSearchRadius: 3
};

const SOFT_BREAK_PATTERN = /[\s,.;:!?，。；：！？、]/u;

const elements = {
  richEditor: document.querySelector("#richEditor"),
  preview: document.querySelector("#preview"),
  exportOutput: document.querySelector("#exportOutput"),
  status: document.querySelector("#status"),
  stats: document.querySelector("#stats"),
  currentColorDisplay: document.querySelector("#currentColorDisplay"),
  selectionHint: document.querySelector("#selectionHint"),
  presetSwatches: document.querySelector("#presetSwatches"),
  modeTabs: document.querySelectorAll(".mode-tab"),
  modePanels: document.querySelectorAll(".mode-panel"),
  singleColorInput: document.querySelector("#singleColorInput"),
  singleHexInput: document.querySelector("#singleHexInput"),
  gradientStartInput: document.querySelector("#gradientStartInput"),
  gradientEndInput: document.querySelector("#gradientEndInput"),
  gradientStrip: document.querySelector("#gradientStrip"),
  paletteStrip: document.querySelector("#paletteStrip"),
  paletteSwatches: document.querySelector("#paletteSwatches"),
  paletteCount: document.querySelector("#paletteCount")
};

let activeMode = "single";
let activePresetCode = "R";
let savedEditorRange = null;
let paletteColors = DEFAULT_GRADIENT_PALETTE.slice();

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.style.color = isError ? "#8f2114" : "#7d2410";
}

function normalizeHex(hex) {
  // 燕云游戏只识别小写 hex（如 #ff0000），统一返回小写
  const value = String(hex).trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(value)) {
    throw new Error(`非法颜色值：${hex}`);
  }
  return `#${value}`;
}

function colorStringToHex(color) {
  if (!color) {
    return null;
  }

  if (color.startsWith("#")) {
    return normalizeHex(color);
  }

  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgbMatch) {
    return null;
  }

  const [, r, g, b] = rgbMatch;
  // 转 hex 时统一输出小写，匹配游戏识别规则
  return `#${[r, g, b].map((value) => Number(value).toString(16).padStart(2, "0")).join("").toLowerCase()}`;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  // 输出小写 hex，匹配燕云游戏识别
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("").toLowerCase()}`;
}

function interpolateColor(startHex, endHex, progress) {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  return rgbToHex({
    r: Math.round(start.r + (end.r - start.r) * progress),
    g: Math.round(start.g + (end.g - start.g) * progress),
    b: Math.round(start.b + (end.b - start.b) * progress)
  });
}

function buildMultiGradient(palette, progress) {
  if (palette.length === 1) {
    return palette[0];
  }

  const scaled = progress * (palette.length - 1);
  const index = Math.min(Math.floor(scaled), palette.length - 2);
  const localProgress = scaled - index;
  return interpolateColor(palette[index], palette[index + 1], localProgress);
}

// 从内存中的方块颜色数组读取并校验，多色渐变至少需要 2 个色块
function getPaletteValues() {
  if (paletteColors.length < 2) {
    throw new Error("多色渐变至少需要两个色块。");
  }
  return paletteColors.map(normalizeHex);
}

function createFragmentFromChars(chars) {
  const fragment = document.createDocumentFragment();
  let currentColor = null;
  let currentSpan = null;
  let lastNode = null;

  const ensureSpan = (color) => {
    if (color === currentColor && currentSpan) {
      return currentSpan;
    }

    currentColor = color;
    currentSpan = document.createElement("span");
    if (color) {
      currentSpan.style.color = color;
    }
    fragment.appendChild(currentSpan);
    lastNode = currentSpan;
    return currentSpan;
  };

  chars.forEach(({ char, color }) => {
    if (char === "\n") {
      currentColor = null;
      currentSpan = null;
      const br = document.createElement("br");
      fragment.appendChild(br);
      lastNode = br;
      return;
    }

    ensureSpan(color).appendChild(document.createTextNode(char));
    lastNode = currentSpan;
  });

  return { fragment, lastNode };
}

function createFragmentFromText(text, resolver = null) {
  const chars = Array.from(text).map((char, index, list) => ({
    char,
    color: char === "\n" || !resolver ? null : resolver(index, list.length)
  }));
  return createFragmentFromChars(chars);
}

function placeCaretAfter(node) {
  if (!node) {
    return;
  }
  const selection = window.getSelection();
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getEditorSelectionRange() {
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    return savedEditorRange ? savedEditorRange.cloneRange() : null;
  }
  const range = selection.getRangeAt(0);
  if (elements.richEditor.contains(range.commonAncestorContainer)) {
    savedEditorRange = range.cloneRange();
    return range;
  }
  return savedEditorRange ? savedEditorRange.cloneRange() : null;
}

function replaceSelectionWithFragment(fragment, lastNode) {
  const range = getEditorSelectionRange();
  if (!range) {
    return;
  }

  range.deleteContents();
  range.insertNode(fragment);
  placeCaretAfter(lastNode);
  elements.richEditor.normalize();
  const selection = window.getSelection();
  if (selection.rangeCount) {
    savedEditorRange = selection.getRangeAt(0).cloneRange();
  }
}

function insertPlainTextAtCursor(text) {
  const range = getEditorSelectionRange();
  if (!range) {
    elements.richEditor.focus();
    const freshRange = document.createRange();
    freshRange.selectNodeContents(elements.richEditor);
    freshRange.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(freshRange);
    savedEditorRange = freshRange.cloneRange();
  }
  const { fragment, lastNode } = createFragmentFromText(text);
  replaceSelectionWithFragment(fragment, lastNode);
}

function applyResolverToSelection(resolver) {
  const range = getEditorSelectionRange();
  if (!range || range.collapsed) {
    setStatus("先框选一段文字再上色。", true);
    return false;
  }

  const text = range.toString();
  const { fragment, lastNode } = createFragmentFromText(text, resolver);
  replaceSelectionWithFragment(fragment, lastNode);
  updateFromEditor();
  return true;
}

function applyResolverToAll(resolver) {
  const text = getPlainTextFromEditor();
  const { fragment } = createFragmentFromText(text, resolver);
  elements.richEditor.innerHTML = "";
  elements.richEditor.appendChild(fragment);
  updateFromEditor();
}

function clearSelectionStyles() {
  const range = getEditorSelectionRange();
  if (!range || range.collapsed) {
    setStatus("先框选一段文字再清色。", true);
    return false;
  }

  const text = range.toString();
  const { fragment, lastNode } = createFragmentFromText(text);
  replaceSelectionWithFragment(fragment, lastNode);
  updateFromEditor();
  return true;
}

function clearAllStyles() {
  setEditorFromText(getPlainTextFromEditor());
  updateFromEditor();
}

function setEditorFromText(text) {
  const { fragment } = createFragmentFromText(text);
  elements.richEditor.innerHTML = "";
  elements.richEditor.appendChild(fragment);
}

function collectCharsFromNode(node, inheritedColor, bucket) {
  if (node.nodeType === Node.TEXT_NODE) {
    for (const char of node.nodeValue) {
      bucket.push({ char, color: inheritedColor });
    }
    return;
  }

  if (node.nodeName === "BR") {
    bucket.push({ char: "\n", color: null });
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const ownColor = colorStringToHex(node.style?.color || "") || inheritedColor;
  Array.from(node.childNodes).forEach((child) => collectCharsFromNode(child, ownColor, bucket));
}

function getCharsFromEditor() {
  const chars = [];
  Array.from(elements.richEditor.childNodes).forEach((node) => collectCharsFromNode(node, null, chars));
  return chars;
}

function getPlainTextFromEditor() {
  return getCharsFromEditor().map(({ char }) => char).join("");
}

function isPresetHex(hex) {
  const normalized = normalizeHex(hex);
  return Object.entries(PRESET_COLORS).find(([, value]) => value === normalized) || null;
}

function renderPreview(chars) {
  if (!chars.length) {
    elements.preview.classList.add("is-empty");
    elements.preview.textContent = "这里会显示最终聊天效果。";
    return;
  }

  elements.preview.classList.remove("is-empty");
  const { fragment } = createFragmentFromChars(chars);
  elements.preview.innerHTML = "";
  elements.preview.appendChild(fragment);
}

function colorDistance(startHex, endHex) {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  return Math.hypot(end.r - start.r, end.g - start.g, end.b - start.b);
}

function toColorCode(color) {
  const preset = isPresetHex(color);
  return preset ? `#${preset[0]}` : `#${normalizeHex(color).slice(1)}`;
}

function findSoftBoundary(run, preferredIndex, minIndex, maxIndex) {
  let bestIndex = Math.min(Math.max(preferredIndex, minIndex), maxIndex);
  let bestDistance = Number.POSITIVE_INFINITY;
  const radius = GRADIENT_SEGMENTATION.softBreakSearchRadius;

  for (let index = Math.max(minIndex, preferredIndex - radius); index <= Math.min(maxIndex, preferredIndex + radius); index += 1) {
    if (SOFT_BREAK_PATTERN.test(run[index - 1]?.char || "") || SOFT_BREAK_PATTERN.test(run[index]?.char || "")) {
      const distance = Math.abs(index - preferredIndex);
      if (distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    }
  }

  return bestIndex;
}

function getGradientSegmentCount(run) {
  const colors = run.map(({ color }) => normalizeHex(color));
  const uniqueColors = new Set(colors);
  if (run.length < GRADIENT_SEGMENTATION.minLength || uniqueColors.size < 3) {
    return 0;
  }

  const colorSteps = colors.slice(1).map((color, index) => {
    const start = hexToRgb(colors[index]);
    const end = hexToRgb(color);
    return {
      distance: colorDistance(colors[index], color),
      vector: [end.r - start.r, end.g - start.g, end.b - start.b]
    };
  });
  const totalColorDistance = colorSteps.reduce((total, step) => total + step.distance, 0);
  const directionChanges = colorSteps.reduce((count, step, index) => {
    if (index === 0) {
      return count;
    }
    const previous = colorSteps[index - 1].vector;
    const dotProduct = previous[0] * step.vector[0] + previous[1] * step.vector[1] + previous[2] * step.vector[2];
    return dotProduct < 0 ? count + 1 : count;
  }, 0);

  // Smooth gradients move through RGB space gradually. Repeated sharp reversals
  // are much more likely to be deliberate, hand-applied color changes.
  if (
    colorSteps.some(({ distance }) => distance > GRADIENT_SEGMENTATION.maxColorStep) ||
    directionChanges > GRADIENT_SEGMENTATION.maxDirectionChanges
  ) {
    return 0;
  }

  const segmentsByColor = Math.max(2, Math.ceil(totalColorDistance / GRADIENT_SEGMENTATION.targetColorDistance));
  const segmentsByLength = Math.max(2, Math.ceil(run.length / GRADIENT_SEGMENTATION.minCharsPerSegment));

  return Math.min(
    GRADIENT_SEGMENTATION.maxSegments,
    uniqueColors.size,
    segmentsByColor,
    segmentsByLength
  );
}

function serializeExactColorRun(run) {
  let result = "";
  let activeColor = null;

  run.forEach(({ char, color }) => {
    const normalized = normalizeHex(color);
    if (normalized !== activeColor) {
      result += toColorCode(normalized);
      activeColor = normalized;
    }
    result += char;
  });

  return result;
}

function serializeGradientRun(run, segmentCount) {
  const boundaries = [0];
  for (let segment = 1; segment < segmentCount; segment += 1) {
    const preferredIndex = Math.round(run.length * segment / segmentCount);
    boundaries.push(findSoftBoundary(run, preferredIndex, boundaries[boundaries.length - 1] + 1, run.length - (segmentCount - segment)));
  }
  boundaries.push(run.length);

  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const colorIndex = index === 0
      ? start
      : index === segmentCount - 1
        ? end - 1
        : Math.floor((start + end - 1) / 2);
    return `${toColorCode(run[colorIndex].color)}${run.slice(start, end).map(({ char }) => char).join("")}`;
  }).join("");
}

function serializeColorRun(run) {
  const segmentCount = getGradientSegmentCount(run);
  return segmentCount ? serializeGradientRun(run, segmentCount) : serializeExactColorRun(run);
}

function toCanonicalTaggedText(chars) {
  let result = "";
  let colorRun = [];

  const flushColorRun = () => {
    if (colorRun.length) {
      result += serializeColorRun(colorRun);
      colorRun = [];
    }
  };

  chars.forEach(({ char, color }) => {
    if (char === "\n" || !color) {
      flushColorRun();
      result += char;
      return;
    }
    colorRun.push({ char, color });
  });

  flushColorRun();
  return result;
}

function buildStats(chars) {
  const visibleChars = chars.filter(({ char }) => char !== "\n");
  const coloredChars = visibleChars.filter(({ color }) => Boolean(color));
  const uniqueColors = new Set(coloredChars.map(({ color }) => color.toLowerCase()));
  elements.stats.innerHTML = [
    `${visibleChars.length} 字`,
    `${coloredChars.length} 彩字`,
    `${uniqueColors.size} 色`
  ].map((label) => `<span class="stat-pill">${label}</span>`).join("");
}

function updateSelectionHint() {
  const range = getEditorSelectionRange();
  if (!range || range.collapsed) {
    elements.selectionHint.textContent = "未选中文字";
    return;
  }

  const text = range.toString().replace(/\n/g, " ");
  elements.selectionHint.textContent = text.length > 16 ? `已选：${text.slice(0, 16)}...` : `已选：${text}`;
}

function updateFromEditor() {
  const chars = getCharsFromEditor();
  renderPreview(chars);
  elements.exportOutput.value = toCanonicalTaggedText(chars);
  buildStats(chars);
  updateSelectionHint();
}

function syncCurrentColorDisplay() {
  const normalized = normalizeHex(elements.singleHexInput.value);
  elements.currentColorDisplay.textContent = normalized;
  elements.singleColorInput.value = normalized.toLowerCase();
}

function updateGradientStrips() {
  const start = normalizeHex(elements.gradientStartInput.value);
  const end = normalizeHex(elements.gradientEndInput.value);
  elements.gradientStrip.style.background = `linear-gradient(90deg, ${start}, ${end})`;

  try {
    const palette = getPaletteValues();
    elements.paletteStrip.style.background = `linear-gradient(90deg, ${palette.join(",")})`;
    if (elements.paletteCount) {
      elements.paletteCount.textContent = palette.length;
    }
  } catch {
    elements.paletteStrip.style.background = "linear-gradient(90deg, #f94144, #43aa8b)";
  }
}

// 同步方块按钮的背景色与对应隐藏 color input 的值
function syncSwatch(swatch) {
  const targetId = swatch.dataset.target;
  if (targetId) {
    swatch.style.background = elements[targetId].value;
    return;
  }
  const index = Number(swatch.dataset.index);
  if (Number.isInteger(index) && paletteColors[index]) {
    swatch.style.background = paletteColors[index];
  }
}

// 渲染多色渐变方块按钮，点击打开系统颜色选择器
function renderPaletteSwatches() {
  elements.paletteSwatches.innerHTML = "";
  paletteColors.forEach((color, index) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.dataset.index = String(index);
    swatch.style.background = color;
    swatch.setAttribute("aria-label", `选择第 ${index + 1} 个颜色`);
    swatch.title = "点击换色";

    const picker = document.createElement("input");
    picker.type = "color";
    picker.className = "swatch-picker";
    picker.value = color;

    picker.addEventListener("input", () => {
      const next = normalizeHex(picker.value);
      paletteColors[index] = next;
      swatch.style.background = next;
      try {
        updateGradientStrips();
      } catch (error) {
        setStatus(error.message, true);
      }
    });

    swatch.addEventListener("click", () => picker.click());

    const wrapper = document.createElement("span");
    wrapper.className = "swatch-wrapper";
    wrapper.append(swatch, picker);
    elements.paletteSwatches.appendChild(wrapper);
  });
}

function getActiveResolver() {
  if (activeMode === "single") {
    const color = normalizeHex(elements.singleHexInput.value);
    return () => color;
  }

  if (activeMode === "gradient") {
    const start = normalizeHex(elements.gradientStartInput.value);
    const end = normalizeHex(elements.gradientEndInput.value);
    return (index, total) => {
      if (total <= 1) {
        return start;
      }
      return interpolateColor(start, end, index / (total - 1));
    };
  }

  const palette = getPaletteValues();
  return (index, total) => {
    if (total <= 1) {
      return palette[0];
    }
    return buildMultiGradient(palette, index / (total - 1));
  };
}

function activateMode(mode) {
  activeMode = mode;
  elements.modeTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  elements.modePanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.modePanel === mode);
  });
}

function renderPresetSwatches() {
  elements.presetSwatches.innerHTML = "";
  Object.entries(PRESET_COLORS).forEach(([code, color]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `swatch-button${activePresetCode === code ? " is-active" : ""}`;
    button.innerHTML = `
      <span class="swatch-dot" style="background:${color}"></span>
      <span class="swatch-meta">
        <strong>#${code}</strong>
        <small>${PRESET_LABELS[code]}</small>
      </span>
    `;
    button.addEventListener("click", () => {
      activePresetCode = code;
      activateMode("single");
      elements.singleHexInput.value = color;
      syncCurrentColorDisplay();
      renderPresetSwatches();

      const range = getEditorSelectionRange();
      if (range && !range.collapsed) {
        const applied = applyResolverToSelection(() => color);
        if (applied) {
          setStatus(`已把选中内容改成 #${code} ${PRESET_LABELS[code]}。`);
        }
      } else {
        setStatus(`当前单色已切到 #${code} ${PRESET_LABELS[code]}。`);
      }
    });
    elements.presetSwatches.appendChild(button);
  });
}

function copyText(value, successMessage) {
  navigator.clipboard.writeText(value).then(
    () => setStatus(successMessage),
    () => setStatus("复制失败，请手动复制。", true)
  );
}

function persistDraft() {
  localStorage.setItem(STORAGE_KEYS.visualDraft, elements.richEditor.innerHTML);
  setStatus("草稿已保存到浏览器本地。");
}

function restoreDraft() {
  const saved = localStorage.getItem(STORAGE_KEYS.visualDraft);
  if (saved) {
    elements.richEditor.innerHTML = saved;
  } else {
    setEditorFromText(DEFAULT_SAMPLE);
  }
  updateFromEditor();
}

function loadSample() {
  setEditorFromText(DEFAULT_SAMPLE);
  updateFromEditor();
  setStatus("示例文案已载入。");
}

function bindEditorEvents() {
  elements.richEditor.addEventListener("input", updateFromEditor);
  elements.richEditor.addEventListener("mouseup", updateSelectionHint);
  elements.richEditor.addEventListener("keyup", updateSelectionHint);
  elements.richEditor.addEventListener("focus", () => {
    if (!savedEditorRange) {
      const range = document.createRange();
      range.selectNodeContents(elements.richEditor);
      range.collapse(false);
      savedEditorRange = range.cloneRange();
    }
  });

  elements.richEditor.addEventListener("paste", (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    insertPlainTextAtCursor(text);
    updateFromEditor();
  });

  elements.richEditor.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      insertPlainTextAtCursor("\n");
      updateFromEditor();
    }
  });

  document.addEventListener("selectionchange", () => {
    const selection = window.getSelection();
    if (selection.rangeCount) {
      const range = selection.getRangeAt(0);
      if (elements.richEditor.contains(range.commonAncestorContainer)) {
        savedEditorRange = range.cloneRange();
      }
    }
    updateSelectionHint();
  });
}

function bindEvents() {
  bindEditorEvents();

  document.querySelectorAll("button").forEach((button) => {
    button.addEventListener("mousedown", (event) => {
      if (savedEditorRange) {
        event.preventDefault();
      }
    });
  });

  elements.modeTabs.forEach((button) => {
    button.addEventListener("click", () => activateMode(button.dataset.mode));
  });

  elements.singleColorInput.addEventListener("input", () => {
    elements.singleHexInput.value = normalizeHex(elements.singleColorInput.value);
    syncCurrentColorDisplay();
  });

  elements.singleHexInput.addEventListener("change", () => {
    try {
      elements.singleHexInput.value = normalizeHex(elements.singleHexInput.value);
      syncCurrentColorDisplay();
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  [elements.gradientStartInput, elements.gradientEndInput].forEach((input) => {
    input.addEventListener("input", () => {
      const swatch = document.querySelector(`.color-swatch[data-target="${input.id}"]`);
      if (swatch) {
        swatch.style.background = input.value;
      }
      try {
        updateGradientStrips();
      } catch (error) {
        setStatus(error.message, true);
      }
    });
  });

  document.querySelector("#applySelectionBtn").addEventListener("click", () => {
    try {
      const applied = applyResolverToSelection(getActiveResolver());
      if (applied) {
        setStatus("已给选中内容上色。");
      }
    } catch (error) {
      setStatus(error.message || "上色失败。", true);
    }
  });

  document.querySelector("#applyAllBtn").addEventListener("click", () => {
    try {
      applyResolverToAll(getActiveResolver());
      setStatus("已对整段内容套用当前模式。");
    } catch (error) {
      setStatus(error.message || "整段上色失败。", true);
    }
  });

  document.querySelector("#clearSelectionStyleBtn").addEventListener("click", () => {
    const cleared = clearSelectionStyles();
    if (cleared) {
      setStatus("已清掉选中内容的颜色。");
    }
  });

  document.querySelector("#resetAllStylesBtn").addEventListener("click", () => {
    clearAllStyles();
    setStatus("已把整段内容恢复成默认颜色。");
  });

  document.querySelector("#copyExportBtn").addEventListener("click", () => {
    copyText(elements.exportOutput.value, "彩字标签已复制。");
  });

  document.querySelector("#saveDraftBtn").addEventListener("click", persistDraft);
  document.querySelector("#loadSampleBtn").addEventListener("click", loadSample);

  document.querySelector("#clearEditorBtn").addEventListener("click", () => {
    setEditorFromText("");
    updateFromEditor();
    setStatus("编辑区已清空。");
  });
}

function init() {
  activateMode("single");
  renderPresetSwatches();
  renderPaletteSwatches();
  syncCurrentColorDisplay();
  updateGradientStrips();
  bindEvents();
  restoreDraft();
  setStatus("准备就绪。");
}

init();
