"use strict";

/* ===================================================================== */
/* The tune                                                              */
/*                                                                       */
/* Same rules as main.c, so the page and the WAV generator play the same */
/* notes: each letter picks one of 8 notes (C5 to C6), a space is a      */
/* short rest, other characters are skipped, and a "meow" ends the tune. */
/* ===================================================================== */

const SCALE = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5];
const NOTE_SECONDS = 0.3;
const REST_SECONDS = 0.15;
const MEOW_SECONDS = 0.45;

/** Turn a name into a list of { freq, start, length } notes (freq null = meow). */
function nameToNotes(name) {
    const notes = [];
    let t = 0;
    for (const ch of (name.trim() || "meow").toLowerCase()) {
        if (ch >= "a" && ch <= "z") {
            notes.push({ freq: SCALE[(ch.charCodeAt(0) - 97) % SCALE.length], start: t, length: NOTE_SECONDS });
            t += NOTE_SECONDS;
        } else if (ch === " ") {
            t += REST_SECONDS;
        }
    }
    notes.push({ freq: null, start: t, length: MEOW_SECONDS });
    return notes;
}

/* "Happy Birthday to You" (public domain). [note frequency, beats] */
const G4 = 392, A4 = 440, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99;
const HAPPY_BIRTHDAY = [
    [G4, .75], [G4, .25], [A4, 1], [G4, 1], [C5, 1], [B4, 2],
    [G4, .75], [G4, .25], [A4, 1], [G4, 1], [D5, 1], [C5, 2],
    [G4, .75], [G4, .25], [G5, 1], [E5, 1], [C5, 1], [B4, 1], [A4, 2],
    [F5, .75], [F5, .25], [E5, 1], [C5, 1], [D5, 1], [C5, 3],
];
const BEAT_SECONDS = 0.42;

function birthdayNotes() {
    const notes = [];
    let t = 0;
    for (const [freq, beats] of HAPPY_BIRTHDAY) {
        notes.push({ freq, start: t, length: beats * BEAT_SECONDS * 0.92 });
        t += beats * BEAT_SECONDS;
    }
    notes.push({ freq: null, start: t + 0.1, length: MEOW_SECONDS });
    return notes;
}

/* ===================================================================== */
/* Sound (Web Audio)                                                     */
/* ===================================================================== */

let audio = null;   // created on the first click; browsers block audio before that

function audioContext() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    return audio;
}

/** A soft sine note with a quick attack and a gentle fade. */
function playTone(ctx, freq, at, length) {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.22, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.05, at + length * 0.85);
    gain.gain.linearRampToValueAtTime(0, at + length);
    gain.connect(ctx.destination);

    for (const [mult, level] of [[1, 1], [2, 0.3]]) {    // fundamental + a little 2nd harmonic
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.value = freq * mult;
        g.gain.value = level;
        osc.connect(g).connect(gain);
        osc.start(at);
        osc.stop(at + length);
    }
}

/** "Mee-ow": the pitch rises then falls, and the sound fades out. */
function playMeow(ctx, at, length) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sawtooth";
    filter.type = "lowpass";
    filter.frequency.value = 1800;

    const curve = new Float32Array(32);
    for (let i = 0; i < curve.length; i++) curve[i] = 500 + 300 * Math.sin(Math.PI * i / (curve.length - 1));
    osc.frequency.setValueCurveAtTime(curve, at, length);

    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.18, at + 0.05);
    gain.gain.linearRampToValueAtTime(0, at + length);

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + length);
}

/* The purr is a recording (sounds/purr.wav). A plain Audio element is used
 * rather than Web Audio, because browsers block Web Audio from loading files
 * when the page is opened straight from disk. */
const purrSound = new Audio("sounds/purr.wav");
purrSound.preload = "auto";
const PURR_SECONDS = 2.5;       // how much of the recording one pet plays
const PURR_VOLUME = 0.7;
let purrFade = null;

/** Play the start of the purr, then fade it out. Petting again restarts it. */
function playPurr() {
    clearInterval(purrFade);
    purrSound.currentTime = 0;
    purrSound.volume = PURR_VOLUME;
    purrSound.play().catch(() => {});      // ignore if the file is missing

    const fadeStart = performance.now() + (PURR_SECONDS - 0.6) * 1000;
    purrFade = setInterval(() => {
        const left = 1 - (performance.now() - fadeStart) / 600;
        if (left > 1) return;               // not fading yet
        if (left <= 0) {
            purrSound.pause();
            clearInterval(purrFade);
        } else {
            purrSound.volume = PURR_VOLUME * left;
        }
    }, 40);
}

/**
 * Play a list of notes and animate the cat in time with them.
 * Resolves when the last note has finished.
 */
function perform(notes) {
    const ctx = audioContext();
    const t0 = ctx.currentTime + 0.05;
    for (const n of notes) {
        if (n.freq) playTone(ctx, n.freq, t0 + n.start, n.length);
        else playMeow(ctx, t0 + n.start, n.length);
        setTimeout(() => {
            cat.classList.add("mouth");
            floatFromCat(n.freq ? pick(["♪", "♫", "🎵"]) : "😺");
        }, (n.start + 0.05) * 1000);
        setTimeout(() => cat.classList.remove("mouth"), (n.start + n.length * 0.8 + 0.05) * 1000);
    }
    const last = notes[notes.length - 1];
    return new Promise(resolve => setTimeout(resolve, (last.start + last.length + 0.1) * 1000));
}

/* ===================================================================== */
/* Visual effects                                                        */
/* ===================================================================== */

const COLORS = ["#ff4f8b", "#ffd54f", "#4fc3f7", "#81c784", "#ba68c8", "#ff8a65"];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

/* --- Confetti on a canvas ------------------------------------------- */

const canvas = document.getElementById("confetti");
const paint = canvas.getContext("2d");
let pieces = [];
let animating = false;

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    paint.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function burst(x, y, count) {
    if (reducedMotion) count = Math.min(count, 15);
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 8;
        pieces.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 6,
            spin: Math.random() * Math.PI,
            vspin: (Math.random() - 0.5) * 0.4,
            w: 6 + Math.random() * 6,
            h: 4 + Math.random() * 4,
            color: pick(COLORS),
            life: 1,
        });
    }
    if (!animating) {
        animating = true;
        requestAnimationFrame(stepConfetti);
    }
}

function stepConfetti() {
    paint.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of pieces) {
        p.vy += 0.3;                // gravity
        p.vx *= 0.99;               // air
        p.x += p.vx;
        p.y += p.vy;
        p.spin += p.vspin;
        p.life -= 0.007;
        paint.save();
        paint.globalAlpha = Math.max(p.life, 0);
        paint.translate(p.x, p.y);
        paint.rotate(p.spin);
        paint.fillStyle = p.color;
        paint.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.spin * 2)));
        paint.restore();
    }
    pieces = pieces.filter(p => p.life > 0 && p.y < innerHeight + 40);
    if (pieces.length) requestAnimationFrame(stepConfetti);
    else animating = false;
}

/* --- Floating notes and hearts -------------------------------------- */

function floatFromCat(symbol) {
    const box = cat.getBoundingClientRect();
    const el = document.createElement("span");
    el.className = "float-up";
    el.textContent = symbol;
    el.style.left = `${box.left + box.width * (0.4 + Math.random() * 0.2)}px`;
    el.style.top = `${box.top + box.height * 0.45}px`;
    el.style.setProperty("--dx", `${(Math.random() - 0.5) * 160}px`);
    document.body.append(el);
    el.addEventListener("animationend", () => el.remove());
}

/* --- Balloons drifting up the background ---------------------------- */

function launchBalloon() {
    const el = document.createElement("div");
    const color = pick(COLORS);
    el.className = "balloon";
    el.style.left = `${Math.random() * 95}%`;
    el.style.background = color;
    el.style.setProperty("--color", color);
    el.style.setProperty("--drift", `${(Math.random() - 0.5) * 200}px`);
    el.style.animationDuration = `${9 + Math.random() * 7}s`;
    document.getElementById("balloons").append(el);
    el.addEventListener("animationend", () => el.remove());
}

/* ===================================================================== */
/* Page state                                                            */
/* ===================================================================== */

const cat = document.getElementById("cat");
const singBtn = document.getElementById("sing");
const nameInput = document.getElementById("name");
const title = document.getElementById("title");
const meter = document.querySelector(".meter");
const meterFill = document.getElementById("meter-fill");
const mood = document.getElementById("mood");
const cake = document.getElementById("cake");
const candles = document.getElementById("candles");

const MOODS = [
    [0, "Grumpy — sing to cheer them up"],
    [1, "A little happier…"],
    [50, "Happy!"],
    [75, "Very happy!"],
    [100, "Ecstatic! Blow out the candles 🎂"],
];

let happiness = 0;
let singing = false;
let finaleDone = false;

function setHappiness(value) {
    happiness = Math.max(0, Math.min(100, value));
    meterFill.style.width = `${happiness}%`;
    meter.setAttribute("aria-valuenow", happiness);
    document.documentElement.style.setProperty("--blush", happiness / 100);
    if (!candles.classList.contains("out")) {
        mood.textContent = MOODS.filter(([min]) => happiness >= min).pop()[1];
    }
}

function setName(name) {
    title.textContent = name ? `Happy Birthday, ${name}!` : "Happy Birthday!";
    document.title = name ? `Birthday Cat for ${name}` : "Birthday Cat";
    try {                               // keep the name in the link so it can be shared
        const url = new URL(location.href);
        if (name) url.searchParams.set("name", name);
        else url.searchParams.delete("name");
        history.replaceState(null, "", url);
    } catch {
        /* some browsers block this for local files; the page works anyway */
    }
}

function catCentre() {
    const box = cat.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height * 0.4];
}

/* ===================================================================== */
/* Actions                                                               */
/* ===================================================================== */

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Run one song at a time: the button is disabled and the cat dances until it ends. */
async function performing(song) {
    if (singing) return;
    singing = true;
    singBtn.disabled = true;
    cat.classList.add("singing");
    await song();
    cat.classList.remove("singing");
    singBtn.disabled = false;
    singing = false;
}

/** At 100% happiness: bring out the cake and sing Happy Birthday, once. */
async function celebrate() {
    finaleDone = true;
    cake.hidden = false;
    await wait(600);
    await perform(birthdayNotes());
}

function sing() {
    performing(async () => {
        cat.classList.remove("pop");
        void cat.offsetWidth;           // restart the pop animation
        cat.classList.add("pop");
        burst(...catCentre(), 60);

        await perform(nameToNotes(nameInput.value));
        setHappiness(happiness + 25);
        if (happiness === 100 && !finaleDone) await celebrate();
    });
}

function pet() {
    playPurr();
    cat.classList.add("purring");
    clearTimeout(pet.timer);
    pet.timer = setTimeout(() => cat.classList.remove("purring"), PURR_SECONDS * 1000);
    for (let i = 0; i < 3; i++) setTimeout(() => floatFromCat("💖"), i * 150);
    setHappiness(happiness + 5);
    if (happiness === 100 && !finaleDone && !singing) performing(celebrate);
}

function blowOutCandles() {
    if (candles.classList.contains("out")) return;
    candles.classList.add("out");
    mood.textContent = "Make a wish! 🎉";
    const [x, y] = catCentre();
    burst(x, y, 150);
    setTimeout(() => burst(innerWidth * 0.2, innerHeight * 0.3, 80), 250);
    setTimeout(() => burst(innerWidth * 0.8, innerHeight * 0.3, 80), 450);
    for (let i = 0; i < 6; i++) setTimeout(launchBalloon, i * 120);
}

/* ===================================================================== */
/* Start                                                                 */
/* ===================================================================== */

singBtn.addEventListener("click", sing);
cat.addEventListener("click", pet);
candles.addEventListener("click", blowOutCandles);
nameInput.addEventListener("input", () => setName(nameInput.value.trim()));
nameInput.addEventListener("keydown", e => { if (e.key === "Enter") sing(); });
window.addEventListener("resize", resizeCanvas);

const startName = new URLSearchParams(location.search).get("name") || "";
nameInput.value = startName;
setName(startName.trim());
setHappiness(0);
resizeCanvas();

if (!reducedMotion) {
    for (let i = 0; i < 4; i++) setTimeout(launchBalloon, i * 700);
    setInterval(launchBalloon, 2200);
}
