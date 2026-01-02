// public/todo.js
const API_BASE = "";

const userId = localStorage.getItem("userId");
const userName = localStorage.getItem("userName") || localStorage.getItem("user_name") || "";
if (!userId) window.location.href = "login.html";

document.getElementById("meLabel").textContent = userName || "—";
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("userId");
  localStorage.removeItem("userName");
  localStorage.removeItem("user_name");
  window.location.href = "login.html";
});

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

function esc(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

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
      tasksMessage.textContent = "Error loading tasks: " + (await res.text());
      return;
    }
    tasks = await res.json();
    renderTasks();
    tasksMessage.textContent = "";
  } catch {
    tasksMessage.textContent = "Network error while loading tasks.";
  }
}

function renderTasks() {
  tasksBody.innerHTML = "";

  const filtered = tasks.filter(t => {
    const { title, description } = splitText(t.text);
    const okFilter =
      currentFilter === "all" ||
      (currentFilter === "done" && !!t.is_done) ||
      (currentFilter === "notDone" && !t.is_done) ||
      (currentFilter === "hasDesc" && description.trim() !== "");
    const okSearch = !currentSearch || title.toLowerCase().includes(currentSearch.toLowerCase());
    return okFilter && okSearch;
  });

  if (!filtered.length) {
    tasksMessage.textContent = "No tasks for this filter/search.";
    return;
  }

  const sorted = [...filtered].sort((a,b) => {
    const aT = splitText(a.text).title.toLowerCase();
    const bT = splitText(b.text).title.toLowerCase();
    switch (currentSort) {
      case "oldest": return a.id - b.id;
      case "titleAZ": return aT.localeCompare(bT);
      case "titleZA": return bT.localeCompare(aT);
      case "doneFirst": return (b.is_done?1:0) - (a.is_done?1:0);
      case "notDoneFirst": return (a.is_done?1:0) - (b.is_done?1:0);
      case "newest":
      default: return b.id - a.id;
    }
  });

  for (const t of sorted) {
    const { title, description } = splitText(t.text);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.id}</td>
      <td>${esc(title)}</td>
      <td>${esc(description)}</td>
      <td>${t.is_done ? "✅" : "❌"}</td>
      <td>
        <button class="btnTiny edit">Edit</button>
        <button class="btnTiny toggle">${t.is_done ? "Undone" : "Done"}</button>
        <button class="btnTiny del">Delete</button>
      </td>
    `;

    tr.querySelector(".edit").onclick = () => startEdit(t);
    tr.querySelector(".toggle").onclick = () => toggleDone(t);
    tr.querySelector(".del").onclick = () => deleteTask(t.id);

    tasksBody.appendChild(tr);
  }
}

function startEdit(t) {
  editingTask = t;
  const { title, description } = splitText(t.text);
  editTaskTitleInput.value = title;
  editTaskDescInput.value = description;
  editTaskSection.style.display = "block";
  editTaskSection.scrollIntoView({ behavior: "smooth" });
}

cancelEditBtn.onclick = () => {
  editingTask = null;
  editTaskSection.style.display = "none";
};

editTaskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingTask) return;
  const newTitle = editTaskTitleInput.value.trim();
  const newDesc = editTaskDescInput.value.trim();
  if (!newTitle) return alert("Title is required");

  const newText = newDesc ? `${newTitle} - ${newDesc}` : newTitle;

  const res = await fetch(`${API_BASE}/tasks/${editingTask.id}`, {
    method: "PUT",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ text: newText, is_done: editingTask.is_done })
  });
  if (!res.ok) return alert(await res.text());

  editingTask = null;
  editTaskSection.style.display = "none";
  loadTasks();
});

taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("taskTitle").value.trim();
  const desc = document.getElementById("taskDesc").value.trim();
  if (!title) return alert("Title is required");
  const text = desc ? `${title} - ${desc}` : title;

  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ text, user_id: userId })
  });
  if (!res.ok) return alert(await res.text());

  taskForm.reset();
  loadTasks();
});

async function toggleDone(t) {
  const res = await fetch(`${API_BASE}/tasks/${t.id}`, {
    method: "PUT",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ text: t.text, is_done: t.is_done ? 0 : 1 })
  });
  if (!res.ok) return alert(await res.text());
  loadTasks();
}

async function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  const res = await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
  if (!res.ok) return alert(await res.text());
  loadTasks();
}

taskFilters.querySelectorAll("button").forEach(btn => {
  btn.onclick = () => { currentFilter = btn.dataset.filter || "all"; renderTasks(); };
});

taskSearchBtn.onclick = () => { currentSearch = taskSearchInput.value.trim(); renderTasks(); };
taskClearSearchBtn.onclick = () => { taskSearchInput.value = ""; currentSearch = ""; renderTasks(); };

taskSortSelect.onchange = () => { currentSort = taskSortSelect.value || "newest"; renderTasks(); };

loadTasks();

