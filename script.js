(function(){
  const TOTAL = 300; // seconds
  const FADE = 5;   // seconds
  const playBtn = document.getElementById('playBtn');
  const icon = document.getElementById('icon');
  const timeEl = document.getElementById('time');
  const subEl = document.getElementById('sub');
  const ring = document.getElementById('ring');
  const CIRC = 2 * Math.PI * 112;
  ring.setAttribute('stroke-dasharray', CIRC.toFixed(1));
  ring.setAttribute('stroke-dashoffset', CIRC.toFixed(1));

  let ctx, master, rainGain, rainSource, filterA, filterB;
  let running = false, startTime = 0, rafId = null, endTimer = null;

  const iconPause = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
  const iconPlay = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

  function fmt(s){
    s = Math.max(0, Math.ceil(s));
    const m = Math.floor(s/60), r = s%60;
    return m + ':' + String(r).padStart(2,'0');
  }

  function makeNoiseBuffer(seconds){
    const rate = ctx.sampleRate;
    const buf = ctx.createBuffer(1, rate*seconds, rate);
    const data = buf.getChannelData(0);
    let lastOut = 0;
    for(let i=0;i<data.length;i++){
      const white = Math.random()*2-1;
      // brown-ish base for body
      lastOut = (lastOut + 0.02*white) / 1.02;
      data[i] = lastOut * 3.2;
    }
    return buf;
  }

  function playBong(atTime, gainVal){
    const partials = [1, 2.01, 3.2, 4.8];
    const amps = [1, 0.5, 0.28, 0.14];
    const bongGain = ctx.createGain();
    bongGain.gain.setValueAtTime(0.0001, atTime);
    bongGain.connect(master);
    partials.forEach((p, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 220 * p;
      const g = ctx.createGain();
      const peak = gainVal * amps[i];
      g.gain.setValueAtTime(0.0001, atTime);
      g.gain.exponentialRampToValueAtTime(peak, atTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, atTime + 3.6);
      osc.connect(g).connect(bongGain);
      osc.start(atTime);
      osc.stop(atTime + 3.8);
    });
    bongGain.gain.setValueAtTime(1, atTime);
  }

  function startRain(atTime){
    rainSource = ctx.createBufferSource();
    rainSource.buffer = makeNoiseBuffer(6);
    rainSource.loop = true;

    filterA = ctx.createBiquadFilter();
    filterA.type = 'highpass';
    filterA.frequency.value = 500;

    filterB = ctx.createBiquadFilter();
    filterB.type = 'lowpass';
    filterB.frequency.value = 6500;

    rainGain = ctx.createGain();
    rainGain.gain.setValueAtTime(0.0001, atTime);

    rainSource.connect(filterA).connect(filterB).connect(rainGain).connect(master);
    rainSource.start(atTime);

    // fade in over FADE seconds
    rainGain.gain.linearRampToValueAtTime(0.0001, atTime);
    rainGain.gain.exponentialRampToValueAtTime(0.9, atTime + FADE);
    // hold, then fade out at the end
    const fadeOutStart = atTime + (TOTAL - FADE);
    rainGain.gain.setValueAtTime(0.9, fadeOutStart);
    rainGain.gain.exponentialRampToValueAtTime(0.0001, atTime + TOTAL);
  }

  function tick(){
    const elapsed = ctx.currentTime - startTime;
    const remaining = TOTAL - elapsed;
    if(remaining <= 0){
      timeEl.textContent = '0:00';
      ring.setAttribute('stroke-dashoffset', '0');
      finish();
      return;
    }
    timeEl.textContent = fmt(remaining);
    const progress = elapsed / TOTAL;
    ring.setAttribute('stroke-dashoffset', (CIRC * (1-progress)).toFixed(1));
    if(elapsed < FADE) subEl.textContent = 'settling in';
    else if(remaining < FADE) subEl.textContent = 'letting go';
    else subEl.textContent = 'breathe';
    rafId = requestAnimationFrame(tick);
  }

  function finish(){
    running = false;
    icon.innerHTML = iconPlay;
    playBtn.setAttribute('aria-label','Start meditation');
    subEl.textContent = 'session complete';
    if(rafId) cancelAnimationFrame(rafId);
    setTimeout(()=>{
      timeEl.textContent = '5:00';
      ring.setAttribute('stroke-dashoffset', CIRC.toFixed(1));
      subEl.textContent = 'press play';
    }, 2600);
  }

  function stop(){
    running = false;
    if(rafId) cancelAnimationFrame(rafId);
    if(endTimer) clearTimeout(endTimer);
    const now = ctx ? ctx.currentTime : 0;
    if(rainGain){
      rainGain.gain.cancelScheduledValues(now);
      rainGain.gain.setValueAtTime(rainGain.gain.value, now);
      rainGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    }
    if(rainSource){
      try{ rainSource.stop(now + 0.7); }catch(e){}
    }
    icon.innerHTML = iconPlay;
    playBtn.setAttribute('aria-label','Start meditation');
    timeEl.textContent = '5:00';
    ring.setAttribute('stroke-dashoffset', CIRC.toFixed(1));
    subEl.textContent = 'press play';
  }

  async function start(){
    if(!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
    }
    if(ctx.state === 'suspended') await ctx.resume();

    running = true;
    icon.innerHTML = iconPause;
    playBtn.setAttribute('aria-label','Stop meditation');
    subEl.textContent = 'beginning';

    const now = ctx.currentTime + 0.05;
    startTime = now;
    playBong(now, 0.55);
    startRain(now + 0.5);
    endTimer = setTimeout(()=>{ if(running) playBong(ctx.currentTime, 0.55); }, (TOTAL-0.1)*1000);
    rafId = requestAnimationFrame(tick);
  }

  playBtn.addEventListener('click', () => {
    if(running) stop(); else start();
  });
})();
