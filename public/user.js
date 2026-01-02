// public/user.js

// ====================== CONFIG ======================
const API_BASE = "http://localhost:3000";

// ====================== AUTH / BASIC USER ======================
const userId = localStorage.getItem("userId");
const userNameLS =
  localStorage.getItem("userName") ||
  localStorage.getItem("user_name") ||
  "";

if (!userId) {
  // Not logged in
  window.location.href = "login.html";
}

// Header / welcome
const welcomeName = document.getElementById("welcomeName");
const currentUserLabel = document.getElementById("currentUserLabel");
const logoutBtn = document.getElementById("logoutBtn");

if (welcomeName) welcomeName.textContent = userNameLS || "User";
if (currentUserLabel) currentUserLabel.textContent = userNameLS || "—";

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    localStorage.removeItem("user_name");
    window.location.href = "login.html";
  });
}

// ====================== HELPERS ======================
function escHtml(str) {
  return String(str ?? "")
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
      font-family="Arial, sans-serif" dominant-baseline="middle">${escHtml(ch)}</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.trim());
}

function toPhotoUrl(pathOrNull, fallbackLabel) {
  if (!pathOrNull) return defaultAvatarDataUrl(fallbackLabel);
  // If server returns "/uploads/xxx", make it absolute
  if (String(pathOrNull).startsWith("/")) return API_BASE + pathOrNull;
  return String(pathOrNull);
}

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  return null;
}

// ====================== PROFILE (PHOTO) ======================
const profileImg = document.getElementById("profileImg");
const photoForm = document.getElementById("photoForm");
const photoInput = document.getElementById("photoInput");
const photoStatus = document.getElementById("photoStatus");

async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/users/profile/${userId}`);
    if (!res.ok) return; // profile endpoint may not exist yet
    const data = await res.json();

    // Show nicer welcome (name if exists), but keep username label
    if (welcomeName && data?.name) welcomeName.textContent = data.name;
    if (currentUserLabel && data?.user_name) currentUserLabel.textContent = data.user_name;

    if (profileImg) {
      profileImg.src = toPhotoUrl(data?.profile_photo, data?.user_name || userNameLS);
    }
  } catch (e) {
    console.error("loadProfile error:", e);
  }
}

// Upload photo (requires backend PUT /users/:id/photo with field name "photo")
if (photoForm) {
  photoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!photoInput || !photoInput.files || !photoInput.files[0]) {
      if (photoStatus) photoStatus.textContent = "Please choose a photo first.";
      return;
    }

    const fd = new FormData();
    fd.append("photo", photoInput.files[0]);

    try {
      if (photoStatus) photoStatus.textContent = "Uploading...";
      const res = await fetch(`${API_BASE}/users/${userId}/photo`, {
        method: "PUT",
        body: fd,
      });

      const data = await safeJson(res);
      if (!res.ok) {
        const msg = data?.message || (await res.text());
        if (photoStatus) photoStatus.textContent = "Upload failed: " + msg;
        return;
      }

      if (photoStatus) photoStatus.textContent = "Photo updated ✅";
      const newPath = data?.profile_photo;
      if (profileImg) profileImg.src = toPhotoUrl(newPath, userNameLS);
      photoInput.value = "";
    } catch (err) {
      console.error(err);
      if (photoStatus) photoStatus.textContent = "Network error while uploading photo.";
    }
  });
}

// ====================== FRIENDS / REQUESTS ======================
const friendSearchInput = document.getElementById("friendSearchInput");
const friendSearchBtn = document.getElementById("friendSearchBtn");
const friendSearchResult = document.getElementById("friendSearchResult");
const friendSearchStatus = document.getElementById("friendSearchStatus");

const incomingRequestsEl = document.getElementById("incomingRequests");
const outgoingRequestsEl = document.getElementById("outgoingRequests");
const friendsListEl = document.getElementById("friendsList");

let lastSearchedUser = null; // {id, user_name, name, profile_photo}
let selectedFriend = null;   // {id, user_name, name, profile_photo}

function renderSearchResult(user) {
  if (!friendSearchResult) return;

  if (!user) {
    friendSearchResult.innerHTML = "";
    return;
  }

  const isMe = Number(user.id) === Number(userId);
  const avatar = toPhotoUrl(user.profile_photo, user.user_name);
  friendSearchResult.innerHTML = `
    <div class="searchUserRow">
      <img class="miniAvatar" src="${escHtml(avatar)}" alt="avatar" />
      <div class="searchUserInfo">
        <div><strong>${escHtml(user.user_name)}</strong></div>
        <div class="muted">${escHtml(user.name || "")}</div>
      </div>
      <button id="sendFriendReqBtn" class="btn" ${isMe ? "disabled" : ""}>
        ${isMe ? "That's you" : "Send Request"}
      </button>
    </div>
  `;

  const btn = document.getElementById("sendFriendReqBtn");
  if (btn && !isMe) {
    btn.addEventListener("click", sendFriendRequest);
  }
}

async function searchUser() {
  const q = (friendSearchInput?.value || "").trim();
  lastSearchedUser = null;
  renderSearchResult(null);
  if (friendSearchStatus) friendSearchStatus.textContent = "";

  if (!q) {
    if (friendSearchStatus) friendSearchStatus.textContent = "Type a username to search.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/users/search?user_name=${encodeURIComponent(q)}`);
    const data = await safeJson(res);

    if (!res.ok) {
      if (friendSearchStatus) {
        friendSearchStatus.textContent = data?.message || "User not found.";
      }
      return;
    }

    lastSearchedUser = data;
    renderSearchResult(data);
    if (friendSearchStatus) friendSearchStatus.textContent = "";
  } catch (err) {
    console.error(err);
    if (friendSearchStatus) friendSearchStatus.textContent = "Network error while searching.";
  }
}

async function sendFriendRequest() {
  if (!lastSearchedUser) return;

  try {
    if (friendSearchStatus) friendSearchStatus.textContent = "Sending request...";
    const res = await fetch(`${API_BASE}/friends/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_user_id: Number(userId),
        to_user_id: Number(lastSearchedUser.id),
      }),
    });

    const data = await safeJson(res);
    if (!res.ok) {
      if (friendSearchStatus) friendSearchStatus.textContent = data?.message || (await res.text());
      return;
    }

    if (friendSearchStatus) friendSearchStatus.textContent = "Request sent ✅";
    await loadOutgoingRequests();
  } catch (err) {
    console.error(err);
    if (friendSearchStatus) friendSearchStatus.textContent = "Network error while sending request.";
  }
}

if (friendSearchBtn) friendSearchBtn.addEventListener("click", searchUser);
if (friendSearchInput) {
  friendSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchUser();
  });
}

function renderIncomingRequestRow(r) {
  const avatar = toPhotoUrl(r.profile_photo, r.user_name);
  return `
    <div class="reqRow">
      <img class="miniAvatar" src="${escHtml(avatar)}" alt="avatar" />
      <div class="reqInfo">
        <div><strong>${escHtml(r.user_name)}</strong></div>
        <div class="muted">${escHtml(r.name || "")}</div>
      </div>
      <div class="reqActions">
        <button class="btnTiny accept" data-id="${r.id}">Accept</button>
        <button class="btnTiny reject" data-id="${r.id}">Reject</button>
      </div>
    </div>
  `;
}

function renderOutgoingRequestRow(r) {
  const avatar = toPhotoUrl(r.profile_photo, r.user_name);
  return `
    <div class="reqRow">
      <img class="miniAvatar" src="${escHtml(avatar)}" alt="avatar" />
      <div class="reqInfo">
        <div><strong>${escHtml(r.user_name)}</strong></div>
        <div class="muted">${escHtml(r.name || "")}</div>
      </div>
      <div class="reqActions">
        <button class="btnTiny cancel" data-id="${r.id}">Cancel</button>
      </div>
    </div>
  `;
}

async function loadIncomingRequests() {
  if (!incomingRequestsEl) return;

  try {
    const res = await fetch(`${API_BASE}/friends/requests/incoming/${userId}`);
    const data = await safeJson(res);
    if (!res.ok) {
      incomingRequestsEl.innerHTML = `<div class="muted">Error loading incoming requests.</div>`;
      return;
    }

    if (!data || data.length === 0) {
      incomingRequestsEl.innerHTML = `<div class="muted">No incoming requests.</div>`;
      return;
    }

    incomingRequestsEl.innerHTML = data.map(renderIncomingRequestRow).join("");

    // Bind buttons
    incomingRequestsEl.querySelectorAll(".accept").forEach((btn) => {
      btn.addEventListener("click", () => acceptRequest(btn.dataset.id));
    });
    incomingRequestsEl.querySelectorAll(".reject").forEach((btn) => {
      btn.addEventListener("click", () => rejectRequest(btn.dataset.id));
    });
  } catch (err) {
    console.error(err);
    incomingRequestsEl.innerHTML = `<div class="muted">Network error.</div>`;
  }
}

async function loadOutgoingRequests() {
  if (!outgoingRequestsEl) return;

  try {
    const res = await fetch(`${API_BASE}/friends/requests/outgoing/${userId}`);
    const data = await safeJson(res);
    if (!res.ok) {
      outgoingRequestsEl.innerHTML = `<div class="muted">Error loading outgoing requests.</div>`;
      return;
    }

    if (!data || data.length === 0) {
      outgoingRequestsEl.innerHTML = `<div class="muted">No outgoing requests.</div>`;
      return;
    }

    outgoingRequestsEl.innerHTML = data.map(renderOutgoingRequestRow).join("");

    outgoingRequestsEl.querySelectorAll(".cancel").forEach((btn) => {
      btn.addEventListener("click", () => cancelRequest(btn.dataset.id));
    });
  } catch (err) {
    console.error(err);
    outgoingRequestsEl.innerHTML = `<div class="muted">Network error.</div>`;
  }
}

async function acceptRequest(requestId) {
  try {
    const res = await fetch(`${API_BASE}/friends/requests/${requestId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: Number(userId) }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      alert(data?.message || (await res.text()));
      return;
    }
    await loadIncomingRequests();
    await loadFriends();
  } catch (err) {
    console.error(err);
    alert("Network error while accepting request");
  }
}

async function rejectRequest(requestId) {
  try {
    const res = await fetch(`${API_BASE}/friends/requests/${requestId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: Number(userId) }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      alert(data?.message || (await res.text()));
      return;
    }
    await loadIncomingRequests();
  } catch (err) {
    console.error(err);
    alert("Network error while rejecting request");
  }
}

async function cancelRequest(requestId) {
  try {
    const res = await fetch(`${API_BASE}/friends/requests/${requestId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: Number(userId) }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      alert(data?.message || (await res.text()));
      return;
    }
    await loadOutgoingRequests();
  } catch (err) {
    console.error(err);
    alert("Network error while canceling request");
  }
}

function renderFriendRow(f) {
  const avatar = toPhotoUrl(f.profile_photo, f.user_name);
  const active = selectedFriend && Number(selectedFriend.id) === Number(f.id);
  return `
    <button class="friendRow ${active ? "active" : ""}" data-id="${f.id}" data-username="${escHtml(f.user_name)}">
      <img class="miniAvatar" src="${escHtml(avatar)}" alt="avatar" />
      <div class="friendInfo">
        <div><strong>${escHtml(f.user_name)}</strong></div>
        <div class="muted">${escHtml(f.name || "")}</div>
      </div>
    </button>
  `;
}

async function loadFriends() {
  if (!friendsListEl) return;

  try {
    const res = await fetch(`${API_BASE}/friends/list/${userId}`);
    const data = await safeJson(res);

    if (!res.ok) {
      friendsListEl.innerHTML = `<div class="muted">Error loading friends.</div>`;
      return;
    }

    if (!data || data.length === 0) {
      friendsListEl.innerHTML = `<div class="muted">No friends yet.</div>`;
      return;
    }

    friendsListEl.innerHTML = data.map(renderFriendRow).join("");

    friendsListEl.querySelectorAll(".friendRow").forEach((btn) => {
      btn.addEventListener("click", () => {
        const friendId = btn.dataset.id;
        const friendUser = btn.dataset.username;
        selectFriend({ id: friendId, user_name: friendUser });
      });
    });
  } catch (err) {
    console.error(err);
    friendsListEl.innerHTML = `<div class="muted">Network error.</div>`;
  }
}

// ====================== CHAT ======================
const chatHeader = document.getElementById("chatHeader");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const chatStatus = document.getElementById("chatStatus");

function setChatEnabled(enabled) {
  if (chatInput) chatInput.disabled = !enabled;
  if (chatSendBtn) chatSendBtn.disabled = !enabled;
}

function setChatHeaderText(text) {
  if (chatHeader) chatHeader.textContent = text;
}

function renderMessages(msgs) {
  if (!chatMessages) return;
  chatMessages.innerHTML = "";

  if (!msgs || msgs.length === 0) {
    chatMessages.innerHTML = `<div class="muted">No messages yet.</div>`;
    return;
  }

  // show oldest -> newest
  const ordered = [...msgs].reverse();

  const html = ordered
    .map((m) => {
      const mine = Number(m.sender_id) === Number(userId);
      return `
        <div class="msgRow ${mine ? "mine" : "theirs"}">
          <div class="msgBubble">${escHtml(m.body)}</div>
          <div class="msgMeta muted">${escHtml(m.created_at)}</div>
        </div>
      `;
    })
    .join("");

  chatMessages.innerHTML = html;
  // scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function loadConversation() {
  if (!selectedFriend) return;
  if (chatStatus) chatStatus.textContent = "";

  try {
    const res = await fetch(
      `${API_BASE}/messages/conversation?user_id=${encodeURIComponent(userId)}&friend_id=${encodeURIComponent(
        selectedFriend.id
      )}&limit=60`
    );
    const data = await safeJson(res);

    if (!res.ok) {
      if (chatStatus) chatStatus.textContent = data?.message || "Error loading conversation.";
      renderMessages([]);
      return;
    }
    renderMessages(data);
  } catch (err) {
    console.error(err);
    if (chatStatus) chatStatus.textContent = "Network error loading conversation.";
  }
}

function selectFriend(friend) {
  selectedFriend = friend;
  setChatEnabled(true);
  setChatHeaderText(`Chat with: ${friend.user_name}`);
  loadConversation();
  // refresh highlight in friends list
  loadFriends();
}

if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedFriend) return;

    const body = (chatInput?.value || "").trim();
    if (!body) return;

    try {
      if (chatStatus) chatStatus.textContent = "Sending...";
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
        if (chatStatus) chatStatus.textContent = data?.message || "Send failed.";
        return;
      }

      if (chatStatus) chatStatus.textContent = "";
      if (chatInput) chatInput.value = "";
      await loadConversation();
    } catch (err) {
      console.error(err);
      if (chatStatus) chatStatus.textContent = "Network error sending message.";
    }
  });
}

setChatEnabled(false);
setChatHeaderText("Select a friend to start chatting.");

// ====================== ACCOUNT UPDATE (EXISTING) ======================
const updateForm = document.getElementById("updateForm");
const updateResult = document.getElementById("updateResult");

if (updateForm) {
  updateForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const current_user_name = document.getElementById("current_user_name").value.trim();
    const current_pass = document.getElementById("current_pass").value.trim();
    const new_user_name = document.getElementById("new_user_name").value.trim();
    const new_pass = document.getElementById("new_pass").value.trim();

    try {
      const res = await fetch(`${API_BASE}/users/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_user_name,
          current_pass,
          new_user_name,
          new_pass,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        if (updateResult) updateResult.textContent = "Error: " + text;
        return;
      }

      if (updateResult) updateResult.textContent = text;

      // Update local labels
      localStorage.setItem("userName", new_user_name);
      localStorage.setItem("user_name", new_user_name);
      if (currentUserLabel) currentUserLabel.textContent = new_user_name;
    } catch (err) {
      console.error(err);
      if (updateResult) updateResult.textContent = "Network error while updating";
    }
  });
}

// ====================== TASKS (EXISTING) ======================
const taskForm = document.getElementById("taskForm");
const tasksBody = document.getElementById("tasksBody");
const tasksMessage = document.getElementById("tasksMessage");

const taskFilters = document.getElementById("taskFilters");
const taskSearchBtn = document.getElementById("taskSearchBtn");
const taskClearSearchBtn = document.getElementById("taskClearSearchBtn");
const taskSearchInput = document.getElementById("taskSearchInput");
const taskSortSelect = document.getElementById("taskSortSelect");

const editTaskSection = document.getElementById("editTaskSection");
const editTaskForm = document.getElementById("editTaskForm");
const editTaskTitleInput = document.getElementById("editTaskTitleInput");
const editTaskDescInput = document.getElementById("editTaskDescInput");
const cancelEditBtn = document.getElementById("cancelEditBtn");

let tasks = [];
let currentFilter = "all";
let currentSearch = "";
let currentSort = "newest";
let editingTask = null;

function splitText(text) {
  if (!text) return { title: "", description: "" };
  const parts = text.split(" - ");
  if (parts.length === 1) return { title: parts[0], description: "" };
  return { title: parts[0], description: parts.slice(1).join(" - ") };
}

async function loadTasks() {
  try {
    const res = await fetch(`${API_BASE}/tasks/user/${userId}`);
    if (!res.ok) {
      const msg = await res.text();
      if (tasksMessage) {
        tasksMessage.textContent = "Error loading tasks: " + msg;
        tasksMessage.style.color = "red";
      }
      return;
    }

    tasks = await res.json();
    renderTasks();
    if (tasksMessage) tasksMessage.textContent = "";
  } catch (err) {
    console.error(err);
    if (tasksMessage) tasksMessage.textContent = "Network error while loading tasks";
  }
}

function renderTasks() {
  if (!tasksBody) return;
  tasksBody.innerHTML = "";

  const filtered = tasks.filter((task) => {
    const { title, description } = splitText(task.text);

    const okFilter =
      currentFilter === "all" ||
      (currentFilter === "done" && !!task.is_done) ||
      (currentFilter === "notDone" && !task.is_done) ||
      (currentFilter === "hasDesc" && description.trim() !== "");

    const okSearch =
      !currentSearch || title.toLowerCase().includes(currentSearch.toLowerCase());

    return okFilter && okSearch;
  });

  if (!filtered.length) {
    if (tasksMessage) {
      tasksMessage.textContent = "No tasks for this filter/search.";
      tasksMessage.style.color = "gray";
    }
    return;
  } else if (tasksMessage) {
    tasksMessage.textContent = "";
  }

  const sorted = [...filtered].sort((a, b) => {
    const aSplit = splitText(a.text);
    const bSplit = splitText(b.text);
    const aTitle = aSplit.title.toLowerCase();
    const bTitle = bSplit.title.toLowerCase();

    switch (currentSort) {
      case "oldest":
        return a.id - b.id;
      case "titleAZ":
        return aTitle.localeCompare(bTitle);
      case "titleZA":
        return bTitle.localeCompare(aTitle);
      case "doneFirst":
        return (b.is_done ? 1 : 0) - (a.is_done ? 1 : 0);
      case "notDoneFirst":
        return (a.is_done ? 1 : 0) - (b.is_done ? 1 : 0);
      case "newest":
      default:
        return b.id - a.id;
    }
  });

  sorted.forEach((task) => {
    const { title, description } = splitText(task.text);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${task.id}</td>
      <td>${escHtml(title)}</td>
      <td>${escHtml(description)}</td>
      <td>${task.is_done ? "✅" : "❌"}</td>
      <td>
        <button class="btnTiny edit-btn">Edit</button>
        <button class="btnTiny toggle-btn">${task.is_done ? "Undone" : "Done"}</button>
        <button class="btnTiny delete-btn">Delete</button>
      </td>
    `;

    tr.querySelector(".edit-btn").addEventListener("click", () => startEditTask(task));
    tr.querySelector(".toggle-btn").addEventListener("click", () => toggleDone(task));
    tr.querySelector(".delete-btn").addEventListener("click", () => deleteTask(task.id));

    tasksBody.appendChild(tr);
  });
}

function startEditTask(task) {
  editingTask = task;
  if (!editTaskSection) return;

  const { title, description } = splitText(task.text);
  if (editTaskTitleInput) editTaskTitleInput.value = title;
  if (editTaskDescInput) editTaskDescInput.value = description;

  editTaskSection.style.display = "block";
  editTaskSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", () => {
    editingTask = null;
    if (editTaskSection) editTaskSection.style.display = "none";
  });
}

if (editTaskForm) {
  editTaskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editingTask) return;

    const newTitle = (editTaskTitleInput?.value || "").trim();
    const newDesc = (editTaskDescInput?.value || "").trim();
    if (!newTitle) {
      alert("Title is required");
      return;
    }

    const newText = newDesc ? `${newTitle} - ${newDesc}` : newTitle;

    try {
      const res = await fetch(`${API_BASE}/tasks/${editingTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText, is_done: editingTask.is_done }),
      });

      if (!res.ok) {
        alert(await res.text());
        return;
      }

      editingTask = null;
      if (editTaskSection) editTaskSection.style.display = "none";
      await loadTasks();
    } catch (err) {
      console.error(err);
      alert("Network error while updating task");
    }
  });
}

if (taskForm) {
  taskForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("taskTitle").value.trim();
    const desc = document.getElementById("taskDesc").value.trim();

    if (!title) {
      alert("Title is required");
      return;
    }

    const text = desc ? `${title} - ${desc}` : title;

    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, user_id: userId }),
      });

      if (!res.ok) {
        alert(await res.text());
        return;
      }

      await loadTasks();
      taskForm.reset();
    } catch (err) {
      console.error(err);
      alert("Network error while adding task");
    }
  });
}

async function toggleDone(task) {
  try {
    const newDone = task.is_done ? 0 : 1;
    const res = await fetch(`${API_BASE}/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: task.text, is_done: newDone }),
    });

    if (!res.ok) {
      alert(await res.text());
      return;
    }

    await loadTasks();
  } catch (err) {
    console.error(err);
    alert("Network error while toggling task");
  }
}

async function deleteTask(id) {
  if (!confirm("Delete this task?")) return;

  try {
    const res = await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    await loadTasks();
  } catch (err) {
    console.error(err);
    alert("Network error while deleting task");
  }
}

// Filter buttons
if (taskFilters) {
  taskFilters.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter || "all";
      renderTasks();
    });
  });
}

// Search
if (taskSearchBtn) {
  taskSearchBtn.addEventListener("click", () => {
    currentSearch = (taskSearchInput?.value || "").trim();
    renderTasks();
  });
}

if (taskClearSearchBtn) {
  taskClearSearchBtn.addEventListener("click", () => {
    if (taskSearchInput) taskSearchInput.value = "";
    currentSearch = "";
    renderTasks();
  });
}

// Sort
if (taskSortSelect) {
  taskSortSelect.addEventListener("change", () => {
    currentSort = taskSortSelect.value || "newest";
    renderTasks();
  });
}

// ====================== INITIAL LOAD ======================
loadProfile();
loadIncomingRequests();
loadOutgoingRequests();
loadFriends();
loadTasks();




