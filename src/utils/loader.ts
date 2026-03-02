export function hideInitialLoader() {
  const loader = document.getElementById('initial-loader');
  if (loader && !loader.classList.contains('fade-out')) {
    loader.classList.add('fade-out');
    setTimeout(() => {
      if (loader.parentNode) loader.remove();
    }, 300);
  }
}
