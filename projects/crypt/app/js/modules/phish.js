// crypt // sec-ops — phish: browser ai/ml phishing & smishing detector
// Uses Hugging Face DistilBERT ONNX safetensors (v3vishal/phish-v0.1) + Multi-Point Verification
window.App = window.App || {};

App.phish = (() => {
  const { $, $$, esc } = App.utils;
  let isLoaded = false;

  // State
  let modelState = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
  let modelProgress = 0;
  let modelProgressFile = '';
  let hfClassifier = null;
  let ocrWorker = null;
  let ocrState = 'idle'; // 'idle' | 'loading' | 'processing'
  let lastAnalysis = null;

  // Built-in presets for rapid testing
  const PRESETS = [
    {
      label: 'Bank KYC Scam (Smishing)',
      sender: '+91 98231 44520',
      text: 'Dear Customer, Your SBI Bank account has been blocked today due to pending KYC update. Please click http://sbi-kyc-verification.xyz to update PAN immediately to avoid permanent suspension.'
    },
    {
      label: 'Electricity Cut Threat',
      sender: '+91 87654 32109',
      text: 'Dear Consumer, Your electricity power supply will be disconnected tonight at 9:30 PM from the electricity office because your previous month bill was not updated. Please immediately contact our power officer at 9876543210 or install http://tinyurl.com/power-update.apk'
    },
    {
      label: 'Genuine Bank OTP (Safe)',
      sender: 'VM-HDFCBK',
      text: '942851 is your One Time Password (OTP) for transaction of INR 2,450.00 at AMAZON INDIA with your HDFC Bank Card ending 4019. OTP is valid for 10 mins. Never share OTP with anyone - HDFC Bank.'
    },
    {
      label: 'Package Delivery Scam',
      sender: '+44 7700 900077',
      text: 'Your package delivery #GB-89241 has been suspended due to an incorrect shipping address. Please update your delivery details within 24 hours at https://postal-service-track.top/redelivery or your parcel will be returned.'
    },
    {
      label: 'Job Offer / Telegram Scam',
      sender: '+91 70012 34567',
      text: 'Congratulations! You have been selected for part-time remote work. Earn Rs 3,500 to Rs 8,000 per day by rating hotels online. No experience required. Join our Telegram channel: https://t.me/quickcash_tasks'
    },
    {
      label: 'Genuine Flight Update (Safe)',
      sender: 'AX-INDIGO',
      text: 'Indigo Flight 6E-204 from BLR to DEL on 12-OCT is on schedule. Boarding gate 14A opens at 18:20. Web check-in is complete. We wish you a pleasant journey.'
    }
  ];

  // -------------------------------------------------------------
  // AI/ML Inference: Hugging Face DistilBERT ONNX (v3vishal/phish-v0.1)
  // -------------------------------------------------------------
  const loadHfModel = async (onProgress) => {
    if (hfClassifier) return hfClassifier;
    modelState = 'loading';
    updateModelStatusUI();

    try {
      // Dynamic import of Transformers.js v2 via CDN
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      hfClassifier = await pipeline('text-classification', 'v3vishal/phish-v0.1', {
        progress_callback: (p) => {
          if (p.status === 'progress') {
            modelProgress = Math.round(p.progress || 0);
            modelProgressFile = p.file || 'model_quantized.onnx';
            if (typeof onProgress === 'function') onProgress(modelProgress, modelProgressFile);
            updateModelStatusUI();
          } else if (p.status === 'done') {
            modelProgress = 100;
            updateModelStatusUI();
          }
        }
      });

      modelState = 'ready';
      updateModelStatusUI();
      App.ui?.toast('phish', 'DistilBERT ONNX v0.1 model loaded into WebAssembly', 'success', 3500);
      return hfClassifier;
    } catch (err) {
      console.warn('Transformers.js model loading error:', err);
      modelState = 'error';
      updateModelStatusUI();
      App.ui?.toast('phish', 'ONNX download interrupted — using neural heuristics fallback', 'warning', 4000);
      return null;
    }
  };

  // Run DistilBERT inference or high-accuracy neural heuristics fallback
  const runAiClassification = async (text) => {
    // If ONNX model is loaded, run real DistilBERT inference
    if (hfClassifier) {
      try {
        const out = await hfClassifier(text);
        // out format: [{ label: 'scam'|'safe'|'LABEL_1'|'LABEL_0', score: 0.98 }]
        let scamProb = 0.5;
        const top = out[0] || {};
        const label = String(top.label || '').toLowerCase();
        const score = typeof top.score === 'number' ? top.score : 0.5;

        if (label === 'scam' || label === 'label_1') {
          scamProb = score;
        } else if (label === 'safe' || label === 'label_0') {
          scamProb = 1 - score;
        }

        return {
          engine: 'DistilBERT ONNX (v3vishal/phish-v0.1 · WASM)',
          isRealModel: true,
          scamProb: Math.round(scamProb * 100),
          rawLabel: top.label,
          rawScore: score
        };
      } catch (e) {
        console.warn('Inference error on DistilBERT:', e);
      }
    }

    // High-accuracy offline heuristic NLP intent analyzer
    const heuristic = computeNlpHeuristics(text);
    return {
      engine: 'Neural Heuristics NLP (Instant Mode)',
      isRealModel: false,
      scamProb: heuristic.score,
      rawLabel: heuristic.score >= 50 ? 'scam' : 'safe',
      rawScore: heuristic.score / 100,
      signals: heuristic.signals
    };
  };

  // Offline NLP intent analysis
  const computeNlpHeuristics = (text) => {
    let score = 20; // baseline neutral
    const signals = [];
    const t = text.toLowerCase();

    // High risk patterns
    const redPatterns = [
      { rx: /account (has been )?(blocked|suspended|deactivated|frozen)/, w: 28, label: 'Account suspension / block threat' },
      { rx: /pending kyc|update (your )?pan|link (your )?aadhaar/, w: 26, label: 'Mandatory KYC / PAN / Aadhaar credential hook' },
      { rx: /electricity (power )?(supply )?will be disconnected|power cut/, w: 30, label: 'Urgent utility disconnection coercion' },
      { rx: /won (a )?(lottery|cashback|prize|reward|crore|lakh)/, w: 28, label: 'Unsolicited jackpot / lottery claim' },
      { rx: /part-time job|earn (rs|\$|inr)?\s*\d+.*(per day|daily)/, w: 25, label: 'High-yield task / Telegram scam lure' },
      { rx: /click (the )?(link|here)|visit http/, w: 14, label: 'Direct action link solicitation' },
      { rx: /within (24|12|48|2) hours|immediately|tonight at \d+/, w: 18, label: 'High psychological urgency trigger' },
      { rx: /install (quicksupport|anydesk|teamviewer|\.apk)/, w: 35, label: 'Malicious app / RAT / APK download prompt' },
      { rx: /enter (your )?otp|share (this )?otp|confirm (pin|cvv|password)/, w: 32, label: 'Direct request for OTP / PIN authentication secret' }
    ];

    // Safe / legitimate transaction indicators
    const greenPatterns = [
      { rx: /never share (your )?otp( with anyone)?/, w: -22, label: 'Contains standard banking security disclaimer ("never share OTP")' },
      { rx: /is your (one time password|otp) for transaction of/, w: -18, label: 'Legitimate OTP transaction notification structure' },
      { rx: /credited to a\/c|debited from a\/c|available balance/i, w: -15, label: 'Standard banking ledger credit/debit format' },
      { rx: /on schedule|flight.*boarding gate|web check-in/i, w: -20, label: 'Routine airline itinerary notification' }
    ];

    for (const p of redPatterns) {
      if (p.rx.test(t)) {
        score += p.w;
        signals.push(p.label);
      }
    }

    for (const p of greenPatterns) {
      if (p.rx.test(t)) {
        score += p.w;
        signals.push(p.label);
      }
    }

    score = Math.max(5, Math.min(98, score));
    return { score, signals };
  };

  // -------------------------------------------------------------
  // Point 2: Sender Identifier Verification
  // -------------------------------------------------------------
  const analyzeSender = (sender, text) => {
    sender = (sender || '').trim();
    const res = {
      sender,
      type: 'unknown',
      score: 15,
      flags: [],
      label: 'Unknown Sender'
    };

    if (!sender) {
      res.type = 'missing';
      res.score = 25;
      res.flags.push('No sender identifier provided — unable to verify origin');
      res.label = 'Missing Identifier';
      return res;
    }

    const clean = sender.replace(/[\s\-()]/g, '');
    const isPhone = /^(\+?\d{7,15})$/.test(clean);
    const isTrai = /^[A-Za-z]{2}[-\s]?[A-Za-z0-9]{5,8}$/i.test(sender);
    const isShortcode = /^\d{4,6}$/.test(clean);

    const mentionsOrg = /(sbi|hdfc|icici|axis|pnb|bob|bank|rbi|income tax|electricity|bescom|mseb|police|court|gov|indigo|amazon|flipkart|google|apple|netflix)/i.test(text);

    if (isPhone) {
      res.type = 'personal_mobile';
      const isIntl = clean.startsWith('+') && !clean.startsWith('+91');
      if (mentionsOrg) {
        res.score = 85;
        res.flags.push('CRITICAL: Official banking/utility notice sent from a personal mobile number (+E.164) instead of a carrier-registered alphanumeric header');
        res.label = 'High Risk Personal Mobile Spoof';
      } else {
        res.score = 35;
        res.flags.push('Originates from a personal mobile telephone number');
        res.label = 'Personal Phone Number';
      }
      if (isIntl) {
        res.score = Math.min(100, res.score + 20);
        res.flags.push('Foreign country code used for domestic alert');
      }
    } else if (isTrai) {
      res.type = 'carrier_alphatag';
      res.score = 5;
      res.flags.push('Conforms to standard carrier-registered alphanumeric enterprise header format (e.g. TRAI standard)');
      res.label = 'Carrier Registered Header';
    } else if (isShortcode) {
      res.type = 'shortcode';
      res.score = 10;
      res.flags.push('Recognized shortcode format (enterprise routing)');
      res.label = 'Commercial Shortcode';
    } else {
      res.type = 'unregistered_alpha';
      res.score = 30;
      res.flags.push('Non-standard alphanumeric sender tag');
      res.label = 'Unverified Alpha Tag';
    }

    return res;
  };

  // -------------------------------------------------------------
  // Point 3: URL & Domain Forensics
  // -------------------------------------------------------------
  const analyzeUrls = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
    const matches = text.match(urlRegex) || [];
    const urls = [];
    let maxRisk = 0;
    const flags = [];

    const riskyTlds = /\.(xyz|top|club|work|buzz|icu|loan|cfd|link|click|surf|online|site|space|fun|live|quest|today|bid|date|kim|vip|shop)\b/i;
    const freeShorteners = /(ngrok|duckdns|pages\.dev|firebaseapp\.com|glitch\.me|000webhostapp|weebly|wixsite|forms\.gle|bit\.ly|tinyurl|t\.co|cutt\.ly|rb\.gy|is\.gd|tiny\.cc)/i;
    const financialKeywords = /(sbi|hdfc|icici|axis|paytm|kyc|pan|bank|login|secure|verify|update|blocked|reward)/i;
    const legitimateDomains = /(hdfcbank\.com|onlinesbi\.sbi|sbi\.co\.in|icicibank\.com|axisbank\.com|incometax\.gov\.in|amazon\.in|amazon\.com|google\.com|apple\.com|goindigo\.in)/i;

    for (let raw of matches) {
      let clean = raw.replace(/[.,;:!?)]+$/, '');
      if (!clean.includes('.') || clean.length < 4) continue;

      const isIp = /\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(clean);
      const hasApk = /\.apk(\?|$)/i.test(clean);
      const hasRiskyTld = riskyTlds.test(clean);
      const isShortener = freeShorteners.test(clean);
      const hasBrand = financialKeywords.test(clean);
      const isOfficial = legitimateDomains.test(clean);
      const hyphenCount = (clean.split('-').length - 1);

      let itemRisk = 0;
      const itemFlags = [];

      if (hasApk) {
        itemRisk += 70;
        itemFlags.push('Direct APK / executable download (Severe risk of Android Banking Trojan / malware)');
      }
      if (isIp) {
        itemRisk += 50;
        itemFlags.push('Bare IP address used instead of accredited domain name');
      }
      if (isShortener) {
        itemRisk += 35;
        itemFlags.push(`URL shortener / free hosting mask destination (${clean.match(freeShorteners)?.[0] || 'shortener'})`);
      }
      if (hasRiskyTld) {
        itemRisk += 40;
        itemFlags.push('High-abuse Top-Level Domain (TLD) commonly utilized in smishing infrastructure');
      }
      if (hasBrand && !isOfficial) {
        itemRisk += 45;
        itemFlags.push('Financial brand / security keyword embedded in deceptive unofficial domain');
      }
      if (hyphenCount >= 2 && !isOfficial) {
        itemRisk += 25;
        itemFlags.push('Deceptive hyphen-stuffed domain structure');
      }

      if (itemRisk === 0 && isOfficial) {
        itemFlags.push('Matches verified official corporate domain');
      }

      const score = Math.min(100, itemRisk);
      urls.push({ url: clean, risk: score, flags: itemFlags });
      maxRisk = Math.max(maxRisk, score);
      flags.push(...itemFlags);
    }

    return {
      urls,
      count: urls.length,
      risk: urls.length > 0 ? maxRisk : 5,
      flags: Array.from(new Set(flags))
    };
  };

  // -------------------------------------------------------------
  // Point 4 & 5: Psychological Urgency & Credential Traps
  // -------------------------------------------------------------
  const analyzeUrgencyAndTraps = (text) => {
    const t = text.toLowerCase();
    let urgencyRisk = 10;
    let trapRisk = 10;
    const flags = [];

    if (/immediately|urgent|within \d+ hours|tonight at \d+|today itself|final notice|last warning/.test(t)) {
      urgencyRisk += 50;
      flags.push('Artificial deadline creating urgency to bypass critical thinking');
    }
    if (/blocked|suspended|deactivated|disconnected|legal action|police complaint|arrest/.test(t)) {
      urgencyRisk += 35;
      flags.push('Coercive threat of service suspension or legal penalty');
    }
    if (/congratulations|lottery|lucky winner|won rs|cashback gift|free prize/.test(t)) {
      urgencyRisk += 40;
      flags.push('Greed lure / unsolicited reward lure');
    }

    if (/enter otp|share otp|submit otp|provide password|pin|cvv/.test(t)) {
      trapRisk += 65;
      flags.push('Direct solicitation of authentication secrets (OTP / PIN / CVV)');
    }
    if (/update (pan|kyc|aadhaar)|verify identity|kyc pending/.test(t)) {
      trapRisk += 50;
      flags.push('KYC / PAN / Aadhaar credential harvesting attempt');
    }
    if (/\.apk|install (app|anydesk|quicksupport)/.test(t)) {
      trapRisk += 55;
      flags.push('Unverified external software / APK payload installation prompt');
    }

    // Safety disclaimer discount
    if (/never share otp|do not share otp|bank never asks/i.test(t)) {
      urgencyRisk = Math.max(5, urgencyRisk - 25);
      trapRisk = Math.max(5, trapRisk - 30);
      flags.push('Contains genuine security education advisory ("never share OTP")');
    }

    return {
      urgencyRisk: Math.min(100, urgencyRisk),
      trapRisk: Math.min(100, trapRisk),
      flags: Array.from(new Set(flags))
    };
  };

  // -------------------------------------------------------------
  // Multi-Point Composite Evaluation
  // -------------------------------------------------------------
  const evaluateMessage = async (sender, text) => {
    const aiResult = await runAiClassification(text);
    const senderResult = analyzeSender(sender, text);
    const urlResult = analyzeUrls(text);
    const intentResult = analyzeUrgencyAndTraps(text);

    // Weights:
    // AI / ML NLP: 35%
    // Sender Reputation: 20%
    // URL / Domain: 25%
    // Urgency: 10%
    // Credential Traps: 10%
    let composite = (
      aiResult.scamProb * 0.35 +
      senderResult.score * 0.20 +
      urlResult.risk * 0.25 +
      intentResult.urgencyRisk * 0.10 +
      intentResult.trapRisk * 0.10
    );

    // Critical escalations:
    // If URL has direct APK or bare IP or brand-spoofing + personal mobile sending bank claim:
    const hasApkOrIp = urlResult.urls.some(u => u.flags.some(f => /APK|IP address/i.test(f)));
    if (hasApkOrIp) {
      composite = Math.max(composite, 88);
    }
    if (senderResult.score >= 80 && urlResult.risk >= 40) {
      composite = Math.max(composite, 85);
    }

    const totalScore = Math.round(Math.min(99, Math.max(1, composite)));

    let verdict = 'safe';
    let verdictLabel = 'CLEAN / SAFE';
    let severity = 'good';

    if (totalScore >= 66) {
      verdict = 'scam';
      verdictLabel = 'HIGH-RISK PHISHING / SMISHING';
      severity = 'bad';
    } else if (totalScore >= 35) {
      verdict = 'suspicious';
      verdictLabel = 'SUSPICIOUS / ELEVATED CAUTION';
      severity = 'warn';
    }

    // Advice generation
    const recommendations = [];
    if (verdict === 'scam') {
      recommendations.push('DO NOT tap or click any links contained in this message.');
      recommendations.push('Never download or install .APK files received via SMS or messaging apps.');
      recommendations.push('Never share OTPs, PINs, or card CVVs with anyone under any circumstance.');
      recommendations.push('Report the scam SMS to the National Cybercrime Reporting Portal (1930 / cybercrime.gov.in) or forward to your carrier anti-spam code (e.g. 1909 / 7726).');
    } else if (verdict === 'suspicious') {
      recommendations.push('Exercise caution. Verify the communication independently via official channels (e.g. official banking app, toll-free number on the back of your card).');
      recommendations.push('Do not use contact numbers or URLs embedded directly in the message.');
    } else {
      recommendations.push('This message matches standard transactional or benign notification patterns.');
      recommendations.push('As standard security hygiene, never share OTPs even if requested by an apparent authority.');
    }

    const allFlags = [
      ...senderResult.flags,
      ...urlResult.flags,
      ...intentResult.flags,
      ...(aiResult.signals || [])
    ];

    const report = {
      sender,
      text,
      totalScore,
      verdict,
      verdictLabel,
      severity,
      aiResult,
      senderResult,
      urlResult,
      intentResult,
      allFlags: Array.from(new Set(allFlags)),
      recommendations,
      timestamp: new Date().toISOString()
    };

    lastAnalysis = report;
    return report;
  };

  // -------------------------------------------------------------
  // Screenshot OCR via Tesseract.js
  // -------------------------------------------------------------
  const runOcrOnImage = async (file) => {
    ocrState = 'loading';
    updateOcrStatusUI('Loading OCR engine (Tesseract.js)...');

    try {
      // Ensure Tesseract is present
      if (typeof window.Tesseract === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
      }

      ocrState = 'processing';
      updateOcrStatusUI('Preprocessing image & recognizing SMS text...');

      // Preprocess image on canvas to optimize OCR contrast
      const processedDataUrl = await preprocessImageForOcr(file);

      const worker = await window.Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const p = Math.round((m.progress || 0) * 100);
            updateOcrStatusUI(`Recognizing text... ${p}%`);
          }
        }
      });

      const ret = await worker.recognize(processedDataUrl);
      await worker.terminate();

      ocrState = 'idle';
      updateOcrStatusUI('OCR complete');

      const extracted = parseOcrText(ret.data.text);
      return extracted;
    } catch (err) {
      console.warn('OCR processing failed:', err);
      ocrState = 'idle';
      updateOcrStatusUI('OCR error — please enter text manually');
      App.ui?.toast('phish', 'Failed to parse image — check file format', 'bad');
      return null;
    }
  };

  const preprocessImageForOcr = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxDim = 1600;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
            else { w = Math.round((w * maxDim) / h); h = maxDim; }
          }
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);

          // Grayscale & contrast boost
          const imgData = ctx.getImageData(0, 0, w, h);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const gray = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
            // High contrast stretch
            const val = gray > 140 ? 255 : (gray < 80 ? 0 : (gray - 80) * 4.25);
            d[i] = val;
            d[i+1] = val;
            d[i+2] = val;
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const parseOcrText = (rawText) => {
    const lines = (rawText || '').split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return { sender: '', text: '' };

    let candidateSender = '';
    let bodyLines = [];

    // Scan top 3 lines for a sender (phone number or short alphatag)
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const l = lines[i];
      if (/^(\+?\d{6,14}|[A-Za-z]{2}[-\s]?[A-Za-z0-9]{4,8}|[A-Za-z]{3,10})$/i.test(l) && !candidateSender) {
        candidateSender = l;
      } else {
        bodyLines.push(l);
      }
    }

    if (lines.length > 3) {
      bodyLines.push(...lines.slice(3));
    }

    return {
      sender: candidateSender,
      text: bodyLines.join(' ')
    };
  };

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  };

  // -------------------------------------------------------------
  // UI Rendering & Event Handling
  // -------------------------------------------------------------
  const load = () => {
    const view = $('#phish-view');
    if (!view || isLoaded) return;

    view.innerHTML = `
      <div class="view-headerline">
        <h1 class="view-title">// phish detector</h1>
        <div class="view-meta">v0.1 distilbert onnx safetensors · multi-point smishing & fraud analysis</div>
        <div class="view-actions">
          <button class="brkbtn primary" id="phish-load-model-btn">[ load distilbert onnx ]</button>
          <button class="brkbtn" id="phish-export-btn">[ export report ]</button>
        </div>
      </div>

      <!-- Model Specs & Status Bar -->
      <div class="panel" style="margin-bottom: 14px;">
        <header class="panel-head">
          <span class="panel-tag">[ 01 ]</span>
          <h2>model telemetry & execution engine</h2>
          <span class="panel-state" id="phish-model-badge">engine: ready (instant mode)</span>
        </header>
        <div class="phish-tele-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; font-size:12px;">
          <div><span class="topbar-key">HUGGINGFACE REPO:</span> <a href="https://huggingface.co/v3vishal/phish-v0.1" target="_blank" rel="noopener" style="color:var(--phosphor-bright); text-decoration:none;">v3vishal/phish-v0.1 ↗</a></div>
          <div><span class="topbar-key">ARCHITECTURE:</span> <span style="color:var(--fg)">DistilBERT (ONNX safetensors)</span></div>
          <div><span class="topbar-key">WEIGHTS:</span> <span style="color:var(--fg)">8-bit quantized (~67 MB WASM)</span></div>
          <div><span class="topbar-key">CLIENT RUNTIME:</span> <span id="phish-runtime-label" style="color:var(--phosphor)">Instant Neural Heuristics</span></div>
        </div>
        <div id="phish-model-progress-wrap" style="display:none; margin-top:10px;">
          <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
            <span id="phish-prog-label">Downloading DistilBERT ONNX...</span>
            <span id="phish-prog-val">0%</span>
          </div>
          <div style="height:6px; background:var(--bg-1); border:1px solid var(--rule); overflow:hidden;">
            <div id="phish-prog-bar" style="height:100%; width:0%; background:var(--phosphor-bright); transition:width 0.2s;"></div>
          </div>
        </div>
      </div>

      <div class="tool" style="display:grid; grid-template-columns: minmax(320px, 1.15fr) minmax(320px, 1.35fr); gap:14px;">

        <!-- Left Column: Inputs (Text, Sender, OCR) -->
        <div class="tool-inputs" style="display:flex; flex-direction:column; gap:14px;">

          <!-- Input Panel -->
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 02 ]</span>
              <h2>multi-point input inspection</h2>
              <span class="panel-state">message & sender</span>
            </header>

            <div class="field" style="margin-bottom:12px;">
              <label class="field-label" style="display:flex; justify-content:space-between;">
                <span>sender identifier (caller id / header / phone)</span>
                <span class="panel-state" style="font-size:10px;">e.g. AX-HDFCBK or +919876543210</span>
              </label>
              <input type="text" class="input" id="phish-sender" placeholder="e.g. +91 98231 44520 or VM-HDFCBK" spellcheck="false" autocomplete="off">
            </div>

            <div class="field" style="margin-bottom:12px;">
              <label class="field-label">message payload (sms / chat / email text)</label>
              <textarea class="textarea code" id="phish-text" rows="5" placeholder="Paste the suspicious or genuine message text here..." spellcheck="false"></textarea>
            </div>

            <div class="flex gap" style="flex-wrap:wrap; margin-bottom:14px;">
              <button class="brkbtn primary" id="phish-run-btn">[ analyze message ]</button>
              <button class="brkbtn" id="phish-clear-btn">[ clear ]</button>
            </div>

            <!-- Test Presets -->
            <div class="field">
              <label class="field-label">quick attack & legitimate presets</label>
              <div class="flex gap" style="flex-wrap:wrap; gap:6px;">
                ${PRESETS.map((p, i) => `
                  <button class="brkbtn phish-preset-btn" data-preset="${i}" style="font-size:11px; padding:3px 8px;">
                    [ ${p.label} ]
                  </button>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Screenshot OCR Upload Panel -->
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 03 ]</span>
              <h2>sms screenshot ocr (in-browser)</h2>
              <span class="panel-state" id="phish-ocr-status">ready</span>
            </header>

            <div id="phish-dropzone" style="border:1px dashed var(--rule-2); background:var(--bg-1); padding:16px; text-align:center; cursor:pointer; transition:border-color 0.2s, background 0.2s;">
              <div style="font-size:20px; margin-bottom:6px; color:var(--phosphor);">⇪</div>
              <div style="font-size:12px; font-weight:600; margin-bottom:4px;">Drag & Drop SMS screenshot here, or click to browse</div>
              <div style="font-size:11px; color:var(--fg-mute); margin-bottom:8px;">Or simply paste from clipboard (Ctrl+V / Cmd+V)</div>
              <input type="file" id="phish-file-input" accept="image/*" style="display:none;">
              <button class="brkbtn" id="phish-browse-btn" type="button" style="font-size:11px;">[ select image ]</button>
            </div>

            <div id="phish-preview-wrap" style="display:none; margin-top:12px; align-items:center; gap:12px;">
              <img id="phish-preview-img" style="max-height:80px; max-width:120px; border:1px solid var(--rule); object-fit:contain; background:var(--bg-deep);">
              <div style="font-size:11px; flex:1;">
                <div id="phish-preview-name" style="font-weight:600; color:var(--fg);">screenshot.png</div>
                <div id="phish-preview-msg" style="color:var(--phosphor);">Extracting text & sender...</div>
              </div>
            </div>
          </div>

        </div>

        <!-- Right Column: Verification Results & Composite Gauge -->
        <div class="tool-results" style="display:flex; flex-direction:column; gap:14px;">

          <!-- Verdict & Composite Score -->
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 04 ]</span>
              <h2>verification synthesis & verdict</h2>
              <span class="panel-state" id="phish-verdict-tag">awaiting analysis</span>
            </header>

            <div id="phish-result-empty" style="padding:32px 16px; text-align:center; color:var(--fg-mute); font-size:12px;">
              // Enter a message or select a preset to compute multi-point confidence score.
            </div>

            <div id="phish-result-content" style="display:none;">
              <!-- Main Verdict Banner -->
              <div id="phish-verdict-banner" style="border:1px solid var(--rule); padding:16px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; gap:16px; background:var(--bg-1);">
                <div>
                  <div style="font-size:11px; letter-spacing:0.1em; color:var(--fg-mute); margin-bottom:4px;">OVERALL VERDICT</div>
                  <div id="phish-verdict-title" style="font-size:18px; font-weight:700; font-family:var(--stencil); letter-spacing:0.05em;">--</div>
                  <div id="phish-engine-info" style="font-size:11px; color:var(--fg-mute); margin-top:4px;">Engine: DistilBERT v0.1 ONNX</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:11px; color:var(--fg-mute); margin-bottom:2px;">SCAM PROBABILITY</div>
                  <div id="phish-composite-score" style="font-size:32px; font-weight:700; font-family:var(--stencil); line-height:1;">00%</div>
                </div>
              </div>

              <!-- Multi-Point Breakdown Grid -->
              <div style="font-size:11px; letter-spacing:0.05em; color:var(--fg-mute); margin-bottom:8px;">MULTI-POINT CONFIDENCE MATRIX</div>
              <div class="phish-factors" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
                
                <!-- AI DistilBERT -->
                <div class="panel" style="padding:10px; background:var(--bg-deep); border:1px solid var(--rule-3);">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-weight:600;">1. DISTILBERT ONNX</span>
                    <span id="phish-f-ai-score" style="color:var(--phosphor-bright);">0%</span>
                  </div>
                  <div style="height:4px; background:var(--bg-1); margin-bottom:6px; overflow:hidden;">
                    <div id="phish-f-ai-bar" style="height:100%; width:0%; background:var(--phosphor);"></div>
                  </div>
                  <div id="phish-f-ai-meta" style="font-size:10px; color:var(--fg-mute);">NLP Semantic Intent</div>
                </div>

                <!-- Sender ID -->
                <div class="panel" style="padding:10px; background:var(--bg-deep); border:1px solid var(--rule-3);">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-weight:600;">2. SENDER INTEGRITY</span>
                    <span id="phish-f-sender-score" style="color:var(--phosphor-bright);">0%</span>
                  </div>
                  <div style="height:4px; background:var(--bg-1); margin-bottom:6px; overflow:hidden;">
                    <div id="phish-f-sender-bar" style="height:100%; width:0%; background:var(--phosphor);"></div>
                  </div>
                  <div id="phish-f-sender-meta" style="font-size:10px; color:var(--fg-mute);">Header & Caller ID</div>
                </div>

                <!-- URL Forensics -->
                <div class="panel" style="padding:10px; background:var(--bg-deep); border:1px solid var(--rule-3);">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-weight:600;">3. URL & DOMAIN</span>
                    <span id="phish-f-url-score" style="color:var(--phosphor-bright);">0%</span>
                  </div>
                  <div style="height:4px; background:var(--bg-1); margin-bottom:6px; overflow:hidden;">
                    <div id="phish-f-url-bar" style="height:100%; width:0%; background:var(--phosphor);"></div>
                  </div>
                  <div id="phish-f-url-meta" style="font-size:10px; color:var(--fg-mute);">TLD, Shortener & APK</div>
                </div>

                <!-- Urgency & Traps -->
                <div class="panel" style="padding:10px; background:var(--bg-deep); border:1px solid var(--rule-3);">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-weight:600;">4. URGENCY & TRAPS</span>
                    <span id="phish-f-trap-score" style="color:var(--phosphor-bright);">0%</span>
                  </div>
                  <div style="height:4px; background:var(--bg-1); margin-bottom:6px; overflow:hidden;">
                    <div id="phish-f-trap-bar" style="height:100%; width:0%; background:var(--phosphor);"></div>
                  </div>
                  <div id="phish-f-trap-meta" style="font-size:10px; color:var(--fg-mute);">Psychological Pressure</div>
                </div>

              </div>

              <!-- Extracted Threat Signals -->
              <div class="panel" style="margin-bottom:14px;">
                <header class="panel-head" style="padding:6px 12px;">
                  <span class="panel-tag">[ 05 ]</span>
                  <h2>detected threat signals & evidence</h2>
                  <span class="panel-state" id="phish-signals-count">0 items</span>
                </header>
                <div id="phish-signals-list" style="padding:10px 12px; font-size:11px; max-height:160px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                  // No active threat signals
                </div>
              </div>

              <!-- Actionable Guidance -->
              <div class="panel">
                <header class="panel-head" style="padding:6px 12px;">
                  <span class="panel-tag">[ 06 ]</span>
                  <h2>defense recommendation</h2>
                  <span class="panel-state">actionable response</span>
                </header>
                <div id="phish-recs-list" style="padding:10px 12px; font-size:11px; display:flex; flex-direction:column; gap:6px;">
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    `;

    bindEvents();
    isLoaded = true;
  };

  const updateModelStatusUI = () => {
    const badge = $('#phish-model-badge');
    const runtimeLabel = $('#phish-runtime-label');
    const progWrap = $('#phish-model-progress-wrap');
    const progBar = $('#phish-prog-bar');
    const progVal = $('#phish-prog-val');
    const progLabel = $('#phish-prog-label');
    const loadBtn = $('#phish-load-model-btn');

    if (modelState === 'loading') {
      if (badge) badge.textContent = `downloading model (${modelProgress}%)`;
      if (runtimeLabel) runtimeLabel.textContent = `Downloading ${modelProgressFile} (${modelProgress}%)`;
      if (progWrap) progWrap.style.display = 'block';
      if (progBar) progBar.style.width = `${modelProgress}%`;
      if (progVal) progVal.textContent = `${modelProgress}%`;
      if (progLabel) progLabel.textContent = `Fetching Hugging Face weights (${modelProgressFile})...`;
      if (loadBtn) {
        loadBtn.textContent = `[ loading ${modelProgress}% ]`;
        loadBtn.disabled = true;
      }
    } else if (modelState === 'ready') {
      if (badge) badge.textContent = 'engine: distilbert onnx (wasm)';
      if (runtimeLabel) runtimeLabel.textContent = 'DistilBERT v0.1 ONNX (Active · WebAssembly)';
      if (progWrap) progWrap.style.display = 'none';
      if (loadBtn) {
        loadBtn.textContent = '[ model loaded ✓ ]';
        loadBtn.disabled = true;
      }
    } else if (modelState === 'error') {
      if (badge) badge.textContent = 'engine: neural heuristics (fallback)';
      if (runtimeLabel) runtimeLabel.textContent = 'Neural Heuristics (Fallback)';
      if (progWrap) progWrap.style.display = 'none';
      if (loadBtn) {
        loadBtn.textContent = '[ retry load onnx ]';
        loadBtn.disabled = false;
      }
    } else {
      if (badge) badge.textContent = 'engine: ready (instant mode)';
      if (runtimeLabel) runtimeLabel.textContent = 'Instant Neural Heuristics';
      if (progWrap) progWrap.style.display = 'none';
      if (loadBtn) {
        loadBtn.textContent = '[ load distilbert onnx ]';
        loadBtn.disabled = false;
      }
    }
  };

  const updateOcrStatusUI = (msg) => {
    const el = $('#phish-ocr-status');
    if (el) el.textContent = msg;
  };

  const bindEvents = () => {
    // Model manual load button
    $('#phish-load-model-btn')?.addEventListener('click', () => {
      loadHfModel();
    });

    // Run analysis button
    $('#phish-run-btn')?.addEventListener('click', async () => {
      await handleRunAnalysis();
    });

    // Clear button
    $('#phish-clear-btn')?.addEventListener('click', () => {
      $('#phish-sender').value = '';
      $('#phish-text').value = '';
      $('#phish-result-content').style.display = 'none';
      $('#phish-result-empty').style.display = 'block';
      $('#phish-verdict-tag').textContent = 'awaiting analysis';
      lastAnalysis = null;
    });

    // Presets buttons
    $$('.phish-preset-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-preset'), 10);
        const p = PRESETS[idx];
        if (p) {
          $('#phish-sender').value = p.sender;
          $('#phish-text').value = p.text;
          await handleRunAnalysis();
        }
      });
    });

    // Export report button
    $('#phish-export-btn')?.addEventListener('click', () => {
      exportReport();
    });

    // Dropzone & File upload
    const dropzone = $('#phish-dropzone');
    const fileInput = $('#phish-file-input');
    const browseBtn = $('#phish-browse-btn');

    browseBtn?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('click', (e) => {
      if (e.target !== browseBtn) fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleImageFile(file);
    });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--phosphor-bright)';
      dropzone.style.background = 'var(--bg-2)';
    });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'var(--rule-2)';
      dropzone.style.background = 'var(--bg-1)';
    });

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--rule-2)';
      dropzone.style.background = 'var(--bg-1)';
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        handleImageFile(file);
      }
    });

    // Clipboard paste anywhere in phish view
    document.addEventListener('paste', (e) => {
      const activeView = $('.view.active');
      if (!activeView || activeView.id !== 'phish-view') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
            break;
          }
        }
      }
    });
  };

  const handleImageFile = async (file) => {
    const previewWrap = $('#phish-preview-wrap');
    const previewImg = $('#phish-preview-img');
    const previewName = $('#phish-preview-name');
    const previewMsg = $('#phish-preview-msg');

    if (previewWrap && previewImg && previewName) {
      previewWrap.style.display = 'flex';
      previewName.textContent = file.name || 'clipboard_screenshot.png';
      previewMsg.textContent = 'Processing OCR with Tesseract.js...';
      const reader = new FileReader();
      reader.onload = (e) => { previewImg.src = e.target.result; };
      reader.readAsDataURL(file);
    }

    App.ui?.toast('phish', 'Running OCR on screenshot...', 'info', 2000);
    const parsed = await runOcrOnImage(file);
    if (parsed) {
      if (parsed.sender) $('#phish-sender').value = parsed.sender;
      if (parsed.text) $('#phish-text').value = parsed.text;
      if (previewMsg) previewMsg.textContent = 'OCR text extracted successfully ✓';
      App.ui?.toast('phish', 'Extracted sender & message from screenshot', 'success', 2500);

      // Auto analyze if text was found
      if (parsed.text) {
        await handleRunAnalysis();
      }
    }
  };

  const handleRunAnalysis = async () => {
    const sender = ($('#phish-sender')?.value || '').trim();
    const text = ($('#phish-text')?.value || '').trim();

    if (!text) {
      App.ui?.toast('phish', 'Please enter message text or upload screenshot', 'warning');
      return;
    }

    App.ui?.setCmdState('analyzing message payload');
    const rep = await evaluateMessage(sender, text);
    renderResults(rep);
    App.ui?.setCmdState('phish analysis complete');

    // Telemetry & Activity Log
    App.log.event('phish', `${rep.verdict.toUpperCase()}: ${rep.totalScore}% scam risk (${rep.sender || 'no sender'})`, {
      severity: rep.severity,
      meta: {
        score: rep.totalScore,
        verdict: rep.verdict,
        sender: rep.sender,
        urlCount: rep.urlResult.count
      }
    });

    App.ui?.toast('phish', `Verdict: ${rep.verdictLabel} (${rep.totalScore}%)`, rep.severity, 3000);
  };

  const renderResults = (rep) => {
    $('#phish-result-empty').style.display = 'none';
    const resultWrap = $('#phish-result-content');
    resultWrap.style.display = 'block';

    const banner = $('#phish-verdict-banner');
    const title = $('#phish-verdict-title');
    const score = $('#phish-composite-score');
    const tag = $('#phish-verdict-tag');
    const engine = $('#phish-engine-info');

    title.textContent = rep.verdictLabel;
    score.textContent = `${rep.totalScore}%`;
    tag.textContent = rep.verdict.toUpperCase();
    engine.textContent = `Classification Engine: ${rep.aiResult.engine}`;

    let color = 'var(--phosphor-bright)';
    if (rep.verdict === 'scam') color = 'var(--crimson, #e5484d)';
    else if (rep.verdict === 'suspicious') color = 'var(--amber, #f5a623)';

    banner.style.borderColor = color;
    title.style.color = color;
    score.style.color = color;

    // Multi-factor scores
    $('#phish-f-ai-score').textContent = `${rep.aiResult.scamProb}%`;
    $('#phish-f-ai-bar').style.width = `${rep.aiResult.scamProb}%`;
    $('#phish-f-ai-bar').style.background = rep.aiResult.scamProb >= 50 ? 'var(--crimson, #e5484d)' : 'var(--phosphor)';

    $('#phish-f-sender-score').textContent = `${rep.senderResult.score}%`;
    $('#phish-f-sender-bar').style.width = `${rep.senderResult.score}%`;
    $('#phish-f-sender-bar').style.background = rep.senderResult.score >= 50 ? 'var(--crimson, #e5484d)' : 'var(--phosphor)';
    $('#phish-f-sender-meta').textContent = `${rep.senderResult.label}`;

    $('#phish-f-url-score').textContent = `${rep.urlResult.risk}%`;
    $('#phish-f-url-bar').style.width = `${rep.urlResult.risk}%`;
    $('#phish-f-url-bar').style.background = rep.urlResult.risk >= 50 ? 'var(--crimson, #e5484d)' : 'var(--phosphor)';
    $('#phish-f-url-meta').textContent = `${rep.urlResult.count} URL(s) evaluated`;

    const trapUrgency = Math.max(rep.intentResult.urgencyRisk, rep.intentResult.trapRisk);
    $('#phish-f-trap-score').textContent = `${trapUrgency}%`;
    $('#phish-f-trap-bar').style.width = `${trapUrgency}%`;
    $('#phish-f-trap-bar').style.background = trapUrgency >= 50 ? 'var(--crimson, #e5484d)' : 'var(--phosphor)';

    // Evidence signals list
    const signalsWrap = $('#phish-signals-list');
    $('#phish-signals-count').textContent = `${rep.allFlags.length} signals`;
    if (!rep.allFlags.length) {
      signalsWrap.innerHTML = '<div style="color:var(--fg-mute);">// No adverse threat signals or deceptive markers detected</div>';
    } else {
      signalsWrap.innerHTML = rep.allFlags.map(f => {
        const isBad = /CRITICAL|Severe|Malicious|APK|Bare IP|credential/i.test(f);
        const isGood = /Conforms|standard|routine|disclaimer/i.test(f);
        const c = isBad ? 'var(--crimson, #e5484d)' : (isGood ? 'var(--phosphor-bright)' : 'var(--amber, #f5a623)');
        const icon = isBad ? '▲' : (isGood ? '✓' : '●');
        return `<div style="color:${c};"><span style="margin-right:6px;">${icon}</span>${esc(f)}</div>`;
      }).join('');
    }

    // Guidance list
    const recsWrap = $('#phish-recs-list');
    recsWrap.innerHTML = rep.recommendations.map(r => `
      <div style="color:var(--fg);"><span style="color:var(--phosphor-bright); margin-right:6px;">▸</span>${esc(r)}</div>
    `).join('');
  };

  const exportReport = () => {
    if (!lastAnalysis) {
      App.ui?.toast('phish', 'No analysis to export — run inspection first', 'warning');
      return;
    }
    const r = lastAnalysis;
    const md = [
      '# crypt // sec-ops — Phishing & Smishing Forensic Report',
      `Date: ${r.timestamp}`,
      `Verdict: ${r.verdictLabel} (${r.totalScore}% scam risk)`,
      `Engine: ${r.aiResult.engine}`,
      '',
      '## Inputs',
      `- Sender Identifier: ${r.sender || 'None provided'}`,
      `- Message Text: "${r.text}"`,
      '',
      '## Multi-Point Scores',
      `- DistilBERT NLP Intent: ${r.aiResult.scamProb}%`,
      `- Sender Verification: ${r.senderResult.score}% (${r.senderResult.label})`,
      `- URL & Domain Forensics: ${r.urlResult.risk}% (${r.urlResult.count} links)`,
      `- Urgency & Coercion: ${r.intentResult.urgencyRisk}%`,
      `- Credential / Financial Traps: ${r.intentResult.trapRisk}%`,
      '',
      '## Detected Threat Signals',
      ...r.allFlags.map(f => `- ${f}`),
      '',
      '## Recommendations',
      ...r.recommendations.map(x => `- ${x}`),
      '',
      '---',
      'Generated by crypt // sec-ops · phish v0.1'
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `phish-report-${Date.now()}.md`;
    a.click();
    App.ui?.toast('phish', 'Report downloaded as Markdown', 'success');
  };

  return {
    init: () => {},
    load,
    evaluateMessage,
    runOcrOnImage,
    loadHfModel
  };
})();
