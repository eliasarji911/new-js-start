// login.js

const loginForm = document.getElementById("loginForm");
const resultP = document.getElementById("result");

function showResult(msg, ok) {
  if (!resultP) return;

  resultP.classList.remove("success", "error", "show");
  resultP.textContent = msg;
  resultP.classList.add(ok ? "success" : "error");
  requestAnimationFrame(() => resultP.classList.add("show"));
}

async function withLoading(btn, fn) {
  btn.disabled = true;
  btn.classList.add("loading");
  try {
    return await fn();
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user_name = document.getElementById("user_name").value.trim();
  const pass = document.getElementById("pass").value.trim();

  const btn = loginForm.querySelector('button[type="submit"]');

  await withLoading(btn, async () => {
    try {
      const res = await fetchWithTimeout(
        "http://localhost:3000/users/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_name, pass }),
        },
        8000
      );

      const isJson = (res.headers.get("content-type") || "").includes("application/json");

      // Try to read server response safely (json or text)
      let data = null;
      let text = "";
      if (isJson) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      } else {
        text = await res.text();
      }

      if (!res.ok) {
        const msg = (data && data.message) ? data.message : (text || "Login failed");
        showResult(`${res.status}: ${msg}`, false);
        if (window.mascotUI) window.mascotUI.errorShake();
        return;
      }

      // ✅ Success: store the SAME keys that user.js uses
      // Clear previous session keys first
      localStorage.removeItem("userId");
      localStorage.removeItem("userName");
      localStorage.removeItem("user_name"); // legacy key you used before

      const userId = data?.id;
      const userName = data?.user_name;

      // Validate response shape
      if (!userId || !userName) {
        showResult("Login succeeded but server response is missing id/user_name", false);
        if (window.mascotUI) window.mascotUI.errorShake();
        return;
      }

      localStorage.setItem("userId", String(userId));
      localStorage.setItem("userName", String(userName));

      // (Optional) keep the old key too, harmless:
      localStorage.setItem("user_name", String(userName));

      showResult("Login successful", true);

      // ✅ Redirect
      window.location.href = "user.html";
    } catch (err) {
      const msg =
        err.name === "AbortError"
          ? "Request timed out (server didn’t respond)."
          : "Network error (server not running or blocked).";

      showResult(msg, false);
      if (window.mascotUI) window.mascotUI.errorShake();
    }
  });
});




