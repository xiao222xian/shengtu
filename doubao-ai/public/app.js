const form = document.getElementById("gen-form");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const submitBtn = document.getElementById("submit-btn");
const saveBtn = document.getElementById("save-btn");

const apiKeyInput = document.getElementById("apiKey");
const toggleApiKeyBtn = document.getElementById("toggle-api-key");
const baseUrlInput = document.getElementById("baseUrl");
const modelInput = document.getElementById("model");
const sourceImageUrlInput = document.getElementById("sourceImageUrl");

let latestResults = [];
let pickedDirHandle = null;
let currentSourceImageRef = "";

const savedApiKey = localStorage.getItem("apiKey") || "";
const savedBaseUrl = localStorage.getItem("baseUrl") || "";
const savedModel = localStorage.getItem("model") || "";
if (savedApiKey) apiKeyInput.value = savedApiKey;
if (savedBaseUrl) baseUrlInput.value = savedBaseUrl;
if (savedModel) modelInput.value = savedModel;

function persistSettings() {
  localStorage.setItem("apiKey", apiKeyInput.value.trim());
  localStorage.setItem("baseUrl", baseUrlInput.value.trim());
  localStorage.setItem("model", modelInput.value.trim());
}

toggleApiKeyBtn.addEventListener("click", () => {
  const isHidden = apiKeyInput.type === "password";
  apiKeyInput.type = isHidden ? "text" : "password";
  toggleApiKeyBtn.textContent = isHidden ? "隐藏" : "显示";
});

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#b91c1c" : "#0f766e";
}

function getRuntimeConfig() {
  return {
    apiKey: apiKeyInput.value.trim(),
    baseUrl: baseUrlInput.value.trim() || "https://ark.cn-beijing.volces.com/api/v3",
    model: modelInput.value.trim() || "doubao-seedream-5-0-260128",
    sourceImageUrl: sourceImageUrlInput.value.trim(),
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取本地图片失败。"));
    reader.readAsDataURL(file);
  });
}

async function callArkGenerate({ apiKey, baseUrl, model, prompt, sourceImageUrl }) {
  const payload = {
    model,
    prompt,
    sequential_image_generation: "disabled",
    response_format: "b64_json",
    size: "2K",
    stream: false,
    watermark: true,
  };

  if (sourceImageUrl) payload.image = [sourceImageUrl];

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `HTTP ${response.status}`);
  }

  const item = data?.data?.[0];
  if (!item) throw new Error("No image data returned.");
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item.url) return item.url;
  throw new Error("Provider response does not include url or b64_json.");
}

function dataUrlToBlob(dataUrl) {
  const matched = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matched) throw new Error("Invalid base64 image format.");
  const mime = matched[1];
  const binary = atob(matched[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function extFromBlobType(blobType) {
  const t = String(blobType || "").toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
  return "jpg";
}

async function getImageBlob(url) {
  if (String(url).startsWith("data:image/")) return dataUrlToBlob(url);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`下载图片失败: HTTP ${resp.status}`);
  return resp.blob();
}

async function pickDirectoryHandle() {
  if (!("showDirectoryPicker" in window)) {
    throw new Error("当前浏览器不支持目录写入，将回退为批量下载。");
  }
  return window.showDirectoryPicker({ mode: "readwrite" });
}

async function saveAllToDirectory(results, namePrefix) {
  if (!pickedDirHandle) pickedDirHandle = await pickDirectoryHandle();

  let successCount = 0;
  for (const item of results) {
    const blob = await getImageBlob(item.imageUrl);
    const ext = extFromBlobType(blob.type);
    const fileName = `${namePrefix}-${item.slot + 1}.${ext}`;
    const fileHandle = await pickedDirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    successCount += 1;
  }
  return successCount;
}

async function saveAsDownloads(results, namePrefix) {
  for (const item of results) {
    const a = document.createElement("a");
    a.href = item.imageUrl;
    a.download = `${namePrefix}-${item.slot + 1}.jpg`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function regenerateOne(resultPos, newPrompt, btn) {
  const config = getRuntimeConfig();
  if (!config.apiKey) return setStatus("请先填写 API Key。", true);

  const sourceImageRef = currentSourceImageRef || config.sourceImageUrl;
  if (!sourceImageRef) return setStatus("单张重生需要原图（URL 或本地图）。", true);
  if (!newPrompt) return setStatus("请填写新的提示词。", true);

  const target = latestResults[resultPos];
  btn.disabled = true;
  setStatus(`正在重生第 ${target.slot + 1} 张...`);
  try {
    const imageUrl = await callArkGenerate({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      prompt: newPrompt,
      sourceImageUrl: sourceImageRef,
    });
    latestResults[resultPos] = { ...target, prompt: newPrompt, imageUrl, success: true, error: "" };
    renderResults();
    setStatus(`第 ${target.slot + 1} 张已重新生成。`);
  } catch (error) {
    latestResults[resultPos] = { ...target, prompt: newPrompt, success: false, error: error.message };
    renderResults();
    setStatus(`第 ${target.slot + 1} 张重生失败：${error.message}`, true);
  } finally {
    saveBtn.disabled = latestResults.filter((r) => r.success).length === 0;
    btn.disabled = false;
  }
}

function renderResults() {
  resultsEl.innerHTML = "";
  latestResults.forEach((item, resultPos) => {
    const card = document.createElement("article");
    card.className = "card";

    if (item.success && item.imageUrl) {
      const img = document.createElement("img");
      img.src = item.imageUrl;
      img.alt = `生成图 ${item.slot + 1}`;
      card.appendChild(img);
    } else {
      const error = document.createElement("div");
      error.className = "meta error";
      error.textContent = item.error || "生成失败";
      card.appendChild(error);
    }

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<div>提示词 ${item.slot + 1}</div>`;

    const promptEditor = document.createElement("textarea");
    promptEditor.className = "prompt-editor";
    promptEditor.value = item.prompt || "";
    promptEditor.placeholder = "修改这张图的提示词，然后点击重新生成此张";

    const actions = document.createElement("div");
    actions.className = "result-actions";
    const regenBtn = document.createElement("button");
    regenBtn.type = "button";
    regenBtn.textContent = "重新生成此张";
    regenBtn.addEventListener("click", async () => {
      await regenerateOne(resultPos, promptEditor.value.trim(), regenBtn);
    });

    actions.appendChild(regenBtn);
    meta.appendChild(promptEditor);
    meta.appendChild(actions);
    card.appendChild(meta);
    resultsEl.appendChild(card);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  persistSettings();

  const { apiKey, baseUrl, model, sourceImageUrl } = getRuntimeConfig();
  const localImage = document.getElementById("image").files[0];
  const prompts = [
    document.getElementById("p1").value.trim(),
    document.getElementById("p2").value.trim(),
    document.getElementById("p3").value.trim(),
    document.getElementById("p4").value.trim(),
    document.getElementById("p5").value.trim(),
  ];
  const filledPrompts = prompts
    .map((prompt, slot) => ({ prompt, slot }))
    .filter((item) => item.prompt.length > 0);

  if (!apiKey) return setStatus("请先填写 API Key。", true);
  if (!sourceImageUrl && !localImage) return setStatus("请上传原图或填写原图 URL。", true);
  if (filledPrompts.length === 0) return setStatus("至少填写 1 条提示词才会生成。", true);

  submitBtn.disabled = true;
  saveBtn.disabled = true;
  latestResults = [];
  resultsEl.innerHTML = "";
  setStatus(`正在生成 ${filledPrompts.length} 张，请稍候...`);

  let sourceImageRef = sourceImageUrl;
  if (!sourceImageRef && localImage) {
    try {
      sourceImageRef = await fileToDataUrl(localImage);
    } catch (error) {
      submitBtn.disabled = false;
      return setStatus(error.message || "本地图片读取失败。", true);
    }
  }
  currentSourceImageRef = sourceImageRef || "";

  for (let i = 0; i < filledPrompts.length; i += 1) {
    const { prompt, slot } = filledPrompts[i];
    try {
      const imageUrl = await callArkGenerate({
        apiKey,
        baseUrl,
        model,
        prompt,
        sourceImageUrl: sourceImageRef,
      });
      latestResults.push({ slot, prompt, imageUrl, success: true, error: "" });
      setStatus(`生成进度：${i + 1}/${filledPrompts.length}`);
    } catch (error) {
      latestResults.push({ slot, prompt, success: false, error: error.message });
      setStatus(`第 ${slot + 1} 条提示词生成失败：${error.message}`, true);
    }
  }

  renderResults();
  const okCount = latestResults.filter((r) => r.success).length;
  setStatus(`生成完成：成功 ${okCount} 张，失败 ${latestResults.length - okCount} 张。`);
  saveBtn.disabled = okCount === 0;
  submitBtn.disabled = false;
});

saveBtn.addEventListener("click", async () => {
  const namePrefix = (document.getElementById("namePrefix").value || "generated").trim();
  const okResults = latestResults.filter((item) => item.success && item.imageUrl);
  if (okResults.length === 0) return setStatus("没有可保存的图片。", true);

  saveBtn.disabled = true;
  setStatus("正在保存...");
  try {
    const savedCount = await saveAllToDirectory(okResults, namePrefix);
    setStatus(`保存完成：已写入 ${savedCount} 张。`);
  } catch (error) {
    await saveAsDownloads(okResults, namePrefix);
    setStatus(`目录保存不可用（${error.message || "未知错误"}），已回退为批量下载 ${okResults.length} 张。`, true);
  } finally {
    saveBtn.disabled = false;
  }
});
