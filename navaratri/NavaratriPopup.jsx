import { useCallback, useEffect, useRef, useState } from 'react';
import './NavaratriPopup.css';

const CONFETTI_COLORS = ['#ff9f1c', '#f6c453', '#ff5c8a', '#c8283a', '#a855f7', '#22c55e'];

const NINE_COLORS = [
  '#f59e0b', '#22c55e', '#f8fafc', '#f97316', '#3b82f6',
  '#ec4899', '#a855f7', '#14b8a6', '#ef4444',
];

const FLOWER_EMOJIS = ['🌺', '🌸', '🌼', '🌷', '🏵️', '💮'];

// Tap par jo phool barsenge (🪷 lotus Maa Durga ka phool hai)
const BURST_EMOJIS = ['🌺', '🌸', '🌼', '🪷', '🏵️', '💮', '✨'];

const makeConfetti = () =>
  Array.from({ length: 18 }).map(() => ({
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2.2 + Math.random() * 2}s`,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 6 + Math.floor(Math.random() * 6),
  }));

// Flowers falling on the image
const makeFlowers = () =>
  Array.from({ length: 20 }).map(() => ({
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 4}s`,
    duration: `${3 + Math.random() * 3}s`,
    emoji: FLOWER_EMOJIS[Math.floor(Math.random() * FLOWER_EMOJIS.length)],
    size: 14 + Math.floor(Math.random() * 12),
    sway: (Math.random() - 0.5) * 60,
    rotate: `${Math.random() * 360}deg`,
  }));

// Sparkles around Durga
const makeSparkles = () =>
  Array.from({ length: 12 }).map(() => ({
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 3}s`,
    duration: `${1.5 + Math.random() * 2}s`,
    size: 5 + Math.random() * 6,
  }));

// Ek tap = ek burst: phool upar uchhalte hain, phir neeche barsate hain
const makeBurstPieces = (count, height, y) =>
  Array.from({ length: count }).map(() => ({
    emoji: BURST_EMOJIS[Math.floor(Math.random() * BURST_EMOJIS.length)],
    size: 16 + Math.floor(Math.random() * 16),
    dx: (Math.random() - 0.5) * 160,
    up: 30 + Math.random() * 70,
    fall: height - y + 30 + Math.random() * 25,
    rot: (Math.random() - 0.5) * 720,
    dur: 1.7 + Math.random() * 1.2,
    delay: Math.random() * 0.12,
  }));

export default function NavaratriPopup() {
  const [showPopup, setShowPopup] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [bursts, setBursts] = useState([]);
  const [hintGone, setHintGone] = useState(false);

  const [confetti] = useState(makeConfetti);
  const [flowers] = useState(makeFlowers);
  const [sparkles] = useState(makeSparkles);

  const audioRef = useRef(null);
  const imageRef = useRef(null);
  const burstId = useRef(0);
  const lastTap = useRef({ time: 0, combo: 0 });

  useEffect(() => {
    const timer = setTimeout(() => setShowPopup(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const closePopup = useCallback(() => {
    setShowPopup(false);
    setBursts([]);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  // Esc + scroll lock
  useEffect(() => {
    if (!showPopup) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closePopup();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showPopup, closePopup]);

  // 🎵 AUTO-PLAY SONG — Try immediately, fallback to first interaction
  useEffect(() => {
    if (!showPopup) return undefined;
    const audio = audioRef.current;
    if (!audio) return undefined;

    let interactionHandler = null;

    const tryAutoplay = async () => {
      try {
        audio.volume = 0.7;
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        // Blocked by browser — set up first-interaction listener
        console.log('Autoplay blocked, waiting for user interaction');

        interactionHandler = () => {
          audio.play()
            .then(() => setIsPlaying(true))
            .catch(() => {});
          removeInteractionHandler();
        };

        document.addEventListener('click', interactionHandler, { once: true });
        document.addEventListener('touchstart', interactionHandler, { once: true });
        document.addEventListener('keydown', interactionHandler, { once: true });
      }
    };

    // Small delay so popup animation finishes, then autoplay
    const timer = setTimeout(tryAutoplay, 200);

    function removeInteractionHandler() {
      if (interactionHandler) {
        document.removeEventListener('click', interactionHandler);
        document.removeEventListener('touchstart', interactionHandler);
        document.removeEventListener('keydown', interactionHandler);
        interactionHandler = null;
      }
    }

    return () => {
      clearTimeout(timer);
      removeInteractionHandler();
    };
  }, [showPopup]);

  const flashCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 🌸 Tap karne par phoolon ki barsaat
  const showerFlowers = (x, y, width, height) => {
    const now = Date.now();
    // Jaldi-jaldi tap karoge to barsaat badi hoti jaayegi
    const combo = now - lastTap.current.time < 900 ? Math.min(lastTap.current.combo + 1, 5) : 0;
    lastTap.current = { time: now, combo };

    const id = ++burstId.current;
    const pieces = makeBurstPieces(12 + combo * 4, height, y);

    setBursts((prev) => [...prev.slice(-5), { id, x, y, pieces }]);
    setHintGone(true);
    if (navigator.vibrate) navigator.vibrate(12);

    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, 3400);
  };

  const handleImageTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    showerFlowers(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
  };

  const handleImageKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      showerFlowers(rect.width / 2, rect.height / 3, rect.width, rect.height);
    }
  };

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.log('Audio play failed:', err));
    }
  };

  const convertToPng = (blob) =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        canvas.toBlob((pngBlob) => {
          URL.revokeObjectURL(url);
          resolve(pngBlob);
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(blob);
      };
      img.src = url;
    });

  const copyToClipboard = async () => {
    const shareText = `🎉 Happy Navaratri 🎉\n\nNine nights of devotion, dance, and joy 🪔🌺\n\nWishing you a blessed Navaratri!\n\n${window.location.origin}`;

    try {
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          const img = imageRef.current;
          if (img && img.complete && img.naturalWidth > 0) {
            const response = await fetch(img.src);
            const blob = await response.blob();
            const pngBlob = blob.type === 'image/png' ? blob : await convertToPng(blob);

            const clipboardItem = new ClipboardItem({
              'text/plain': new Blob([shareText], { type: 'text/plain' }),
              'image/png': pngBlob,
            });
            await navigator.clipboard.write([clipboardItem]);
          } else {
            await navigator.clipboard.writeText(shareText);
          }
        } catch (imgErr) {
          await navigator.clipboard.writeText(shareText);
        }
      } else {
        await navigator.clipboard.writeText(shareText);
      }
      flashCopied();
    } catch (err) {
      console.log('Copy failed:', err);
      alert('Copy failed. Please take a screenshot instead.');
    }
  };

  const shareNative = async () => {
    const shareText = `🎉 Happy Navaratri 🎉\n\nNine nights of devotion, dance, and joy 🪔🌺\n\n${window.location.origin}`;

    if (navigator.share) {
      try {
        const img = imageRef.current;
        if (img && img.complete && img.naturalWidth > 0) {
          const response = await fetch(img.src);
          const blob = await response.blob();
          const file = new File([blob], 'navaratri.jpg', { type: blob.type });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ title: 'Happy Navaratri', text: shareText, files: [file] });
            return;
          }
        }
        await navigator.share({ title: 'Happy Navaratri', text: shareText });
      } catch (err) {
        console.log('Share failed:', err);
      }
    } else {
      await navigator.clipboard.writeText(shareText).catch(() => {});
      flashCopied();
    }
  };

  if (!showPopup) return null;

  return (
    <div className="nav-popup-overlay" onClick={closePopup}>
      <div
        className="nav-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nav-popup-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confetti */}
        <div className="nav-popup-confetti" aria-hidden="true">
          {confetti.map((c, i) => (
            <span
              key={i}
              className="nav-confetti-piece"
              style={{
                left: c.left,
                width: c.size,
                height: c.size,
                animationDelay: c.delay,
                animationDuration: c.duration,
                background: c.color,
              }}
            />
          ))}
        </div>

        {/* Close */}
        <button className="nav-popup-close" onClick={closePopup} aria-label="Close" title="Close">
          ✕
        </button>

        {/* Clipboard */}
        <button
          className={`nav-popup-clipboard ${copied ? 'copied' : ''}`}
          onClick={copyToClipboard}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
          aria-label="Copy to clipboard"
        >
          {copied ? '✓' : '📋'}
        </button>

        {/* Header */}
        <div className="nav-popup-header">
          <span className="nav-popup-greeting">शुभ</span>
          <h1 className="nav-popup-title" id="nav-popup-title">Navaratri</h1>
          <p className="nav-popup-subtitle">Nine nights of devotion, dance, and joy</p>
          <div className="nav-popup-colors" aria-hidden="true">
            {NINE_COLORS.map((color, i) => (
              <span
                key={color}
                className="nav-popup-color-dot"
                style={{ background: color, animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        </div>

        {/* Image: flowers + sparkles + TAP for flower shower */}
        <div
          className="nav-popup-image-wrap nav-tappable"
          role="button"
          tabIndex={0}
          aria-label="Tap to shower flowers on Maa Durga"
          onPointerDown={handleImageTap}
          onKeyDown={handleImageKey}
        >
          {/* Divine aura glow */}
          <div className="nav-divine-glow" aria-hidden="true" />

          {/* Sparkles around Durga */}
          <div className="nav-sparkles" aria-hidden="true">
            {sparkles.map((s, i) => (
              <span
                key={i}
                className="nav-sparkle"
                style={{
                  top: s.top,
                  left: s.left,
                  width: s.size,
                  height: s.size,
                  animationDelay: s.delay,
                  animationDuration: s.duration,
                }}
              />
            ))}
          </div>

          {!imgFailed && (
            <img
              ref={imageRef}
              src="/navaratri.jpg"
              alt="Happy Navaratri"
              className="nav-popup-image"
              draggable="false"
              onError={() => setImgFailed(true)}
            />
          )}
          <div className={`nav-popup-image-placeholder ${imgFailed ? 'is-visible' : ''}`}>
            <span className="nav-popup-placeholder-icon">🪔</span>
            <span className="nav-popup-placeholder-text">Maa Durga</span>
          </div>

          {/* 🌺 FLOWERS RAINING ON DURGA 🌸 */}
          <div className="nav-flower-rain" aria-hidden="true">
            {flowers.map((f, i) => (
              <span
                key={i}
                className="nav-flower"
                style={{
                  left: f.left,
                  fontSize: `${f.size}px`,
                  animationDelay: f.delay,
                  animationDuration: f.duration,
                  '--sway': `${f.sway}px`,
                  '--rotate': f.rotate,
                }}
              >
                {f.emoji}
              </span>
            ))}
          </div>

          {/* 👆 Tap burst layer */}
          <div className="nav-burst-layer" aria-hidden="true">
            {bursts.map((b) => (
              <div key={b.id} className="nav-burst" style={{ left: b.x, top: b.y }}>
                <span className="nav-burst-ring" />
                {b.pieces.map((p, i) => (
                  <span
                    key={i}
                    className="nav-burst-flower"
                    style={{
                      fontSize: `${p.size}px`,
                      animationDuration: `${p.dur}s`,
                      animationDelay: `${p.delay}s`,
                      '--dx': `${p.dx}px`,
                      '--up': `${p.up}px`,
                      '--fall': `${p.fall}px`,
                      '--rot': `${p.rot}deg`,
                    }}
                  >
                    {p.emoji}
                  </span>
                ))}
              </div>
            ))}
          </div>

          {/* Bottom garland border */}
          <div className="nav-flower-border" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="nav-flower-border-item">
                {i % 2 === 0 ? '🌺' : '🌸'}
              </span>
            ))}
          </div>

          {/* Hint — pehle tap ke baad gayab */}
          {!hintGone && <div className="nav-tap-hint" aria-hidden="true">Tap for flowers 🌸</div>}
        </div>

        {/* Actions */}
        <div className="nav-popup-actions">
          <button
            className="nav-popup-btn nav-popup-btn-music"
            onClick={toggleMusic}
            aria-pressed={isPlaying}
          >
            {isPlaying ? (
              <>
                <span className="nav-popup-eq" aria-hidden="true">
                  <i /><i /><i />
                </span>
                Pause
              </>
            ) : (
              '🎵 Play Song'
            )}
          </button>
          <button className="nav-popup-btn nav-popup-btn-close" onClick={closePopup}>
            Continue
          </button>
        </div>

        {/* Hidden audio — autoPlay attribute added */}
        <audio
          ref={audioRef}
          src="/navaratri-song.mp3"
          loop
          preload="auto"
          autoPlay
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => console.log('Audio not found or failed to load')}
        />

        {/* Footer */}
        <div className="nav-popup-footer" aria-hidden="true">
          <span>🪔</span>
          <span>🌺</span>
          <span>🪔</span>
        </div>

        {/* Toast */}
        <div className="nav-popup-toast-region" aria-live="polite">
          {copied && <div className="nav-popup-toast">Copied</div>}
        </div>

        {/* Share */}
        <button className="nav-popup-share" onClick={shareNative} title="Share" aria-label="Share">
          📤
        </button>
      </div>
    </div>
  );
}
