/*
 * nametune: turn a name into a short tune and save it as a WAV file.
 *
 *   ./nametune "Sam" [sam.wav]
 *
 * Uses the same rules as the web page (app.js), so both play the same notes:
 *   - each letter picks one of 8 notes from C5 to C6, (letter - 'a') % 8
 *   - a space is a short rest, anything else is skipped
 *   - the tune ends with a "mee-ow" whose pitch rises and falls
 */
#include <ctype.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define SAMPLE_RATE 44100
#define NOTE_SECONDS 0.3
#define REST_SECONDS 0.15
#define MEOW_SECONDS 0.45
#define VOLUME 0.25
#define PI 3.14159265358979323846

static const double SCALE[] = {523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50};
#define SCALE_SIZE (sizeof SCALE / sizeof SCALE[0])

/* Quick 10 ms fade-in, gentle decay, and a 20 ms fade-out so notes don't click. */
static double envelope(double t, double length) {
    double attack = fmin(1.0, t / 0.01);
    double release = fmin(1.0, (length - t) / 0.02);
    return attack * release * exp(-4.0 * t);
}

/* Append one note (a sine plus a little of its 2nd harmonic) to the buffer. */
static size_t add_note(int16_t* buf, size_t at, double freq) {
    size_t n = (size_t)(NOTE_SECONDS * SAMPLE_RATE);
    for (size_t i = 0; i < n; i++) {
        double t = (double)i / SAMPLE_RATE;
        double wave = sin(2 * PI * freq * t) + 0.3 * sin(2 * PI * 2 * freq * t);
        buf[at + i] = (int16_t)(32767 * VOLUME * envelope(t, NOTE_SECONDS) * wave / 1.3);
    }
    return n;
}

/* Append the "mee-ow": the pitch glides 500 -> 800 -> 500 Hz while fading out. */
static size_t add_meow(int16_t* buf, size_t at) {
    size_t n = (size_t)(MEOW_SECONDS * SAMPLE_RATE);
    double phase = 0.0;
    for (size_t i = 0; i < n; i++) {
        double t = (double)i / SAMPLE_RATE;
        double freq = 500 + 300 * sin(PI * t / MEOW_SECONDS);
        phase += 2 * PI * freq / SAMPLE_RATE;
        double fade = fmin(1.0, t / 0.05) * (1.0 - t / MEOW_SECONDS);
        buf[at + i] = (int16_t)(32767 * VOLUME * fade * sin(phase));
    }
    return n;
}

/* Write a little-endian integer of `bytes` bytes (WAV files are little-endian). */
static void put_le(FILE* f, uint32_t value, int bytes) {
    for (int i = 0; i < bytes; i++) fputc((value >> (8 * i)) & 0xFF, f);
}

static int save_wav(const char* path, const int16_t* samples, size_t count) {
    FILE* f = fopen(path, "wb");
    if (!f) return 0;
    uint32_t data_bytes = (uint32_t)(count * 2);
    fwrite("RIFF", 1, 4, f);  put_le(f, 36 + data_bytes, 4);
    fwrite("WAVE", 1, 4, f);
    fwrite("fmt ", 1, 4, f);  put_le(f, 16, 4);
    put_le(f, 1, 2);                        /* PCM */
    put_le(f, 1, 2);                        /* mono */
    put_le(f, SAMPLE_RATE, 4);
    put_le(f, SAMPLE_RATE * 2, 4);          /* bytes per second */
    put_le(f, 2, 2);                        /* bytes per sample */
    put_le(f, 16, 2);                       /* bits per sample */
    fwrite("data", 1, 4, f);  put_le(f, data_bytes, 4);
    for (size_t i = 0; i < count; i++) put_le(f, (uint16_t)samples[i], 2);
    return fclose(f) == 0;
}

int main(int argc, char** argv) {
    if (argc < 2 || argc > 3) {
        fprintf(stderr, "Usage: %s \"<name>\" [output.wav]\n", argv[0]);
        return 1;
    }
    const char* name = argv[1];
    const char* out = argc == 3 ? argv[2] : "tune.wav";

    /* Worst case every character is a note, plus the meow. */
    size_t max = (strlen(name) * NOTE_SECONDS + MEOW_SECONDS) * SAMPLE_RATE + 1;
    int16_t* buf = calloc(max, sizeof(int16_t));
    if (!buf) return 1;

    size_t len = 0;
    int notes = 0;
    for (const char* p = name; *p; p++) {
        int c = tolower((unsigned char)*p);
        if (c >= 'a' && c <= 'z') {
            len += add_note(buf, len, SCALE[(c - 'a') % SCALE_SIZE]);
            notes++;
        } else if (c == ' ') {
            len += (size_t)(REST_SECONDS * SAMPLE_RATE);   /* calloc'd, so already silent */
        }
    }
    len += add_meow(buf, len);

    if (!save_wav(out, buf, len)) {
        fprintf(stderr, "Could not write %s\n", out);
        free(buf);
        return 1;
    }
    printf("Saved %s: %d notes + meow, %.2f seconds\n", out, notes, (double)len / SAMPLE_RATE);
    free(buf);
    return 0;
}
