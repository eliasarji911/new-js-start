// register.js

const registerForm = document.getElementById("registerForm");
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

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const emIL = document.getElementById("emIL").value.trim(); // keep emIL if your DB column is emIL
  const user_name = document.getElementById("user_name").value.trim();
  const pass = document.getElementById("pass").value.trim();

  const btn = registerForm.querySelector('button[type="submit"]');

  await withLoading(btn, async () => {
    try {
      const res = await fetchWithTimeout(
        "http://localhost:3000/users/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, emIL, user_name, pass }),
        },
        8000
      );

      const text = await res.text();
      showResult(`${res.status}: ${text}`, res.ok);

      if (res.ok) {
        // ✅ After successful signup, go back to login page
        setTimeout(() => {
          window.location.href = "index.html";
        }, 600);
        return;
      }

      if (window.mascotUI) window.mascotUI.errorShake();
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






