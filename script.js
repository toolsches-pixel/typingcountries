// ============================================================
// WORD LIST
// ============================================================
const RAW_WORDS = `
afghanistan
albania
algeria
andorra
angola
antigua and barbuda
argentine
armenia
australia
austria
azerbaijan
bahamas
bahrain
bangladesh
barbados
belarus
belgium
belize
benin
bhutan
bolivia
bosnia herzegovina
botswana
brazil
brunei
bulgaria
burkina faso
burundi
cambodia
cameroon
canada
cape verde
central and african republic
chad
chile
china
colombia
comoros
republic of congo
democratic republic of congo
costa rica
cote d ivoire
croatia
cuba
cyprus
czechia
denmark
djibouti
dominica
dominican republic
ecuador
egypt
el salvador
equatorial guinea
eritrea
estonia
eswatini
ethiopia
fiji
finland
france
gabon
gambia
georgia
germany
ghana
greece
grenada
guatemala
guinea
guinea-bissau
guyana
haiti
honduras
hungary
iceland
india
indonesia
iran
iraq
ireland
israel
italy
jamaica
jordan
kazakhstan
kenya
kiribati
republic of korea
kosovo
kuwait
kyrgyzstan
laos
latvia
lebanon
lesotho
liberia
libya
liechtenstein
lithuania
luxembourg
madagascar
malawi
malaysia
maldives
mali
malta
marshall
mauritania
mauritius
mexico
micronesia
moldova
monaco
mongolia
montenegro
morocco
mozambique
myanmar
namibia
nauru
nepal
netherlands
new zealand
nicaragua
niger
nigeria
macedonia
norway
oman
pakistan
palau
panama
papua new guinea
paraguay
peru
philippines
poland
portugal
qatar
romania
russia
rwanda
saint kitts and nevis
saint lucia
saint vincent
samoa
san marino
sao tome principe
saudi arabia
senegal
serbia
seychelles
sierra leone
singapore
slovakia
slovenia
solomon islands
somalia
south africa
south sudan
spain
sri lanka
sudan
suriname
sweden
switzerland
syria
tajikistan
tanzania
thailand
east timor
togo
tonga
trinidad and tobago
tunisia
turkey
turkmenistan
tuvalu
uganda
ukraine
uae
uk
usa
uruguay
uzbekistan
vanuatu
vatican
venezuela
vietnam
yemen
zambia
zimbabwe
`;

const WORD_LIST = RAW_WORDS
    .split(/[\n\r,]+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);

// ----- DOM elements -----
const wordStreamPanel = document.getElementById('wordStreamPanel');
const wordStream = document.getElementById('wordStream');
const typingInput = document.getElementById('typingInput');
const timerDisplay = document.getElementById('timerDisplay');
const progressBadge = document.getElementById('progressBadge');
const wordCountBadge = document.getElementById('wordCountBadge');
const restartBtn = document.getElementById('restartBtn');
const skipBtn = document.getElementById('skipBtn');
const speakBtn = document.getElementById('speakBtn');
const messageBox = document.getElementById('messageBox');
const speakToggle = document.getElementById('speakToggle');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themePanel = document.getElementById('themePanel');
const resultOverlay = document.getElementById('resultOverlay');
const finalWpm = document.getElementById('finalWpm');
const finalTime = document.getElementById('finalTime');
const finalAccuracy = document.getElementById('finalAccuracy');
const finalErrors = document.getElementById('finalErrors');
const finalSkipped = document.getElementById('finalSkipped');
const playAgainBtn = document.getElementById('playAgainBtn');
const closeResultBtn = document.getElementById('closeResultBtn');

// ----- state -----
let allWords = [];
let currentIndex = 0;
let currentWord = '';
let wordStatus = [];
let sessionTotalTyped = 0;
let sessionErrorCount = 0;
let sessionSkippedCount = 0;
let currentAttemptTotalTyped = 0;
let currentAttemptErrors = 0;
let isTransitioning = false;
let testStartTime = null;
let testEndTime = null;
let wpmInterval = null;
let timerInterval = null;
let voiceEnabled = true;
let selectedVoice = null;

// ----- SPEECH -----
function loadVoices() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;
    selectedVoice =
        voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en-us')) ||
        voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en-gb')) ||
        voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en')) ||
        voices[0];
}

if ('speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
} else {
    voiceEnabled = false;
    setTimeout(() => {
        speakToggle.classList.add('off');
        speakToggle.textContent = '🔇';
        speakToggle.disabled = true;
    }, 100);
}

function speakWord(word) {
    if (!voiceEnabled) return;
    if (!('speechSynthesis' in window)) return;
    if (!word) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(word);
        u.rate = 0.9; u.pitch = 1.0; u.volume = 1.0;
        if (selectedVoice) u.voice = selectedVoice;
        window.speechSynthesis.speak(u);
    } catch (e) { console.error('speech error:', e); }
}

// ----- helpers -----
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function calculateWPM() {
    if (!testStartTime) return 0;
    const endTime = testEndTime || Date.now();
    const minutesElapsed = (endTime - testStartTime) / 1000 / 60;
    if (minutesElapsed <= 0) return 0;
    return Math.max(0, Math.round((sessionTotalTyped / 5) / minutesElapsed));
}

function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function formatTimeShort(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function updateTimerDisplay() {
    if (!testStartTime) { timerDisplay.textContent = '00:00.0'; return; }
    const now = testEndTime || Date.now();
    timerDisplay.textContent = formatTime(now - testStartTime);
}

function startWpmTracking() {
    testStartTime = Date.now();
    testEndTime = null;
    if (wpmInterval) clearInterval(wpmInterval);
    wpmInterval = setInterval(() => {}, 500);
}

function startTimerTracking() {
    if (timerInterval) clearInterval(timerInterval);
    timerDisplay.classList.add('running');
    timerInterval = setInterval(() => {
        if (testStartTime && !testEndTime) updateTimerDisplay();
    }, 100);
}

function stopWpmTracking() {
    testEndTime = Date.now();
    if (wpmInterval) { clearInterval(wpmInterval); wpmInterval = null; }
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerDisplay.classList.remove('running');
    updateTimerDisplay();
}

// ============================================================
// SCROLL TO ACTIVE WORD
// ============================================================
function scrollToActiveWord() {
    const activeEl = wordStream.querySelector('.word.active');
    if (!activeEl) return;

    const containerRect = wordStreamPanel.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    const activeTopInContainer = activeRect.top - containerRect.top;
    const activeBottomInContainer = activeRect.bottom - containerRect.top;

    const containerHeight = wordStreamPanel.clientHeight;
    const scrollTop = wordStreamPanel.scrollTop;

    const margin = 40;
    const isAbove = activeTopInContainer < margin;
    const isBelow = activeBottomInContainer > containerHeight - margin;

    if (isAbove || isBelow) {
        const activeCenterInContainer = (activeTopInContainer + activeBottomInContainer) / 2;
        const targetScroll = scrollTop + activeCenterInContainer - (containerHeight / 2);

        wordStreamPanel.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: 'smooth'
        });
    }
}

// ----- RENDER -----
function renderWordStream() {
    wordStream.innerHTML = '';

    allWords.forEach((word, idx) => {
        const wordEl = document.createElement('span');
        wordEl.className = 'word';
        wordEl.dataset.index = idx;

        const status = wordStatus[idx];

        if (status === 'active') {
            const typed = typingInput.value;
            const target = word;

            for (let i = 0; i < target.length; i++) {
                const charEl = document.createElement('span');
                charEl.className = 'char';
                charEl.textContent = target[i] === ' ' ? '\u00A0' : target[i];
                charEl.dataset.char = target[i];

                if (i < typed.length) {
                    if (typed[i] === target[i]) charEl.classList.add('correct');
                    else charEl.classList.add('incorrect');
                } else {
                    charEl.classList.add('pending');
                }

                if (i === typed.length) charEl.classList.add('current');
                wordEl.appendChild(charEl);
            }

            if (typed.length > target.length) {
                for (let i = target.length; i < typed.length; i++) {
                    const extraEl = document.createElement('span');
                    extraEl.className = 'char extra';
                    extraEl.textContent = typed[i] === ' ' ? '\u00A0' : typed[i];
                    wordEl.appendChild(extraEl);
                }
            }

            wordEl.classList.add('active');
        } else {
            wordEl.textContent = word;
            if (status === 'done') wordEl.classList.add('done');
            else if (status === 'error') wordEl.classList.add('error');
            else if (status === 'skipped') wordEl.classList.add('skipped');
        }

        wordStream.appendChild(wordEl);
    });

    scrollToActiveWord();
}

function updateProgressBadge() {
    const total = allWords.length;
    const doneCount = wordStatus.filter(s => s === 'done' || s === 'skipped').length;
    if (doneCount >= total) {
        progressBadge.textContent = `${total} / ${total}`;
    } else {
        progressBadge.textContent = `${doneCount + 1} / ${total}`;
    }
}

let messageTimeout = null;
function showMessage(text, color = 'var(--text-dim)') {
    messageBox.textContent = text;
    messageBox.style.color = color;
    messageBox.classList.add('show');
    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => messageBox.classList.remove('show'), 1200);
}

// ============================================================
// MOVE TO NEXT
// ============================================================
function moveToNextWord() {
    isTransitioning = false;

    let nextIdx = -1;
    for (let i = currentIndex + 1; i < allWords.length; i++) {
        if (wordStatus[i] === 'pending') { nextIdx = i; break; }
    }
    if (nextIdx === -1) {
        for (let i = 0; i < allWords.length; i++) {
            if (wordStatus[i] === 'pending') { nextIdx = i; break; }
        }
    }

    if (nextIdx === -1) {
        currentIndex = -1;
        currentWord = '';
        typingInput.value = '';
        typingInput.disabled = true;
        renderWordStream();
        updateProgressBadge();
        setTimeout(showResult, 300);
        return;
    }

    currentIndex = nextIdx;
    currentWord = allWords[currentIndex];
    wordStatus[currentIndex] = 'active';

    typingInput.value = '';
    currentAttemptTotalTyped = 0;
    currentAttemptErrors = 0;

    renderWordStream();
    updateProgressBadge();
    speakWord(currentWord);

    typingInput.disabled = false;
    typingInput.focus();
}

function showResult() {
    stopWpmTracking();
    const wpm = calculateWPM();
    let accuracy = 100;
    if (sessionTotalTyped > 0) {
        const correct = sessionTotalTyped - sessionErrorCount;
        accuracy = Math.max(0, Math.round((correct / sessionTotalTyped) * 100));
    }
    finalWpm.textContent = wpm;
    finalAccuracy.textContent = accuracy + '%';
    finalErrors.textContent = sessionErrorCount;
    finalSkipped.textContent = sessionSkippedCount;
    if (testStartTime && testEndTime) {
        finalTime.textContent = formatTimeShort(testEndTime - testStartTime);
    } else {
        finalTime.textContent = '0:00';
    }
    resultOverlay.classList.add('show');
}

function hideResult() { resultOverlay.classList.remove('show'); }

function restartTest() {
    hideResult();
    if (wpmInterval) clearInterval(wpmInterval);
    if (timerInterval) clearInterval(timerInterval);
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }

    isTransitioning = false;
    sessionTotalTyped = 0;
    sessionErrorCount = 0;
    sessionSkippedCount = 0;
    currentAttemptTotalTyped = 0;
    currentAttemptErrors = 0;
    testStartTime = null;
    testEndTime = null;

    timerDisplay.textContent = '00:00.0';
    timerDisplay.classList.remove('running');

    allWords = shuffleArray(WORD_LIST);
    wordStatus = new Array(allWords.length).fill('pending');

    currentIndex = 0;
    currentWord = allWords[0];
    wordStatus[0] = 'active';

    typingInput.value = '';
    typingInput.disabled = false;

    updateProgressBadge();
    renderWordStream();
    wordStreamPanel.scrollTop = 0;
    speakWord(currentWord);
    typingInput.focus();
}

function skipWord() {
    if (isTransitioning) return;
    if (typingInput.disabled) return;
    if (currentIndex === -1) return;

    isTransitioning = true;
    wordStatus[currentIndex] = 'skipped';
    sessionSkippedCount++;
    showMessage(`skipped: ${currentWord}`, 'var(--main)');
    renderWordStream();
    updateProgressBadge();
    typingInput.disabled = true;

    setTimeout(() => {
        typingInput.disabled = false;
        moveToNextWord();
    }, 150);
}

// ============================================================
// TYPING INPUT
// ============================================================
function onTypingInput() {
    if (isTransitioning) return;
    if (currentIndex === -1) return;
    if (typingInput.disabled) return;

    if (!testStartTime) {
        startWpmTracking();
        startTimerTracking();
    }

    const rawTyped = typingInput.value;
    const typed = rawTyped.trim();
    const target = currentWord;

    let attemptErrors = 0;
    const minLength = Math.min(typed.length, target.length);
    for (let i = 0; i < minLength; i++) {
        if (typed[i] !== target[i]) attemptErrors++;
    }
    if (typed.length > target.length) {
        attemptErrors += typed.length - target.length;
    }

    sessionTotalTyped = sessionTotalTyped - currentAttemptTotalTyped + typed.length;
    sessionErrorCount = sessionErrorCount - currentAttemptErrors + attemptErrors;
    currentAttemptTotalTyped = typed.length;
    currentAttemptErrors = attemptErrors;

    // CORRECT — auto next
    if (typed === target && typed.length > 0) {
        wordStatus[currentIndex] = 'done';
        renderWordStream();
        updateProgressBadge();

        isTransitioning = true;
        typingInput.disabled = true;

        setTimeout(() => {
            typingInput.disabled = false;
            moveToNextWord();
        }, 80);
        return;
    }

    if (typed.length === 0 && rawTyped.length > 0) {
        renderWordStream();
        return;
    }

    renderWordStream();
    updateProgressBadge();
}

// ============================================================
// KEY HANDLER
// ============================================================
function onKeyDownHandler(e) {
    // Alt+S → skip
    if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        skipWord();
        return;
    }

    // Space → next (sirf tab jab word sahi type ho)
    if (e.key === ' ' || e.code === 'Space') {
        if (isTransitioning) return;
        if (typingInput.disabled) return;
        if (currentIndex === -1) return;

        const typed = typingInput.value.trim();
        const target = currentWord;

        if (typed === target && typed.length > 0) {
            e.preventDefault();
            wordStatus[currentIndex] = 'done';
            renderWordStream();
            updateProgressBadge();

            isTransitioning = true;
            typingInput.disabled = true;

            setTimeout(() => {
                typingInput.disabled = false;
                moveToNextWord();
            }, 80);
            return;
        }
        return;
    }

    // Enter → skip
    if (e.key === 'Enter') {
        e.preventDefault();
        if (isTransitioning) return;
        if (typingInput.disabled) return;
        if (currentIndex === -1) return;

        const typed = typingInput.value.trim();
        const target = currentWord;

        if (typed === target && typed.length > 0) {
            wordStatus[currentIndex] = 'done';
        } else {
            wordStatus[currentIndex] = 'skipped';
            sessionSkippedCount++;
            showMessage(`skipped: ${currentWord}`, 'var(--main)');
        }

        renderWordStream();
        updateProgressBadge();
        isTransitioning = true;
        typingInput.disabled = true;

        setTimeout(() => {
            typingInput.disabled = false;
            moveToNextWord();
        }, 120);
        return;
    }
}

function toggleVoice() {
    if (!('speechSynthesis' in window)) return;
    voiceEnabled = !voiceEnabled;
    if (voiceEnabled) {
        speakToggle.classList.remove('off');
        speakToggle.textContent = '🔊';
        speakWord(currentWord);
    } else {
        speakToggle.classList.add('off');
        speakToggle.textContent = '🔇';
        try { window.speechSynthesis.cancel(); } catch (e) {}
    }
}

// ============================================================
// THEME
// ============================================================
const themes = ['serika-dark', 'serika-light', 'dracula', 'nord', 'solarized', 'rose', 'cobalt', 'matrix', '80s', 'botanical'];

function setTheme(name) {
    themes.forEach(t => document.body.classList.remove('theme-' + t));
    document.body.classList.add('theme-' + name);
    document.querySelectorAll('.theme-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.theme === name);
    });
    try { localStorage.setItem('apnaWordTheme', name); } catch (e) {}
}

document.querySelectorAll('.theme-swatch').forEach(sw => {
    sw.addEventListener('click', () => setTheme(sw.dataset.theme));
});

themeToggleBtn.addEventListener('click', () => {
    themePanel.classList.toggle('open');
    themeToggleBtn.classList.toggle('hidden', themePanel.classList.contains('open'));
});

document.addEventListener('click', (e) => {
    if (!themePanel.contains(e.target) && e.target !== themeToggleBtn) {
        themePanel.classList.remove('open');
        themeToggleBtn.classList.remove('hidden');
    }
});

try {
    const saved = localStorage.getItem('apnaWordTheme');
    setTheme(saved && themes.includes(saved) ? saved : 'serika-dark');
} catch (e) { setTheme('serika-dark'); }

// ============================================================
// INIT
// ============================================================
function init() {
    if (!WORD_LIST || WORD_LIST.length === 0) {
        showMessage('no words found', 'var(--text-error)');
        return;
    }

    wordCountBadge.textContent = `${WORD_LIST.length} countries`;

    allWords = shuffleArray(WORD_LIST);
    wordStatus = new Array(allWords.length).fill('pending');

    currentIndex = 0;
    currentWord = allWords[0];
    wordStatus[0] = 'active';

    typingInput.value = '';
    typingInput.disabled = false;

    updateProgressBadge();
    renderWordStream();
    setTimeout(() => speakWord(currentWord), 500);
    typingInput.focus();

    document.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' && !themePanel.contains(e.target)) {
            typingInput.focus();
        }
    });

    typingInput.addEventListener('input', onTypingInput);
    document.addEventListener('keydown', onKeyDownHandler, true);
    skipBtn.addEventListener('click', skipWord);
    speakBtn.addEventListener('click', () => speakWord(currentWord));
    speakToggle.addEventListener('click', toggleVoice);
    restartBtn.addEventListener('click', () => { typingInput.disabled = false; restartTest(); });

    playAgainBtn.addEventListener('click', () => restartTest());
    closeResultBtn.addEventListener('click', () => hideResult());
    resultOverlay.addEventListener('click', (e) => {
        if (e.target === resultOverlay) hideResult();
    });
}

init();
