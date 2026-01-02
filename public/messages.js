// public/messages.js
const API_BASE = ""; // same server+port automatically

const userId = localStorage.getItem("userId");
const userName =
  localStorage.getItem("userName") ||
  localStorage.getItem("user_name") ||
  "";

if (!userId) window.location.href = "login.html";

// UI
const meLabel = document.getElementById("meLabel");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");

const contactSearch = document.getElementById("contactSearch");
const contactsList = document.getElementById("contactsList");
const contactsEmpty = document.getElementById("contactsEmpty");

const chatAvatar = document.getElementById("chatAvatar");
const chatWith = document.getElementById("chatWith");
const markReadBtn = document.getElementById("markReadBtn");

const messagesArea = document.getElementById("messagesArea");
const sendForm = document.getElementById("sendForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const statusLine = document.getElementById("statusLine");

if (meLabel) meLabel.textContent = userName || "—";

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("userId");
  localStorage.removeItem("userName");
  localStorage.removeItem("user_name");
  window.location.href = "login.html";
});

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function defaultAvatarDataUrl(label = "?") {
  const ch = (label || "?").trim().charAt(0).toUpperCase() || "?";
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
    <rect width="100%" height="100%" rx="18" ry="18" fill="#0f172a"/>
    <text x="50%" y="54%" font-size="52" text-anchor="middle" fill="#e2e8f0"
      font-family="Arial, sans-serif" dominant-baseline="middle">${esc(ch)}</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.trim());
}

function toPhotoUrl(pathOrNull, fallbackLabel) {
  if (!pathOrNull) return defaultAvatarDataUrl(fallbackLabel);
  if (String(pathOrNull).startsWith("/")) return pathOrNull; // served from same server
  return String(pathOrNull);
}

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { return await res.json(); } catch { return null; }
  }
  return null;
}

let friends = [];
let selectedFriend = null;
let pollTimer = null;

function setChatEnabled(enabled) {
  messageInput.disabled = !enabled;
  sendBtn.disabled = !enabled;
}

function setStatus(msg) {
  statusLine.textContent = msg || "";
}

function renderContacts(list) {
  if (!list || list.length === 0) {
    contactsList.innerHTML = "";
    contactsEmpty.textContent = "No friends yet.";
    return;
  }
  contactsEmpty.textContent = "";

  contactsList.innerHTML = list.map((f) => {
    const active = selectedFriend && Number(selectedFriend.id) === Number(f.id);
    const avatar = toPhotoUrl(f.profile_photo, f.user_name);
    return `
      <button class="contactItem ${active ? "active" : ""}" data-id="${f.id}">
        <img class="contactAvatar" src="${esc(avatar)}" alt="avatar" />
        <div class="contactMeta">
          <div class="contactName">${esc(f.user_name)}</div>
          <div class="contactSub muted">${esc(f.name || "")}</div>
        </div>
      </button>
    `;
  }).join("");

  contactsList.querySelectorAll(".contactItem").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const f = friends.find(x => String(x.id) === String(id));
      if (f) selectFriend(f);
    });
  });
}

function applyContactFilter() {
  const q = (contactSearch.value || "").trim().toLowerCase();
  if (!q) return renderContacts(friends);

  const filtered = friends.filter((f) =>
    (f.user_name || "").toLowerCase().includes(q) ||
    (f.name || "").toLowerCase().includes(q)
  );

  renderContacts(filtered);
}

async function loadFriends() {
  try {
    setStatus("Loading contacts...");
    const res = await fetch(`${API_BASE}/friends/list/${userId}`);
    const data = await safeJson(res);

    if (!res.ok) {
      setStatus("Failed to load contacts.");
      contactsList.innerHTML = "";
      contactsEmpty.textContent = "Error loading friends.";
      return;
    }

    friends = data || [];
    applyContactFilter();
    setStatus("");
  } catch (e) {
    console.error(e);
    setStatus("Network error while loading contacts.");
  }
}

function renderMessages(msgs) {
  if (!msgs || msgs.length === 0) {
    messagesArea.innerHTML = `<div class="muted">No messages yet.</div>`;
    return;
  }

  const ordered = [...msgs].reverse(); // server returns DESC

  messagesArea.innerHTML = ordered.map((m) => {
    const mine = Number(m.sender_id) === Number(userId);
    return `
      <div class="bubbleRow ${mine ? "mine" : "theirs"}">
        <div class="bubble ${mine ? "mine" : "theirs"}">
          <div class="bubbleText">${esc(m.body)}</div>
          <div class="bubbleTime">${esc(m.created_at)}</div>
        </div>
      </div>
    `;
  }).join("");

  messagesArea.scrollTop = messagesArea.scrollHeight;
}

async function loadConversation() {
  if (!selectedFriend) return;
  try {
    const res = await fetch(
      `${API_BASE}/messages/conversation?user_id=${encodeURIComponent(userId)}&friend_id=${encodeURIComponent(selectedFriend.id)}&limit=80`
    );
    const data = await safeJson(res);

    if (!res.ok) {
      setStatus(data?.message || "Failed to load chat.");
      renderMessages([]);
      return;
    }

    setStatus("");
    renderMessages(data || []);
  } catch (e) {
    console.error(e);
    setStatus("Network error while loading chat.");
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(loadConversation, 2500);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function selectFriend(f) {
  selectedFriend = f;
  chatWith.textContent = f.user_name || "—";
  chatAvatar.src = toPhotoUrl(f.profile_photo, f.user_name);

  setChatEnabled(true);
  applyContactFilter();
  loadConversation();
  startPolling();
  messageInput.focus();
}

sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedFriend) return;

  const body = (messageInput.value || "").trim();
  if (!body) return;

  try {
    setStatus("Sending...");
    const res = await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_id: Number(userId),
        receiver_id: Number(selectedFriend.id),
        body,
      }),
    });

    const data = await safeJson(res);
    if (!res.ok) {
      setStatus(data?.message || "Send failed.");
      return;
    }

    messageInput.value = "";
    setStatus("");
    await loadConversation();
  } catch (e2) {
    console.error(e2);
    setStatus("Network error while sending.");
  }
});

markReadBtn.addEventListener("click", async () => {
  if (!selectedFriend) return;

  try {
    setStatus("Marking as read...");
    const res = await fetch(`${API_BASE}/messages/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: Number(userId), friend_id: Number(selectedFriend.id) }),
    });

    const data = await safeJson(res);
    if (!res.ok) {
      setStatus(data?.message || "Failed.");
      return;
    }
    setStatus("Marked as read ✅");
    setTimeout(() => setStatus(""), 1200);
  } catch (e) {
    console.error(e);
    setStatus("Network error.");
  }
});

contactSearch.addEventListener("input", applyContactFilter);
refreshBtn.addEventListener("click", loadFriends);

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

async function init() {
  setChatEnabled(false);
  chatAvatar.src = defaultAvatarDataUrl("?");
  await loadFriends();

  const friendId = getQueryParam("friend_id");
  if (friendId) {
    const f = friends.find(x => String(x.id) === String(friendId));
    if (f) selectFriend(f);
  }
}
init();

window.addEventListener("beforeunload", () => stopPolling());

