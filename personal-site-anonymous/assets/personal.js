const portrait = document.querySelector('.portrait-motion');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let stopPortrait;

function syncMotion() {
  if (preference.matches) {
    stopPortrait?.();
    stopPortrait = undefined;
    portrait.removeAttribute('src');
    portrait.load();
    portrait.classList.remove('is-ready');
  } else if (!stopPortrait) {
    stopPortrait = loadPortrait(portrait);
  }
}

portrait.addEventListener('seeked', () => {
  if (!preference.matches && portrait.readyState >= 2) {
    portrait.classList.add('is-ready');
  }
});
preference.addEventListener('change', syncMotion);
syncMotion();
