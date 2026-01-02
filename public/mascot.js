document.addEventListener("DOMContentLoaded", () => {
  const face = document.getElementById("face");
  const p1 = document.getElementById("p1");
  const p2 = document.getElementById("p2");

  const userInput = document.getElementById("user_name");
  const passInput = document.getElementById("pass");

  if (!face || !p1 || !p2) return;

  function mood(name){
    face.classList.remove("neutral", "smile", "worried");
    face.classList.add(name);
  }

  mood("neutral");

  // Eyes follow mouse (unless hiding eyes)
  window.addEventListener("mousemove", (e) => {
    if (face.classList.contains("hide-eyes")) return;

    const rect = face.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    const max = 6;
    const x = Math.max(-max, Math.min(max, dx / 40));
    const y = Math.max(-max, Math.min(max, dy / 40));

    p1.style.transform = `translate(${x}px, ${y}px)`;
    p2.style.transform = `translate(${x}px, ${y}px)`;
  });

  // Blink loop
  function blink(){
    face.classList.add("blink");
    setTimeout(() => face.classList.remove("blink"), 140);
    const next = 2200 + Math.random() * 3600;
    setTimeout(blink, next);
  }
  setTimeout(blink, 1200);

  // Username focus = smile
  if (userInput) {
    userInput.addEventListener("focus", () => {
      face.classList.remove("hide-eyes");
      mood("smile");
    });
    userInput.addEventListener("blur", () => {
      if (!passInput || document.activeElement !== passInput) mood("neutral");
    });
  }

  // Password focus = cover eyes
  if (passInput) {
    passInput.addEventListener("focus", () => {
      face.classList.add("hide-eyes");
      mood("neutral");
    });
    passInput.addEventListener("blur", () => {
      face.classList.remove("hide-eyes");
      mood("neutral");
    });
  }

  // Simple API for login/register scripts
  window.mascotUI = {
    errorShake(){
      face.classList.add("shake");
      mood("worried");
      setTimeout(() => face.classList.remove("shake"), 380);
      setTimeout(() => mood("neutral"), 900);
    }
  };
});
