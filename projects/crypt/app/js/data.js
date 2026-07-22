// crypt // sec-ops — static reference data
window.App = window.App || {};

App.data = {
  // Tiny built-in sample so things work even if rockyou-top.js fails to load.
  common_passwords: [
    "123456", "password", "12345678", "qwerty", "abc123", "111111",
    "iloveyou", "admin", "welcome", "monkey", "dragon", "letmein"
  ],

  // Sequences detected by the zxcvbn-style strength engine.
  keyboard_rows: [
    "qwertyuiop", "asdfghjkl", "zxcvbnm",
    "1234567890", "qazwsxedc"
  ],

  hash_examples: {
    md5:     "5f4dcc3b5aa765d61d8327deb882cf99",     // "password"
    sha1:    "5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8", // "password"
    sha256:  "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    bcrypt:  "$2b$12$KIXqJqMQF.gPzPzAS9Q7..bX7K4uH4o6cVwfqEz5cT.PZQpQVo3a2",
    argon2:  "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0$hashbytes"
  },

  // Diceware-ish wordlist (~250 short, easy-to-type, non-offensive words)
  diceware: [
    "able","acid","aged","army","arch","atom","aura","axis","bake","barn","bear","beat","bell","bend",
    "best","bird","blue","blur","boat","bold","bone","book","bowl","bran","bree","brew","brim","cake",
    "calm","camp","cape","cart","case","cash","cave","cell","chip","clay","clip","clue","cobra","code",
    "coil","coin","cold","comb","cone","cord","core","cork","corn","cove","crab","crop","crow","cube",
    "curl","cyan","dare","dart","data","dawn","deck","deep","deer","dirt","dive","dock","done","dose",
    "dove","draw","drum","duct","duke","dusk","dust","duty","each","eagle","earl","echo","edge","ego",
    "elm","else","ember","epic","etch","ever","evil","exit","face","fame","fang","fast","feed","fern",
    "fern","feud","fish","fizz","flag","flax","fled","flex","flip","floe","flow","foam","fold","font",
    "form","fort","four","frog","from","fuel","fuse","gain","gala","gap","gate","gear","gem","gene",
    "gent","gift","gild","glow","glue","gold","good","grid","grin","grip","gulf","gull","half","halo",
    "hand","harp","hawk","heap","heir","helm","herb","hike","hill","hive","hold","holy","hood","hoop",
    "horn","host","hour","hull","hunt","hush","idea","idol","inch","iris","iron","ivy","jade","jam",
    "jazz","jest","joke","jolt","joy","junk","kale","keep","keen","kelp","kept","keyboard","kind","king",
    "kiln","kit","kite","knee","knife","knit","knot","know","lace","lair","lake","lamp","lance","land",
    "lane","lark","lash","lava","lawn","lazy","lead","leaf","leap","left","lemon","lens","levy","lift",
    "lime","limp","line","link","lion","lisp","list","loaf","loan","lock","loft","logo","long","loop",
    "lord","lose","loss","lost","loud","love","luck","lush","lyric","made","main","mane","mango","many",
    "map","mark","marsh","mask","mast","mate","math","maze","mead","meek","melt","memo","mend","menu",
    "mesh","midst","milk","mill","mind","mine","mint","mire","mirth","mist","moat","mode","molt","monk",
    "moon","moss","mote","mound","muse","myth","name","nape","navy","near","neck","need","nest","next",
    "nice","nine","node","noon","nope","norm","nose","note","oak","oat","odd","ogre","okay","olive",
    "omen","once","onyx","oops","open","opera","opal","ore","ouch","ours","oval","oven","over","owl",
    "pact","pail","pair","palm","pane","park","part","past","path","peak","pear","peep","peer","pelt",
    "perk","pest","phase","pier","pike","pile","pill","pine","ping","pipe","plan","play","plot","plow",
    "plug","plum","poet","pole","poll","pond","pool","pore","port","pose","post","pour","pram","pray",
    "prim","prior","prism","prom","prop","prose","prowl","puck","puff","pull","pulp","puma","pump",
    "punch","punt","pure","push","puzzle","quad","quail","quark","quart","quay","queen","quell","quick",
    "quill","quilt","quip","quirk","quiz","quota","race","raft","rage","raid","rail","rain","rake","ramp",
    "rang","rank","rapid","rare","rash","rate","raze","reach","react","real","reap","rebel","reef",
    "rein","relay","rely","rest","rib","rice","rich","rid","ride","rim","ring","rinse","rip","ripe",
    "rise","rite","river","road","roam","roar","robe","rock","rode","rogue","role","roll","roof","rook",
    "room","root","rose","rosin","rote","round","rove","row","royal","ruby","rude","rug","rule",
    "rune","rung","runt","rush","rust","sack","sage","said","sail","sake","salt","same","sand","sane",
    "sang","sash","save","scale","scarf","scent","scion","scope","scout","screw","seal","seat","sect",
    "seed","seek","seem","seen","sense","sent","sepia","serf","setup","seven","sew","shaft","shame",
    "shape","share","sharp","shave","sheaf","shed","sheen","sheep","sheet","shelf","shell","shift","shin",
    "shine","ship","shire","shoe","shoot","shop","shore","shorn","short","shot","shout","show","shrub"
  ],

  // Pattern signatures for the threat-payload analyzer.
  threat_signatures: {
    "sql-injection": [
      { rx: /'\s*or\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i, label: "classic OR 1=1 tautology", weight: 25 },
      { rx: /union\s+select/i, label: "UNION SELECT extraction", weight: 30 },
      { rx: /drop\s+table/i, label: "DROP TABLE destructive intent", weight: 30 },
      { rx: /;.*--/, label: "stacked-query + line comment", weight: 20 },
      { rx: /sleep\s*\(\s*\d+\s*\)/i, label: "time-based blind SQLi (SLEEP)", weight: 25 },
      { rx: /benchmark\s*\(/i, label: "MySQL BENCHMARK timing oracle", weight: 25 },
      { rx: /information_schema/i, label: "schema discovery", weight: 20 },
      { rx: /load_file\s*\(/i, label: "MySQL LOAD_FILE() exfil", weight: 25 },
      { rx: /xp_cmdshell/i, label: "MSSQL xp_cmdshell RCE", weight: 35 }
    ],
    "xss": [
      { rx: /<script[\s>]/i, label: "raw <script> tag", weight: 30 },
      { rx: /on(?:error|load|click|mouseover|focus)\s*=/i, label: "inline event handler", weight: 25 },
      { rx: /javascript\s*:/i, label: "javascript: URI scheme", weight: 20 },
      { rx: /<img[^>]+onerror/i, label: "<img onerror> payload", weight: 25 },
      { rx: /document\.cookie/i, label: "cookie exfil reference", weight: 25 },
      { rx: /<svg[\s>]/i, label: "SVG vector (often event-handler carrier)", weight: 15 },
      { rx: /eval\s*\(/i, label: "eval() execution", weight: 20 }
    ],
    "csrf": [
      { rx: /<form[^>]+method\s*=\s*['"]?post/i, label: "auto-POSTing form", weight: 30 },
      { rx: /type\s*=\s*['"]?hidden/i, label: "hidden field (likely token spoof)", weight: 20 },
      { rx: /action\s*=\s*['"]?https?:/i, label: "cross-origin action target", weight: 25 },
      { rx: /submit\(\)/i, label: "auto-submit script", weight: 20 }
    ],
    "directory-traversal": [
      { rx: /(\.\.[\\/]){2,}/, label: "stacked ../ traversal", weight: 30 },
      { rx: /etc[\\/]passwd/, label: "/etc/passwd target", weight: 25 },
      { rx: /win(?:dows)?[\\/]win\.ini/i, label: "Windows win.ini target", weight: 25 },
      { rx: /%2e%2e%2f/i, label: "URL-encoded traversal", weight: 25 },
      { rx: /\.\.%2f/i, label: "mixed-encoded traversal", weight: 25 },
      { rx: /\/proc\/self\//, label: "/proc/self exposure", weight: 25 }
    ],
    "command-injection": [
      { rx: /;\s*(?:cat|ls|whoami|id|pwd|uname)/i, label: "semicolon chain to recon command", weight: 30 },
      { rx: /\|\s*(?:nc|netcat|curl|wget|bash)/i, label: "pipe to network/shell tool", weight: 30 },
      { rx: /`[^`]+`/, label: "backtick command substitution", weight: 20 },
      { rx: /\$\([^)]+\)/, label: "$(...) command substitution", weight: 20 },
      { rx: /&{1,2}\s*\w+/, label: "&& or & command chain", weight: 20 },
      { rx: /(\/etc\/passwd|\/etc\/shadow)/, label: "credential file read", weight: 25 }
    ]
  },

  // Educational mitigations per attack class.
  threat_mitigations: {
    "sql-injection": [
      "parameterized queries / prepared statements (never string-concat user input)",
      "least-privilege DB account; revoke FILE, EXECUTE, DDL where unused",
      "allow-list input validation by type (int, uuid, enum) before query",
      "WAF rules for UNION, SLEEP, INTO OUTFILE keywords as defence-in-depth"
    ],
    "xss": [
      "context-aware output encoding (HTML body, attribute, JS, URL, CSS)",
      "Content-Security-Policy with strict default-src 'self', no unsafe-inline",
      "Trusted Types API on modern browsers; HttpOnly cookies on session IDs",
      "DOMPurify (or equivalent) for any user-rendered rich HTML"
    ],
    "csrf": [
      "double-submit CSRF token (cookie + header), verify on every state-changing route",
      "SameSite=Lax (Strict for sensitive) on session cookies",
      "Origin / Referer validation as a defence-in-depth layer",
      "re-authentication for high-value actions (transfer, role change)"
    ],
    "directory-traversal": [
      "resolve and canonicalize paths; reject any result outside the allowed root",
      "use indexed handles or UUIDs, never raw user-supplied filenames",
      "drop privileges; chroot or container the file-serving process",
      "deny dotfiles and known-sensitive paths at the web-server layer"
    ],
    "command-injection": [
      "never call shell with concatenated input — use array-form exec (execFile)",
      "allow-list of permitted command names, with strict argument validators",
      "drop privileges; run in a seccomp/AppArmor sandbox",
      "audit logging on every exec call for forensic trace"
    ]
  },

  algorithm_meta: {
    "aes-cbc":   { label: "AES-256-CBC",      family: "symmetric", quantum_safe: false },
    "aes-gcm":   { label: "AES-256-GCM",      family: "symmetric", quantum_safe: false },
    "caesar":    { label: "Caesar shift",     family: "classical", quantum_safe: false },
    "vigenere":  { label: "Vigenère",         family: "classical", quantum_safe: false },
    "xor":       { label: "XOR stream",       family: "classical", quantum_safe: false }
  }
};
