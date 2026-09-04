// crypt // sec-ops — interactive ctf & crypto challenges
window.App = window.App || {};

App.ctf = (() => {
  const { $, esc } = App.utils;
  let isLoaded = false;

  const CHALLENGES = [
    {
      id: 'vig',
      title: '01 // Classical Cryptanalysis (Vigenère)',
      points: 100,
      desc: 'An encrypted message was intercepted. The cipher used is Vigenère with key "CYBER". Decrypt the message to find the flag.',
      ciphertext: 'XDVW MTI ZVCJVE VR V3X',
      solution: 'FLAG{CRYPT_VIGENERE_SOLVED}',
      hint: 'Use the Encryption Hub tool with algorithm "Vigenère", mode "Decrypt", key "CYBER". The decoded message ends with the flag format FLAG{...}.',
      validate: (input) => input.trim().toUpperCase() === 'FLAG{CRYPT_VIGENERE_SOLVED}' || input.trim() === 'FLAG{CRYPT_VIGENERE_SOLVED}'
    },
    {
      id: 'jwt',
      title: '02 // Auth Bypass (JWT alg: none)',
      points: 150,
      desc: 'Analyze the given JWT token. Identify the security flaw where signature verification is bypassed because the header algorithm is set to "none". Extract the flag from the payload.',
      ciphertext: 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIiwiaXNBZG1pbiI6dHJ1ZSwiZmxhZyI6IkZMQUd7SldUX0FMR19OT05FX0JZX1BBU1N9In0.',
      solution: 'FLAG{JWT_ALG_NONE_BY_PASS}',
      hint: 'Paste the token into the JWT Inspector tool to decode the payload claims.',
      validate: (input) => input.trim() === 'FLAG{JWT_ALG_NONE_BY_PASS}'
    },
    {
      id: 'sqli',
      title: '03 // SQL Injection Prevention',
      points: 150,
      desc: 'Which defensive programming technique completely prevents SQL Injection by enforcing structural separation between SQL code and user data parameters?',
      solution: 'PARAMETERIZED QUERIES',
      hint: 'Check the Threat Simulator mitigations section for SQL Injection.',
      validate: (input) => /parameterized|prepared/i.test(input.trim())
    },
    {
      id: 'stego',
      title: '04 // Digital Forensics (Steganography)',
      points: 200,
      desc: 'LSB Steganography hides bits in the least significant position of image pixel color channels. What does LSB stand for?',
      solution: 'LEAST SIGNIFICANT BIT',
      hint: 'Read the header info in the Steganography tool.',
      validate: (input) => /least\s+significant\s+bit/i.test(input.trim())
    }
  ];

  const getSolved = () => {
    try {
      return JSON.parse(localStorage.getItem('crypt.ctf.solved') || '[]');
    } catch { return []; }
  };

  const setSolved = (solvedList) => {
    localStorage.setItem('crypt.ctf.solved', JSON.stringify(solvedList));
  };

  const load = () => {
    const view = $('#ctf-view');
    if (!view || isLoaded) return;

    view.innerHTML = `
      <div class="view-headerline">
        <h1 class="view-title">// ctf & crypto lab</h1>
        <div class="view-meta">interactive security challenges · test your practical cryptanalysis skills</div>
        <div class="view-actions">
          <span class="badge" id="ctf-score-badge" style="background:var(--security);color:#fff;padding:4px 10px;font-weight:600">SCORE: 0 PTS</span>
        </div>
      </div>

      <div class="tool-stack">
        ${CHALLENGES.map((c, idx) => `
          <div class="panel" id="ctf-panel-${c.id}">
            <header class="panel-head">
              <span class="panel-tag">[ ${String(idx + 1).padStart(2, '0')} ]</span>
              <h2>${esc(c.title)}</h2>
              <span class="panel-state" id="ctf-status-${c.id}">${c.points} PTS</span>
            </header>
            <p style="margin:8px 0;font-size:13px;line-height:1.5;color:var(--ink)">${esc(c.desc)}</p>
            ${c.ciphertext ? `<pre class="result code" style="margin:8px 0;padding:8px;font-size:12px;background:var(--surface)">${esc(c.ciphertext)}</pre>` : ''}
            
            <div class="field" style="margin-top:10px">
              <div class="input-row">
                <input class="input" type="text" id="ctf-input-${c.id}" placeholder="enter flag / answer (e.g. FLAG{...})">
                <button class="brkbtn primary" id="ctf-submit-${c.id}">submit</button>
              </div>
            </div>
            
            <details style="margin-top:10px;font-size:12px;color:var(--ink-muted)">
              <summary style="cursor:pointer;user-select:none">💡 Need a hint?</summary>
              <p style="margin-top:6px;padding:6px;background:var(--surface);border-left:3px solid var(--security)">${esc(c.hint)}</p>
            </details>
          </div>
        `).join('')}
      </div>
    `;

    bind();
    isLoaded = true;
    updateProgress();
  };

  const updateProgress = () => {
    const solved = getSolved();
    let totalScore = 0;

    CHALLENGES.forEach(c => {
      const isSolved = solved.includes(c.id);
      const statusEl = $('#ctf-status-' + c.id);
      const inputEl = $('#ctf-input-' + c.id);
      const btnEl = $('#ctf-submit-' + c.id);

      if (isSolved) {
        totalScore += c.points;
        if (statusEl) { statusEl.textContent = 'SOLVED ✓'; statusEl.style.color = 'var(--security)'; }
        if (inputEl) { inputEl.value = c.solution; inputEl.disabled = true; }
        if (btnEl) { btnEl.disabled = true; btnEl.textContent = '[ solved ]'; }
      }
    });

    const badge = $('#ctf-score-badge');
    if (badge) badge.textContent = `SCORE: ${totalScore} / ${CHALLENGES.reduce((a, b) => a + b.points, 0)} PTS`;
  };

  const bind = () => {
    CHALLENGES.forEach(c => {
      $(`#ctf-submit-${c.id}`)?.addEventListener('click', () => {
        const val = $(`#ctf-input-${c.id}`).value;
        if (c.validate(val)) {
          const solved = getSolved();
          if (!solved.includes(c.id)) {
            solved.push(c.id);
            setSolved(solved);
            App.ui.toast('ctf', `correct! +${c.points} pts`, 'success');
            App.log.add('ctf', `solved challenge: ${c.id} (+${c.points} pts)`, 'ok');
            updateProgress();
          }
        } else {
          App.ui.toast('ctf', 'incorrect flag or answer — try again', 'bad');
        }
      });
    });
  };

  const init = () => {};
  return { init, load };
})();
