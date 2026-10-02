import { useEffect, useState } from "react";

const symbols = "tRx,E1b>pa29+N7z?H4/<k#";
const revealedTexts = new Set<string>();
const staggerMs = 55;
const scrambleMs = 65;
const leadInMs = 240;

/** Decorative, once-per-page-load reveal. The accessible text never changes. */
export function DecryptedText({ text }: { text: string }) {
  const letters = Array.from(text);
  const [frame, setFrame] = useState(() => ({
    settled: revealedTexts.has(text) ? letters.length : 0,
    scrambled: letters.map((_, index) => symbols[index % symbols.length]),
  }));

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cancelled = false;
    let animationFrame = 0;

    const finish = () => {
      cancelAnimationFrame(animationFrame);
      revealedTexts.add(text);
      setFrame({ settled: letters.length, scrambled: [] });
    };
    const onMotionChange = () => { if (motion.matches) finish(); };
    motion.addEventListener("change", onMotionChange);

    if (motion.matches || revealedTexts.has(text)) {
      finish();
    } else {
      // Start after fonts load so the reserved letter widths stay stable.
      void document.fonts.ready.then(() => {
        if (cancelled || motion.matches || revealedTexts.has(text)) return;
        let start: number | undefined;
        let previousTick = -1;
        const animate = (now: number) => {
          if (cancelled) return;
          start ??= now;
          const elapsed = now - start;
          const settled = Math.min(letters.length, Math.max(0, Math.floor((elapsed - leadInMs) / staggerMs)));
          const tick = Math.floor(elapsed / scrambleMs);
          if (settled === letters.length) { finish(); return; }
          if (tick !== previousTick) {
            previousTick = tick;
            setFrame({ settled, scrambled: letters.map(() => symbols[Math.floor(Math.random() * symbols.length)]) });
          }
          animationFrame = requestAnimationFrame(animate);
        };
        animationFrame = requestAnimationFrame(animate);
      });
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      motion.removeEventListener("change", onMotionChange);
    };
  }, [text]);

  let index = 0;
  return <span className="decrypted-text">
    <span className="sr-only">{text}</span>
    <span className="decrypted-text-visual" aria-hidden="true">
      {text.split(/(\s+)/).map((word, wordIndex) => {
        if (/^\s+$/.test(word)) { index += word.length; return word; }
        return <span className="decrypted-word" key={wordIndex}>{Array.from(word).map((letter) => {
          const letterIndex = index++;
          return <span className="decrypted-letter" data-settled={letterIndex < frame.settled} key={letterIndex}>
            <span className="decrypted-final">{letter}</span>
            <span className="decrypted-scramble">{frame.scrambled[letterIndex]}</span>
          </span>;
        })}</span>;
      })}
    </span>
  </span>;
}
