// public/contacts.js
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

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchResult = document.getElementById("searchResult");
const searchStatus = document.getElementById("searchStatus");

const incomingList = document.getElementById("incomingList");
const outgoingList = document.getElementById("outgoingList");
const friendsList = document.getElementById("friendsList");

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function defaultAvatar(label="?"){
  const ch=(label||"?").trim().charAt(0).toUpperCase()||"?";
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" rx="18" ry="18" fill="#0f172a"/><text x="50%" y="54%" font-size="52" text-anchor="middle" fill="#e2e8f0" font-family="Arial" dominant-baseline="middle">${esc(ch)}</text></svg>`
  );
}
function photo(p, label){ if(!p) return defaultAvatar(label); if(String(p).startsWith("/")) return p; return String(p); }
async function safeJson(res){ const ct=res.headers.get("content-type")||""; if(ct.includes("application/json")){ try{return await res.json();}catch{return null;} } return null; }

let lastUser = null;

function renderSearch(u){
  if(!u){ searchResult.innerHTML=""; return; }
  const isMe = Number(u.id) === Number(userId);
  searchResult.innerHTML = `
    <div class="miniRow">
      <img class="miniAvatar" src="${esc(photo(u.profile_photo, u.user_name))}" />
      <div>
        <div><strong>${esc(u.user_name)}</strong></div>
        <div class="muted small">${esc(u.name||"")}</div>
      </div>
      <button id="sendReqBtn" class="btnTiny" ${isMe?"disabled":""}>${isMe?"You":"Send request"}</button>
    </div>
  `;
  if(!isMe){
    document.getElementById("sendReqBtn").onclick = sendRequest;
  }
}

async function searchUser(){
  const q = (searchInput.value||"").trim();
  lastUser = null;
  renderSearch(null);
  searchStatus.textContent = "";
  if(!q){ searchStatus.textContent="Type a username."; return; }

  const res = await fetch(`${API_BASE}/users/search?user_name=${encodeURIComponent(q)}`);
  const data = await safeJson(res);
  if(!res.ok){ searchStatus.textContent = data?.message || "User not found"; return; }
  lastUser = data;
  renderSearch(data);
}

async function sendRequest(){
  if(!lastUser) return;
  searchStatus.textContent="Sending...";
  const res = await fetch(`${API_BASE}/friends/request`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({from_user_id:Number(userId), to_user_id:Number(lastUser.id)})
  });
  const data = await safeJson(res);
  if(!res.ok){ searchStatus.textContent = data?.message || "Failed"; return; }
  searchStatus.textContent="Request sent ✅";
  loadOutgoing();
}

searchBtn.onclick = searchUser;
searchInput.addEventListener("keydown", e => { if(e.key==="Enter") searchUser(); });

function reqRow(u, actionsHtml){
  return `
    <div class="miniRow">
      <img class="miniAvatar" src="${esc(photo(u.profile_photo, u.user_name))}" />
      <div style="flex:1">
        <div><strong>${esc(u.user_name)}</strong></div>
        <div class="muted small">${esc(u.name||"")}</div>
      </div>
      <div class="row">${actionsHtml}</div>
    </div>
  `;
}

async function loadIncoming(){
  const res = await fetch(`${API_BASE}/friends/requests/incoming/${userId}`);
  const data = await safeJson(res);
  if(!res.ok){ incomingList.innerHTML=`<div class="muted small">Error</div>`; return; }
  if(!data?.length){ incomingList.innerHTML=`<div class="muted small">No incoming</div>`; return; }

  incomingList.innerHTML = data.map(r => reqRow(r, `
    <button class="btnTiny" data-a="acc" data-id="${r.id}">Accept</button>
    <button class="btnTiny" data-a="rej" data-id="${r.id}">Reject</button>
  `)).join("");

  incomingList.querySelectorAll("button").forEach(b=>{
    b.onclick = () => {
      const id=b.dataset.id;
      if(b.dataset.a==="acc") acceptReq(id);
      else rejectReq(id);
    };
  });
}

async function loadOutgoing(){
  const res = await fetch(`${API_BASE}/friends/requests/outgoing/${userId}`);
  const data = await safeJson(res);
  if(!res.ok){ outgoingList.innerHTML=`<div class="muted small">Error</div>`; return; }
  if(!data?.length){ outgoingList.innerHTML=`<div class="muted small">No outgoing</div>`; return; }

  outgoingList.innerHTML = data.map(r => reqRow(r, `
    <button class="btnTiny" data-id="${r.id}">Cancel</button>
  `)).join("");

  outgoingList.querySelectorAll("button").forEach(b=>{
    b.onclick = ()=> cancelReq(b.dataset.id);
  });
}

async function acceptReq(id){
  const res = await fetch(`${API_BASE}/friends/requests/${id}/accept`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({user_id:Number(userId)})
  });
  const data = await safeJson(res);
  if(!res.ok) return alert(data?.message || "Error");
  loadIncoming(); loadFriends();
}

async function rejectReq(id){
  const res = await fetch(`${API_BASE}/friends/requests/${id}/reject`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({user_id:Number(userId)})
  });
  const data = await safeJson(res);
  if(!res.ok) return alert(data?.message || "Error");
  loadIncoming();
}

async function cancelReq(id){
  const res = await fetch(`${API_BASE}/friends/requests/${id}/cancel`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({user_id:Number(userId)})
  });
  const data = await safeJson(res);
  if(!res.ok) return alert(data?.message || "Error");
  loadOutgoing();
}

async function loadFriends(){
  const res = await fetch(`${API_BASE}/friends/list/${userId}`);
  const data = await safeJson(res);
  if(!res.ok){ friendsList.innerHTML=`<div class="muted small">Error</div>`; return; }
  if(!data?.length){ friendsList.innerHTML=`<div class="muted small">No friends yet</div>`; return; }

  friendsList.innerHTML = data.map(f=>`
    <button class="friendBtn" data-id="${f.id}">
      <img class="miniAvatar" src="${esc(photo(f.profile_photo, f.user_name))}" />
      <div style="text-align:left">
        <div><strong>${esc(f.user_name)}</strong></div>
        <div class="muted small">${esc(f.name||"")}</div>
      </div>
    </button>
  `).join("");

  friendsList.querySelectorAll(".friendBtn").forEach(btn=>{
    btn.onclick = ()=> {
      const id = btn.dataset.id;
      window.location.href = `messages.html?friend_id=${encodeURIComponent(id)}`;
    };
  });
}

loadIncoming();
loadOutgoing();
loadFriends();

