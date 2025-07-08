// Minimalist Safe Vault - Client-side AES encryption
// No analytics, no tracking, no sharing

const CATEGORIES = ["Identity", "Education", "Medical", "Financial", "Others"];
const API_URL = "https://safe-1.onrender.com/api"; // Change to your Render backend URL
let vaultKey = null;
let files = {};
let currentCategory = "Identity";

// --- UI Elements ---
const loginContainer = document.getElementById("login-container");
const vaultContainer = document.getElementById("vault-container");
const loginForm = document.getElementById("login-form");
const passphraseInput = document.getElementById("passphrase");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const categoryBtns = document.querySelectorAll(".category-btn");
const categorySelect = document.getElementById("category-select");
const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const fileList = document.getElementById("file-list");
const currentCategoryTitle = document.getElementById("current-category");
const previewModal = document.getElementById("preview-modal");
const filePreview = document.getElementById("file-preview");
const closePreview = document.getElementById("close-preview");

// --- Crypto helpers ---
async function getKeyFromPassphrase(passphrase) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("safevault_salt"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptFile(file, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await file.arrayBuffer());
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
}

async function decryptFile(encrypted, key) {
  const iv = new Uint8Array(encrypted.iv);
  const data = new Uint8Array(encrypted.data);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return new Uint8Array(decrypted);
}

// --- Storage helpers ---
// Save file to backend
async function saveFiles() {
  // Not used anymore
}
// Load files from backend
async function loadFiles(category) {
  const res = await fetch(`${API_URL}/files/${category}`);
  if (!res.ok) return [];
  return await res.json();
}

// --- UI Logic ---
async function showCategory(category) {
  currentCategory = category;
  currentCategoryTitle.textContent = category;
  categoryBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.category === category));
  await renderFileList();
}

async function renderFileList() {
  fileList.innerHTML = "<li><em>Loading...</em></li>";
  files[currentCategory] = await loadFiles(currentCategory);
  const catFiles = files[currentCategory] || [];
  fileList.innerHTML = "";
  if (catFiles.length === 0) {
    fileList.innerHTML = '<li><em>No files uploaded.</em></li>';
    return;
  }
  catFiles.forEach((f, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${f.name}</span>
      <div>
        <button onclick="previewFile('${currentCategory}',${idx})">Preview</button>
        <button onclick="downloadFile('${currentCategory}',${idx})">Download</button>
        <button onclick="deleteFile('${currentCategory}',${idx})">Delete</button>
      </div>`;
    fileList.appendChild(li);
  });
}

window.previewFile = async function(category, idx) {
  const f = files[category][idx];
  // Fetch file from backend
  const res = await fetch(`${API_URL}/file/${f._id}`);
  const fileData = await res.json();
  const decrypted = await decryptFile(fileData.encrypted, vaultKey);
  const blob = new Blob([decrypted], { type: fileData.type });
  filePreview.innerHTML = "";
  if (fileData.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(blob);
    img.style.maxWidth = "80vw";
    img.style.maxHeight = "70vh";
    filePreview.appendChild(img);
  } else if (fileData.type === "application/pdf") {
    const iframe = document.createElement("iframe");
    iframe.src = URL.createObjectURL(blob);
    iframe.width = "100%";
    iframe.height = "500px";
    filePreview.appendChild(iframe);
  } else {
    filePreview.textContent = "Preview not supported.";
  }
  previewModal.classList.remove("hidden");
};

window.downloadFile = async function(category, idx) {
  const f = files[category][idx];
  const res = await fetch(`${API_URL}/file/${f._id}`);
  const fileData = await res.json();
  const decrypted = await decryptFile(fileData.encrypted, vaultKey);
  const blob = new Blob([decrypted], { type: fileData.type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileData.name;
  a.click();
};

window.deleteFile = async function(category, idx) {
  const f = files[category][idx];
  await fetch(`${API_URL}/file/${f._id}`, { method: "DELETE" });
  renderFileList();
};

// Remove closePreview event since the close icon is removed
// closePreview.onclick = () => previewModal.classList.add("hidden");
window.onclick = e => {
  if (e.target === previewModal) previewModal.classList.add("hidden");
};

// --- Login Logic ---
const HARDCODED_PASSWORD = "1326";
loginForm.onsubmit = async e => {
  e.preventDefault();
  loginError.textContent = "";
  const passphrase = passphraseInput.value;
  if (passphrase !== HARDCODED_PASSWORD) {
    loginError.textContent = "Incorrect passphrase.";
    return;
  }
  try {
    vaultKey = await getKeyFromPassphrase(passphrase);
    // files = loadFiles();
    loginContainer.classList.add("hidden");
    vaultContainer.classList.remove("hidden");
    showCategory(currentCategory);
  } catch {
    loginError.textContent = "Error unlocking vault.";
  }
};

logoutBtn.onclick = () => {
  vaultKey = null;
  passphraseInput.value = "";
  vaultContainer.classList.add("hidden");
  loginContainer.classList.remove("hidden");
};

categoryBtns.forEach(btn => {
  btn.onclick = () => showCategory(btn.dataset.category);
});

uploadBtn.onclick = async () => {
  if (!fileInput.files.length) return;
  const cat = categorySelect.value;
  for (const file of fileInput.files) {
    const encrypted = await encryptFile(file, vaultKey);
    const data = {
      name: file.name,
      type: file.type,
      category: cat,
      encrypted
    };
    await fetch(`${API_URL}/upload`, {
      method: "POST",
      body: new URLSearchParams({ data: JSON.stringify(data) })
    });
  }
  fileInput.value = "";
  showCategory(cat);
};

// --- Initial State ---
(function init() {
  showCategory(currentCategory);
})();
