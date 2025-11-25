// login.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("login.js loaded");

  const loginForm = document.getElementById("loginForm");
  const signupBtn = document.getElementById("goToSignup");

  console.log("loginForm =", loginForm);
  console.log("signupBtn =", signupBtn);

  // If we can't find the form, nothing will work
  if (!loginForm) {
    console.error("loginForm not found in index.html");
    return;
  }

  // ---- LOGIN HANDLER ----
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Login form submitted");

    const user_name = document.getElementById("loginUserName").value;
    const pass = document.getElementById("loginPass").value;

    console.log("Sending login request:", { user_name, pass });

    try {
      const res = await fetch("http://localhost:3000/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name, pass })
      });

      const data = await res.json().catch(() => ({}));
      console.log("Login response:", res.status, data);

      if (!res.ok) {
        alert(data.message || "Login failed");
        return;
      }

      // Save user info for user.html
      localStorage.setItem("userId", data.id);
      localStorage.setItem("userName", data.user_name);

      console.log("Saved to localStorage:", {
        userId: data.id,
        userName: data.user_name
      });

      // Go to user page
      window.location.href = "user.html";
    } catch (err) {
      console.error("Login error:", err);
      alert("Network error");
    }
  });

  // ---- SIGNUP BUTTON ----
  if (signupBtn) {
    signupBtn.addEventListener("click", () => {
      window.location.href = "register.html"; // or whatever your signup page is
    });
  }
});




