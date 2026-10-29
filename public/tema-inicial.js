try {
  if (localStorage.getItem("greenstore-tema") === "light") {
    document.documentElement.dataset.theme = "light";
  }
} catch {
  // Tema escuro como padrão.
}