# Birthday Cat

This is a birthday web page with a singing cat. Type someone's name and press **Sing!** The cat sings a tune made from the letters of that name, dances, and throws confetti. Each song makes it happier. At 100 % happiness a cake appears, the cat sings *Happy Birthday*, and you can click the candles to blow them out.

The cat is drawn in SVG and the music is synthesised in the browser with the Web Audio API. The only sound file is the cat's purr. A small C program, `nametune`, can save any name's tune as a WAV file.

## How it works

- **Name → tune.** Each letter picks one of eight notes from C5 to C6, using `(letter − 'a') % 8`. A space is a short rest and anything else is skipped. Every tune ends with a "mee-ow". The same name always gives the same tune.
- **Sing!** The cat plays the tune, dances, wags its tail faster and opens its mouth on each note. Music notes float up, and the happiness meter rises by 25 %.
- **Pet the cat.** Clicking the cat plays a purr, makes it close its eyes and sends up hearts (+5 % happiness).
- **Happiness.** The cat's cheeks blush more as the meter fills. The mood line moves from *Grumpy* to *Ecstatic!*
- **Celebration.** At 100 % a cake slides in and the cat sings *Happy Birthday* (public domain). Clicking the candles blows them out, with a big confetti burst and a wave of balloons.
- **Shareable link.** The name is kept in the address (`index.html?name=Sam`), so you can send someone a link with their name already filled in.

## Usage

Open `index.html` in a browser. No build step or server is needed. Double-click it, or from a terminal:

```
xdg-open index.html        # Linux
open index.html            # macOS
start index.html           # Windows
```

To pre-fill a name, add it to the link:

```
index.html?name=Sam
```

| Input | Action |
|---|---|
| **Sing!** button, or `Enter` in the name box | Sing the name's tune |
| Click the cat | Pet it |
| Click the candles | Blow them out (once the cake has appeared) |

Animations are turned down when the system's *reduce motion* setting is on.

## Saving a tune as a WAV file

`main.c` builds `nametune`, which uses the same notes as the page and saves the tune as a WAV file (44.1 kHz, mono, 16-bit).

```
make
./nametune "Sam Lee"              # saves tune.wav
./nametune "Sam Lee" sam.wav      # choose the file name
```

Requires a C compiler and the maths library. `make clean` removes `nametune` and `tune.wav`.

## Files

| File | Purpose |
|---|---|
| `index.html` | The page, including the SVG cat and the cake |
| `styles.css` | Layout and every animation: blink, wag, dance, hat bob, candles, balloons, meter stripes |
| `app.js` | The tune rules, Web Audio synthesis (notes, meow), the purr playback, canvas confetti, and the page logic |
| `main.c` | `nametune`, the WAV generator |
| `makefile` | Builds `nametune` |
| `sounds/purr.wav` | The purr recording, by Universfield on [Pixabay](https://pixabay.com/) |
