window.addEventListener("DOMContentLoaded", () => {
  const card = document.getElementById("card");
  if (card) requestAnimationFrame(() => card.classList.add("show"));
});
