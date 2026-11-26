const clip = new URL('portrait-turn-hd.mp4', document.baseURI);
const frontalPhase = 1.60538 / 4.042;
const frameTimes = [0.0,0.041,0.082,0.124,0.165,0.206,0.236,0.265,0.294,0.318,0.344,0.371,0.398,0.424,0.449,0.472,0.495,0.523,0.555,0.593,0.635,0.681,0.733,0.778,0.818,0.859,0.903,0.943,0.981,1.02,1.061,1.098,1.13,1.158,1.191,1.23,1.271,1.308,1.344,1.38,1.417,1.447,1.475,1.504,1.534,1.569,1.605,1.639,1.672,1.705,1.746,1.784,1.821,1.86,1.905,1.951,1.992,2.035,2.082,2.124,2.162,2.202,2.247,2.287,2.322,2.357,2.397,2.437,2.475,2.51,2.548,2.59,2.631,2.674,2.723,2.775,2.821,2.87,2.925,2.973,3.017,3.067,3.121,3.168,3.215,3.274,3.333,3.394,3.467,3.539,3.618,3.7,3.772,3.829,3.876,3.918,3.959,4.0];

function phaseAt(x, width) {
  const span = Math.min(580, width * 0.52);
  const p = Math.max(0, Math.min(1, 0.5 + (x - width / 2) / span));
  return p + (frontalPhase - 0.5) * 4 * p * (1 - p);
}

function frameAt(time) {
  let from = 0;
  let to = frameTimes.length - 1;
  while (from < to) {
    const middle = Math.ceil((from + to) / 2);
    if (frameTimes[middle] <= time) from = middle;
    else to = middle - 1;
  }
  return from;
}

function loadPortrait(video) {
  const controller = new AbortController();
  const options = { signal: controller.signal, passive: true };
  let objectURL;
  let target = frontalPhase;
  let position = frontalPhase;
  let displayedFrame = -1;
  let lastTick;
  let animation = 0;
  let active = false;
  let ready = false;

  function seek() {
    if (!ready || video.seeking || !Number.isFinite(video.duration)) return;
    const time = position * video.duration;
    const frame = frameAt(time);
    if (frame === displayedFrame) return;
    const boundary = frameTimes[Math.max(frame, displayedFrame)];
    // Keep tiny pointer noise from flipping between two poses at their boundary.
    if (Math.abs(displayedFrame - frame) === 1 &&
        time > .004 && time < video.duration - .004 &&
        Math.abs(time - boundary) < .004) return;
    displayedFrame = frame;
    // Seek inside each existing exposure. Pointer motion within that exposure
    // never requests another decode of the same frame.
    video.currentTime = Math.min(video.duration - .001, frameTimes[frame] + .003);
  }

  function queue() {
    if (!animation) animation = requestAnimationFrame(step);
  }

  function step(now) {
    animation = 0;
    const dt = lastTick === undefined ? 16 : Math.min(now - lastTick, 50);
    lastTick = now;
    position += (target - position) * (1 - Math.exp(-dt / 70));
    if (Math.abs(target - position) < 0.0008) position = target;
    seek();
    if (active && position !== target) queue();
    else lastTick = undefined;
  }

  function move(event) {
    if (!event.isPrimary) return;
    active = true;
    target = phaseAt(event.clientX, window.innerWidth);
    queue();
  }

  function leave() {
    active = false;
    cancelAnimationFrame(animation);
    animation = 0;
    lastTick = undefined;
    target = position;
  }

  window.addEventListener('pointermove', move, options);
  window.addEventListener('pointerdown', move, options);
  document.documentElement.addEventListener('pointerenter', move, options);
  document.documentElement.addEventListener('pointerleave', leave, options);
  window.addEventListener('blur', leave, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); }, options);
  video.addEventListener('loadedmetadata', () => {
    ready = true;
    displayedFrame = -1;
    queue();
  }, options);
  video.addEventListener('seeked', queue, options);

  async function load() {
    if (clip.protocol === 'file:') {
      video.src = clip.href;
      return;
    }
    try {
      const response = await fetch(clip, { signal: controller.signal });
      if (!response.ok) throw new Error('Video request failed');
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectURL = URL.createObjectURL(blob);
      video.src = objectURL;
    } catch {
      if (!controller.signal.aborted) video.src = clip.href;
    }
  }
  load();
  return () => {
    leave();
    controller.abort();
    if (objectURL) URL.revokeObjectURL(objectURL);
  };
}
