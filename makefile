CC     = gcc
CFLAGS = -std=c11 -Wall -Wextra -O2

nametune: main.c
	$(CC) $(CFLAGS) main.c -lm -o $@

clean:
	rm -f nametune tune.wav

.PHONY: clean
