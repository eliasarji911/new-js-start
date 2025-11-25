
const userId = localStorage.getItem("userId");
let userName = localStorage.getItem("userName");


if (!userId) {
 
  if (window.location.pathname.includes("user.html")) {
    alert("You must log in first");
    window.location.href = "index.html";
  }
}



const welcomeSpan = document.getElementById("welcomeName");
const currentUserLabel = document.getElementById("currentUserLabel");

if (welcomeSpan) {
  welcomeSpan.textContent = userName ? userName : "User #" + userId;
}
if (currentUserLabel) {
  currentUserLabel.textContent = userName ? userName : "User #" + userId;
}



const updateForm = document.getElementById("updateForm");
const updateResult = document.getElementById("updateResult");

updateForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const current_user_name = document.getElementById("current_user_name").value;
  const current_pass = document.getElementById("current_pass").value;
  const new_user_name = document.getElementById("new_user_name").value;
  const new_pass = document.getElementById("new_pass").value;

  try {
    const res = await fetch("http://localhost:3000/users/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_user_name,
        current_pass,
        new_user_name,
        new_pass
      })
    });

    const text = await res.text();

    if (!res.ok) {
      updateResult.style.color = "red";
      updateResult.textContent = text || "Update failed";
      return;
    }

 
    updateResult.style.color = "green";
    updateResult.textContent = text || "User updated successfully";

   
    userName = new_user_name;
    localStorage.setItem("userName", userName);

    if (welcomeSpan) welcomeSpan.textContent = userName;
    if (currentUserLabel) currentUserLabel.textContent = userName;

   
    document.getElementById("current_pass").value = "";
    document.getElementById("new_pass").value = "";

  } catch (err) {
    console.error(err);
    updateResult.style.color = "red";
    updateResult.textContent = "Network error while updating account";
  }
});



const taskForm = document.getElementById("taskForm");
const tasksBody = document.getElementById("tasksBody");
const tasksMessage = document.getElementById("tasksMessage");


const editTaskSection = document.getElementById("editTaskSection");
const editTaskForm = document.getElementById("editTaskForm");
const editTaskTitleLabel = document.getElementById("editTaskTitle");
const editTaskTitleInput = document.getElementById("editTaskTitleInput");
const editTaskDescInput = document.getElementById("editTaskDescInput");
const cancelEditBtn = document.getElementById("cancelEditBtn");


const filterContainer = document.getElementById("taskFilters");
const taskSearchInput = document.getElementById("taskSearchInput");
const taskSearchBtn = document.getElementById("taskSearchBtn");
const taskClearSearchBtn = document.getElementById("taskClearSearchBtn");
const taskSortSelect = document.getElementById("taskSortSelect");

let tasks = [];              
let editingTask = null;
let currentFilter = "all";   
let currentSearch = "";      
let currentSort = "newest"; 


taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("taskTitle").value.trim();
  const desc  = document.getElementById("taskDesc").value.trim();

  if (!title) {
    alert("Title is required");
    return;
  }

  const text = desc ? `${title} - ${desc}` : title;

  try {
    const res = await fetch("http://localhost:3000/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, user_id: userId })
    });

    if (!res.ok) {
      const msg = await res.text();
      alert("Error adding task: " + msg);
      return;
    }

    taskForm.reset();
    await loadTasks();
  } catch (err) {
    console.error(err);
    alert("Network error while adding task");
  }
});


async function loadTasks() {
  try {
    const res = await fetch(`http://localhost:3000/tasks/user/${userId}`);
    if (!res.ok) {
      const msg = await res.text();
      tasksMessage.textContent = "Error loading tasks: " + msg;
      tasksMessage.style.color = "red";
      return;
    }

    tasks = await res.json();
    renderTasks();
    tasksMessage.textContent = "";
  } catch (err) {
    console.error(err);
    tasksMessage.textContent = "Network error while loading tasks";
    tasksMessage.style.color = "red";
  }
}


function splitText(text) {
  if (!text) return { title: "", description: "" };
  const parts = text.split(" - ");
  if (parts.length === 1) {
    return { title: parts[0], description: "" };
  }
  return { title: parts[0], description: parts.slice(1).join(" - ") };
}


function renderTasks() {
  tasksBody.innerHTML = "";

 
  const filtered = tasks.filter(task => {
    const { title, description } = splitText(task.text);

    let okFilter =
      currentFilter === "all" ||
      (currentFilter === "done" && task.is_done) ||
      (currentFilter === "notDone" && !task.is_done) ||
      (currentFilter === "hasDesc" && description.trim() !== "");

    let okSearch = true;
    if (currentSearch) {
      okSearch = title.toLowerCase().includes(currentSearch.toLowerCase());
    }

    return okFilter && okSearch;
  });

  if (!filtered.length) {
    tasksMessage.textContent = "No tasks for this filter/search.";
    tasksMessage.style.color = "gray";
    return;
  } else {
    tasksMessage.textContent = "";
  }


  const sorted = [...filtered].sort((a, b) => {
    const aSplit = splitText(a.text);
    const bSplit = splitText(b.text);
    const aTitle = aSplit.title.toLowerCase();
    const bTitle = bSplit.title.toLowerCase();

    switch (currentSort) {
      case "oldest": return a.id - b.id;
      case "titleAZ": return aTitle.localeCompare(bTitle);
      case "titleZA": return bTitle.localeCompare(aTitle);
      case "doneFirst": return (b.is_done ? 1 : 0) - (a.is_done ? 1 : 0);
      case "notDoneFirst": return (a.is_done ? 1 : 0) - (b.is_done ? 1 : 0);
      case "newest":
      default: return b.id - a.id;
    }
  });


  sorted.forEach(task => {
    const tr = document.createElement("tr");
    const { title, description } = splitText(task.text);

    tr.innerHTML = `
      <td>${task.id}</td>
      <td>${title}</td>
      <td>${description}</td>
      <td>${task.is_done ? "✅" : "❌"}</td>
      <td>
        <button class="edit-btn">Edit</button>
        <button class="toggle-btn">Toggle Done</button>
        <button class="delete-btn">Delete</button>
      </td>
    `;

    tr.querySelector(".edit-btn").addEventListener("click", () => startEditTask(task));
    tr.querySelector(".toggle-btn").addEventListener("click", () => toggleDone(task));
    tr.querySelector(".delete-btn").addEventListener("click", () => deleteTask(task.id));

    tasksBody.appendChild(tr);
  });
}


if (filterContainer) {
  filterContainer.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter; 
      renderTasks();
    });
  });
}


taskSearchBtn.addEventListener("click", () => {
  currentSearch = taskSearchInput.value.trim();
  renderTasks();
});

taskClearSearchBtn.addEventListener("click", () => {
  currentSearch = "";
  taskSearchInput.value = "";
  renderTasks();
});


if (taskSortSelect) {
  taskSortSelect.addEventListener("change", () => {
    currentSort = taskSortSelect.value;
    renderTasks();
  });
}


function startEditTask(task) {
  editingTask = task;

  const { title, description } = splitText(task.text);

  editTaskTitleLabel.textContent = `Edit task #${task.id}`;
  editTaskTitleInput.value = title;
  editTaskDescInput.value = description;

  editTaskSection.style.display = "block";
}

editTaskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingTask) return;

  const newTitle = editTaskTitleInput.value.trim();
  const newDesc  = editTaskDescInput.value.trim();

  if (!newTitle) {
    alert("Title is required");
    return;
  }

  const newText = newDesc ? `${newTitle} - ${newDesc}` : newTitle;

  try {
    const res = await fetch(`http://localhost:3000/tasks/${editingTask.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText, is_done: editingTask.is_done })
    });

    if (!res.ok) {
      const msg = await res.text();
      alert("Error updating task: " + msg);
      return;
    }

    editTaskSection.style.display = "none";
    editingTask = null;
    await loadTasks();

  } catch (err) {
    console.error(err);
    alert("Network error while updating task");
  }
});


cancelEditBtn.addEventListener("click", () => {
  editingTask = null;
  editTaskSection.style.display = "none";
});


async function toggleDone(task) {
  try {
    const newDone = task.is_done ? 0 : 1;

    const res = await fetch(`http://localhost:3000/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: task.text, is_done: newDone })
    });

    if (!res.ok) {
      const msg = await res.text();
      alert("Error updating task: " + msg);
      return;
    }

    await loadTasks();
  } catch (err) {
    console.error(err);
    alert("Network error while updating task");
  }
}


async function deleteTask(id) {
  if (!confirm("Delete this task?")) return;

  try {
    const res = await fetch(`http://localhost:3000/tasks/${id}`, {
      method: "DELETE"
    });

    if (!res.ok) {
      const msg = await res.text();
      alert("Error deleting task: " + msg);
      return;
    }

    await loadTasks();
  } catch (err) {
    console.error(err);
    alert("Network error while deleting task");
  }
}

// ====================== INITIAL LOAD ======================
loadTasks();







