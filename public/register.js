

const registerForm = document.getElementById("registerForm");
const resultP = document.getElementById("result");
const goLoginBtn = document.getElementById("goLoginBtn");

goLoginBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});


registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user_name = document.getElementById("user_name").value;
  const pass = document.getElementById("pass").value;
  const emIL = document.getElementById("emIL").value;
  const name = document.getElementById("name").value;

  const body = { user_name, pass, emIL, name };

  try {
    const res = await fetch("http://localhost:3000/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    resultP.innerText = text;
  } catch (err) {
    console.error("Register error:", err);
    resultP.innerText = "Error registering user";
  }
});




