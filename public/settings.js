// public/settings.js
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

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function defaultAvatar(label="?"){
  const ch=(label||"?").trim().charAt(0).toUpperCase()||"?";
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" rx="22" ry="22" fill="#0f172a"/><text x="50%" y="54%" font-size="64" text-anchor="middle" fill="#e2e8f0" font-family="Arial" dominant-baseline="middle">${esc(ch)}</text></svg>`
  );
}
function photo(p,label){ if(!p) return defaultAvatar(label); if(String(p).startsWith("/")) return p; return String(p); }
async function safeJson(res){ const ct=res.headers.get("content-type")||""; if(ct.includes("application/json")){ try{return await res.json();}catch{return null;} } return null; }

const profileImg = document.getElementById("profileImg");
const photoForm = document.getElementById("photoForm");
const photoInput = document.getElementById("photoInput");
const photoStatus = document.getElementById("photoStatus");

async function loadProfile(){
  try{
    const res = await fetch(`${API_BASE}/users/profile/${userId}`);
    if(!res.ok){ profileImg.src = defaultAvatar(userName); return; }
    const data = await res.json();
    profileImg.src = photo(data.profile_photo, data.user_name || userName);
  }catch{
    profileImg.src = defaultAvatar(userName);
  }
}

photoForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!photoInput.files?.[0]){ photoStatus.textContent="Choose a file first"; return; }
  const fd = new FormData();
  fd.append("photo", photoInput.files[0]);

  photoStatus.textContent="Uploading...";
  const res = await fetch(`${API_BASE}/users/${userId}/photo`, { method:"PUT", body: fd });
  const data = await safeJson(res);
  if(!res.ok){ photoStatus.textContent = data?.message || "Upload failed"; return; }

  photoStatus.textContent="Updated ✅";
  profileImg.src = photo(data.profile_photo, userName);
  photoInput.value="";
});

const updateForm = document.getElementById("updateForm");
const updateResult = document.getElementById("updateResult");

updateForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const current_user_name = document.getElementById("current_user_name").value.trim();
  const current_pass = document.getElementById("current_pass").value.trim();
  const new_user_name = document.getElementById("new_user_name").value.trim();
  const new_pass = document.getElementById("new_pass").value.trim();

  const res = await fetch(`${API_BASE}/users/update`,{
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ current_user_name, current_pass, new_user_name, new_pass })
  });

  const text = await res.text();
  if(!res.ok){ updateResult.textContent = "Error: " + text; return; }

  updateResult.textContent = text;
  localStorage.setItem("userName", new_user_name);
  localStorage.setItem("user_name", new_user_name);
  document.getElementById("meLabel").textContent = new_user_name;
});

loadProfile();
