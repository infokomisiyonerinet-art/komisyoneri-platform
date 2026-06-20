// ── PAGE NAVIGATION (see unified go() at bottom of script)

// ── LANGUAGE TOGGLE
let curLang = 'rw';

var TX = {
  rw: {
    verified:      'Yemejwe',
    viewDetail:    'Reba Birenzeho',
    noListings:    'Nta mitungo irahari ubu',
    demoBtn:       '✦ Reba Demo Listings',
    noPropsCat:    'Nta mitungo muri iyi categorie',
    noMyProps:     'Nta mitungo wanditse kuri platform.',
    addProp:       '+ Andika Imitungo',
    waMsg:         'Muraho! Ndi gushakisha imitungo: ',
    waMsgEnd:      '. Mushobora kunsobanurira birenzeho?',
    delConfirm:    'Ugukosora? Imitungo izasibwa burundu.',
    deleted:       '🗑️ Imitungo yasibwe.',
    delAllConfirm: 'Ugukosora? Imitungo YOSE izasibwa burundu!',
    delAllDone:    '🗑️ Imitungo yose yasibwe. (',
    labApproved:   'Yemejwe',
    labRejected:   'Yananiwe',
    labAll:        'Zose'
  },
  en: {
    verified:      'Verified',
    viewDetail:    'View Details',
    noListings:    'No listings yet',
    demoBtn:       '✦ View Demo Listings',
    noPropsCat:    'No properties in this category',
    noMyProps:     'You have not listed any properties yet.',
    addProp:       '+ Add Property',
    waMsg:         'Hello! I am looking for a property: ',
    waMsgEnd:      '. Could you give me more details?',
    delConfirm:    'Are you sure? This property will be permanently deleted.',
    deleted:       '🗑️ Property deleted.',
    delAllConfirm: 'Are you sure? ALL properties will be permanently deleted!',
    delAllDone:    '🗑️ All properties deleted. (',
    labApproved:   'Approved',
    labRejected:   'Rejected',
    labAll:        'All'
  }
};

function t(key) {
  return (TX[curLang] || TX.rw)[key] || key;
}

function setLang(lang) {
  curLang = lang;
  document.documentElement.lang = lang === 'rw' ? 'rw' : 'en';
  document.title = lang === 'rw'
    ? 'KOMISIYONERI — Imitungo mu Rwanda | Rwanda Real Estate Platform'
    : 'KOMISIYONERI — Buy & Sell Property in Rwanda | Real Estate Platform';
  document.querySelectorAll('[data-rw],[data-en]').forEach(el => {
    const val = el.getAttribute('data-' + lang);
    if (val === null) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
  document.getElementById('lb-rw').classList.toggle('active', lang === 'rw');
  document.getElementById('lb-en').classList.toggle('active', lang === 'en');
  // Re-render dynamic content so hardcoded strings also update
  loadApprovedProperties();
}

// ── SEARCH TABS
document.querySelectorAll('.s-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.s-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── CHIP FILTERS
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.closest('.chips-row')?.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
  });
});

// ── ROOM CHIPS (3D tour)
document.querySelectorAll('.r-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.closest('.room-chips')?.querySelectorAll('.r-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    showToast((curLang === 'rw' ? 'Virtual Tour: ' : 'Switching to: ') + chip.textContent);
  });
});

// ── DETAIL TABS
document.querySelectorAll('.det-tab').forEach((tab, i) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.det-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

// ── THUMB GALLERY
document.querySelectorAll('.thumb').forEach(th => {
  th.addEventListener('click', () => {
    th.closest('.det-thumbs')?.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
    th.classList.add('active');
    const colors = ['g1','g2','g3','g4','g5','g7'];
    const hero = document.querySelector('.det-hero-bg');
    if (hero) {
      hero.className = 'det-hero-bg ' + (colors[Array.from(th.parentElement.children).indexOf(th)] || 'g1');
    }
  });
});

// ── SORT / VIEW buttons
document.querySelectorAll('.v-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.v-btns').querySelectorAll('.v-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── RANGE SLIDER
const rs = document.querySelector('.range-sl');
const rv = document.getElementById('range-val');
if (rs && rv) rs.addEventListener('input', () => { rv.textContent = rs.value + 'M RWF'; });

// ── FAV BUTTONS
document.querySelectorAll('.p-fav').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    btn.classList.toggle('on');
    showToast(btn.classList.contains('on') ? (curLang === 'rw' ? 'Yongewe ku rutonde!' : 'Added to favorites!') : (curLang === 'rw' ? 'Yakuwe ku rutonde' : 'Removed from favorites'));
  });
});

// ── PAYMENT MODAL
function openPay() {
  kmTrack('begin_checkout',{});
  if(kmFlag('payments')) injectRealPayForm();
  document.getElementById('pay-modal').classList.add('open');
}
function closePay() { document.getElementById('pay-modal').classList.remove('open'); }
document.getElementById('pay-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closePay(); });

// ── CHAT WIDGET v2 — robust, persistent, typing indicator
var chatOpen = false;

function toggleChat() {
  var panel = document.getElementById('chat-panel');
  var fab = document.getElementById('chat-fab-btn');
  if (!panel) return;
  chatOpen = !chatOpen;
  if (chatOpen) {
    panel.classList.add('open');
    if (fab) fab.style.display = 'none';
    // scroll to bottom
    var msgs = document.getElementById('chat-msgs');
    if (msgs) setTimeout(function(){ msgs.scrollTop = msgs.scrollHeight; }, 100);
  } else {
    panel.classList.remove('open');
    if (fab) fab.style.display = 'flex';
  }
}
var chatHistory = [];
var typingTimer = null;

// ==========================================
//  KOMISIYONERI — AI CHAT (Claude API)
//  Izirikana ibiri muri system yacu yose
// ==========================================

var KOMISIYONERI_SYSTEM = `You are NOHERI, the AI assistant of KOMISIYONERI Connectpro Services — Rwanda's #1 Real Estate Platform.

CRITICAL LANGUAGE RULE:
- ALWAYS reply in the EXACT same language the user writes in
- If user writes in ENGLISH → reply in ENGLISH only
- If user writes in KINYARWANDA → reply in KINYARWANDA only
- If user writes in FRENCH → reply in FRENCH only
- NEVER switch languages mid-conversation unless the user does
- NEVER reply in Kinyarwanda if the user wrote in English

CORE INSTRUCTIONS:
- Be helpful, fast, and friendly
- Answer ALL questions about properties, prices, agents, and services
- Subiza ibibazo BYOSE bijyanye n'imitungo, ibiciro, serivisi, no guhuza na agents
- Niba udafite igisubizo, tanga amakuru ya KOMISIYONERI (telefoni', 'error', email)

== AMAKURU Y'IKIGO ==
- Izina: KOMISIYONERI Connectpro Services Ltd
- Headquarters: Kigali, Rwanda
- Telefoni/WhatsApp: +250 783 177 254
- Imeyili: komisiyonericonnectproservices@gmail.com
- Website: www.komisiyoneri.com

== FEATURES 6 ZA PLATFORM ==
1. Smart Listings — Imitungo irenga 1,240 mu Rwanda yose
2. Virtual Tours 3D/VR — Reba inzu mu 3D utajya ahandi
3. Digital Payments — MTN MoMo, Airtel Money, Karita ya Banki
4. AI Market Analytics — Ibiciro biraganuye, trends, ROI
5. Agent Dashboard — Agents bareba imitungo yabo
6. Live Chat & Support — Guhuza na agents vuba

== IMITUNGO IBONEKA (ingero) ==
- Villa Kimironko Gasabo: 120M RWF | 4BR 2BA | 320m² | 3D Tour
- Apartimanı Niboye Kicukiro: 450K RWF/kwezi | 2BR 1BA | 85m²
- Inzu Musanze Muhoza: 85M RWF | 3BR 2BA | 500m²
- Ubutaka Rubavu Gisenyi: 45M RWF | 1,200m²
- Inyubako CBD Nyarugenge: 220M RWF | 6 Floors | 800m²
- Studio Remera Gasabo: 280K RWF/kwezi | 1BR | 42m²

== IBICIRO BY'ISOKO (Kigali 2025) ==
- Gasabo: 372,000 RWF/m² (+8.2%)
- Nyarugenge: 328,000 RWF/m² (+5.1%)
- Kicukiro: 305,000 RWF/m² (+6.4%)
- Musanze: 238,000 RWF/m²
- Rubavu: 215,000 RWF/m²
- Huye: 186,000 RWF/m²
- Nyagatare: 164,000 RWF/m²

== IBICIRO BY'UBUKODE (Kigali) ==
- Studio: 150,000–350,000 RWF/kwezi
- Apartimanı 2BR: 300,000–600,000 RWF/kwezi
- Villa: 700,000–2,500,000 RWF/kwezi

== AGENT WEMEWE ==
- NOHERI: Senior Agent | 127 inzu zagurishijwe | Rating 4.9/5 | Tel: +250 783 177 254

== SERIVISI ==
- Gukodesha inzu (ubukode)
- Kugura inzu cyangwa ubutaka
- Gukiranura imitungo
- Virtual tours 3D
- AI valuation y'imitungo
- E-contracts (amasezerano ya digitale)
- Market analytics

Niba umuntu asaba guhuza na agent: mubwire hamagare +250 783 177 254 cyangwa WhatsApp.
Niba asaba inzu: baza uturere, ubwoko, ibyumba, na budget.
- Villa 4BR: 600,000-1,500,000 RWF/kwezi

- Villa 4BR: 600,000-1,500,000 RWF/kwezi

IBICIRO BYO KUGURA:
- Ubutaka gusa: 20M-80M RWF
- Inzu 2BR: 35M-80M RWF
- Villa 3-4BR: 80M-200M RWF
- Inyubako y'Ubucuruzi: 150M-500M+ RWF

REVENUE MODEL YA KOMISIYONERI:
- Komisiyoni kuri transaction: 3–5%
- Subscription ya agents: 50,000 RWF/kwezi
- Premium listings, AI Analytics, Digital Payments

AKARERE TWAKORA:
- Akarere 30 ka Rwanda — Kigali, Amajyaruguru, Amajyepfo, Iburasirazuba, Iburengerazuba

IYANDIKISHWA UBUNTU:
- Umushaka inzu: ubuntu, nta mafaranga asabwa
- Nyir'imitungo: ubuntu, imitungo 3 y'mbere ubuntu
- Agent: 50,000 RWF/kwezi (subscription)

== INZIRA YO GUSUBIZA ==
- Reply ONLY in the user's language (English if they write English, Kinyarwanda if Kinyarwanda)
- Keep replies short (2-4 lines max)
- Buri gihe shyira amakuru ya nyayo ari mu system (ibiciro, telefoni', 'error', imeyili', 'error')
- Niba utazi ikintu, bwira ko uzahuza na agent: +250 783 177 254
- Subiza neza, nk'umukomisiyoneri w'inzobere wawe
- Ntukavuge "AI" cyangwa "Claude" — uri "KOMISIYONERI Support"`;

var chatApiLoading = false;
var ANTHROPIC_API_KEY = 'via-vercel';  // Vercel backend ikora

function toggleApiInput() {
  var row = document.getElementById('chat-apirow');
  if (!row) return;
  row.style.display = row.style.display === 'none' ? 'block' : 'none';
  if (row.style.display === 'block') {
    var inp = document.getElementById('chat-api-inp');
    if (inp && ANTHROPIC_API_KEY) inp.value = ANTHROPIC_API_KEY;
    setTimeout(function(){ if(inp) inp.focus(); }, 100);
  }
}

function saveApiKey() {
  var inp = document.getElementById('chat-api-inp');
  if (!inp) return;
  var key = inp.value.trim();
  if (!key.startsWith('sk-ant')) {
    showToast(curLang === 'rw' ? 'Key ntiyizewe — tangira na "sk-ant"' : 'Invalid key — must start with "sk-ant"');
    return;
  }
  ANTHROPIC_API_KEY = key;
  // Update status
  var status = document.getElementById('chat-status');
  if (status) { status.textContent = curLang === 'rw' ? 'AI Ikorana ✓' : 'AI Connected ✓'; status.style.color = '#27A84A'; }
  // Hide input, show connected badge
  var row = document.getElementById('chat-apirow');
  if (row) {
    row.innerHTML = '<div class="chat-api-connected"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>API Key yabitswe — KOMISIYONERI AI irakora!</div>';
  }
  // Add welcome message
  addMsg(curLang === 'rw' 
    ? 'Nziza! KOMISIYONERI AI irashobora ubu gusubiza ibibazo byose ku mitungo, ibiciro, agents, na serivisi zacu!' 
    : 'Great! KOMISIYONERI AI can now answer all questions about our properties, prices, agents, and services!', 'bot');
  showToast(curLang === 'rw' ? 'AI yahuganye neza! ✓' : 'AI connected! ✓');
}

function sendChat() {
  var inp = document.getElementById('chat-inp');
  if (!inp) return;
  var val = inp.value.trim();
  if (!val) return;
  if (chatApiLoading) return;
  inp.value = '';
  inp.focus();

  var sugs = document.querySelector('.chat-sugs');
  if (sugs) sugs.style.display = 'none';

  addMsg(val, 'me');

  showTyping();
  chatApiLoading = true;

  // Build clean messages array — only user/assistant alternating
  // Always start fresh with just the current message for reliability
  var messages = [{ role: 'user', content: val }];

  // Add limited history (last 4 pairs) properly alternating
  if (chatHistory.length > 0) {
    var validHistory = chatHistory
      .filter(function(m) { return (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim(); })
      .slice(-8);
    // Ensure it starts with 'user' and alternates properly
    var cleaned = [];
    var lastRole = null;
    for (var i = 0; i < validHistory.length; i++) {
      if (validHistory[i].role !== lastRole) {
        cleaned.push({ role: validHistory[i].role, content: validHistory[i].content });
        lastRole = validHistory[i].role;
      }
    }
    // Add current message
    if (cleaned.length === 0 || cleaned[cleaned.length-1].role !== 'user') {
      cleaned.push({ role: 'user', content: val });
    } else {
      cleaned[cleaned.length-1] = { role: 'user', content: val };
    }
    // Final check: must start with user
    if (cleaned.length > 0 && cleaned[0].role === 'user') {
      messages = cleaned;
    } else {
      messages = [{ role: 'user', content: val }];
    }
  }

  chatHistory.push({ role: 'user', content: val });

  // Call Claude API

  fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      system: KOMISIYONERI_SYSTEM,
      messages: messages
    })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    removeTyping();
    chatApiLoading = false;
    var reply = '';
    if (data.content && data.content[0] && data.content[0].text) {
      reply = data.content[0].text;
    } else if (data.error) {
      console.error('API Error:', data.error);
      reply = curLang === 'rw'
        ? 'Ikibazo: ' + (data.error.message || 'Hamagara +250 783 177 254')
        : 'Error: ' + (data.error.message || 'Call +250 783 177 254');
    } else {
      reply = curLang === 'rw' ? 'Murakoze! Nzakusubiza vuba.' : 'Thank you! Replying shortly.';
    }
    chatHistory.push({ role: 'assistant', content: reply });
    addMsg(reply, 'bot');
    refreshSuggestions(val);
  })
  .catch(function(err) {
    removeTyping();
    chatApiLoading = false;
    // Fallback to local reply if API fails (offline/network)
    var fallbacks = {
      rw: ['Hamagara agent wacu: +250 783 177 254','Twandikire: komisiyonericonnectproservices@gmail.com','Ibibazo byose: www.komisiyoneri.com'],
      en: ['Call our agent: +250 783 177 254','Email us: komisiyonericonnectproservices@gmail.com','All info: www.komisiyoneri.com']
    };
    var fb = fallbacks[curLang] || fallbacks.rw;
    var reply = fb[Math.floor(Math.random() * fb.length)];
    chatHistory.push({ role: 'assistant', content: reply });
    addMsg(reply, 'bot');
  });
}

function sendChatMsg(btn) {
  var inp = document.getElementById('chat-inp');
  if (!inp) return;
  var txt = curLang === 'en'
    ? (btn.getAttribute('data-en') || btn.textContent.trim())
    : (btn.getAttribute('data-rw') || btn.textContent.trim());
  inp.value = txt;
  sendChat();
}

function refreshSuggestions(lastMsg) {
  var sugs = document.querySelector('.chat-sugs');
  if (!sugs) return;
  var m = lastMsg.toLowerCase();
  var list;
  if (m.match(/kugura|buy|inzu|property|price|igiciro/)) {
    list = curLang === 'en'
      ? [{rw:'Ibiciro by Gasabo',en:'Gasabo prices'},{rw:'Kugura villa',en:'Buy a villa'},{rw:'Huza na Agent',en:'Contact Agent'}]
      : [{rw:'Ibiciro by Gasabo',en:'Gasabo prices'},{rw:'Kugura villa',en:'Buy a villa'},{rw:'Huza na Agent',en:'Contact Agent'}];
  } else if (m.match(/gukodesha|rent|kwezi|apartimanı/)) {
    list = [{rw:'Apartimanı i Kigali',en:'Kigali apartments'},{rw:'Kwezi bungana?',en:'Monthly cost?'},{rw:'Reba imitungo',en:'View listings'}];
  } else if (m.match(/agent|huza|contact|tel/)) {
    list = [{rw:'WhatsApp Agent',en:'WhatsApp Agent'},{rw:'Hamagara ubu',en:'Call now'},{rw:'Iyandikishe',en:'Register'}];
  } else {
    list = [{rw:'Kugura inzu',en:'Buy property'},{rw:'Gukodesha',en:'Rent a home'},{rw:'AI Analytics',en:'AI Analytics'}];
  }
  var btns = sugs.querySelectorAll('.c-sug');
  btns.forEach(function(btn, i) {
    if (list[i]) {
      btn.setAttribute('data-rw', list[i].rw);
      btn.setAttribute('data-en', list[i].en);
      btn.textContent = curLang === 'en' ? list[i].en : list[i].rw;
    }
  });
  sugs.style.display = 'flex';
}

function showTyping() {
  var msgs = document.getElementById('chat-msgs');
  if (!msgs) return;
  removeTyping();
  var d = document.createElement('div');
  d.className = 'cm-typing';
  d.id = 'chat-typing';
  d.innerHTML = '<span></span><span></span><span></span>';
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeTyping() {
  var t = document.getElementById('chat-typing');
  if (t) t.remove();
}

function addMsg(text, who) {
  var msgs = document.getElementById('chat-msgs');
  if (!msgs) return;
  var div = document.createElement('div');
  div.className = 'cm ' + who;
  var now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = '<span>' + escapeHtml(text) + '</span><div class="cm-time">' + now + '</div>';
  msgs.appendChild(div);
  // smooth scroll to bottom
  setTimeout(function() { msgs.scrollTop = msgs.scrollHeight; }, 30);
  // NOTE: chatHistory is managed by sendChat/sendChatMsg — do NOT push here
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Enter key handler — attach once on load
function initChat() {
  var inp = document.getElementById('chat-inp');
  if (!inp) return;
  inp.removeEventListener('keydown', chatKeyHandler);
  inp.addEventListener('keydown', chatKeyHandler);
}
function chatKeyHandler(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
}

// ── ANALYTICS HELPER
function kmTrack(name, params) {
  try {
    var p = Object.assign({ platform:'web', lang:curLang||'rw' }, params||{});
    if(typeof gtag    !=='undefined') gtag('event', name, p);
    if(typeof posthog !=='undefined') posthog.capture(name, p);
  } catch(e){}
}
// ── GLOBAL ERROR HANDLER
window.onerror = function(msg, src, line, col, err) {
  try {
    if(typeof Sentry  !=='undefined') Sentry.captureException(err||new Error(msg));
    if(typeof gtag    !=='undefined') gtag('event','exception',{description:msg,fatal:false});
    if(typeof posthog !=='undefined') posthog.capture('js_error',{message:msg,source:src,lineno:line});
  } catch(e){}
};
window.onunhandledrejection = function(evt) {
  var msg = evt.reason ? (evt.reason.message||String(evt.reason)) : 'Unhandled promise rejection';
  try {
    if(typeof Sentry  !=='undefined') Sentry.captureException(evt.reason||new Error(msg));
    if(typeof gtag    !=='undefined') gtag('event','exception',{description:msg,fatal:false});
    if(typeof posthog !=='undefined') posthog.capture('promise_error',{message:msg});
  } catch(e){}
};
// ── TOAST
let toastTimer;
function showToast(msg, type) {
  const t = document.getElementById('toast');
  const tm = document.getElementById('toast-msg');
  tm.textContent = msg;
  t.classList.remove('toast-error','toast-warn');
  if(type==='error') t.classList.add('toast-error');
  else if(type==='warn') t.classList.add('toast-warn');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 5000);
}

// ── STAB (search type) active
document.querySelectorAll('.s-tab').forEach(s => {
  s.addEventListener('click', () => {
    s.closest('.s-tabs').querySelectorAll('.s-tab').forEach(x => x.classList.remove('active'));
    s.classList.add('active');
  });
});

// ── ROLE TABS (auth)
document.querySelectorAll('.rt').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.role-tabs')?.querySelectorAll('.rt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// --- USER AUTH SYSTEM ---
var currentUser = null;
var _pendingAction = null;

function saveUser(user) {
  try { localStorage.setItem('km_current', JSON.stringify(user)); } catch(e){}
  currentUser = user;
  updateNavForUser(user);
  try {
    if(user && user.uid) {
      if(typeof posthog !=='undefined') posthog.identify(user.uid,{email:user.email,name:user.name,role:user.role,provider:user.provider});
      if(typeof Sentry  !=='undefined') Sentry.setUser({id:user.uid,email:user.email,username:user.name});
    }
  } catch(e){}
}

function loadSavedUser() {
  try {
    var u = localStorage.getItem('km_current');
    if (u) {
      currentUser = JSON.parse(u);
      // Refresh role from km_users in case admin approved/changed it since last session
      try {
        var users = JSON.parse(localStorage.getItem('km_users')||'[]');
        var fresh = users.find(function(x){ return x.email === currentUser.email; });
        if (fresh && fresh.role && fresh.role !== currentUser.role) {
          currentUser.role = fresh.role;
          if (fresh.agentId) currentUser.agentId = fresh.agentId;
          try { localStorage.setItem('km_current', JSON.stringify(currentUser)); } catch(e2){}
        }
      } catch(e2){}
      updateNavForUser(currentUser);
    }
  } catch(e){}
}

function updateNavForUser(user) {
  var adminBtn = document.getElementById('nav-admin-btn');
  if (adminBtn) adminBtn.style.display = (user && (user.email === 'komisiyonericonnectproservices@gmail.com' || user.email === 'admin@komisiyoneri.com')) ? 'block' : 'none';
  var guest = document.getElementById('nav-guest');
  var userArea = document.getElementById('nav-user');
  var avatar = document.getElementById('nav-avatar');
  if (!user) {
    if(guest) guest.style.display='flex';
    if(userArea) userArea.style.display='none';
    return;
  }
  if(guest) guest.style.display='none';
  if(userArea) userArea.style.display='flex';
  var ini = (user.name||'U').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
  if (avatar) {
    if (user.photo) {
      avatar.textContent = '';
      avatar.style.backgroundImage = 'url(' + user.photo + ')';
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
    } else {
      avatar.style.backgroundImage = '';
      avatar.textContent = ini;
    }
  }
  var dashBtn = document.getElementById('nl-dashboard');
  if(dashBtn) dashBtn.style.display = (user.role === 'Agent' || user.role === 'Admin') ? '' : 'none';
}

function loadAgentDashboard() {
  if (!currentUser) return;
  var e = function(id){ return document.getElementById(id); };

  // Personalize welcome
  var wn = e('dash-welcome-name');
  if (wn) wn.textContent = (curLang==='rw' ? 'Murakaza neza, ' : 'Welcome back, ') + (currentUser.name||'Agent') + '!';

  var props = [], deals = [], leads = [], agents = [];
  try { props  = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(err){}
  try { deals  = JSON.parse(localStorage.getItem('km_deals')||'[]');      } catch(err){}
  try { leads  = JSON.parse(localStorage.getItem('km_leads')||'[]');      } catch(err){}
  try { agents = JSON.parse(localStorage.getItem('km_agents')||'[]');     } catch(err){}

  var myProps    = props.filter(function(p){ return p.ownerEmail === currentUser.email; });
  var approved   = myProps.filter(function(p){ return p.status === 'Approved'; });
  var myLeads    = leads.filter(function(l){ return currentUser.agentId && l.assignedAgent === currentUser.agentId; });
  var myDeals    = deals.filter(function(d){ return currentUser.agentId && d.agentId === currentUser.agentId; });
  var salesClosed = myDeals.filter(function(d){ return d.status === 'Completed'; }).length;

  var myAgent = agents.find(function(a){ return a.id === currentUser.agentId; });
  var commission = myAgent ? (myAgent.commissionTotal || 0) : 0;
  var commDisp = commission >= 1000000 ? (commission/1000000).toFixed(1)+'M'
               : commission >= 1000    ? Math.round(commission/1000)+'K'
               : String(commission);

  if(e('dash-kpi-listings'))   e('dash-kpi-listings').textContent   = approved.length;
  if(e('dash-kpi-sales'))      e('dash-kpi-sales').textContent      = salesClosed;
  if(e('dash-kpi-commission')) e('dash-kpi-commission').textContent = commDisp || '0';
  if(e('dash-kpi-leads'))      e('dash-kpi-leads').textContent      = myLeads.length;
  if(e('dash-sidebar-listings')) e('dash-sidebar-listings').textContent = approved.length;

  renderDashboardListings(approved);

  // Upcoming visits
  var bookings = [];
  try { bookings = JSON.parse(localStorage.getItem('km_bookings')||'[]'); } catch(err){}
  var myBookings = bookings.filter(function(b){ return b.agentEmail === currentUser.email; });
  myBookings.sort(function(a,b){ return (a.date||'') < (b.date||'') ? -1 : 1; });
  renderDashboardBookings(myBookings);
}

function renderDashboardBookings(bookings) {
  var el = document.getElementById('dash-bookings-rows');
  if (!el) return;
  if (!bookings || bookings.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding:1.8rem 1rem">'
      + '<div class="es-icon">📅</div>'
      + '<div class="es-title">' + (curLang==='rw'?'Nta nzira ziteganijwe':'No upcoming visits') + '</div>'
      + '<div class="es-sub">' + (curLang==='rw'?'Abakiriya bazakugira gahunda hano.':'Client bookings will appear here.') + '</div>'
      + '</div>';
    return;
  }
  el.innerHTML = bookings.slice(0,8).map(function(b) {
    var dateStr = b.date ? new Date(b.date+'T00:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}) : '—';
    var timeStr = b.time || '';
    var propLabel = escapeHtml(b.propTitle || (curLang==='rw'?'Imitungo':'Property'));
    var visitor   = escapeHtml(b.name || '—');
    var phone     = escapeHtml(b.phone || '');
    return '<div class="lr" style="cursor:default">'
      + '<div class="lt g2" style="min-width:48px;min-height:48px">'
      + '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>'
      + '<div class="li">'
      + '<strong>'+propLabel+'</strong>'
      + '<span>'+visitor+(phone?' · '+phone:'')+'</span>'
      + '</div>'
      + '<span class="lr-price" style="font-size:.82rem;color:var(--navy);white-space:nowrap">'+dateStr+(timeStr?' '+timeStr:'')+'</span>'
      + '</div>';
  }).join('');
}

function renderDashboardListings(props) {
  var el = document.getElementById('dash-listings-rows');
  if (!el) return;
  if (!props || props.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding:1.8rem 1rem">'
      + '<div class="es-icon">🏠</div>'
      + '<div class="es-title">' + (curLang==='rw'?'Nta mitungo yanditswe':'No listings yet') + '</div>'
      + '<div class="es-sub">' + (curLang==='rw'?'Imitungo washyiraho izagaragara hano.':'Your submitted properties appear here.') + '</div>'
      + '<button class="btn btn-navy btn-sm" onclick="openAddProperty()">' + (curLang==='rw'?'Ongeramo Imitungo':'Add Property') + '</button>'
      + '</div>';
    return;
  }
  var gradients = ['g1','g2','g3','g4','g5','g6','g7'];
  el.innerHTML = props.slice(0,4).map(function(prop, i) {
    var gc = gradients[i % 7];
    var price = prop.price ? (Number(prop.price)>=1000000 ? (Number(prop.price)/1000000).toFixed(0)+'M RWF' : Number(prop.price).toLocaleString()+' RWF') : '—';
    var statusColor = prop.status==='Approved' ? 'sd-green' : prop.status==='Pending' ? 'sd-gold' : 'sd-muted';
    var statusLabel = prop.status==='Approved' ? (curLang==='rw'?'Iraboneka':'Active')
                    : prop.status==='Pending'  ? (curLang==='rw'?'Irasabwa':'Pending') : escapeHtml(prop.status||'');
    return '<div class="lr" onclick="go(\'listings\')">'
      + '<div class="lt '+gc+'"><svg viewBox="0 0 24 24"><path d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/></svg></div>'
      + '<div class="li"><strong>'+escapeHtml((prop.type||'')+' — '+(prop.district||''))+'</strong>'
      + '<span><span class="sdot '+statusColor+'"></span>'+statusLabel+'</span></div>'
      + '<span class="lr-price">'+price+'</span>'
      + '</div>';
  }).join('');
}

function openProfile() {
  if (!currentUser) { go('auth'); return; }
  var m = document.getElementById('profile-modal');
  if (!m) return;
  m.style.display = 'flex';
  var e = function(id){ return document.getElementById(id); };
  // Show Add Property button only for approved agents and admin
  var addPropBtn = e('profile-add-prop-btn');
  if (addPropBtn) {
    var canAdd = currentUser.role === 'Agent' || currentUser.email === 'komisiyonericonnectproservices@gmail.com';
    addPropBtn.style.display = canAdd ? '' : 'none';
  }
  // ensure view mode is shown
  if(e('profile-view')) e('profile-view').style.display = '';
  if(e('profile-edit')) e('profile-edit').style.display = 'none';
  var av = e('profile-avatar-big');
  if (av) {
    if (currentUser.photo) {
      av.textContent = '';
      av.style.backgroundImage = 'url(' + currentUser.photo + ')';
    } else {
      var ini = (currentUser.name||'U').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
      av.style.backgroundImage = '';
      av.textContent = ini;
    }
  }
  if(e('profile-name-big')) e('profile-name-big').textContent = currentUser.name||'—';
  if(e('profile-role-badge')) e('profile-role-badge').textContent = currentUser.role||'Buyer';
  if(e('profile-phone')) e('profile-phone').textContent = currentUser.phone||'—';
  if(e('profile-email')) e('profile-email').textContent = currentUser.email||'—';
  if(e('profile-date')) e('profile-date').textContent = currentUser.date ? new Date(currentUser.date).toLocaleDateString() : '—';
  if(e('profile-location')) e('profile-location').textContent = currentUser.location || '—';
  if(e('profile-preference')) e('profile-preference').textContent = currentUser.preference || '—';
}

function closeProfile() {
  var m = document.getElementById('profile-modal');
  if(m) m.style.display='none';
}

function openEditProfile() {
  var e = function(id){ return document.getElementById(id); };
  if(e('profile-view')) e('profile-view').style.display = 'none';
  if(e('profile-edit')) e('profile-edit').style.display = '';
  window._profileNewPhoto = null;
  if(e('edit-name-display')) e('edit-name-display').textContent = currentUser.name||'—';
  if(e('edit-phone')) e('edit-phone').value = currentUser.phone||'';
  if(e('edit-location')) e('edit-location').value = currentUser.location||'';
  if(e('edit-preference')) e('edit-preference').value = currentUser.preference||'Kugura';
  if(e('edit-email-display')) e('edit-email-display').textContent = currentUser.email||'—';
  var av = e('profile-edit-avatar');
  if (av) {
    if (currentUser.photo) {
      av.textContent = '';
      av.style.backgroundImage = 'url(' + currentUser.photo + ')';
    } else {
      var ini = (currentUser.name||'U').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
      av.style.backgroundImage = '';
      av.textContent = ini;
    }
  }
}

function closeEditProfile() {
  openProfile();
}

function saveEditProfile() {
  var g = function(id){ var el=document.getElementById(id); return el?el.value.trim():''; };
  if (window._profileNewPhoto) currentUser.photo = window._profileNewPhoto;
  currentUser.phone = g('edit-phone');
  currentUser.location = g('edit-location');
  var prefEl = document.getElementById('edit-preference');
  if (prefEl) currentUser.preference = prefEl.value;
  saveUser(currentUser);
  // sync to km_users array
  var users = [];
  try { users = JSON.parse(localStorage.getItem('km_users')||'[]'); } catch(e){}
  users = users.map(function(u) {
    if (u.email === currentUser.email) {
      u.phone = currentUser.phone;
      u.location = currentUser.location;
      u.preference = currentUser.preference;
      if (currentUser.photo) u.photo = currentUser.photo;
    }
    return u;
  });
  try { localStorage.setItem('km_users', JSON.stringify(users)); } catch(e){}
  showToast(curLang==='rw'?'✅ Profile yawe yavuguruwe!':'✅ Profile updated!');
  closeEditProfile();
}

function onProfilePhotoChange(input) {
  var f = input.files && input.files[0];
  if (!f) return;
  convertFileToBase64(f, function(data) {
    window._profileNewPhoto = data;
    var av = document.getElementById('profile-edit-avatar');
    if (av) { av.textContent = ''; av.style.backgroundImage = 'url('+data+')'; av.style.backgroundSize='cover'; av.style.backgroundPosition='center'; }
  });
}

function logoutUser() {
  try { localStorage.removeItem('km_current'); } catch(e){}
  currentUser = null;
  updateNavForUser(null);
  closeProfile();
  showToast(curLang==='rw'?'Wasohowe neza! Murabeho!':'Logged out successfully!');
  go('home');
}

var _editPropId = null;

function openEditProperty(prop) {
  // Only Pending properties can be edited
  if (prop.status !== 'Pending') {
    showToast(curLang==='rw' ? 'Imitungo yemejwe ntishobora guhindurwa.' : 'Approved properties cannot be edited.', 'warn');
    return;
  }
  _editPropId = prop.id;

  // Open the modal (bypasses role check since user already owns this property)
  var m = document.getElementById('add-prop-modal');
  if (m) m.style.display = 'flex';

  // Update modal title and submit label
  var title = document.querySelector('#add-prop-modal .modal-title');
  if (title) title.textContent = curLang==='rw' ? '✏️ Hindura Imitungo' : '✏️ Edit Property';
  var lbl = document.getElementById('submit-prop-label');
  if (lbl) lbl.textContent = curLang==='rw' ? 'Bika Impinduka' : 'Save Changes';

  // Pre-fill all fields
  var s = function(id, val) { var el=document.getElementById(id); if(el) el.value = val||''; };
  var c = function(id, val) { var el=document.getElementById(id); if(el) el.checked = !!val; };
  s('prop-type',    prop.type);
  s('prop-service', prop.service);
  s('prop-district',prop.district);
  s('prop-sector',  prop.sector);
  s('prop-price',   prop.price);
  s('prop-beds',    prop.beds);
  s('prop-baths',   prop.baths);
  s('prop-size',    prop.size);
  s('prop-desc',    prop.desc);
  s('prop-contact', prop.contact || prop.phone);
  s('prop-title',   prop.title);
  s('prop-year',    prop.yearBuilt);
  s('prop-deed',    prop.titleDeed);
  s('prop-floors',  prop.floors);
  s('prop-parking', prop.parking);
  s('prop-doc-luc', prop.docLuc);
  s('prop-doc-id',  prop.docId);
  s('prop-doc-permit', prop.docPermit);
  s('prop-lat',     prop.latitude);
  s('prop-lng',     prop.longitude);
  var ams = ['garden','pool','garage','solar','fibre','security','generator'];
  ams.forEach(function(a) { c('am-'+a, prop.amenities && prop.amenities.indexOf(a) !== -1); });

  // Show user media section (file re-upload optional)
  var userSec = document.getElementById('user-media-section');
  var adminSec = document.getElementById('admin-media-section');
  if (userSec) userSec.style.display = 'flex';
  if (adminSec) adminSec.style.display = 'none';
}

function openAddProperty() {
  if (!currentUser) {
    showToast(curLang==='rw'?'Injira mbere yo kongeramo imitungo!':'Please login first!', 'warn');
    go('auth'); return;
  }
  var isAdminUser = currentUser.email === 'komisiyonericonnectproservices@gmail.com';
  if (!isAdminUser && currentUser.role !== 'Agent') {
    if (currentUser.role === 'PendingAgent') {
      showToast(curLang==='rw'
        ? '⏳ Konti yawe irimo gusuzumwa. Tegereza kwemererwa.'
        : '⏳ Your account is under review. Wait for approval.');
    } else {
      showToast(curLang==='rw'
        ? '🔒 Agents bemewe gusa ni bo bashobora kongeramo imitungo. Iyandikishe nk\'Agent!'
        : '🔒 Only approved agents can add listings. Register as an Agent!');
    }
    return;
  }
  if(!window._listingsOpen) { showToast('⛔ New listings are currently paused.', 'warn'); return; }
  var m = document.getElementById('add-prop-modal');
  if(m) m.style.display='flex';
  var c = document.getElementById('prop-contact');
  if(c && currentUser.phone) c.value = currentUser.phone;
}

function closeAddProperty() {
  var m = document.getElementById('add-prop-modal');
  if(m) m.style.display='none';
  _editPropId = null;
  var title = document.querySelector('#add-prop-modal .modal-title');
  if (title) { title.setAttribute('data-rw','+ Andika Imitungo Nshya'); title.textContent = curLang==='rw'?'+ Andika Imitungo Nshya':'+ Add New Property'; }
  var lbl = document.getElementById('submit-prop-label');
  if (lbl) lbl.textContent = curLang==='rw' ? 'Ohereza Imitungo' : 'Submit Property';
}

function submitProperty() {
  var g = function(id){ var el=document.getElementById(id); return el?el.value.trim():''; };

  // Check login
  if(!currentUser) {
    showToast(curLang==='rw' ? 'Injira mbere yo gushyiraho imitungo!' : 'Please login first!', 'warn');
    closeAddProperty();
    go('auth');
    return;
  }

  var isAdmin = currentUser.email === 'komisiyonericonnectproservices@gmail.com';
  if (!isAdmin && currentUser.role !== 'Agent') {
    showToast(curLang==='rw'
      ? '🔒 Agents bemewe gusa ni bo bashobora ohereza imitungo.'
      : '🔒 Only approved agents can submit listings.', 'warn');
    return;
  }

  // === EDIT MODE: update existing Pending property in-place ===
  if (_editPropId) {
    var editId = _editPropId;
    var props = [];
    try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
    var idx = -1;
    for (var i=0; i<props.length; i++) { if (String(props[i].id) === String(editId)) { idx=i; break; } }
    if (idx === -1) { showToast('Imitungo ntiboneka.'); closeAddProperty(); return; }
    if (props[idx].status !== 'Pending') {
      showToast(curLang==='rw' ? 'Imitungo yemejwe ntishobora guhindurwa.' : 'Only pending listings can be edited.', 'warn');
      closeAddProperty(); return;
    }
    // Merge new field values into the existing property, keeping system fields unchanged
    var updated = props[idx];
    updated.type     = g('prop-type')    || updated.type;
    updated.service  = g('prop-service') || updated.service;
    updated.district = g('prop-district')|| updated.district;
    updated.sector   = g('prop-sector');
    updated.price    = g('prop-price')   || updated.price;
    updated.beds     = g('prop-beds');
    updated.baths    = g('prop-baths');
    updated.size     = g('prop-size');
    updated.desc     = g('prop-desc');
    updated.contact  = g('prop-contact') || updated.contact;
    updated.phone    = g('prop-contact') || updated.phone;
    updated.title    = g('prop-title') || (updated.type + (updated.district ? ' — '+updated.district : ''));
    updated.yearBuilt= g('prop-year');
    updated.titleDeed= g('prop-deed');
    updated.floors   = g('prop-floors');
    updated.parking  = g('prop-parking');
    updated.amenities= ['garden','pool','garage','solar','fibre','security','generator'].filter(function(a){ var el=document.getElementById('am-'+a); return el&&el.checked; });
    updated.docLuc   = g('prop-doc-luc');
    updated.docId    = g('prop-doc-id');
    updated.docPermit= g('prop-doc-permit');
    updated.latitude = g('prop-lat') ? parseFloat(g('prop-lat')) : (updated.latitude || null);
    updated.longitude= g('prop-lng') ? parseFloat(g('prop-lng')) : (updated.longitude || null);
    props[idx] = updated;
    try { localStorage.setItem('km_properties', JSON.stringify(props)); } catch(e){}
    closeAddProperty();
    showToast(curLang==='rw' ? '✅ Imitungo yahinduwe! Irasabwa kwemezwa.' : '✅ Listing updated! Awaiting approval.');
    return;
  }

  if(!g('prop-price')) { showToast(curLang==='rw'?'Shyira igiciro!':'Enter price!', 'error'); return; }
  if(!g('prop-type')) { showToast('Hitamo ubwoko!'); return; }
  if(!g('prop-district')) { showToast('Hitamo akarere!'); return; }

  if(isAdmin) {
    // === ADMIN: YouTube + URL images, auto-approved ===
    var videoUrl = convertYouTubeURL(g('prop-video'));
    var props = [];
    try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
    var newProp = {
      id: Date.now(),
      type: g('prop-type'), service: g('prop-service'), district: g('prop-district'),
      sector: g('prop-sector'), price: g('prop-price'), beds: g('prop-beds'),
      baths: g('prop-baths'), size: g('prop-size'), desc: g('prop-desc'),
      contact: g('prop-contact') || '+250 783 177 254',
      img1: g('prop-img1'), img2: g('prop-img2'), img3: g('prop-img3'),
      video: videoUrl, tour3dUrl: g('prop-tour3d'),
      title:     g('prop-title') || (g('prop-type') + (g('prop-district') ? ' — ' + g('prop-district') : '')),
      phone:     g('prop-contact') || '+250 783 177 254',
      yearBuilt: g('prop-year'),
      titleDeed: g('prop-deed'),
      floors:    g('prop-floors'),
      parking:   g('prop-parking'),
      amenities: ['garden','pool','garage','solar','fibre','security','generator'].filter(function(a){ var el=document.getElementById('am-'+a); return el&&el.checked; }),
      docLuc:    g('prop-doc-luc'),
      docId:     g('prop-doc-id'),
      docPermit: g('prop-doc-permit'),
      latitude:  g('prop-lat')  ? parseFloat(g('prop-lat'))  : null,
      longitude: g('prop-lng')  ? parseFloat(g('prop-lng'))  : null,
      owner: 'KOMISIYONERI', ownerEmail: currentUser.email,
      verified: true, rating: 5.0, reviews: 0,
      date: new Date().toISOString(), status: 'Approved'
    };
    props.push(newProp);
    try { localStorage.setItem('km_properties', JSON.stringify(props)); } catch(e){}
    closeAddProperty();
    loadApprovedProperties();
    showToast('✅ Imitungo yashyizweho kandi yemejwe!');

  } else {
    // === USER: File upload to Firebase Storage, pending review ===
    var file1El = document.getElementById('prop-file1');
    var file2El = document.getElementById('prop-file2');
    var file3El = document.getElementById('prop-file3');
    var hasFile = file1El && file1El.files && file1El.files[0];

    if(!hasFile) {
      showToast(curLang==='rw' ? 'Shyiramo nibura ifoto imwe!' : 'Upload at least one photo!', 'error');
      return;
    }

    showToast(curLang==='rw' ? 'Amafoto arakopiwa...' : 'Uploading photos...');
    var _sbtn = document.getElementById('submit-prop-btn');
    var _slbl = document.getElementById('submit-prop-label');
    if(_sbtn){ _sbtn.disabled=true; _sbtn.classList.add('btn-loading');
      if(_slbl) _slbl.innerHTML='<span class="btn-spinner"></span>'+(curLang==='rw'?'Kopiwa...':'Uploading...'); }

    var propId = Date.now();
    var fileList = [file1El, file2El, file3El].filter(function(f){ return f && f.files && f.files[0]; });
    var propData = {
      id: propId,
      type: g('prop-type'), service: g('prop-service'), district: g('prop-district'),
      sector: g('prop-sector'), price: g('prop-price'), beds: g('prop-beds'),
      baths: g('prop-baths'), size: g('prop-size'), desc: g('prop-desc'),
      contact: g('prop-contact') || currentUser.phone || '+250 783 177 254',
      img1: '', img2: '', img3: '',
      video: '', tour3dUrl: '',
      title:     g('prop-title') || (g('prop-type') + (g('prop-district') ? ' — ' + g('prop-district') : '')),
      phone:     g('prop-contact') || currentUser.phone || '+250 783 177 254',
      yearBuilt: g('prop-year'),
      titleDeed: g('prop-deed'),
      floors:    g('prop-floors'),
      parking:   g('prop-parking'),
      amenities: ['garden','pool','garage','solar','fibre','security','generator'].filter(function(a){ var el=document.getElementById('am-'+a); return el&&el.checked; }),
      docLuc:    g('prop-doc-luc'),
      docId:     g('prop-doc-id'),
      docPermit: g('prop-doc-permit'),
      latitude:  g('prop-lat')  ? parseFloat(g('prop-lat'))  : null,
      longitude: g('prop-lng')  ? parseFloat(g('prop-lng'))  : null,
      owner: currentUser.name, ownerEmail: currentUser.email,
      date: new Date().toISOString(), status: 'Pending'
    };

    // Try Firebase Storage upload; fall back to base64 if unavailable
    if(typeof storage !== 'undefined' && storage) {
      var uploadPromises = fileList.map(function(f, i) {
        var file = f.files[0];
        var ref = storage.ref('properties/' + propId + '/img' + (i + 1) + '_' + file.name);
        return ref.put(file).then(function() { return ref.getDownloadURL(); }).then(function(url) {
          propData['img' + (i + 1)] = url;
        });
      });
      Promise.all(uploadPromises)
        .then(function() {
          var props = [];
          try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
          props.push(propData);
          try { localStorage.setItem('km_properties', JSON.stringify(props)); } catch(e){}
          var sbtn2=document.getElementById('submit-prop-btn'),slbl2=document.getElementById('submit-prop-label');
          if(sbtn2){ sbtn2.disabled=false; sbtn2.classList.remove('btn-loading'); if(slbl2) slbl2.textContent=(curLang==='rw'?'Ohereza Imitungo':'Submit Property'); }
          closeAddProperty();
          showToast(curLang==='rw' ? '✅ Imitungo yoherejwe! Admin azayisuzuma vuba.' : '✅ Property submitted for review!');
        })
        .catch(function(err) {
          console.error('Storage upload failed, falling back to base64:', err);
          _submitPropertyBase64(fileList, propData);
        });
    } else {
      _submitPropertyBase64(fileList, propData);
    }
  }
}

function _submitPropertyBase64(fileList, propData) {
  var images = [];
  var done = 0;
  fileList.forEach(function(f, i) {
    var reader = new FileReader();
    reader.onload = function(e) {
      images[i] = e.target.result;
      done++;
      if(done === fileList.length) {
        propData.img1 = images[0] || '';
        propData.img2 = images[1] || '';
        propData.img3 = images[2] || '';
        var props = [];
        try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
        props.push(propData);
        try { localStorage.setItem('km_properties', JSON.stringify(props)); } catch(e){}
        var sbtn3=document.getElementById('submit-prop-btn'),slbl3=document.getElementById('submit-prop-label');
        if(sbtn3){ sbtn3.disabled=false; sbtn3.classList.remove('btn-loading'); if(slbl3) slbl3.textContent=(curLang==='rw'?'Ohereza Imitungo':'Submit Property'); }
        closeAddProperty();
        showToast(curLang==='rw' ? '✅ Imitungo yoherejwe! Admin azayisuzuma vuba.' : '✅ Property submitted for review!');
      }
    };
    reader.readAsDataURL(f.files[0]);
  });
}

function handleForgotPassword() {
  var emailEl = document.getElementById('login-email');
  var email = emailEl ? emailEl.value.trim() : '';
  if (!email) {
    showToast(curLang==='rw' ? 'Shyira imeyili yawe mbere!' : 'Enter your email address first!');
    if (emailEl) emailEl.focus();
    return;
  }
  if (!firebaseAuth) {
    showToast(curLang==='rw' ? 'Serivisi ntiboneka. Ongera ugerageze.' : 'Service unavailable. Try again.');
    return;
  }
  firebaseAuth.sendPasswordResetEmail(email)
    .then(function() {
      showToast(curLang==='rw'
        ? '📧 Imeyili yoherejwe kuri ' + email + '. Reba inbox yawe!'
        : '📧 Reset email sent to ' + email + '. Check your inbox!');
    })
    .catch(function(err) {
      if (err.code === 'auth/user-not-found') {
        showToast(curLang==='rw' ? 'Nta konti ifite iyo meyili.' : 'No account found with that email.');
      } else if (err.code === 'auth/invalid-email') {
        showToast(curLang==='rw' ? 'Imeyili ntabwo ari yo.' : 'Invalid email address.');
      } else {
        showToast(curLang==='rw' ? 'Habayeho ikosa. Ongera ugerageze.' : 'Error. Please try again.');
      }
    });
}

async function handleLogin() {
  document.querySelectorAll('#page-auth .field-error').forEach(function(f){ f.classList.remove('field-error'); });
  var emailEl = document.getElementById('login-email');
  var passEl  = document.getElementById('login-pass');
  var email   = emailEl ? emailEl.value.trim() : '';
  var pass    = passEl  ? passEl.value          : '';
  if (!email) {
    showToast(curLang==='rw'?'Shyira imeyili!':'Enter email!', 'error');
    if(emailEl){ emailEl.closest('.field').classList.add('field-error'); emailEl.focus(); }
    return;
  }
  if (!pass) {
    showToast(curLang==='rw'?'Shyira ijambo banga!':'Enter password!', 'error');
    if(passEl){ passEl.closest('.field').classList.add('field-error'); passEl.focus(); }
    return;
  }
  var btn = document.querySelector('#form-login [onclick="handleLogin()"]');
  var lbl = document.getElementById('login-btn-label');
  if(btn){ btn.disabled=true; btn.classList.add('btn-loading'); }
  if(lbl) lbl.innerHTML='<span class="btn-spinner"></span>'+(curLang==='rw'?'Tegereza...':'Signing in...');
  try {
    if (!firebaseAuth) initFirebase();
    var result = await firebaseAuth.signInWithEmailAndPassword(email, pass);
    var fb = result.user;
    var profile = {};
    try {
      var users = JSON.parse(localStorage.getItem('km_users')||'[]');
      profile = users.find(function(u){ return u.email===email; }) || {};
    } catch(e){}
    var user = {
      uid: fb.uid,
      name: fb.displayName || profile.name || email.split('@')[0],
      email: fb.email,
      role: profile.role || 'Buyer',
      phone: profile.phone || '',
      avatar: fb.photoURL || profile.avatar || '',
      provider: 'email',
      emailVerified: fb.emailVerified
    };
    saveUser(user);
    kmTrack('login',{method:user.provider||'email'});
    showToast((curLang==='rw'?'Murakaza neza, ':'Welcome, ')+user.name+'! 🎉');
    var pa = _pendingAction; _pendingAction = null;
    if (pa === 'agent-reg') { go('home'); openAgentReg(); }
    else { go('home'); }
  } catch(err) {
    var code = err.code || '';
    var msg  = curLang==='rw'?'Habaye ikosa, ongera ugerageze.':'Login failed, please try again.';
    if (code==='auth/user-not-found'||code==='auth/invalid-credential')
      msg = curLang==='rw'?'Nta konti ifite iyo meyili.':'No account with that email.';
    else if (code==='auth/wrong-password')
      msg = curLang==='rw'?'Ijambo banga sibyo.':'Incorrect password.';
    else if (code==='auth/invalid-email')
      msg = curLang==='rw'?'Imeyili ntiyanditse neza.':'Invalid email format.';
    else if (code==='auth/too-many-requests')
      msg = curLang==='rw'?'Ugerageje inshuro nyinshi. Tegereza akanya.':'Too many attempts. Please wait.';
    showToast(msg, 'error');
  } finally {
    if(btn){ btn.disabled=false; btn.classList.remove('btn-loading'); }
    if(lbl) lbl.textContent = curLang==='rw'?'Injira':'Sign In';
  }
}

async function handleRegister() {
  document.querySelectorAll('#form-register .field-error').forEach(function(f){ f.classList.remove('field-error'); });
  var g = function(id){ var el=document.getElementById(id); return el?el.value.trim():''; };
  var name=g('reg-name'), phone=g('reg-phone'), email=g('reg-email');
  var passEl = document.getElementById('reg-pass');
  var pass2El = document.getElementById('reg-pass2');
  var pass  = passEl  ? passEl.value  : '';
  var pass2 = pass2El ? pass2El.value : '';
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function fieldErr(id, msg) {
    var el = document.getElementById(id);
    if(el){ el.closest('.field').classList.add('field-error'); el.focus(); }
    showToast(msg, 'error');
  }
  if (!name)                        { fieldErr('reg-name',  curLang==='rw'?'Shyira amazina yawe!':'Enter your name!'); return; }
  if (!phone)                       { fieldErr('reg-phone', curLang==='rw'?'Shyira telefoni yawe!':'Enter your phone!'); return; }
  if (!email||!emailRe.test(email)) { fieldErr('reg-email', curLang==='rw'?'Imeyili ntiyanditse neza!':'Invalid email!'); return; }
  if (pass.length<8)                { fieldErr('reg-pass',  curLang==='rw'?'Ijambo banga rigomba nibura inyuguti 8!':'Password must be at least 8 characters!'); return; }
  if (pass!==pass2)                 { fieldErr('reg-pass2', curLang==='rw'?'Amagambo banga ntahuye!':'Passwords do not match!'); return; }

  var btn = document.querySelector('#form-register [onclick="handleRegister()"]');
  var lbl = document.getElementById('register-btn-label');
  if(btn){ btn.disabled=true; btn.classList.add('btn-loading'); }
  if(lbl) lbl.innerHTML='<span class="btn-spinner"></span>'+(curLang==='rw'?'Tegereza...':'Creating account...');

  try {
    if (!firebaseAuth) initFirebase();
    var result = await firebaseAuth.createUserWithEmailAndPassword(email, pass);
    var fb = result.user;
    await fb.updateProfile({ displayName: name });
    try { await fb.sendEmailVerification(); } catch(e){}
    var locEl  = document.getElementById('reg-location');
    var prefEl = document.getElementById('reg-preference');
    var roleEl = document.querySelector('.rt.active');
    var user = {
      uid: fb.uid, name: name, phone: phone, email: email,
      role: roleEl ? roleEl.textContent.trim() : 'Buyer',
      location: locEl  ? locEl.value.trim() : '',
      preference: prefEl ? prefEl.value : 'Kugura',
      provider: 'email', emailVerified: false,
      date: new Date().toISOString()
    };
    var users = [];
    try { users = JSON.parse(localStorage.getItem('km_users')||'[]'); } catch(e){}
    if (!users.find(function(u){ return u.email===email; })) {
      users.push(user);
      try { localStorage.setItem('km_users', JSON.stringify(users)); } catch(e){}
    }
    saveUser(user);
    kmTrack('sign_up',{method:'email',role:user.role});
    showToast(curLang==='rw'?'Konti yakozwe! Reba imeyili yawe kugira ngo uremeze.':'Account created! Check your email to verify.');
    var pa = _pendingAction; _pendingAction = null;
    if (pa === 'agent-reg') { go('home'); openAgentReg(); }
    else { go('home'); }
  } catch(err) {
    var code = err.code || '';
    var msg  = curLang==='rw'?'Habaye ikosa, ongera ugerageze.':'Registration failed, please try again.';
    if (code==='auth/email-already-in-use')
      msg = curLang==='rw'?'Iyo meyili isanzwe ikoreshwa.':'That email is already registered.';
    else if (code==='auth/weak-password')
      msg = curLang==='rw'?'Ijambo banga ni ryoroheje cyane.':'Password is too weak.';
    showToast(msg, 'error');
  } finally {
    if(btn){ btn.disabled=false; btn.classList.remove('btn-loading'); }
    if(lbl) lbl.textContent = curLang==='rw'?'Iyandikishe Ubuntu':'Register Free';
  }
}

function checkPwStrength(pw) {
  var bar = document.getElementById('pw-strength-bar');
  if (!bar) return;
  bar.className = 'pw-strength';
  if (!pw) return;
  var score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score===1) bar.classList.add('weak');
  else if (score===2) bar.classList.add('fair');
  else if (score>=3) bar.classList.add('strong');
}
document.addEventListener('DOMContentLoaded', loadSavedUser);
document.addEventListener('DOMContentLoaded', applyPlatformFlags);
setTimeout(loadSavedUser, 200);

// ── AUTH SWITCH (login <-> register)
let authMode = 'login';
function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  const t = document.getElementById('auth-title');
  const s = document.getElementById('auth-sub');
  const btn = document.getElementById('auth-switch-btn');
  const txt = document.getElementById('auth-switch-txt');
  const formLogin = document.getElementById('form-login');
  const formReg = document.getElementById('form-register');
  if (authMode === 'register') {
    if(formLogin) formLogin.style.display = 'none';
    if(formReg) formReg.style.display = 'flex';
    if(t) t.textContent = curLang==='rw' ? 'Fungura Konti Nshya' : 'Create Your Account';
    if(s) s.textContent = curLang==='rw' ? 'Uzuza amakuru yawe kugira ngo wishyurishe' : 'Fill in your details to register';
    if(btn) btn.textContent = curLang==='rw' ? 'Injira mu konti ufite' : 'Sign in instead';
    if(txt) txt.textContent = curLang==='rw' ? 'Ufite konti?' : 'Already have an account?';
  } else {
    if(formLogin) formLogin.style.display = 'block';
    if(formReg) formReg.style.display = 'none';
    if(t) t.textContent = curLang==='rw' ? 'Injira mu Konti' : 'Sign In';
    if(s) s.textContent = curLang==='rw' ? 'Uzuza amakuru yawe hasi kugira ngo winjire' : 'Enter your details below to sign in';
    if(btn) btn.textContent = curLang==='rw' ? 'Iyandikishe hano' : 'Register here';
    if(txt) txt.textContent = curLang==='rw' ? 'Nta konti ufite?' : "Don't have an account?";
  }
}

// ── DASHBOARD sidebar nav
document.querySelectorAll('.dn').forEach(item => {
  item.addEventListener('click', () => {
    item.closest('.dash-sidebar')?.querySelectorAll('.dn').forEach(d => d.classList.remove('active'));
    item.classList.add('active');
  });
});

// ── DET TABS (detail page)
document.querySelectorAll('.det-tab').forEach((tab, i) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.det-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const tourBox = document.querySelector('.tour-box');
    if (tourBox) tourBox.style.display = (i === 1) ? 'flex' : '';
  });
});

// ── KPI animation on page visibility
function animateKPIs() {
  document.querySelectorAll('.an-kpi-v, .kpi-v').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => {
      el.style.transition = 'opacity .45s ease, transform .45s ease';
      el.style.opacity = '1';
      el.style.transform = 'none';
    }, 80 + i * 60);
  });
}

// ── UNIFIED go() — page navigation + title + analytics
function go(name) {
  if (name === 'dashboard') {
    if (!currentUser) {
      showToast(curLang==='rw' ? 'Injira mbere!' : 'Please log in first!', 'warn');
      name = 'auth';
    } else if (currentUser.role === 'PendingAgent') {
      showToast(curLang==='rw' ? '⏳ Iyandikishe ryawe irimo gusuzumwa! KOMISIYONERI izakugezaho mu masaa 24.' : '⏳ Your application is under review! We will contact you within 24 hours.', 'warn');
      return;
    } else if (currentUser.role !== 'Agent' && currentUser.role !== 'Admin') {
      showToast(curLang==='rw' ? 'Dashboard irabana n\'Agents gusa!' : 'Dashboard is for Agents only!');
      return;
    } else {
      loadAgentDashboard();
    }
  }
  // Hide all pages, deactivate all nav links
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nl').forEach(b => {
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });

  // Show target page
  var pg = document.getElementById('page-' + name);
  var nb = document.getElementById('nl-' + name);
  if (pg) pg.classList.add('active');
  if (nb) { nb.classList.add('active'); nb.setAttribute('aria-current', 'page'); }

  // Scroll to top instantly
  window.scrollTo({ top: 0, behavior: 'instant' });
  // Show floating search bar on listings/detail/analytics, hide on home/auth/dashboard
  var stb = document.getElementById('search-trigger-bar');
  if (stb) {
    var showBar = ['listings','detail','analytics'].indexOf(name) > -1;
    stb.style.display = showBar ? 'flex' : 'none';
  }

  // Update page title
  var titles = {
    home:      curLang === 'rw' ? 'Ahabanza — KOMISIYONERI'        : 'Home — KOMISIYONERI',
    listings:  curLang === 'rw' ? 'Imitungo — KOMISIYONERI'        : 'Properties — KOMISIYONERI',
    detail:    'Villa Kimironko — KOMISIYONERI',
    analytics: 'AI Analytics — KOMISIYONERI',
    dashboard: 'Dashboard — KOMISIYONERI',
    auth:      curLang === 'rw' ? 'Injira — KOMISIYONERI'          : 'Sign In — KOMISIYONERI'
  };
  if (titles[name]) document.title = titles[name];

  // GA4 page tracking
  if (typeof gtag !== 'undefined') {
    gtag('event', 'page_view', { page_title: titles[name], page_path: '/' + name });
    if(typeof posthog !=='undefined') posthog.capture('$pageview',{$current_url:'/'+name,page_title:titles[name]});
  }

  // Animate KPIs when entering analytics or dashboard
  if (name === 'analytics' || name === 'dashboard') {
    setTimeout(animateKPIs, 80);
  }
}


// ── SEARCH MODAL
// ══════════════════════════════════════════════
//  KOMISIYONERI — SMART SEARCH ENGINE v2
// ══════════════════════════════════════════════

// ── Property cache (5-second TTL) ──
var _propsCache = null, _propsCacheTime = 0;
function getApprovedProps() {
  var now = Date.now();
  if (!_propsCache || now - _propsCacheTime > 5000) {
    var raw = [];
    try { raw = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
    _propsCache = raw.filter(function(p){ return p.status === 'Approved'; });
    _propsCacheTime = now;
  }
  return _propsCache;
}
function invalidatePropsCache() { _propsCache = null; }

// ── Normalize text ──
function kmNorm(s) {
  return (s||'').toLowerCase()
    .replace(/[àáâãäå]/g,'a').replace(/[èéêë]/g,'e')
    .replace(/[ìíîï]/g,'i').replace(/[òóôõö]/g,'o')
    .replace(/[ùúûü]/g,'u').replace(/ñ/g,'n')
    .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}

// ── Levenshtein distance (capped for speed) ──
function kmLev(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  var m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  var prev = [], curr = [];
  for (var j = 0; j <= n; j++) prev[j] = j;
  for (var i = 1; i <= m; i++) {
    curr[0] = i;
    for (var j = 1; j <= n; j++) {
      curr[j] = a[i-1]===b[j-1] ? prev[j-1] : 1+Math.min(prev[j],curr[j-1],prev[j-1]);
    }
    prev = curr.slice();
  }
  return prev[n];
}

// ── Match query word against text (partial + fuzzy typo tolerance) ──
function kmWordMatch(word, text) {
  if (text.indexOf(word) !== -1) return true;
  if (word.length <= 3) return false;
  var maxDist = word.length <= 5 ? 1 : 2;
  var tWords = text.split(' ');
  for (var i = 0; i < tWords.length; i++) {
    var tw = tWords[i];
    if (Math.abs(tw.length - word.length) <= maxDist && kmLev(word, tw) <= maxDist) return true;
  }
  return false;
}

// ── Score property 0–100 against free-text query ──
function kmScore(query, prop) {
  var q = kmNorm(query);
  if (!q) return 100;
  var words = q.split(' ').filter(function(w){ return w.length > 1; });
  if (!words.length) return 100;
  var text = kmNorm([prop.title, prop.district, prop.sector, prop.type,
    prop.description, prop.price ? String(prop.price) : ''].join(' '));
  var matched = 0;
  for (var i = 0; i < words.length; i++) {
    if (kmWordMatch(words[i], text)) matched++;
  }
  return Math.round(matched / words.length * 100);
}

// ── Format price short ──
function fmtPriceSh(p) {
  var n = parseInt(p)||0; if (!n) return '';
  if (n >= 1e9) return (n/1e9).toFixed(1).replace('.0','')+'B RWF';
  if (n >= 1e6) return Math.round(n/1e6)+'M RWF';
  return n.toLocaleString()+' RWF';
}

// ── Render suggestions into a dropdown ──
function renderQsSuggestions(query, boxId) {
  var box = document.getElementById(boxId); if (!box) return;
  if (!query || query.length < 2) { box.style.display='none'; return; }
  var props = getApprovedProps();
  var scored = props.map(function(p){ return {p:p,s:kmScore(query,p)}; })
    .filter(function(x){ return x.s >= 30; })
    .sort(function(a,b){ return b.s-a.s; }).slice(0,5);
  if (!scored.length) {
    box.innerHTML='<div class="qs-no-results">Nta mituringo ihuye na "'+query.replace(/</g,'&lt;')+'"</div>';
    box.style.display='block'; return;
  }
  var html = scored.map(function(x){
    var p=x.p;
    var hasImg = p.img1 && p.img1.length > 10;
    var thumb = hasImg
      ? '<img class="qs-thumb" src="'+p.img1+'" loading="lazy" alt="'+p.title+'" onerror="this.style.display=\'none\'">'
      : '<div class="qs-thumb-ph">🏠</div>';
    var loc = [p.district,p.sector].filter(Boolean).join(', ');
    return '<div class="qs-item" onclick="qs_openProp(\''+String(p.id)+'\',\''+boxId+'\')">'+thumb
      +'<div class="qs-info"><div class="qs-title">'+(p.title||p.type||'Imitungo')+'</div>'
      +'<div class="qs-meta">'+(loc||'Rwanda')+(p.type?' &middot; '+p.type:'')+'</div></div>'
      +(p.price?'<div class="qs-price">'+fmtPriceSh(p.price)+'</div>':'')+'</div>';
  }).join('');
  html += '<div class="qs-footer" onclick="qs_search()">'
    +'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
    +' Reba ibisubizo byose &rarr;</div>';
  box.innerHTML = html;
  box.style.display = 'block';
}

// ── Debounce handlers ──
var _qsT, _mqsT;
function ksHandleInput() {
  clearTimeout(_qsT);
  _qsT = setTimeout(function(){
    var inp=document.getElementById('qs-input');
    if (inp) renderQsSuggestions(inp.value.trim(),'qs-suggestions');
  }, 160);
}
function mqsHandleInput() {
  clearTimeout(_mqsT);
  _mqsT = setTimeout(function(){
    var inp=document.getElementById('sm-quick-search');
    if (inp) renderQsSuggestions(inp.value.trim(),'sm-suggestions');
    updateCount();
  }, 180);
}

function closeQsSuggestions() {
  var b1=document.getElementById('qs-suggestions'); if (b1) b1.style.display='none';
  var b2=document.getElementById('sm-suggestions'); if (b2) b2.style.display='none';
}

// ── Open single property in listings view ──
function qs_openProp(id, boxId) {
  var box=document.getElementById(boxId); if (box) box.style.display='none';
  closeSearch();
  var prop = getApprovedProps().filter(function(p){ return String(p.id)===String(id); })[0];
  if (!prop) return;
  window._filtersActive = true;
  go('listings');
  setTimeout(function(){
    var grids=document.querySelectorAll('#p-grid-main');
    grids.forEach(function(grid){
      grid.querySelectorAll('.user-prop-card').forEach(function(el){ el.remove(); });
      var e=grid.querySelector('.empty-listings'); if (e) e.remove();
      var w=document.createElement('div');
      w.className='user-prop-card'; w.setAttribute('data-pid',String(prop.id));
      w.innerHTML=renderUserPropCard(prop); grid.appendChild(w);
      var c=document.getElementById('listings-count'); if (c) c.textContent=1;
    });
  }, 100);
}

// ── Fill quick search from a hint chip ──
function smHint(text) {
  var inp = document.getElementById('sm-quick-search');
  if (!inp) return;
  inp.value = text;
  window._qs_query = text;
  renderQsSuggestions(text, 'sm-suggestions');
  updateCount();
  inp.focus();
}

// ── Search from hero bar ──
function qs_search() {
  var inp=document.getElementById('qs-input'), q=inp?inp.value.trim():'';
  window._qs_query = q;
  closeQsSuggestions();
  if (q) { var mq=document.getElementById('sm-quick-search'); if (mq) mq.value=q; }
  applyAndSearch();
}

// ── openSearch: accepts optional pre-fill {type, district, tab, chip, query} ──
function openSearch(opts) {
  document.getElementById('search-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  if (opts) {
    if (opts.tab) {
      document.querySelectorAll('.sm-tab').forEach(function(t) {
        var en=(t.getAttribute('data-en')||'').toLowerCase();
        t.classList.toggle('active', en===opts.tab.toLowerCase());
      });
    }
    if (opts.district) {
      var el=document.getElementById('srch-location'); if (el) el.value=opts.district;
    }
    if (opts.type) {
      var el=document.getElementById('srch-type-txt'); if (el) el.value=opts.type;
    }
    if (opts.query) {
      var el=document.getElementById('sm-quick-search'); if (el) el.value=opts.query;
    }
    if (opts.chip) {
      var el=document.getElementById('sm-quick-search'); if (el) el.value=opts.chip;
    }
  }
  updateCount();
}
function closeSearch() {
  document.getElementById('search-modal').classList.remove('open');
  document.body.style.overflow = '';
  closeQsSuggestions();
}
function setSmTab(btn) {
  btn.closest('.sm-tabs').querySelectorAll('.sm-tab').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  updateCount();
}
// Reset search AND reload all listings
function toggleMoreFilters(btn) {
  var panel = btn.nextElementSibling;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'flex';
  btn.innerHTML = open ? '⚙️ Ibindi Filters ▾' : '⚙️ Ibindi Filters ▲';
  updateCount();
}
function resetSearch() {
  var modal=document.getElementById('search-modal');
  modal.querySelectorAll('input').forEach(function(i){ i.value=''; });
  modal.querySelectorAll('.sm-chip').forEach(function(c){ c.classList.remove('on'); });
  modal.querySelectorAll('.sm-tab').forEach(function(t,i){ t.classList.toggle('active',i===0); });
  var inp=document.getElementById('qs-input'); if (inp) inp.value='';
  var morePanel=document.querySelector('.sm-more-panel'); if (morePanel) morePanel.style.display='none';
  var moreToggle=document.querySelector('.sm-more-toggle'); if (moreToggle) moreToggle.innerHTML='⚙️ Ibindi Filters ▾';
  window._filtersActive=false; window._qs_query='';
  closeQsSuggestions(); invalidatePropsCache();
  updateCount(); loadApprovedProperties();
}
function syncInput(selId, txtId) {
  var sel=document.getElementById(selId), txt=document.getElementById(txtId);
  if (!sel||!txt) return;
  if (sel.value.indexOf('Ikindi')!==-1||sel.value.indexOf('Other')!==-1) {
    txt.style.display='block'; txt.focus();
  } else { txt.style.display='none'; }
}

// ── applySearchFilters: fuzzy + structured matching ──
function applySearchFilters(props) {
  var g=function(id){ var el=document.getElementById(id); return el?el.value.trim():''; };
  var quickQ   = g('sm-quick-search') || (window._qs_query||'');
  var locTxt   = kmNorm(g('srch-location'));
  var typeTxt  = kmNorm(g('srch-type-txt'));
  var bedsTxt  = g('srch-beds-txt').trim();
  var priceTxt = g('srch-price-txt').replace(/[,\s]/g,'');
  var sizeMin  = parseInt(g('srch-size-min'))||0;
  var sizeMax  = parseInt(g('srch-size-max'))||0;
  var activeTabEl = document.querySelector('.sm-tab.active');
  var tabEn = activeTabEl ? (activeTabEl.getAttribute('data-en')||'').toLowerCase() : '';
  var serviceFilter = tabEn==='buy'?'Kugura':(tabEn==='rent'||tabEn==='gukodesha')?'Gukodesha':'';
  var activeChips = Array.from(document.querySelectorAll('.sm-chip.on')).map(function(c){ return c.getAttribute('data-amenity'); }).filter(Boolean);
  // Parse price text: "80M"→80000000, "80000000"→80000000
  function parseP(s) {
    if (!s) return 0;
    var m = s.match(/(\d+\.?\d*)[mM]/);
    if (m) return Math.round(parseFloat(m[1])*1e6);
    var n = parseInt(s); return isNaN(n) ? 0 : n;
  }
  var maxP = parseP(priceTxt);

  return props.filter(function(p) {
    if (quickQ && kmScore(quickQ, p) < 40) return false;
    if (locTxt) {
      var loc=kmNorm((p.district||'')+' '+(p.sector||'')+' '+(p.title||''));
      if (!locTxt.split(' ').filter(Boolean).every(function(w){ return kmWordMatch(w,loc); })) return false;
    }
    if (typeTxt) {
      if (!typeTxt.split(' ').filter(Boolean).some(function(w){ return kmWordMatch(w,kmNorm(p.type||'')); })) return false;
    }
    var bedsMin = parseInt(bedsTxt)||0;
    if (bedsMin>0 && (parseInt(p.beds)||0)<bedsMin) return false;
    var pp = parseInt(p.price)||0;
    if (maxP && pp>maxP) return false;
    var ps = parseInt(p.size)||0;
    if (sizeMin && ps<sizeMin) return false;
    if (sizeMax && ps>sizeMax) return false;
    if (serviceFilter && p.service && p.service!==serviceFilter) return false;
    if (activeChips.length > 0) {
      var has3d = activeChips.indexOf('3dtour') !== -1;
      var amenityChips = activeChips.filter(function(a){ return a !== '3dtour'; });
      if (has3d && !p.tour3dUrl) return false;
      if (amenityChips.length > 0) {
        var pAm = p.amenities || [];
        if (!amenityChips.every(function(a){ return pAm.indexOf(a) !== -1; })) return false;
      }
    }
    return true;
  });
}

// ── updateCount ──
function updateCount() {
  var el=document.getElementById('sm-result-count'); if (!el) return;
  el.textContent = applySearchFilters(getApprovedProps()).length;
}

// ── applyAndSearch: filter + show closest matches on zero results ──
function applyAndSearch() {
  var approved=getApprovedProps(), filtered=applySearchFilters(approved);
  window._filtersActive=true;
  closeSearch(); go('listings');
  kmTrack('search',{query:window._qs_query||'',results:filtered.length});
  setTimeout(function(){
    var grids=document.querySelectorAll('#p-grid-main');
    grids.forEach(function(grid){
      grid.querySelectorAll('.user-prop-card').forEach(function(el){ el.remove(); });
      grid.querySelectorAll('.empty-listings,.similar-results-note').forEach(function(el){ el.remove(); });
      var countEl=document.getElementById('listings-count');
      if (filtered.length===0) {
        var qText=window._qs_query||(function(){var el=document.getElementById('sm-quick-search');return el?el.value.trim():'';})();
        var similar=approved.map(function(p){return{p:p,s:kmScore(qText||'',p)};})
          .sort(function(a,b){return b.s-a.s;}).slice(0,3);
        var note=document.createElement('div');
        note.className='similar-results-note';
        note.style.cssText='grid-column:1/-1';
        note.innerHTML='<span>🔍 '+(curLang==='rw'?'Nta mitungo ihuye — hano ni imitungo ifanana:':'No exact match — showing closest results:')+'</span>'
          +'&nbsp;<button onclick="resetSearch()" class="btn btn-navy btn-sm" style="margin:0">Siba →</button>';
        grid.appendChild(note);
        similar.forEach(function(x){
          var w=document.createElement('div');
          w.className='user-prop-card'; w.setAttribute('data-pid',String(x.p.id));
          w.innerHTML=renderUserPropCard(x.p); grid.appendChild(w);
        });
        if (countEl) countEl.textContent=0;
      } else {
        filtered.forEach(function(prop){
          var w=document.createElement('div');
          w.className='user-prop-card'; w.setAttribute('data-pid',String(prop.id));
          w.innerHTML=renderUserPropCard(prop); grid.appendChild(w);
        });
        if (countEl) countEl.textContent=filtered.length;
      }
    });
  }, 150);
}

// ESC + outside-click to close
document.addEventListener('keydown', function(e) {
  if (e.key==='Escape') { closeSearch(); closeQsSuggestions(); }
});
document.addEventListener('click', function(e) {
  var qs=document.getElementById('qs-suggestions'), inp=document.getElementById('qs-input');
  if (qs && qs.style.display!=='none' && !qs.contains(e.target) && e.target!==inp) qs.style.display='none';
});

// ── Init on load ──
window.addEventListener('DOMContentLoaded', function() {
  go('home');
  setLang('rw');
  initChat();
});

// ============================================
//  KOMISIYONERI — PROPERTY SUBMISSION SYSTEM
// ============================================

var adminCurrentFilter = 'pending';

// --- RENDER USER PROPERTY CARD ---
function renderUserPropCard(prop) {
  var pid = String(prop.id);
  var gradients = ['g1','g2','g3','g4','g5','g6','g7'];
  var gidx = pid.split('').reduce(function(a,c){return a+(c.charCodeAt(0));},0) % 7;
  var gclass = gradients[gidx];

  // Price
  var priceNum = parseInt(prop.price) || 0;
  var priceLabel = priceNum >= 1000000
    ? (Math.round(priceNum/1000000)) + 'M RWF'
    : priceNum >= 1000 ? (Math.round(priceNum/1000)) + 'K RWF'
    : priceNum + ' RWF';
  if(prop.service === 'Gukodesha') priceLabel += '/mo';

  // Service badge
  var svcBadge = prop.service === 'Gukodesha'
    ? '<span class="badge b-green">Gukodesha</span>'
    : '<span class="badge b-navy">Kugura</span>';

  // Location + features
  var loc = [prop.district, prop.sector].filter(Boolean).join(', ');
  var feats = [];
  if(prop.beds && prop.beds !== '0') feats.push('<span class="p-feat">🛏 '+prop.beds+'</span>');
  if(prop.baths && prop.baths !== '0') feats.push('<span class="p-feat">🚿 '+prop.baths+'</span>');
  if(prop.size) feats.push('<span class="p-feat">📐 '+prop.size+'m²</span>');
  var featsHtml = feats.join('');

  // Image
  var imgBg = prop.img1 ? ' style="background-image:url(' + prop.img1 + ');background-size:cover;background-position:center;background-repeat:no-repeat"' : '';

  // Badges
  var topBadges = '';
  if(prop.isDemo) topBadges += '<span style="position:absolute;top:.4rem;left:.4rem;z-index:4;background:rgba(245,166,35,.95);color:#000;border-radius:20px;padding:.1rem .5rem;font-size:.6rem;font-weight:800">✦ DEMO</span>';
  if(prop.verified) topBadges += '<span style="position:absolute;top:.4rem;right:.4rem;z-index:4;background:rgba(39,168,74,.9);color:#fff;border-radius:20px;padding:.1rem .4rem;font-size:.6rem;font-weight:700">✅</span>';
  if(prop.rating) topBadges += '<span style="position:absolute;bottom:.4rem;right:.4rem;z-index:4;background:rgba(0,0,0,.6);color:#fff;border-radius:20px;padding:.1rem .45rem;font-size:.65rem;font-weight:700">★ '+prop.rating+'</span>';

  // No image placeholder
  var placeholder = prop.img1 ? '' : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.4"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="white" stroke-width="1"><path d="M3 12l9-9 9 9M5 10v9h14v-9"/></svg></div>';

  // Short desc
  var shortDesc = prop.desc ? prop.desc.substring(0, 55) + '...' : '';

  // Star rating HTML
  var ratingVal = prop.rating || (4.5 + Math.random() * 0.5).toFixed(1);
  var reviewCount = prop.reviews || Math.floor(Math.random() * 20 + 3);
  var starsHtml = '';
  for (var si = 1; si <= 5; si++) {
    starsHtml += '<span class="p-star' + (si <= Math.floor(ratingVal) ? ' on' : '') + '">★</span>';
  }

  // Verified bottom-left badge
  var verifiedBadge = prop.verified ? '<div class="p-verified"><svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' + t('verified') + '</div>' : '';

  // WhatsApp message
  var propName = (prop.type||'Imitungo') + (prop.district ? ' — '+prop.district : '');
  var waText = encodeURIComponent(t('waMsg') + propName + ' (' + priceLabel + ')' + t('waMsgEnd'));
  var waPhone = '250783177254';

  return '<div class="p-card" data-pid="' + pid + '" style="cursor:pointer">'
    + '<div class="p-img ' + gclass + '"' + imgBg + ' style="position:relative' + (imgBg ? ';background-size:cover;background-position:center' : '') + '" onclick="openPropDetail(\'' + pid + '\')">'
    +   topBadges
    +   placeholder
    +   '<div class="p-tag">' + svcBadge + '</div>'
    +   '<div class="p-price">' + priceLabel + '</div>'
    +   verifiedBadge
    + '</div>'
    + '<div class="p-body" onclick="openPropDetail(\'' + pid + '\')">'
    +   '<div class="p-loc">' + loc + '</div>'
    +   '<div class="p-rating"><div class="p-stars">' + starsHtml + '</div><span class="p-rating-count">(' + reviewCount + ')</span></div>'
    +   '<div class="p-title">' + propName + '</div>'
    +   (shortDesc ? '<div style="font-size:.76rem;color:#6b7280;line-height:1.45;margin:.2rem 0">' + shortDesc + '</div>' : '')
    +   '<div class="p-feats">' + featsHtml + '</div>'
    + '</div>'
    + '<div class="p-card-footer">'
    +   '<button class="p-btn-detail" onclick="openPropDetail(\'' + pid + '\')">' + t('viewDetail') + '</button>'
    +   '<button title="Add to Compare" onclick="event.stopPropagation();addToCompare(\'' + pid + '\')" style="padding:.35rem .5rem;border:1.5px solid var(--border);border-radius:8px;background:#fff;cursor:pointer;font-size:.82rem;color:var(--muted);transition:var(--tr)" onmouseover="this.style.borderColor=\'var(--navy)\';this.style.color=\'var(--navy)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--muted)\'">⚖️</button>'
    +   '<button class="p-btn-wa" onclick="event.stopPropagation();window.open(\'https://wa.me/' + waPhone + '?text=' + waText + '\',\'_blank\')">'
    +     '<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.549 4.107 1.508 5.84L0 24l6.335-1.483A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.502-5.178-1.38l-.37-.22-3.762.88.924-3.638-.242-.375A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>'
    +     'WhatsApp'
    +   '</button>'
    + '</div>'
    + '</div>';
}


// --- INJECT APPROVED PROPERTIES INTO LISTINGS PAGE ---
function loadApprovedProperties() {
  var grids = document.querySelectorAll('#p-grid-main');
  if (!grids.length) return;
  var props = [];
  try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
  // Show demos + approved real listings
  var approved = props.filter(function(p){ return p.status === 'Approved'; });

  grids.forEach(function(grid) {
    grid.querySelectorAll('.user-prop-card,.sk-init').forEach(function(el){ el.remove(); });
    var empty = grid.querySelector('.empty-listings');
    if(empty) empty.remove();

    if(approved.length === 0) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-listings empty-state';
      emptyDiv.innerHTML = '<div class="es-icon">🏠</div>'
        + '<div class="es-title">' + t('noListings') + '</div>'
        + '<div class="es-sub">' + (curLang==='rw'?'Nta mitungo yemejwe ubu. Gerageza demo!':'No approved listings yet. Try demo listings!') + '</div>'
        + '<button onclick="loadDemoListings()" class="btn btn-navy btn-sm">'
        + t('demoBtn') + '</button>';
      grid.appendChild(emptyDiv);
    } else {
      // Add all approved (demos + real)
      approved.forEach(function(prop) {
        var wrapper = document.createElement('div');
        wrapper.className = 'user-prop-card';
        wrapper.setAttribute('data-pid', String(prop.id));
        wrapper.innerHTML = renderUserPropCard(prop);
        grid.appendChild(wrapper);
      });
    }
  });

  // Update count
  var countEl = document.getElementById('listings-count');
  if (countEl) countEl.textContent = approved.length;
}

// --- OPEN ADMIN PANEL ---
function openAdmin() {
  var isAdmin = currentUser && (
    currentUser.email === 'komisiyonericonnectproservices@gmail.com' ||
    currentUser.email === 'admin@komisiyoneri.com' ||
    currentUser.role === 'Admin'
  );
  if (!isAdmin) {
    showToast(curLang==='rw' ? 'Ntabwo wemerewe! Admin gusa.' : 'Access denied. Admin only.', 'error');
    return;
  }
  var m = document.getElementById('admin-modal');
  if(m) m.style.display = 'flex';
  adminRender('pending');
}

function closeAdmin() {
  var m = document.getElementById('admin-modal');
  if(m) m.style.display = 'none';
}

function adminFilter(status) {
  adminCurrentFilter = status;
  adminRender(status);
  // Update button styles
  ['pending','approved','rejected'].forEach(function(s) {
    var btn = document.getElementById('adm-btn-'+s);
    if(btn) {
      btn.className = s === status ? 'btn btn-navy btn-sm' : 'btn btn-sm';
      if(s !== status) btn.style.cssText = 'font-size:.75rem;border:1.5px solid var(--border)';
      else btn.style.cssText = 'font-size:.75rem';
    }
  });
}

function adminRender(filter) {
  var props = [];
  try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
  // Update counts
  ['pending','approved','rejected'].forEach(function(s) {
    var el = document.getElementById('adm-count-'+s);
    if(el) el.textContent = props.filter(function(p){return (p.status||'').toLowerCase()===s;}).length;
  });
  var allEl = document.getElementById('adm-count-all');
  if(allEl) allEl.textContent = props.length;

  var filtered = filter === 'all' ? props : props.filter(function(p){
    return (p.status||'').toLowerCase() === filter;
  });

  // Update active tab style
  ['all','pending','approved','rejected'].forEach(function(s) {
    var btn = document.getElementById('adm-btn-'+s);
    if(!btn) return;
    if(s === filter) {
      btn.style.background = 'var(--navy)'; btn.style.color = '#fff'; btn.style.border = 'none';
    } else {
      btn.style.background = '#fff'; btn.style.color = 'var(--dark)'; btn.style.border = '1.5px solid var(--border)';
    }
  });
  var list = document.getElementById('admin-list');
  if (!list) return;
  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)">' + t('noPropsCat') + '</div>';
    return;
  }
  var propsIndexed = props.map(function(p, i) { return {p: p, idx: i}; });
  var filteredIndexed = filter === 'all' ? propsIndexed : propsIndexed.filter(function(item) {
    return (item.p.status||'').toLowerCase() === filter;
  });
  list.innerHTML = filteredIndexed.map(function(item) {
    var prop = item.p;
    var globalIdx = item.idx;
    var priceDisplay = prop.price ? Number(prop.price).toLocaleString()+' RWF' : '—';
    var statusColor = prop.status==='Approved'?'#27A84A':prop.status==='Rejected'?'#e53e3e':'#F5A623';
    return '<div style="border:1.5px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:.8rem;background:#fafbff">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;flex-wrap:wrap">'
      + '<div style="flex:1">'
      + '<div style="font-weight:700;color:var(--navy);font-size:.95rem">'+escapeHtml(prop.type||'')+' — '+escapeHtml(prop.district||'')+(prop.sector?', '+escapeHtml(prop.sector):'')+'</div>'
      + '<div style="font-size:.8rem;color:var(--muted);margin:.2rem 0">👤 '+escapeHtml(prop.owner||'')+' | 📞 '+escapeHtml(prop.contact||'')+'</div>'
      + '<div style="font-size:.8rem;color:var(--muted)">📧 '+escapeHtml(prop.ownerEmail||'—')+'</div>'
      + '<div style="font-size:.85rem;margin:.4rem 0;font-weight:600">💰 '+priceDisplay+' ('+escapeHtml(prop.service||'')+')</div>'
      + (prop.desc?'<div style="font-size:.78rem;color:#555;margin:.3rem 0;font-style:italic">'+escapeHtml(prop.desc.substring(0,100))+'...</div>':'')
      + '<div style="font-size:.72rem;color:var(--muted)">📅 '+(prop.date?new Date(prop.date).toLocaleString():'—')+'</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:.4rem;flex-shrink:0">'
      + '<div style="font-size:.7rem;font-weight:700;color:'+statusColor+';text-align:center">'+escapeHtml(prop.status||'')+'</div>'
      + (filter!=='approved'?'<button onclick="adminApprove('+globalIdx+')" style="background:#27A84A;color:#fff;border:none;padding:.35rem .7rem;border-radius:6px;cursor:pointer;font-size:.75rem;font-weight:700">✅ Emeza</button>':'')
      + (filter!=='rejected'?'<button onclick="adminReject('+globalIdx+')" style="background:#e53e3e;color:#fff;border:none;padding:.35rem .7rem;border-radius:6px;cursor:pointer;font-size:.75rem;font-weight:700">❌ Kataa</button>':'')
      + '<button onclick="adminDelete('+globalIdx+')" style="background:#718096;color:#fff;border:none;padding:.35rem .7rem;border-radius:6px;cursor:pointer;font-size:.75rem">🗑️ Siba</button>'
      + '</div></div></div>';
  }).join('');
}

function adminApprove(idx) {
  var props = [];
  try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
  if (props[idx]) {
    props[idx].status = 'Approved';
    try { localStorage.setItem('km_properties', JSON.stringify(props)); } catch(e){}
    showToast('✅ Imitungo yemejwe! Igaragara muri Listings.');
    adminRender(adminCurrentFilter);
    loadApprovedProperties();
  }
}

function adminUnapprove(idx) {
  var props = [];
  try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
  if (props[idx]) {
    props[idx].status = 'Pending';
    try { localStorage.setItem('km_properties', JSON.stringify(props)); } catch(e){}
    showToast('↩ Imitungo yasubijwe Pending.');
    adminRender(adminCurrentFilter);
    loadApprovedProperties();
  }
}

function adminReject(idx) {
  var props = [];
  try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
  if (props[idx]) {
    props[idx].status = 'Rejected';
    try { localStorage.setItem('km_properties', JSON.stringify(props)); } catch(e){}
    showToast('❌ Imitungo yananiwe.');
    adminRender(adminCurrentFilter);
  }
}

function adminDelete(idx) {
  if (!confirm(t('delConfirm'))) return;
  var props = [];
  try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
  props.splice(idx, 1);
  try { localStorage.setItem('km_properties', JSON.stringify(props)); } catch(e){}
  showToast(t('deleted'));
  adminRender(adminCurrentFilter);
  loadApprovedProperties();
}

function adminDeleteAll(status) {
  var label = status === 'approved' ? t('labApproved') : status === 'rejected' ? t('labRejected') : t('labAll');
  if (!confirm(label + ': ' + t('delAllConfirm'))) return;
  var props = [];
  try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
  var kept = props.filter(function(p){ return (p.status||'').toLowerCase() !== status; });
  try { localStorage.setItem('km_properties', JSON.stringify(kept)); } catch(e){}
  showToast(t('delAllDone') + (props.length - kept.length) + ')');
  adminRender(adminCurrentFilter);
  loadApprovedProperties();
}

// --- MY PROPERTIES ---
function openMyProps() {
  if (!currentUser) { go('auth'); return; }
  var m = document.getElementById('my-props-modal');
  if(m) m.style.display = 'flex';
  var props = [];
  try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
  var mine = props.filter(function(p){ return p.ownerEmail === currentUser.email; });
  var list = document.getElementById('my-props-list');
  if (!list) return;
  if (mine.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)">'
      + '<div style="font-size:2rem;margin-bottom:.5rem">🏠</div>'
      + '<div>' + t('noMyProps') + '</div>'
      + '<button class="btn btn-navy btn-sm" style="margin-top:1rem" onclick="openAddProperty()">' + t('addProp') + '</button>'
      + '</div>';
    return;
  }
  list.innerHTML = mine.map(function(prop) {
    var statusColor = prop.status==='Approved'?'#27A84A':prop.status==='Rejected'?'#e53e3e':'#F5A623';
    var statusIcon = prop.status==='Approved'?'✅':prop.status==='Rejected'?'❌':'⏳';
    var priceDisplay = prop.price ? Number(prop.price).toLocaleString()+' RWF' : '—';
    var editBtn = prop.status === 'Pending'
      ? '<button onclick=\'openEditProperty('+JSON.stringify(prop).replace(/\'/g,"\\'")+');document.getElementById("my-props-modal").style.display="none"\' '
        + 'style="background:none;border:1.5px solid var(--navy);color:var(--navy);border-radius:7px;padding:.25rem .6rem;font-size:.72rem;font-weight:700;cursor:pointer;margin-top:.4rem">✏️ '
        + (curLang==='rw'?'Hindura':'Edit') + '</button>'
      : '';
    return '<div style="border:1.5px solid var(--border);border-radius:10px;padding:.9rem;margin-bottom:.7rem">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem">'
      + '<div style="flex:1">'
      + '<div style="font-weight:700;color:var(--navy)">'+prop.type+' — '+prop.district+'</div>'
      + '<div style="font-size:.82rem;color:var(--muted);margin:.2rem 0">'+prop.service+' | '+priceDisplay+'</div>'
      + (prop.desc?'<div style="font-size:.78rem;color:#555;font-style:italic">'+prop.desc.substring(0,60)+'...</div>':'')
      + editBtn
      + '</div>'
      + '<div style="text-align:center;flex-shrink:0">'
      + '<div style="font-size:1.2rem">'+statusIcon+'</div>'
      + '<div style="font-size:.65rem;font-weight:700;color:'+statusColor+'">'+prop.status+'</div>'
      + '</div>'
      + '</div></div>';
  }).join('');
}

// Load approved properties whenever listings page is shown
var origGo = go;
go = function(page) {
  origGo(page);
  if (page === 'listings') {
    setTimeout(loadApprovedProperties, 100);
  }
};

// Also load on page init — after demos are already in localStorage
setTimeout(loadApprovedProperties, 400);


// === BOOKING SYSTEM ===
function openBooking() {
  var m = document.getElementById('booking-modal');
  if(m) m.style.display = 'flex';
  // Set min date to today
  var d = document.getElementById('book-date');
  if(d) d.min = new Date().toISOString().split('T')[0];
  // Pre-fill if logged in
  if(currentUser) {
    var n = document.getElementById('book-name');
    var p = document.getElementById('book-phone');
    if(n && !n.value) n.value = currentUser.name||'';
    if(p && !p.value) p.value = currentUser.phone||'';
  }
}
function closeBooking() {
  var m = document.getElementById('booking-modal');
  if(m) m.style.display = 'none';
}
function submitBooking() {
  var name = document.getElementById('book-name');
  var phone = document.getElementById('book-phone');
  var date = document.getElementById('book-date');
  if(!name||!name.value){showToast('Shyira amazina yawe!', 'error');return;}
  if(!phone||!phone.value){showToast('Shyira telefoni yawe!', 'error');return;}
  if(!date||!date.value){showToast('Hitamo itariki!', 'error');return;}
  var _bb=document.getElementById('book-submit-btn'),_bl=document.getElementById('book-submit-lbl');
  if(_bb){_bb.disabled=true;_bb.classList.add('btn-loading');if(_bl)_bl.innerHTML='<span class="btn-spinner"></span>'+(curLang==='rw'?'Tegereza...':'Sending...');}
  var time = document.getElementById('book-time');
  var cur = window._currentProp || {};
  var bookings = [];
  try{bookings=JSON.parse(localStorage.getItem('km_bookings')||'[]');}catch(e){}
  var bk = {
    id: 'BK-' + Date.now(),
    name: name.value, phone: phone.value, date: date.value,
    time: time ? time.value : '',
    note: (document.getElementById('book-note')||{}).value || '',
    propId:     cur.id        || null,
    propTitle:  cur.title     || (cur.type && cur.district ? cur.type + ' — ' + cur.district : null),
    agentEmail: cur.ownerEmail|| null,
    created: new Date().toISOString()
  };
  bookings.push(bk);
  try{localStorage.setItem('km_bookings',JSON.stringify(bookings));}catch(e){}
  if (bk.id) try { rtdb.ref('bookings/' + bk.id).set(bk); } catch(e){}
  if(_bb){_bb.disabled=false;_bb.classList.remove('btn-loading');if(_bl)_bl.textContent='Emeza Gahunda';}
  closeBooking();
  kmTrack('booking_request',{property_id:String(bk.propId||''),district:bk.district||'',date:bk.date||''});
  showToast('Gahunda yashyizweho! Agent azakuhamagara kuri '+phone.value+'. ✅');
  if (bk.agentEmail) {
    kmSendEmail(_ejsTmplBooking, {
      to_email:     bk.agentEmail,
      prop_title:   bk.propTitle  || '',
      visitor_name: bk.name,
      visitor_phone:bk.phone,
      visit_date:   bk.date,
      visit_time:   bk.time,
      note:         bk.note,
      booking_id:   bk.id
    });
  }
}

// === MESSAGE OWNER SYSTEM ===
function openMessageOwner() {
  var m = document.getElementById('msg-owner-modal');
  if(m) m.style.display = 'flex';
  if(currentUser) {
    var n = document.getElementById('msg-name');
    var p = document.getElementById('msg-phone');
    var e = document.getElementById('msg-email');
    if(n&&!n.value) n.value = currentUser.name||'';
    if(p&&!p.value) p.value = currentUser.phone||'';
    if(e&&!e.value) e.value = currentUser.email||'';
  }
}
function closeMsgOwner() {
  var m = document.getElementById('msg-owner-modal');
  if(m) m.style.display = 'none';
}
function submitMessage() {
  var name = document.getElementById('msg-name');
  var phone = document.getElementById('msg-phone');
  var text = document.getElementById('msg-text');
  if(!name||!name.value){showToast('Shyira amazina yawe!', 'error');return;}
  if(!text||!text.value){showToast('Andika ubutumwa bwawe!');return;}
  var msgs = [];
  try{msgs=JSON.parse(localStorage.getItem('km_messages')||'[]');}catch(e){}
  msgs.push({id:'MSG-'+Date.now(),name:name.value,phone:(phone||{}).value||'',email:(document.getElementById('msg-email')||{}).value||'',text:text.value,date:new Date().toISOString(),status:'unread'});
  try{localStorage.setItem('km_messages',JSON.stringify(msgs));}catch(e){}
  // Open WhatsApp with message
  var waText = 'KOMISIYONERI+Platform+-+'+encodeURIComponent(name.value)+'-+Tel:+'+encodeURIComponent((phone||{}).value||'N/A')+'-+'+encodeURIComponent(text.value);
  closeMsgOwner();
  showToast('Message yoherejwe! ✅ Tuzakusubiza vuba.');
  setTimeout(function(){
    if(confirm('Urashaka kohereza kandi kuri WhatsApp vuba?')){
      window.open('https://wa.me/250783177254?text='+waText,'_blank');
    }
  }, 500);
}

// === DEPOSIT PAYMENT SYSTEM ===
function openDepositPay() {
  if(kmFlag('payments')) injectRealDepositForm();
  var m = document.getElementById('deposit-modal');
  if(m) m.style.display = 'flex';
  if(kmFlag('payments') && currentUser) {
    var n = document.getElementById('dep-name');
    var p = document.getElementById('dep-phone');
    if(n&&!n.value) n.value = currentUser.name||'';
    if(p&&!p.value) p.value = currentUser.phone||'';
  }
}
function closeDepositPay() {
  var m = document.getElementById('deposit-modal');
  if(m) m.style.display = 'none';
}
function selectDepMethod(el) {
  ['dep-m1','dep-m2','dep-m3','dep-m4'].forEach(function(id){
    var btn = document.getElementById(id);
    if(btn){btn.style.borderWidth='1.5px';btn.style.borderColor='var(--border)';btn.style.background='';}
  });
  el.style.borderWidth = '2px';
  el.style.borderColor = 'var(--navy)';
  el.style.background = 'rgba(13,59,140,.06)';
}
function submitDeposit() {
  var name = document.getElementById('dep-name');
  var phone = document.getElementById('dep-phone');
  if(!name||!name.value){showToast('Shyira amazina yawe!', 'error');return;}
  if(!phone||!phone.value){showToast('Shyira telefoni yawe!', 'error');return;}
  closeDepositPay();
  showToast('Deposit yoherejwe! Tuzakwemeza mu masaha 24. ✅');
}


// === DETAIL PAGE TAB SWITCHER ===
function switchDetTab(tab, btn) {
  var tabs = ['desc','3d','map','docs','reviews'];
  tabs.forEach(function(t) {
    var el = document.getElementById('tab-' + (t==='3d'?'3d':t));
    if(el) el.style.display = 'none';
  });
  // Show selected
  var show = document.getElementById('tab-' + tab);
  if(show) show.style.display = 'block';
  // Update tab buttons
  document.querySelectorAll('.det-tab').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
}

// === MORTGAGE CALCULATOR ===
function openMortgage() {
  var m = document.getElementById('mortgage-modal');
  if(m) m.style.display = 'flex';
  calcMortgage();
}
function closeMortgage() {
  var m = document.getElementById('mortgage-modal');
  if(m) m.style.display = 'none';
}
function calcMortgage() {
  var price = parseFloat(document.getElementById('mort-price').value) || 120000000;
  var depPct = parseFloat(document.getElementById('mort-deposit').value) || 20;
  var years = parseFloat(document.getElementById('mort-years').value) || 15;
  var rate = parseFloat(document.getElementById('mort-rate').value) || 17;
  var deposit = price * depPct / 100;
  var loan = price - deposit;
  var monthlyRate = rate / 100 / 12;
  var n = years * 12;
  var monthly = loan * monthlyRate * Math.pow(1+monthlyRate,n) / (Math.pow(1+monthlyRate,n)-1);
  var total = monthly * n;
  function fmt(n) {
    if(n >= 1000000) return (n/1000000).toFixed(1) + 'M RWF';
    return Math.round(n/1000) + 'K RWF';
  }
  var el = function(id){ return document.getElementById(id); };
  if(el('mort-monthly')) el('mort-monthly').textContent = fmt(monthly) + '/mo';
  if(el('mort-summary')) el('mort-summary').textContent = 'Imyaka ' + years + ' | ' + rate + '%/yr | Total: ' + fmt(total);
  if(el('mort-dep-val')) el('mort-dep-val').textContent = fmt(deposit);
  if(el('mort-loan-val')) el('mort-loan-val').textContent = fmt(loan);
  if(el('mort-total-val')) el('mort-total-val').textContent = fmt(total);
}

// === PROPERTY COMPARISON ===
var _comparePropB = null;

function addToCompare(propId) {
  var props = [];
  try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
  var prop = props.find(function(p){ return String(p.id) === String(propId); });
  if (!prop) return;
  _comparePropB = prop;
  var label = prop.title || ((prop.type||'Imitungo') + (prop.district ? ' — '+prop.district : ''));
  showToast('⚖️ ' + escapeHtml(label) + ' — ' + (curLang==='rw' ? 'Fungura indi imitungo ukande Compare!' : 'Now open another property and click Compare!'));
}

function openCompare() {
  var m = document.getElementById('compare-modal');
  if (!m) return;
  m.style.display = 'flex';
  var propA = window._currentProp || null;
  var propB = _comparePropB || null;
  var content = document.getElementById('compare-content');
  var actions = document.getElementById('compare-actions');
  if (!content) return;

  if (!propA && !propB) {
    content.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)"><div style="font-size:2rem;margin-bottom:.5rem">⚖️</div><div style="font-weight:600;color:var(--navy);margin-bottom:.4rem">'+(curLang==='rw'?'Hitamo Imitungo 2':'Select 2 Properties')+'</div><div style="font-size:.83rem">'+(curLang==='rw'?'Kanda ⚖️ ku karita igereranye.':'Click ⚖️ on any listing card to add it.')+'</div></div>';
    if (actions) actions.innerHTML = '';
    return;
  }
  if (!propB) {
    content.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted)"><div style="font-size:1.6rem;margin-bottom:.5rem">⚖️</div><div style="font-weight:600;color:var(--navy);margin-bottom:.3rem">'+(propA ? escapeHtml(propA.title||(propA.type+' — '+(propA.district||''))) : '')+'</div><div style="font-size:.83rem;margin-top:.4rem">'+(curLang==='rw'?'Kanda ⚖️ ku karita ya kabiri kugira ngo ugereranye.':'Click ⚖️ on a second listing card to compare.')+'</div></div>';
    if (actions) actions.innerHTML = '';
    return;
  }
  renderCompareTable(propA || propB, propB);
}

function renderCompareTable(propA, propB) {
  var content = document.getElementById('compare-content');
  var actions = document.getElementById('compare-actions');
  if (!content) return;

  function fmt(p) {
    var n = parseInt(p.price)||0;
    var s = n>=1000000 ? (n/1000000).toFixed(0)+'M RWF' : n>=1000 ? Math.round(n/1000)+'K RWF' : (n||'—')+' RWF';
    return p.service==='Gukodesha' ? s+'/mo' : s;
  }
  function hi(vA, vB, higherBetter) {
    var na = parseFloat(vA), nb = parseFloat(vB);
    if (isNaN(na)||isNaN(nb)) return ['',''];
    var better = higherBetter ? na > nb : na < nb;
    var worse  = higherBetter ? na < nb : na > nb;
    return [better?'color:var(--green);font-weight:700':worse?'color:#e53e3e':'', worse?'color:var(--green);font-weight:700':better?'color:#e53e3e':''];
  }

  var priceH = hi(propA.price, propB.price, false);
  var bedH  = hi(propA.beds,  propB.beds,  true);
  var bathH = hi(propA.baths, propB.baths, true);
  var sizeH = hi(propA.size,  propB.size,  true);
  var rateH = hi(propA.rating||0, propB.rating||0, true);

  var nameA = escapeHtml(propA.title||(propA.type+' — '+(propA.district||'')));
  var nameB = escapeHtml(propB.title||(propB.type+' — '+(propB.district||'')));

  var pricePmA = (propA.service!=='Gukodesha'&&propA.price&&propA.size) ? Math.round(parseInt(propA.price)/parseInt(propA.size)).toLocaleString()+' RWF/m²' : '—';
  var pricePmB = (propB.service!=='Gukodesha'&&propB.price&&propB.size) ? Math.round(parseInt(propB.price)/parseInt(propB.size)).toLocaleString()+' RWF/m²' : '—';

  var rows = [
    ['💰 Igiciro/Price', fmt(propA), fmt(propB), priceH[0], priceH[1]],
    ['📍 Ahantu/Location', escapeHtml([propA.district,propA.sector].filter(Boolean).join(', ')||'—'), escapeHtml([propB.district,propB.sector].filter(Boolean).join(', ')||'—'), '', ''],
    ['🏠 Ubwoko/Type', escapeHtml(propA.type||'—'), escapeHtml(propB.type||'—'), '', ''],
    ['🔑 Serivisi', propA.service==='Gukodesha'?'Gukodesha':'Kugura', propB.service==='Gukodesha'?'Gukodesha':'Kugura', '', ''],
    ['🛏 Ibyumba/Beds', propA.beds&&propA.beds!=='0'?propA.beds+' BR':'—', propB.beds&&propB.beds!=='0'?propB.beds+' BR':'—', bedH[0], bedH[1]],
    ['🚿 Bafu/Baths', propA.baths&&propA.baths!=='0'?propA.baths+' BA':'—', propB.baths&&propB.baths!=='0'?propB.baths+' BA':'—', bathH[0], bathH[1]],
    ['📐 Ubuso/Size', propA.size?propA.size+'m²':'—', propB.size?propB.size+'m²':'—', sizeH[0], sizeH[1]],
    ['🏗️ Yubatswe/Year', propA.yearBuilt||'—', propB.yearBuilt||'—', '', ''],
    ['📋 Title Deed', escapeHtml(propA.titleDeed||'—'), escapeHtml(propB.titleDeed||'—'), '', ''],
    ['🌐 3D Tour', propA.tour3dUrl?'✅':'—', propB.tour3dUrl?'✅':'—', '', ''],
    ['⭐ Rating', propA.rating?'★ '+propA.rating:'—', propB.rating?'★ '+propB.rating:'—', rateH[0], rateH[1]],
    ['💵 Igiciro/m²', pricePmA, pricePmB, '', '']
  ];

  var tbody = rows.map(function(r, i) {
    var bg = i%2===0 ? 'background:var(--light)' : '';
    return '<tr style="'+bg+'"><td style="padding:.6rem .5rem;font-weight:600;font-size:.82rem">'+r[0]+'</td>'
      +'<td style="text-align:center;padding:.6rem .5rem;font-size:.83rem;'+r[3]+'">'+r[1]+'</td>'
      +'<td style="text-align:center;padding:.6rem .5rem;font-size:.83rem;'+r[4]+'">'+r[2]+'</td></tr>';
  }).join('');

  content.innerHTML = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">'
    +'<thead><tr>'
    +'<th style="text-align:left;padding:.7rem .5rem;border-bottom:2px solid var(--border);color:var(--muted);font-size:.7rem;text-transform:uppercase;letter-spacing:.08em">Ibiranga</th>'
    +'<th style="text-align:center;padding:.7rem .5rem;border-bottom:2px solid var(--navy);color:var(--navy);font-size:.8rem;max-width:160px">🏠 '+nameA+'</th>'
    +'<th style="text-align:center;padding:.7rem .5rem;border-bottom:2px solid var(--blue);color:var(--blue);font-size:.8rem;max-width:160px">🏢 '+nameB+'</th>'
    +'</tr></thead><tbody>'+tbody+'</tbody></table></div>';

  if (actions) {
    var pidA = String(propA.id), pidB = String(propB.id);
    actions.innerHTML = '<button onclick="closeCompare();openPropDetail(\''+pidA+'\')" class="btn btn-navy btn-sm" style="justify-content:center">'+nameA+' — Detail</button>'
      +'<button onclick="closeCompare();openPropDetail(\''+pidB+'\')" class="btn btn-outline btn-sm" style="justify-content:center">'+nameB+' — Detail</button>';
  }
}

function closeCompare() {
  var m = document.getElementById('compare-modal');
  if(m) m.style.display = 'none';
}

// === REVIEWS ===
var currentRating = 0;
function renderReviewsTab(prop) {
  var reviews = [];
  try { reviews = JSON.parse(localStorage.getItem('km_reviews')||'[]'); } catch(e) {}
  var propRevs = reviews.filter(function(r){ return r.propId && String(r.propId) === String(prop.id); });
  var count = propRevs.length;
  var avg = count > 0
    ? Math.round(propRevs.reduce(function(s,r){ return s+(r.rating||0); },0) / count * 10) / 10
    : null;

  var avgEl = document.getElementById('det-avg-rating');
  if (avgEl) avgEl.textContent = avg !== null ? avg.toFixed(1) : (prop.rating ? String(prop.rating) : '—');

  var cntEl = document.getElementById('det-review-count');
  if (cntEl) cntEl.textContent = count + ' ' + (curLang==='rw' ? 'Ibitekerezo' : (count === 1 ? 'Review' : 'Reviews'));

  var barsEl = document.getElementById('det-rating-bars');
  if (barsEl) {
    var barsHtml = '';
    [5,4,3,2,1].forEach(function(star) {
      var n = count > 0 ? propRevs.filter(function(r){ return Math.round(r.rating) === star; }).length : 0;
      var pct = count > 0 ? Math.round(n / count * 100) : 0;
      barsHtml += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem">'
        + '<span style="font-size:.75rem;width:20px">'+star+'★</span>'
        + '<div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px"><div style="width:'+pct+'%;height:100%;background:var(--gold);border-radius:3px"></div></div>'
        + '<span style="font-size:.72rem;color:var(--muted)">'+pct+'%</span></div>';
    });
    barsEl.innerHTML = barsHtml;
  }

  var list = document.getElementById('reviews-list');
  if (list) {
    if (count === 0) {
      list.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.83rem">'
        + (curLang==='rw' ? 'Nta review irashyizweho — uba uwa mbere!' : 'No reviews yet — be the first!') + '</div>';
    } else {
      list.innerHTML = propRevs.slice().reverse().map(function(r) {
        var stars = '★'.repeat(r.rating||0) + '☆'.repeat(5-(r.rating||0));
        return '<div style="padding:.9rem;border:1.5px solid var(--border);border-radius:10px">'
          + '<div style="display:flex;justify-content:space-between;margin-bottom:.4rem">'
          + '<div style="font-weight:700;font-size:.88rem">'+escapeHtml(r.name||'—')+'</div>'
          + '<div style="color:var(--gold);font-size:.85rem">'+stars+'</div></div>'
          + '<div style="font-size:.8rem;color:var(--muted);margin-bottom:.4rem">'+escapeHtml(r.date||'')+'</div>'
          + '<div style="font-size:.85rem;color:#444">'+escapeHtml(r.text||'')+'</div></div>';
      }).join('');
    }
  }
}

function openReviewForm() {
  var m = document.getElementById('review-modal');
  if(m) m.style.display = 'flex';
  if(currentUser) {
    var n = document.getElementById('rev-name');
    if(n && !n.value) n.value = currentUser.name || '';
  }
}
function closeReviewForm() {
  var m = document.getElementById('review-modal');
  if(m) m.style.display = 'none';
}
function setRating(r) {
  currentRating = r;
  document.getElementById('rev-rating').value = r;
  var stars = document.querySelectorAll('.star-btn');
  stars.forEach(function(s, i) { s.textContent = i < r ? '★' : '☆'; s.style.color = i < r ? 'var(--gold)' : '#ccc'; });
}
function submitReview() {
  var name = document.getElementById('rev-name');
  var text = document.getElementById('rev-text');
  if(!name||!name.value){showToast('Shyira amazina yawe!', 'error');return;}
  if(currentRating === 0){showToast('Hitamo inyenyeri (rating)!');return;}
  if(!text||!text.value){showToast('Andika ibitekerezo byawe!');return;}
  var cur = window._currentProp || {};
  var reviews = [];
  try{reviews=JSON.parse(localStorage.getItem('km_reviews')||'[]');}catch(e){}
  reviews.push({
    id: 'RVW-'+Date.now(),
    name: name.value, rating: currentRating, text: text.value,
    date: new Date().toLocaleDateString(),
    propId: cur.id || null
  });
  try{localStorage.setItem('km_reviews',JSON.stringify(reviews));}catch(e){}

  // Recalculate and persist avg rating on the property
  if (cur.id) {
    var propRevs = reviews.filter(function(r){ return r.propId && String(r.propId) === String(cur.id); });
    var newAvg = Math.round(propRevs.reduce(function(s,r){ return s+(r.rating||0); },0) / propRevs.length * 10) / 10;
    var props = [];
    try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
    var pidx = -1;
    for(var i=0;i<props.length;i++){ if(String(props[i].id)===String(cur.id)){pidx=i;break;} }
    if(pidx !== -1) {
      props[pidx].rating = newAvg;
      props[pidx].reviews = propRevs.length;
      try { localStorage.setItem('km_properties',JSON.stringify(props)); } catch(e){}
      if(window._currentProp){ window._currentProp.rating = newAvg; window._currentProp.reviews = propRevs.length; }
    }
    renderReviewsTab(cur);
    // Update the ★ badge in the hero
    document.querySelectorAll('.badge').forEach(function(b){
      if(b.textContent.match(/^★\s*[\d.]+$/)) b.textContent = '★ '+newAvg;
    });
  }

  closeReviewForm();
  showToast('Review yawe yoherejwe! Murakoze. ' + '★'.repeat(currentRating));
  name.value=''; text.value=''; setRating(0);
}


// === SIMILAR PROPERTIES — Dynamic ===
function loadSimilarProperties() {
  var list = document.getElementById('similar-props-list');
  var empty = document.getElementById('similar-empty');
  if (!list) return;

  var cur = window._currentProp;
  var props = [];
  try { props = JSON.parse(localStorage.getItem('km_properties') || '[]'); } catch(e) {}

  var approved = props.filter(function(p) {
    return p.status === 'Approved' && (!cur || String(p.id) !== String(cur.id));
  });

  if (approved.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  // Score by relevance: same type + same district = 2, one match = 1, no match = 0
  var scored = approved.map(function(p) {
    var score = 0;
    if (cur) {
      if (p.type === cur.type) score++;
      if (p.district === cur.district) score++;
    }
    return { p: p, score: score };
  });
  scored.sort(function(a, b) { return b.score - a.score; });

  if (empty) empty.style.display = 'none';
  var colors = ['g1','g2','g3','g4','g5','g6'];
  var show = scored.slice(0, 4);

  list.innerHTML = show.map(function(item, i) {
    var prop = item.p;
    var priceDisplay = prop.price
      ? (parseInt(prop.price) >= 1000000
        ? Math.round(parseInt(prop.price)/1000000) + 'M RWF'
        : Math.round(parseInt(prop.price)/1000) + 'K RWF')
      : '—';
    if (prop.service === 'Gukodesha') priceDisplay += '/mo';
    var imgStyle = prop.img1 ? 'background:url(' + prop.img1 + ') center/cover no-repeat' : '';
    var colorClass = prop.img1 ? '' : colors[i % colors.length];
    var matchBadge = item.score === 2
      ? '<span style="font-size:.68rem;background:var(--green);color:#fff;border-radius:4px;padding:.1rem .35rem;margin-left:.3rem">✓ Ifanana</span>'
      : (item.score === 1 ? '<span style="font-size:.68rem;background:var(--light);color:var(--muted);border-radius:4px;padding:.1rem .35rem;margin-left:.3rem">~ ' + (prop.type === (cur&&cur.type) ? prop.type : prop.district) + '</span>' : '');
    return '<div style="display:flex;align-items:center;gap:.7rem;cursor:pointer;padding:.5rem;border-radius:9px;transition:var(--tr)" '
      + 'onmouseover="this.style.background=\'var(--light)\'" onmouseout="this.style.background=\'\'" '
      + 'onclick="openPropDetail(' + JSON.stringify(prop).replace(/"/g,'&quot;') + ')">'
      + '<div style="width:52px;height:46px;border-radius:8px;flex-shrink:0;' + imgStyle + '" class="' + colorClass + '"></div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:.84rem;font-weight:600;display:flex;align-items:center;flex-wrap:wrap">' + (prop.title || (prop.type + ' — ' + (prop.district||''))) + matchBadge + '</div>'
      + '<div style="font-size:.76rem;color:var(--muted)">' + priceDisplay + '</div>'
      + '</div></div>';
  }).join('');
}

// Load similar properties when detail page opens
var _origGo2 = go;
go = function(page) {
  _origGo2(page);
  if (page === 'detail') {
    setTimeout(loadSimilarProperties, 150);
  }
};
setTimeout(loadSimilarProperties, 400);


// ════════════════════════════════════════════════
//  KOMISIYONERI — REAL AUTH SYSTEM
//  Google Sign-in + Phone OTP (Firebase)
// ════════════════════════════════════════════════

// Firebase is already initialized at the top of the page; no duplicate config needed.

var firebaseApp = null;
var firebaseAuth = null;
var confirmationResult = null;
var recaptchaVerifier = null;

// Initialize Firebase
function initFirebase() {
  try {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
      firebaseAuth = firebase.auth();
      if (!window._authListenerAttached) {
        window._authListenerAttached = true;
        firebaseAuth.onAuthStateChanged(function(fbUser) {
          if (fbUser) {
            var prov = (fbUser.providerData[0] && fbUser.providerData[0].providerId) || '';
            if (prov === 'password') {
              var users = [];
              try { users = JSON.parse(localStorage.getItem('km_users')||'[]'); } catch(e){}
              var saved = users.find(function(u){ return u.email===fbUser.email; });
              if (saved) {
                saved.emailVerified = fbUser.emailVerified;
                try { localStorage.setItem('km_users', JSON.stringify(users)); } catch(e){}
              }
            }
          } else {
            if (currentUser && (currentUser.provider === 'google' || currentUser.provider === 'phone' || currentUser.provider === 'email')) {
              currentUser = null;
              try { localStorage.removeItem('km_current'); } catch(e) {}
              updateNavForUser(null);
            }
          }
        });
      }
      return true;
    }
  } catch(e) {
    console.log('Firebase not available:', e.message);
  }
  return false;
}

// === GOOGLE SIGN-IN ===
function initGoogleSignIn() {
  var container = document.getElementById('google-signin-btn');
  if (!container) return;

  // Use Google Identity Services
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.initialize({
      // Replace with your Google Client ID from console.cloud.google.com
      client_id: '1008698859279-i85iho206omiura7rb76lmun56vvmio7.apps.googleusercontent.com',
      callback: handleGoogleResponse,
      auto_select: false,
      cancel_on_tap_outside: true
    });
    google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      width: container.offsetWidth || 300,
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left'
    });
  } else {
    // Fallback - show manual button
    container.innerHTML = '<button class="soc-btn" onclick="googleSignInFallback()" style="width:100%;justify-content:center"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" fill="#4285f4"/></svg> Injira na Google</button>';
  }
}

function handleGoogleResponse(response) {
  try {
    var parts = response.credential.split('.');
    var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    var user = {
      name: payload.name || payload.given_name || 'User',
      email: payload.email || '',
      phone: '',
      role: 'Buyer',
      avatar: payload.picture || '',
      provider: 'google',
      date: new Date().toISOString()
    };

    function finishGoogleLogin(user) {
      var users = [];
      try { users = JSON.parse(localStorage.getItem('km_users') || '[]'); } catch(e){}
      var existing = users.find(function(u) { return u.email === user.email; });
      if (!existing) {
        users.push(user);
        try { localStorage.setItem('km_users', JSON.stringify(users)); } catch(e){}
      } else {
        user = existing;
      }
      saveUser(user);
      kmTrack('login',{method:'google'});
      showToast('Murakaza neza ' + user.name + '! (Google) 🎉');
      setTimeout(function() { go('home'); }, 800);
    }

    // Exchange Google credential with Firebase so Firebase recognizes this session
    if (initFirebase() && firebaseAuth && typeof firebase.auth.GoogleAuthProvider !== 'undefined') {
      var credential = firebase.auth.GoogleAuthProvider.credential(response.credential);
      firebaseAuth.signInWithCredential(credential)
        .then(function(result) {
          user.name = result.user.displayName || user.name;
          user.email = result.user.email || user.email;
          user.avatar = result.user.photoURL || user.avatar;
          finishGoogleLogin(user);
        })
        .catch(function() {
          // Firebase exchange failed — still allow login via localStorage
          finishGoogleLogin(user);
        });
    } else {
      finishGoogleLogin(user);
    }
  } catch(e) {
    showToast('Google sign-in error. Gerageza nanone.');
  }
}

function googleSignInFallback() {
  // Simple popup-based Google OAuth fallback
  showToast('Google Sign-in: Shyiramo Google Client ID muri code mbere.');
}

// === PHONE OTP AUTH ===
function openPhoneAuth() {
  var m = document.getElementById('phone-modal');
  if (m) m.style.display = 'flex';
  document.getElementById('phone-step1').style.display = 'block';
  document.getElementById('phone-step2').style.display = 'none';

  // Init recaptcha if Firebase configured
  setTimeout(function() {
    if (initFirebase() && firebaseAuth) {
      // Recaptcha initialized in sendOTP - invisible mode
      console.log('Phone auth ready');
    }
  }, 300);
}

function closePhoneAuth() {
  var m = document.getElementById('phone-modal');
  if (m) m.style.display = 'none';
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch(e) {}
    recaptchaVerifier = null;
  }
  confirmationResult = null;
}

function sendOTP() {
  var country = document.getElementById('phone-country').value;
  var number = document.getElementById('phone-number').value.replace(/\s/g, '');
  if (!number || number.length < 8) {
    showToast('Injiza numero ya telefoni nzima!', 'error');
    return;
  }
  var fullPhone = country + number;
  document.getElementById('phone-display').textContent = fullPhone;
  window._demoPhone = fullPhone;

  // Try Firebase Phone Auth
  if (initFirebase() && firebaseAuth) {
    // Reset recaptcha if needed
    try {
      if (recaptchaVerifier) {
        recaptchaVerifier.clear();
        recaptchaVerifier = null;
      }
    } catch(e) {}

    try {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container-modal', {
        size: 'invisible',
        callback: function() {}
      });

      firebaseAuth.signInWithPhoneNumber(fullPhone, recaptchaVerifier)
        .then(function(result) {
          confirmationResult = result;
          document.getElementById('phone-step1').style.display = 'none';
          document.getElementById('phone-step2').style.display = 'block';
          showToast('OTP yoherejwe kuri ' + fullPhone + '! Reba SMS yawe.');
        })
        .catch(function(error) {
          console.error('Phone auth error:', error);
          document.getElementById('phone-step1').style.display = 'none';
          document.getElementById('phone-step2').style.display = 'block';
          window._demoOTP = String(Math.floor(100000 + Math.random() * 900000));
          showToast('Demo Mode: OTP: ' + window._demoOTP);
        });
    } catch(e) {
      document.getElementById('phone-step1').style.display = 'none';
      document.getElementById('phone-step2').style.display = 'block';
      window._demoOTP = String(Math.floor(100000 + Math.random() * 900000));
      showToast('Demo Mode: OTP: ' + window._demoOTP);
    }
  } else {
    document.getElementById('phone-step1').style.display = 'none';
    document.getElementById('phone-step2').style.display = 'block';
    window._demoOTP = String(Math.floor(100000 + Math.random() * 900000));
    showToast('Demo Mode: OTP: ' + window._demoOTP);
  }
}

function verifyOTP() {
  var code = document.getElementById('otp-code').value.trim();
  if (!code || code.length < 4) {
    showToast('Injiza OTP code!');
    return;
  }

  if (confirmationResult) {
    // Real Firebase verification
    confirmationResult.confirm(code)
      .then(function(result) {
        var fbUser = result.user;
        var user = {
          name: fbUser.displayName || ('User ' + fbUser.phoneNumber),
          email: fbUser.email || '',
          phone: fbUser.phoneNumber || '',
          role: 'Buyer',
          provider: 'phone',
          date: new Date().toISOString()
        };
        saveUser(user);
        closePhoneAuth();
        showToast('Wainjiye neza! 🎉 ' + user.name);
        setTimeout(function() { go('home'); }, 800);
      })
      .catch(function(error) {
        showToast('Code sibyo: ' + error.message);
      });
  } else {
    // Demo mode
    if (code === window._demoOTP) {
      var country = document.getElementById('phone-country').value;
      var number = document.getElementById('phone-number').value.replace(/\s/g, '');
      var user = {
        name: 'Umukoresha wa ' + country + number,
        email: '',
        phone: country + number,
        role: 'Buyer',
        provider: 'phone',
        date: new Date().toISOString()
      };
      saveUser(user);
      closePhoneAuth();
      showToast('Wainjiye neza! 🎉');
      setTimeout(function() { go('home'); }, 800);
    } else {
      showToast(curLang==='rw' ? 'Code sibyo! Gerageza nanone.' : 'Wrong code! Try again.');
    }
  }
}

// Init Google Sign-in when page loads
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initGoogleSignIn, 1000);
});
// Also init when auth page shown
var _goOrigAuth = go;
go = function(page) {
  _goOrigAuth(page);
  if (page === 'auth') {
    setTimeout(initGoogleSignIn, 500);
  }
};


// === BOTTOM NAVIGATION ===
function bnGo(page) {
  go(page);
  // Update active state
  document.querySelectorAll('.bn-item').forEach(function(btn) {
    btn.classList.remove('active');
  });
  var btn = document.getElementById('bn-' + page);
  if (btn) btn.classList.add('active');
}

function bnProfile() {
  if (currentUser) {
    openProfile();
  } else {
    go('auth');
  }
  document.querySelectorAll('.bn-item').forEach(function(b){ b.classList.remove('active'); });
  document.getElementById('bn-profile').classList.add('active');
}

// Update bottom nav avatar when user logs in
var _origSaveUser = saveUser;
saveUser = function(user) {
  _origSaveUser(user);
  var av = document.getElementById('bn-avatar');
  if (av && user) {
    var ini = (user.name||'U').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
    av.textContent = ini;
    av.style.background = 'var(--navy)';
    av.style.color = '#fff';
    av.style.fontSize = '.65rem';
  }
};

// Sync bottom nav with page navigation
var _origGoBN = go;
go = function(page) {
  _origGoBN(page);
  var pageMap = {home:'home',listings:'listings',analytics:'analytics',dashboard:'profile',auth:'profile',detail:'listings'};
  var activeBtn = pageMap[page] || 'home';
  document.querySelectorAll('.bn-item').forEach(function(b){ b.classList.remove('active'); });
  var btn = document.getElementById('bn-' + activeBtn);
  if (btn) btn.classList.add('active');
};

// Hide bottom nav on dashboard (has its own nav)
var _origGoFinal = go;
go = function(page) {
  _origGoFinal(page);
  var nav = document.getElementById('bottom-nav');
  if (nav) {
    nav.style.display = page === 'dashboard' ? 'none' : 'flex';
  }
};


// ════════════════════════════════════════════════════
//  KOMISIYONERI — AGENT MANAGEMENT SYSTEM
// ════════════════════════════════════════════════════

// === AGENT REGISTRATION ===
var agentCurrentStep = 1;

function openAgentReg() {
  if(!window._agentRegOpen) { showToast('⛔ Agent registration is currently closed.', 'warn'); return; }
  var m = document.getElementById('agent-reg-modal');
  if(m) m.style.display = 'flex';
  agentStep(1);
}

function closeAgentReg() {
  var m = document.getElementById('agent-reg-modal');
  if(m) m.style.display = 'none';
}

function agentStep(step) {
  agentCurrentStep = step;
  [1,2,3].forEach(function(s) {
    var form = document.getElementById('agent-form-' + s);
    var bar = document.getElementById('astep' + s);
    if(form) form.style.display = s === step ? 'flex' : 'none';
    if(bar) bar.style.background = s <= step ? 'var(--navy)' : 'var(--border)';
  });
}

function submitAgentReg() {
  var g = function(id){ var el=document.getElementById(id); return el?el.value.trim():''; };
  if(!g('ag-name')){showToast('Shyira amazina yawe!', 'error');return;}
  if(!g('ag-phone')){showToast('Shyira telefoni yawe!', 'error');return;}
  if(!g('ag-id')){showToast("Shyira numero y'indangamuntu!", 'error');return;}
  if(!g('ag-zone')){showToast('Hitamo akarere kawe!', 'error');return;}
  var agEmail = g('ag-email');
  if(agEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agEmail)){showToast('Imeyili ntabwo ari nziza!');return;}
  if(!document.getElementById('ag-agree').checked){showToast('Emeza amasezerano mbere!', 'error');return;}
  var _arb=document.getElementById('agent-reg-btn'),_arl=document.getElementById('agent-reg-lbl');
  if(_arb){_arb.disabled=true;_arb.classList.add('btn-loading');if(_arl)_arl.innerHTML='<span class="btn-spinner"></span>'+(curLang==='rw'?'Tegereza...':'Sending...');}

  var langs = [];
  if(document.getElementById('lang-rw').checked) langs.push('Kinyarwanda');
  if(document.getElementById('lang-en').checked) langs.push('English');
  if(document.getElementById('lang-fr').checked) langs.push('Français');
  if(document.getElementById('lang-sw').checked) langs.push('Kiswahili');

  var agent = {
    id: 'AG-' + Date.now(),
    name: g('ag-name'),
    phone: g('ag-phone'),
    email: g('ag-email'),
    nationalId: g('ag-id'),
    address: g('ag-address'),
    zone: g('ag-zone'),
    experience: g('ag-exp'),
    transport: g('ag-transport'),
    languages: langs,
    status: 'Pending Verification',
    rating: 0,
    deals: 0,
    leads: [],
    commissionTotal: 0,
    registeredDate: new Date().toISOString()
  };

  // Save agent to localStorage + Firebase
  var agents = [];
  try { agents = JSON.parse(localStorage.getItem('km_agents')||'[]'); } catch(e){}
  agents.push(agent);
  try { localStorage.setItem('km_agents', JSON.stringify(agents)); } catch(e){}
  try { rtdb.ref('agents/' + agent.id).set(agent); } catch(e){}

  // Update current user to pending agent — full Agent role granted on admin approval
  if(currentUser) {
    currentUser.role = 'PendingAgent';
    currentUser.agentId = agent.id;
    currentUser.zone = agent.zone;
    saveUser(currentUser);
    // Sync user role to Firebase so admin sees PendingAgent status
    try {
      var users = JSON.parse(localStorage.getItem('km_users')||'[]');
      var uidx = users.findIndex(function(u){ return u.email === currentUser.email; });
      if(uidx >= 0) { users[uidx].role='PendingAgent'; users[uidx].agentId=agent.id; users[uidx].zone=agent.zone; }
      localStorage.setItem('km_users', JSON.stringify(users));
      rtdb.ref('users/'+btoa(currentUser.email).replace(/[.#$[\]]/g,'_')).set(currentUser);
    } catch(e){}
  }

  if(_arb){_arb.disabled=false;_arb.classList.remove('btn-loading');if(_arl)_arl.textContent='✅ Iyandikishe nka Agent';}
  closeAgentReg();
  showToast('✅ Iyandikishe yagenze neza! KOMISIYONERI izakugenzura mu masaa 24.');
  kmTrack('agent_registration',{zone:agent.zone||'',experience:agent.experience||''});

  // Notify admin via WhatsApp — called directly in user gesture (no confirm, no setTimeout)
  var msg = 'Agent:'+agent.name+' Tel:'+agent.phone+' Zone:'+agent.zone+' ID:'+agent.nationalId;
  window.open('https://wa.me/250783177254?text=' + encodeURIComponent(msg), '_blank');
}

// ═══════════════════════════════════════════════════════════
//  VIRTUAL TOUR 3D
// ═══════════════════════════════════════════════════════════
var _tourImgs = [];
var _tourIdx  = 0;
var _tourRoomLabels = {
  rw: ['Salon','Icumba','Igikoni','Hanze','Garage'],
  en: ['Living Room','Bedroom','Kitchen','Garden','Garage']
};

function openTour(startIdx) {
  var prop = window._currentProp;
  if (!prop) { showToast(curLang==='rw'?'Fungura imitungo mbere!':'Open a property first!'); return; }
  var modal = document.getElementById('tour-modal');
  if (!modal) return;

  var titleEl  = document.getElementById('tour-title');
  var cntEl    = document.getElementById('tour-counter');
  var iframe   = document.getElementById('tour-iframe');
  var photoWrap= document.getElementById('tour-photo-wrap');
  var roomBar  = document.getElementById('tour-room-bar');

  if (titleEl) titleEl.textContent = (prop.type||'') + (prop.district?' — '+prop.district:'');

  if (prop.tour3dUrl) {
    // ── Embed the 3D tour URL ──
    iframe.style.display = 'block';
    iframe.src = prop.tour3dUrl;
    photoWrap.style.display = 'none';
    roomBar.style.display = 'none';
    if (cntEl) cntEl.textContent = '3D Tour';
  } else {
    // ── Photo slideshow ──
    _tourImgs = [prop.img1, prop.img2, prop.img3].filter(Boolean);
    if (!_tourImgs.length) {
      showToast(curLang==='rw'?'Nta mafoto arashyizweho':'No photos available');
      return;
    }
    iframe.style.display = 'none';
    photoWrap.style.display = 'flex';

    // Build room chips (one per photo)
    var labels = _tourRoomLabels[curLang] || _tourRoomLabels.rw;
    roomBar.style.display = 'flex';
    roomBar.innerHTML = _tourImgs.map(function(_, i) {
      return '<button class="tr-chip'+(i===0?' active':'')+'" onclick="tourGoRoom('+i+')">'
        + (labels[i]||('Photo '+(i+1)))+'</button>';
    }).join('');

    _tourIdx = startIdx || 0;
    _tourShowImg(_tourIdx);
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Swipe (initialised once)
  if (!openTour._swipe) {
    openTour._swipe = true;
    var sx = 0;
    document.addEventListener('touchstart', function(e){
      if (!document.getElementById('tour-modal').classList.contains('open')) return;
      sx = e.touches[0].clientX;
    }, {passive:true});
    document.addEventListener('touchend', function(e){
      if (!document.getElementById('tour-modal').classList.contains('open')) return;
      var dx = sx - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 50) { if(dx>0) tourNext(); else tourPrev(); }
    }, {passive:true});
    document.addEventListener('keydown', function(e){
      if (!document.getElementById('tour-modal').classList.contains('open')) return;
      if (e.key==='ArrowRight') tourNext();
      if (e.key==='ArrowLeft')  tourPrev();
      if (e.key==='Escape')     closeTour();
    });
  }
}

function _tourShowImg(idx) {
  _tourIdx = Math.max(0, Math.min(idx, _tourImgs.length-1));
  var img  = document.getElementById('tour-photo');
  var cnt  = document.getElementById('tour-counter');
  var prev = document.getElementById('tour-prev');
  var next = document.getElementById('tour-next');
  if (img) {
    img.style.opacity = '0';
    setTimeout(function(){ img.src = _tourImgs[_tourIdx]; img.style.opacity='1'; }, 150);
  }
  if (cnt) cnt.textContent = (_tourIdx+1)+' / '+_tourImgs.length;
  if (prev) prev.disabled = _tourIdx === 0;
  if (next) next.disabled = _tourIdx === _tourImgs.length-1;
  document.querySelectorAll('.tr-chip').forEach(function(b,i){
    b.classList.toggle('active', i===_tourIdx);
  });
}

function tourNext()        { if(_tourIdx < _tourImgs.length-1) _tourShowImg(_tourIdx+1); }
function tourPrev()        { if(_tourIdx > 0)                  _tourShowImg(_tourIdx-1); }
function tourGoRoom(idx)   { _tourShowImg(idx); }

function openVR() {
  var prop = window._currentProp;
  if (!prop) return;
  if (prop.tour3dUrl) {
    window.open(prop.tour3dUrl, '_blank');
  } else {
    var msg = encodeURIComponent(
      (curLang==='rw'?'Muraho! Ndashaka Virtual Tour 3D ya: ':'Hello! I want a 3D Virtual Tour for: ')
      + (prop.type||'property') + (prop.district?' — '+prop.district:'')
      + (curLang==='rw'?' . Mufite?':'. Do you have one?')
    );
    window.open('https://wa.me/250783177254?text=' + msg, '_blank');
  }
}

function closeTour() {
  var modal = document.getElementById('tour-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  var iframe = document.getElementById('tour-iframe');
  if (iframe) { iframe.src=''; iframe.style.display='none'; }
  var photoWrap = document.getElementById('tour-photo-wrap');
  if (photoWrap) photoWrap.style.display = 'flex';
}

// === LEAD MANAGEMENT ===
function openLead() {
  var m = document.getElementById('lead-modal');
  if(m) m.style.display = 'flex';
  if(currentUser) {
    var n = document.getElementById('lead-name');
    var p = document.getElementById('lead-phone');
    if(n && !n.value) n.value = currentUser.name || '';
    if(p && !p.value) p.value = currentUser.phone || '';
  }
}

function closeLead() {
  var m = document.getElementById('lead-modal');
  if(m) m.style.display = 'none';
}

function submitLead() {
  var g = function(id){ var el=document.getElementById(id); return el?el.value.trim():''; };
  if(!g('lead-name')){showToast('Shyira amazina yawe!', 'error');return;}
  if(!g('lead-phone')){showToast('Shyira telefoni yawe!', 'error');return;}
  var _lb=document.getElementById('lead-submit-btn'),_ll=document.getElementById('lead-submit-lbl');
  if(_lb){_lb.disabled=true;_lb.classList.add('btn-loading');if(_ll)_ll.innerHTML='<span class="btn-spinner"></span>'+(curLang==='rw'?'Tegereza...':'Sending...');}

  var zone = g('lead-zone');
  var lead = {
    id: 'LEAD-' + Date.now(),
    clientName: g('lead-name'),
    clientPhone: g('lead-phone'),
    action: document.getElementById('lead-action').value,
    zone: zone,
    budgetMin: document.getElementById('lead-budget-min').value,
    budgetMax: document.getElementById('lead-budget-max').value,
    notes: g('lead-notes'),
    status: 'New',
    assignedAgent: null,
    createdAt: new Date().toISOString(),
    deadline: new Date(Date.now() + 2*60*60*1000).toISOString() // 2hrs deadline
  };

  // Find agent in the zone
  var agents = [];
  try { agents = JSON.parse(localStorage.getItem('km_agents')||'[]'); } catch(e){}
  var zoneAgents = agents.filter(function(a){ return a.zone === zone && a.status !== 'Suspended'; });

  if(zoneAgents.length > 0) {
    // Assign to agent with fewest leads (fairness)
    zoneAgents.sort(function(a,b){ return (a.leads||[]).length - (b.leads||[]).length; });
    lead.assignedAgent = zoneAgents[0].id;
    lead.agentName  = zoneAgents[0].name;
    lead.agentPhone = zoneAgents[0].phone;
    lead.agentEmail = zoneAgents[0].email || '';

    // Update agent leads
    var agentIdx = agents.indexOf(zoneAgents[0]);
    if(!agents[agentIdx].leads) agents[agentIdx].leads = [];
    agents[agentIdx].leads.push(lead.id);
    try { localStorage.setItem('km_agents', JSON.stringify(agents)); } catch(e){}
  }

  // Save lead
  var leads = [];
  try { leads = JSON.parse(localStorage.getItem('km_leads')||'[]'); } catch(e){}
  leads.push(lead);
  try { localStorage.setItem('km_leads', JSON.stringify(leads)); } catch(e){}

  if(_lb){_lb.disabled=false;_lb.classList.remove('btn-loading');if(_ll)_ll.textContent='Ohereza — Agent Azakuhamagara!';}
  closeLead();
  kmTrack('generate_lead',{zone:lead.zone||'',agent:lead.agentName||'',intent:lead.preference||''});

  if(lead.agentName) {
    showToast('✅ Lead yoherejwe! Agent ' + lead.agentName + ' azakuhamagara mu masaa 2.');
    if (lead.agentEmail) {
      kmSendEmail(_ejsTmplLead, {
        to_email:    lead.agentEmail,
        agent_name:  lead.agentName,
        client_name: lead.clientName,
        client_phone:lead.clientPhone,
        zone:        zone,
        budget_min:  lead.budgetMin,
        budget_max:  lead.budgetMax,
        action:      lead.action,
        notes:       lead.notes,
        lead_id:     lead.id
      });
    }
    var agPhone = (lead.agentPhone || '250783177254').replace(/[^0-9]/g, '');
    var agMsg = encodeURIComponent(
      'LEAD NSHYA — Client: ' + lead.clientName +
      ' — Tel: ' + lead.clientPhone +
      ' — Zone: ' + zone
    );
    setTimeout(function(){ window.open('https://wa.me/' + agPhone + '?text=' + agMsg, '_blank'); }, 500);
  } else {
    showToast('✅ Lead yoherejwe! KOMISIYONERI izakuhuza na agent vuba.');
    // Notify admin via WhatsApp
    var msg = 'LEAD NSHYA - Zone:'+zone+' - Client:'+lead.clientName+' - Tel:'+lead.clientPhone;
    setTimeout(function(){
      window.open('https://wa.me/250783177254?text=' + encodeURIComponent(msg), '_blank');
    }, 500);
  }
}

// === ADMIN LEAD DASHBOARD ===
function openAdminLeads() {
  var isAdmin = currentUser && (
    currentUser.email === 'komisiyonericonnectproservices@gmail.com' ||
    currentUser.email === 'admin@komisiyoneri.com' ||
    currentUser.role === 'Admin'
  );
  if (!isAdmin) {
    showToast(curLang==='rw' ? 'Ntabwo wemerewe! Admin gusa.' : 'Access denied. Admin only.', 'error');
    return;
  }

  var leads = [];
  var agents = [];
  try { leads = JSON.parse(localStorage.getItem('km_leads')||'[]'); } catch(e){}
  try { agents = JSON.parse(localStorage.getItem('km_agents')||'[]'); } catch(e){}

  var m = document.getElementById('deal-modal');
  if(!m) return;
  m.style.display = 'flex';

  var content = document.getElementById('deal-tracker-content');

  // Stats
  var newLeads = leads.filter(function(l){ return l.status==='New'; }).length;
  var activeLeads = leads.filter(function(l){ return l.status==='Active'; }).length;
  var closedLeads = leads.filter(function(l){ return l.status==='Closed'; }).length;

  var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin-bottom:1rem">'
    + '<div style="background:var(--light);border-radius:10px;padding:.8rem;text-align:center"><div style="font-size:1.5rem;font-weight:700;color:var(--navy)">'+leads.length+'</div><div style="font-size:.7rem;color:var(--muted)">Leads Zose</div></div>'
    + '<div style="background:#fff3cd;border-radius:10px;padding:.8rem;text-align:center"><div style="font-size:1.5rem;font-weight:700;color:#856404">'+newLeads+'</div><div style="font-size:.7rem;color:var(--muted)">Nshya</div></div>'
    + '<div style="background:#d4edda;border-radius:10px;padding:.8rem;text-align:center"><div style="font-size:1.5rem;font-weight:700;color:#27A84A">'+closedLeads+'</div><div style="font-size:.7rem;color:var(--muted)">Zarangiye</div></div>'
    + '</div>'

    + '<div style="font-weight:700;font-size:.85rem;color:var(--navy);margin-bottom:.6rem">Agents ('+ agents.length +'):</div>'
    + agents.slice(0,5).map(function(a) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem .8rem;background:var(--light);border-radius:8px;margin-bottom:.4rem">'
          + '<div><div style="font-weight:600;font-size:.85rem">'+a.name+'</div><div style="font-size:.72rem;color:var(--muted)">'+a.zone+' | '+a.phone+'</div></div>'
          + '<div style="text-align:center"><div style="font-weight:700;color:var(--navy)">'+(a.leads||[]).length+'</div><div style="font-size:.65rem;color:var(--muted)">Leads</div></div>'
          + '<span style="background:'+(a.status==='Active'?'#27A84A':a.status==='Pending Verification'?'#F5A623':'#e53e3e')+';color:#fff;border-radius:20px;padding:.15rem .5rem;font-size:.65rem;font-weight:700">'+a.status+'</span>'
          + '</div>';
      }).join('')

    + '<div style="font-weight:700;font-size:.85rem;color:var(--navy);margin:.8rem 0 .5rem">Leads Zaheruka:</div>'
    + (leads.length === 0 ? '<div style="text-align:center;padding:1rem;color:var(--muted)">Nta leads irahari ubu</div>' : '')
    + leads.slice(-5).reverse().map(function(l) {
        var statusColor = l.status==='Closed'?'#27A84A':l.status==='Active'?'var(--blue)':'#F5A623';
        return '<div style="border:1.5px solid var(--border);border-radius:10px;padding:.8rem;margin-bottom:.5rem">'
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
          + '<div><div style="font-weight:600;font-size:.85rem">'+l.clientName+'</div>'
          + '<div style="font-size:.75rem;color:var(--muted)">'+l.action+' | '+l.zone+'</div>'
          + (l.agentName?'<div style="font-size:.75rem;color:var(--blue)">Agent: '+l.agentName+'</div>':'<div style="font-size:.75rem;color:#e53e3e">⚠️ Nta agent</div>')
          + '</div>'
          + '<span style="background:'+statusColor+';color:#fff;border-radius:20px;padding:.15rem .5rem;font-size:.65rem;font-weight:700">'+l.status+'</span>'
          + '</div>'
          + '<div style="display:flex;gap:.4rem;margin-top:.5rem">'
          
          
          + '<a href="tel:'+l.clientPhone+'" style="background:var(--navy);color:#fff;border:none;padding:.3rem .6rem;border-radius:6px;cursor:pointer;font-size:.72rem;text-decoration:none">📞 Hamagara</a>'
          + '</div></div>';
      }).join('');

  content.innerHTML = html;
}

function updateLeadStatus(leadId, status) {
  var leads = [];
  try { leads = JSON.parse(localStorage.getItem('km_leads')||'[]'); } catch(e){}
  var idx = leads.findIndex(function(l){ return l.id === leadId; });
  if(idx >= 0) {
    leads[idx].status = status;
    leads[idx].updatedAt = new Date().toISOString();
    try { localStorage.setItem('km_leads', JSON.stringify(leads)); } catch(e){}
    showToast('Lead status yahinduwe: ' + status);
    openAdminLeads(); // Refresh
  }
}

// === AGENT DASHBOARD LEADS ===
function loadAgentLeads() {
  if(!currentUser || !currentUser.agentId) return;
  var leads = [];
  try { leads = JSON.parse(localStorage.getItem('km_leads')||'[]'); } catch(e){}
  var myLeads = leads.filter(function(l){ return l.assignedAgent === currentUser.agentId; });
  return myLeads;
}

// Add Agent Registration to navbar
function showBecomeAgent() {
  if(!currentUser) { _pendingAction = 'agent-reg'; go('auth'); return; }
  openAgentReg();
}


// ════════════════════════════════════════════════════════
//  DEMO LISTINGS + ADMIN LISTING + FILE UPLOAD
// ════════════════════════════════════════════════════════

// Load demo listings into localStorage if none exist
function loadDemoListings() {
  var props = [];
  try { props = JSON.parse(localStorage.getItem('km_properties') || '[]'); } catch(e){}

  // Always show demos alongside real listings
  // Remove old demos first to avoid duplicates
  props = props.filter(function(p){ return !p.isDemo; });

  var demos = [
    {
      id: 'DEMO-001', type: 'Villa', service: 'Kugurisha', district: 'Gasabo',
      sector: 'Kimironko', price: '120000000', beds: '4', baths: '2', size: '320',
      desc: 'Villa nziza i Kimironko - ibyumba 4, bafu 2, garage, imbuga. Hafi amashuri, amasoko. Titre Foncier iri.',
      contact: '+250 783 177 254', owner: 'KOMISIYONERI', ownerEmail: 'demo@komisiyoneri.com',
      img1: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      img2: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
      img3: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
      video: '', status: 'Approved', isDemo: true, verified: true, rating: 4.9, reviews: 12,
      date: new Date().toISOString()
    },
    {
      id: 'DEMO-002', type: 'Apartimani', service: 'Gukodesha', district: 'Kicukiro',
      sector: 'Niboye', price: '450000', beds: '2', baths: '1', size: '85',
      desc: 'Apartimani nshya i Niboye - modern, WiFi, parking, security 24/7. Generator, amazi biratangwa. Hafi ya Kicukiro center.',
      contact: '+250 783 177 254', owner: 'KOMISIYONERI', ownerEmail: 'demo@komisiyoneri.com',
      img1: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
      img2: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
      img3: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
      video: '', status: 'Approved', isDemo: true, verified: true, rating: 4.7, reviews: 8,
      date: new Date().toISOString()
    },
    {
      id: 'DEMO-003', type: 'Inzu', service: 'Kugurisha', district: 'Nyarugenge',
      sector: 'Muhima', price: '65000000', beds: '3', baths: '2', size: '180',
      desc: 'Inzu nziza i Muhima - hafi ya Kigali CBD. Ibyumba 3, bafu 2, kitchen nziza. Titre Foncier iri. Igiciro gihuye isoko.',
      contact: '+250 783 177 254', owner: 'KOMISIYONERI', ownerEmail: 'demo@komisiyoneri.com',
      img1: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80',
      img2: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80',
      img3: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      video: '', status: 'Approved', isDemo: true, verified: true, rating: 4.8, reviews: 5,
      date: new Date().toISOString()
    },
    {
      id: 'DEMO-004', type: 'Ubutaka', service: 'Kugurisha', district: 'Gasabo',
      sector: 'Rusororo', price: '25000000', beds: '0', baths: '0', size: '600',
      desc: 'Ubutaka bunini i Rusororo - 600m2, hafi imihanda myiza. Birabereye kubaka inzu cyangwa inyubako. Titre Foncier.',
      contact: '+250 783 177 254', owner: 'KOMISIYONERI', ownerEmail: 'demo@komisiyoneri.com',
      img1: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80',
      img2: 'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=800&q=80',
      img3: '', video: '', status: 'Approved', isDemo: true, verified: true, rating: 4.5, reviews: 3,
      date: new Date().toISOString()
    },
    {
      id: 'DEMO-005', type: 'Studio', service: 'Gukodesha', district: 'Gasabo',
      sector: 'Remera', price: '280000', beds: '1', baths: '1', size: '42',
      desc: 'Studio nshya i Remera - fully furnished, WiFi na electricity biratangwa. Hafi ya Airport na bus stop. Ideal for professionals.',
      contact: '+250 783 177 254', owner: 'KOMISIYONERI', ownerEmail: 'demo@komisiyoneri.com',
      img1: 'https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=800&q=80',
      img2: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
      img3: '', video: '', status: 'Approved', isDemo: true, verified: true, rating: 4.6, reviews: 9,
      date: new Date().toISOString()
    },
    {
      id: 'DEMO-006', type: 'Villa', service: 'Gukodesha', district: 'Gasabo',
      sector: 'Kacyiru', price: '1500000', beds: '4', baths: '3', size: '450',
      desc: 'Villa ya Luxury i Kacyiru - hafi Ambasade na Ministeri. Swimming pool, garden, garages 2, security. Fully furnished.',
      contact: '+250 783 177 254', owner: 'KOMISIYONERI', ownerEmail: 'demo@komisiyoneri.com',
      img1: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
      img2: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      img3: 'https://images.unsplash.com/photo-1619994403073-2cec844b8e63?w=800&q=80',
      video: '',
      status: 'Approved', isDemo: true, verified: true, rating: 5.0, reviews: 15,
      date: new Date().toISOString()
    },
    {
      id: 'DEMO-007', type: 'Inyubako', service: 'Kugurisha', district: 'Nyarugenge',
      sector: 'CBD', price: '350000000', beds: '0', baths: '0', size: '1200',
      desc: 'Inyubako ubucuruzi i Kigali CBD - floors 5, parking, lifts, AC. Birabereye offices na ibikorwa ubucuruzi. Titre Foncier.',
      contact: '+250 783 177 254', owner: 'KOMISIYONERI', ownerEmail: 'demo@komisiyoneri.com',
      img1: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
      img2: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
      img3: '', video: '', status: 'Approved', isDemo: true, verified: true, rating: 4.8, reviews: 6,
      date: new Date().toISOString()
    },
    {
      id: 'DEMO-008', type: 'Apartimani', service: 'Kugurisha', district: 'Kicukiro',
      sector: 'Gatenga', price: '45000000', beds: '3', baths: '2', size: '120',
      desc: 'Apartimani nziza yo kugura i Gatenga - floor ya 3, elevator, parking, balcony. Modern finishing. Investment nziza.',
      contact: '+250 783 177 254', owner: 'KOMISIYONERI', ownerEmail: 'demo@komisiyoneri.com',
      img1: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80',
      img2: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80',
      img3: '', video: '', status: 'Approved', isDemo: true, verified: true, rating: 4.7, reviews: 11,
      date: new Date().toISOString()
    }
  ];

  // Always add demos (they show until real listings exist)
  window._allDemos = demos;
  var newProps = props.concat(demos);
  try { localStorage.setItem('km_properties', JSON.stringify(newProps)); } catch(e){}
  loadApprovedProperties();
}

// === ADMIN ADD PROPERTY (with YouTube) ===
function openAdminAddProp() {
  // Show admin media section, hide user section
  var adminMedia = document.getElementById('admin-media-section');
  var userMedia = document.getElementById('user-media-section');
  if(adminMedia) adminMedia.style.display = 'flex';
  if(userMedia) userMedia.style.display = 'none';
  openAddProperty();
}

// Override openAddProperty to show correct media section
var _origOpenAddProp = openAddProperty;
openAddProperty = function() {
  _origOpenAddProp();
  var isAdmin = currentUser && currentUser.email === 'komisiyonericonnectproservices@gmail.com';
  var adminMedia = document.getElementById('admin-media-section');
  var userMedia = document.getElementById('user-media-section');
  if(adminMedia) adminMedia.style.display = isAdmin ? 'flex' : 'none';
  if(userMedia) userMedia.style.display = isAdmin ? 'none' : 'flex';
};

// === FILE UPLOAD HANDLER (for regular users) ===
function convertFileToBase64(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) { callback(e.target.result); };
  reader.readAsDataURL(file);
}

// === BOTTOM NAV ACTIVE STATE ===
function updateBottomNav(page) {
  var map = {home:'home',listings:'listings',analytics:'analytics'};
  document.querySelectorAll('.bn-item').forEach(function(b){
    b.querySelectorAll('svg').forEach(function(s){ s.style.stroke='var(--muted)'; });
    b.querySelectorAll('span').forEach(function(s){ s.style.color='var(--muted)'; });
  });
  var activeId = 'bn-' + (map[page] || 'home');
  var active = document.getElementById(activeId);
  if(active) {
    active.querySelectorAll('svg').forEach(function(s){ s.style.stroke='var(--navy)'; });
    active.querySelectorAll('span').forEach(function(s){ s.style.color='var(--navy)'; });
  }
}

// Initialize demos immediately — must run before loadApprovedProperties
document.addEventListener('DOMContentLoaded', function() {
  loadDemoListings();
});
if (document.readyState !== 'loading') loadDemoListings();


// === ADMIN ADD PROPERTY DIRECT (from admin panel) ===
function openAdminAddPropDirect() {
  closeAdmin();
  setTimeout(function() {
    var m = document.getElementById('add-prop-modal');
    if(m) m.style.display = 'flex';
    // Show admin section, hide user section
    var adminSec = document.getElementById('admin-media-section');
    var userSec = document.getElementById('user-media-section');
    if(adminSec) adminSec.style.display = 'flex';
    if(userSec) userSec.style.display = 'none';
    // Pre-fill contact
    var c = document.getElementById('prop-contact');
    if(c) c.value = '+250 783 177 254';
  }, 200);
}

// === YOUTUBE URL CONVERTER ===
function convertYouTubeURL(url) {
  if(!url) return '';
  // Handle youtu.be short links
  var shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if(shortMatch) return 'https://www.youtube.com/embed/' + shortMatch[1];
  // Handle youtube.com/watch?v=
  var longMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if(longMatch) return 'https://www.youtube.com/embed/' + longMatch[1];
  // Already embed format
  if(url.includes('youtube.com/embed/')) return url;
  return url;
}

// Show correct media section when add property modal opens
var _origOpenAdd = openAddProperty;
openAddProperty = function() {
  _origOpenAdd();
  setTimeout(function() {
    var isAdmin = currentUser && currentUser.email === 'komisiyonericonnectproservices@gmail.com';
    var adminSec = document.getElementById('admin-media-section');
    var userSec = document.getElementById('user-media-section');
    if(adminSec) adminSec.style.display = isAdmin ? 'flex' : 'none';
    if(userSec) userSec.style.display = isAdmin ? 'none' : 'flex';
  }, 100);
};


// === OPEN PROPERTY DETAIL PAGE ===
window._currentProp = null;

// === NEARBY POI DATA — keyed by Rwanda district ===
var _poiData = {
  'Gasabo':     [['🏫','Amashuri','Green Hills Academy','1.2km'],['🏥','Ivuriro','King Faisal Hospital','2.1km'],['🛒','Supermarket','Nakumatt Kimironko','0.8km'],['🚌','Gari ya Moshi','Bus Stop Kimironko','0.3km'],['🏦','Banki','BK Kimironko','0.5km'],['✈️','Aéroport','RIA Kanombe','8km']],
  'Kicukiro':   [['🏫','Amashuri','GS Kicukiro Centre','0.9km'],['🏥','Ivuriro','CHUK Hospital','1.8km'],['🛒','Supermarket','Simba Supermarket','1.1km'],['🚌','Gari ya Moshi','Bus Stop Sonatubes','0.4km'],['🏦','Banki','Equity Bank Kicukiro','0.6km'],['✈️','Aéroport','RIA Kanombe','5km']],
  'Nyarugenge':  [['🏫','Amashuri','Lycée de Kigali','0.7km'],['🏥','Ivuriro','CHUK Hospital','1.2km'],['🛒','Supermarket','Spar City Centre','0.5km'],['🚌','Gari ya Moshi','Bus Stop Nyabugogo','0.6km'],['🏦','Banki','BK City Tower','0.3km'],['✈️','Aéroport','RIA Kanombe','10km']],
  'Musanze':    [['🏫','Amashuri','GS Musanze','0.8km'],['🏥','Ivuriro','Ruhengeri Referral Hospital','1.5km'],['🛒','Supermarket','Inyange Shop Musanze','0.6km'],['🚌','Gari ya Moshi','Bus Stop Musanze','0.3km'],['🏦','Banki','BPR Musanze','0.5km'],['✈️','Aéroport','RIA Kanombe','85km']],
  'Rubavu':     [['🏫','Amashuri','GS Rubavu','1.0km'],['🏥','Ivuriro','Gisenyi District Hospital','1.8km'],['🛒','Supermarket','Lake Side Market','0.9km'],['🚌','Gari ya Moshi','Bus Stop Gisenyi','0.4km'],['🏦','Banki','BK Rubavu','0.7km'],['✈️','Aéroport','RIA Kanombe','160km']],
  'Huye':       [['🏫','Amashuri','National Univ. of Rwanda','1.1km'],['🏥','Ivuriro','CHUB University Hospital','1.4km'],['🛒','Supermarket','Huye Market Shop','0.7km'],['🚌','Gari ya Moshi','Bus Stop Butare','0.4km'],['🏦','Banki','BPR Huye','0.6km'],['✈️','Aéroport','RIA Kanombe','130km']],
  'Nyagatare':  [['🏫','Amashuri','GS Nyagatare','0.9km'],['🏥','Ivuriro','Nyagatare District Hospital','1.6km'],['🛒','Supermarket','City Mart Nyagatare','0.8km'],['🚌','Gari ya Moshi','Bus Stop Nyagatare','0.3km'],['🏦','Banki','BK Nyagatare','0.5km'],['✈️','Aéroport','RIA Kanombe','110km']],
  'Rwamagana':  [['🏫','Amashuri','GS Rwamagana','0.8km'],['🏥','Ivuriro','Rwamagana District Hospital','1.3km'],['🛒','Supermarket','Rwamagana Market','0.5km'],['🚌','Gari ya Moshi','Bus Stop Rwamagana','0.3km'],['🏦','Banki','Equity Bank Rwamagana','0.6km'],['✈️','Aéroport','RIA Kanombe','45km']],
  'Bugesera':   [['🏫','Amashuri','GS Bugesera','1.0km'],['🏥','Ivuriro','Bugesera District Hospital','1.5km'],['🛒','Supermarket','Bugesera Market','0.8km'],['🚌','Gari ya Moshi','Bus Stop Bugesera','0.4km'],['🏦','Banki','BPR Bugesera','0.6km'],['✈️','Aéroport','RIA Kanombe','38km']],
  'Gatsibo':    [['🏫','Amashuri','GS Gatsibo','0.9km'],['🏥','Ivuriro','Gatsibo District Hospital','1.4km'],['🛒','Supermarket','Gatsibo Market','0.7km'],['🚌','Gari ya Moshi','Bus Stop Gatsibo','0.4km'],['🏦','Banki','BK Gatsibo','0.5km'],['✈️','Aéroport','RIA Kanombe','95km']],
  'Kayonza':    [['🏫','Amashuri','GS Kayonza','0.8km'],['🏥','Ivuriro','Kayonza District Hospital','1.3km'],['🛒','Supermarket','Kayonza Market','0.6km'],['🚌','Gari ya Moshi','Bus Stop Kayonza','0.3km'],['🏦','Banki','BPR Kayonza','0.5km'],['✈️','Aéroport','RIA Kanombe','70km']],
  'Kirehe':     [['🏫','Amashuri','GS Kirehe','1.0km'],['🏥','Ivuriro','Kirehe District Hospital','1.6km'],['🛒','Supermarket','Kirehe Market','0.8km'],['🚌','Gari ya Moshi','Bus Stop Kirehe','0.4km'],['🏦','Banki','BK Kirehe','0.6km'],['✈️','Aéroport','RIA Kanombe','120km']],
  'Ngoma':      [['🏫','Amashuri','GS Ngoma','0.9km'],['🏥','Ivuriro','Ngoma District Hospital','1.4km'],['🛒','Supermarket','Ngoma Market','0.7km'],['🚌','Gari ya Moshi','Bus Stop Ngoma','0.3km'],['🏦','Banki','BPR Ngoma','0.5km'],['✈️','Aéroport','RIA Kanombe','65km']],
  'Burera':     [['🏫','Amashuri','GS Burera','1.0km'],['🏥','Ivuriro','Burera District Hospital','1.5km'],['🛒','Supermarket','Burera Market','0.8km'],['🚌','Gari ya Moshi','Bus Stop Cyanika','0.4km'],['🏦','Banki','BPR Burera','0.6km'],['✈️','Aéroport','RIA Kanombe','105km']],
  'Gakenke':    [['🏫','Amashuri','GS Gakenke','0.9km'],['🏥','Ivuriro','Gakenke District Hospital','1.4km'],['🛒','Supermarket','Gakenke Market','0.7km'],['🚌','Gari ya Moshi','Bus Stop Gakenke','0.4km'],['🏦','Banki','BK Gakenke','0.5km'],['✈️','Aéroport','RIA Kanombe','98km']],
  'Gicumbi':    [['🏫','Amashuri','GS Gicumbi','0.8km'],['🏥','Ivuriro','Gicumbi District Hospital','1.3km'],['🛒','Supermarket','Gicumbi Market','0.6km'],['🚌','Gari ya Moshi','Bus Stop Gicumbi','0.3km'],['🏦','Banki','BPR Gicumbi','0.5km'],['✈️','Aéroport','RIA Kanombe','55km']],
  'Rulindo':    [['🏫','Amashuri','GS Rulindo','0.9km'],['🏥','Ivuriro','Rulindo District Hospital','1.5km'],['🛒','Supermarket','Rulindo Market','0.7km'],['🚌','Gari ya Moshi','Bus Stop Rulindo','0.4km'],['🏦','Banki','BK Rulindo','0.6km'],['✈️','Aéroport','RIA Kanombe','48km']],
  'Gisagara':   [['🏫','Amashuri','GS Gisagara','1.0km'],['🏥','Ivuriro','Gisagara District Hospital','1.5km'],['🛒','Supermarket','Gisagara Market','0.8km'],['🚌','Gari ya Moshi','Bus Stop Gisagara','0.4km'],['🏦','Banki','BPR Gisagara','0.6km'],['✈️','Aéroport','RIA Kanombe','145km']],
  'Kamonyi':    [['🏫','Amashuri','GS Kamonyi','0.8km'],['🏥','Ivuriro','Kamonyi District Hospital','1.3km'],['🛒','Supermarket','Kamonyi Market','0.6km'],['🚌','Gari ya Moshi','Bus Stop Kamonyi','0.3km'],['🏦','Banki','BK Kamonyi','0.5km'],['✈️','Aéroport','RIA Kanombe','40km']],
  'Muhanga':    [['🏫','Amashuri','GS Muhanga','0.9km'],['🏥','Ivuriro','Kabgayi District Hospital','1.4km'],['🛒','Supermarket','Muhanga Market','0.7km'],['🚌','Gari ya Moshi','Bus Stop Gitarama','0.4km'],['🏦','Banki','BPR Muhanga','0.5km'],['✈️','Aéroport','RIA Kanombe','55km']],
  'Nyamagabe':  [['🏫','Amashuri','GS Nyamagabe','1.0km'],['🏥','Ivuriro','Nyamagabe District Hospital','1.6km'],['🛒','Supermarket','Nyamagabe Market','0.8km'],['🚌','Gari ya Moshi','Bus Stop Nyamagabe','0.4km'],['🏦','Banki','BK Nyamagabe','0.6km'],['✈️','Aéroport','RIA Kanombe','120km']],
  'Nyanza':     [['🏫','Amashuri','GS Nyanza','0.8km'],['🏥','Ivuriro','Nyanza District Hospital','1.3km'],['🛒','Supermarket','Nyanza Market','0.6km'],['🚌','Gari ya Moshi','Bus Stop Nyanza','0.3km'],['🏦','Banki','BPR Nyanza','0.5km'],['✈️','Aéroport','RIA Kanombe','90km']],
  'Nyaruguru':  [['🏫','Amashuri','GS Nyaruguru','1.0km'],['🏥','Ivuriro','Nyaruguru District Hospital','1.6km'],['🛒','Supermarket','Nyaruguru Market','0.8km'],['🚌','Gari ya Moshi','Bus Stop Nyaruguru','0.4km'],['🏦','Banki','BK Nyaruguru','0.6km'],['✈️','Aéroport','RIA Kanombe','155km']],
  'Ruhango':    [['🏫','Amashuri','GS Ruhango','0.9km'],['🏥','Ivuriro','Ruhango District Hospital','1.4km'],['🛒','Supermarket','Ruhango Market','0.7km'],['🚌','Gari ya Moshi','Bus Stop Ruhango','0.3km'],['🏦','Banki','BPR Ruhango','0.5km'],['✈️','Aéroport','RIA Kanombe','75km']],
  'Karongi':    [['🏫','Amashuri','GS Karongi','0.9km'],['🏥','Ivuriro','Kibuye District Hospital','1.5km'],['🛒','Supermarket','Kibuye Market','0.7km'],['🚌','Gari ya Moshi','Bus Stop Kibuye','0.4km'],['🏦','Banki','BK Karongi','0.6km'],['✈️','Aéroport','RIA Kanombe','110km']],
  'Ngororero':  [['🏫','Amashuri','GS Ngororero','0.9km'],['🏥','Ivuriro','Ngororero District Hospital','1.4km'],['🛒','Supermarket','Ngororero Market','0.7km'],['🚌','Gari ya Moshi','Bus Stop Ngororero','0.4km'],['🏦','Banki','BPR Ngororero','0.5km'],['✈️','Aéroport','RIA Kanombe','80km']],
  'Nyabihu':    [['🏫','Amashuri','GS Nyabihu','1.0km'],['🏥','Ivuriro','Nyabihu District Hospital','1.5km'],['🛒','Supermarket','Nyabihu Market','0.8km'],['🚌','Gari ya Moshi','Bus Stop Nyabihu','0.4km'],['🏦','Banki','BK Nyabihu','0.6km'],['✈️','Aéroport','RIA Kanombe','130km']],
  'Nyamasheke': [['🏫','Amashuri','GS Nyamasheke','0.9km'],['🏥','Ivuriro','Nyamasheke District Hospital','1.5km'],['🛒','Supermarket','Nyamasheke Market','0.7km'],['🚌','Gari ya Moshi','Bus Stop Nyamasheke','0.4km'],['🏦','Banki','BPR Nyamasheke','0.5km'],['✈️','Aéroport','RIA Kanombe','150km']],
  'Rusizi':     [['🏫','Amashuri','GS Rusizi','0.9km'],['🏥','Ivuriro','Kamembe District Hospital','1.4km'],['🛒','Supermarket','Kamembe Market','0.7km'],['🚌','Gari ya Moshi','Bus Stop Kamembe','0.3km'],['🏦','Banki','BK Rusizi','0.5km'],['✈️','Aéroport','RIA Kanombe','185km']],
  'Rutsiro':    [['🏫','Amashuri','GS Rutsiro','1.0km'],['🏥','Ivuriro','Rutsiro District Hospital','1.6km'],['🛒','Supermarket','Rutsiro Market','0.8km'],['🚌','Gari ya Moshi','Bus Stop Rutsiro','0.4km'],['🏦','Banki','BPR Rutsiro','0.6km'],['✈️','Aéroport','RIA Kanombe','120km']]
};

function updatePoiCards(district) {
  var grid = document.getElementById('det-poi-grid');
  if (!grid) return;
  var pois = _poiData[district] || _poiData['Gasabo'];
  grid.innerHTML = pois.map(function(p) {
    return '<div style="background:var(--light);border-radius:10px;padding:.8rem;display:flex;align-items:center;gap:.6rem">'
      + '<span style="font-size:1.4rem">'+p[0]+'</span>'
      + '<div><div style="font-size:.7rem;color:var(--muted)">'+p[1]+'</div>'
      + '<div style="font-size:.82rem;font-weight:600">'+escapeHtml(p[2])+' — '+p[3]+'</div></div>'
      + '</div>';
  }).join('');
}

function openPropDetail(propId) {
  if(!propId) { console.warn('openPropDetail: no propId'); return; }
  // Find property in localStorage
  var props = [];
  try { props = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
  var prop = props.find(function(p){ return String(p.id) === String(propId); });

  // Fallback: search in window._allDemos if exists
  if(!prop && window._allDemos) {
    prop = window._allDemos.find(function(p){ return String(p.id) === String(propId); });
  }

  if(!prop) {
    // If no prop found, load demos first then retry
    loadDemoListings();
    var props2 = [];
    try { props2 = JSON.parse(localStorage.getItem('km_properties')||'[]'); } catch(e){}
    prop = props2.find(function(p){ return String(p.id) === String(propId); });
  }

  if(!prop) {
    showToast('Imitungo ntiboneka — gerageza nanone!');
    go('listings');
    return;
  }

  window._currentProp = prop;
  kmTrack('view_item',{item_id:String(prop.id),item_name:prop.title||'',price:prop.price||'',district:prop.district||'',type:prop.type||''});

  // === PRICE ===
  var priceNum = parseInt(prop.price)||0;
  var priceStr = priceNum >= 1000000
    ? priceNum.toLocaleString() + ' RWF'
    : (priceNum >= 1000 ? priceNum.toLocaleString() + ' RWF' : '—');
  if(prop.service === 'Gukodesha') priceStr += '/mo';

  // === HERO IMAGE ===
  var heroBg = document.querySelector('.det-hero-bg');
  if(heroBg) {
    if(prop.img1) {
      heroBg.style.backgroundImage = 'url('+prop.img1+')';
      heroBg.style.backgroundSize = 'cover';
      heroBg.style.backgroundPosition = 'center';
      heroBg.querySelector('svg') && (heroBg.querySelector('svg').style.display='none');
    } else {
      heroBg.style.backgroundImage = '';
      heroBg.querySelector('svg') && (heroBg.querySelector('svg').style.display='');
    }
  }

  // === TITLE + PRICE (hero overlay) ===
  var titleEl = document.getElementById('det-prop-title');
  if(titleEl) titleEl.textContent = prop.title || ((prop.type||'Imitungo') + ' — ' + (prop.district||'') + (prop.sector ? ', '+prop.sector : ''));

  var priceEl = document.querySelector('.det-price');
  if(priceEl) priceEl.innerHTML = priceStr + '<small>('+(prop.service||'Kugurisha')+')</small>';

  // === BADGES ===
  var badgesEl = document.querySelector('#det-prop-title + div');
  if(badgesEl) {
    badgesEl.innerHTML = (prop.isDemo ? '<span class="badge b-gold">✦ DEMO</span>' : '')
      + (prop.verified ? '<span class="badge b-green">✅ Verified</span>' : '')
      + (prop.service === 'Gukodesha' ? '<span class="badge b-muted">Gukodesha</span>' : '<span class="badge b-navy">Kugura</span>')
      + (prop.tour3dUrl ? '<span class="badge" style="background:#7c3aed;color:#fff;cursor:pointer" onclick="openTour(0)">🌐 3D Tour</span>' : '')
      + (prop.rating ? '<span class="badge" style="background:var(--light);color:var(--navy)">★ '+prop.rating+'</span>' : '');
  }

  // === FEATURES (beds/baths/size) ===
  var featsEl = document.querySelector('#det-prop-title + div + div');
  if(featsEl) {
    var bedStr    = prop.beds && prop.beds !== '0' ? prop.beds + ' ' + (curLang==='rw'?'Ibyumba':'Bedrooms') : '';
    var bathStr   = prop.baths && prop.baths !== '0' ? prop.baths + ' ' + (curLang==='rw'?'Bafu':'Bathrooms') : '';
    var sizeStr   = prop.size ? prop.size + 'm²' : '';
    var locStr    = [prop.district, prop.sector].filter(Boolean).join(', ');
    var floorsStr = prop.floors ? prop.floors + ' ' + (curLang==='rw'?'Intera':'Floors') : '';
    var parkStr   = prop.parking ? prop.parking + ' Parking' : '';
    featsEl.innerHTML = [bedStr, bathStr, sizeStr, floorsStr, parkStr, locStr].filter(Boolean).map(function(f){
      return '<span class="p-feat" style="font-size:.88rem">'+f+'</span>';
    }).join('');
    if (prop.amenities && prop.amenities.length) {
      var icons = {garden:'🌳',pool:'🏊',garage:'🚗',solar:'☀️',fibre:'🌐',security:'🔒',generator:'⚡'};
      featsEl.innerHTML += '<div style="margin-top:.5rem;display:flex;flex-wrap:wrap;gap:.3rem">'
        + prop.amenities.map(function(a){ return '<span style="background:var(--light);border-radius:6px;padding:.2rem .5rem;font-size:.78rem">'+(icons[a]||'')+' '+a+'</span>'; }).join('')
        + '</div>';
    }
  }

  // === DESCRIPTION TAB ===
  var descEl = document.getElementById('tab-desc');
  if(descEl) {
    var descP = descEl.querySelector('p');
    if(descP) descP.textContent = prop.desc || (curLang==='rw' ? 'Ibisobanuro ntibishyizweho.' : 'No description provided.');
    // Update info grid
    var infoItems = descEl.querySelectorAll('.\\!bg-light, [style*="var(--light)"] strong, [style*="var(--light)"]');
    // Update type
    var typeStrongs = descEl.querySelectorAll('strong');
    typeStrongs.forEach(function(s) {
      var lbl = s.previousElementSibling || (s.parentNode && s.parentNode.querySelector('span'));
      if(!lbl) return;
      var lblText = lbl.textContent.toLowerCase();
      if(lblText.includes('ubwoko') || lblText.includes('type')) s.textContent = prop.type||'—';
      if(lblText.includes('status')) {
        s.textContent = prop.status === 'Approved' ? (curLang==='rw'?'Iboneka':'Available') : prop.status||'—';
        s.style.color = prop.status === 'Approved' ? 'var(--green)' : 'var(--muted)';
      }
    });
    var ybEl = document.getElementById('det-year-built');
    if (ybEl) ybEl.textContent = prop.yearBuilt || '—';
    var tdEl = document.getElementById('det-title-deed');
    if (tdEl) {
      tdEl.textContent = prop.titleDeed || '—';
      tdEl.style.color = prop.titleDeed ? 'var(--green)' : 'var(--muted)';
    }
  }

  // === MAP TAB — dynamic embed ===
  var mapFrame = document.getElementById('det-map-frame');
  if (mapFrame) {
    var mapSrc;
    if (prop.latitude && prop.longitude) {
      mapSrc = 'https://maps.google.com/maps?q=' + prop.latitude + ',' + prop.longitude + '&z=16&output=embed';
    } else if (prop.district) {
      mapSrc = 'https://maps.google.com/maps?q=' + encodeURIComponent(prop.district + ', Rwanda') + '&z=13&output=embed';
    } else {
      mapSrc = 'https://maps.google.com/maps?q=Kigali,+Rwanda&z=12&output=embed';
    }
    mapFrame.src = mapSrc;
  }
  updatePoiCards(prop.district || '');

  // === GALLERY (thumbnails) ===
  var imgs = [prop.img1, prop.img2, prop.img3].filter(Boolean);
  var galleryEl = document.querySelector('.det-gallery');
  if(galleryEl) {
    if(imgs.length > 0) {
      galleryEl.innerHTML = imgs.map(function(img, i) {
        return '<div class="det-thumb'+(i===0?' active':'')+'" style="background:url('+img+') center/cover no-repeat;width:68px;height:52px;border-radius:6px;cursor:pointer;flex-shrink:0;border:'+(i===0?'2px solid var(--navy)':'1.5px solid var(--border)')+'" onclick="switchGallery(this,\'' + img + '\')"></div>';
      }).join('');
      galleryEl.style.display = 'flex';
    } else {
      galleryEl.innerHTML = '';
    }
  }

  // === VIDEO TAB ===
  var tab3d = document.getElementById('tab-3d');
  if(tab3d) {
    if(prop.video) {
      tab3d.innerHTML = '<div style="border-radius:12px;overflow:hidden;margin-bottom:1rem"><iframe src="'+prop.video+'" width="100%" height="260" style="border:0;display:block" allowfullscreen loading="lazy"></iframe></div>'
        + '<p style="font-size:.82rem;color:var(--muted);text-align:center">'+prop.type+' — '+prop.district+'</p>';
    } else {
      tab3d.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)">'
        + '<div style="font-size:2rem;margin-bottom:.5rem">📹</div>'
        + '<div style="font-weight:600;color:var(--navy)">'+(curLang==='rw'?'Nta video irashyizweho':'No video available')+'</div>'
        + '</div>';
    }
  }

  // === CONTACT (phone + WhatsApp) ===
  var cleanPhone = (prop.contact||'+250783177254').replace(/[^0-9+]/g,'');
  var callBtn = document.querySelector('.ag-acts button[onclick*="tel:"]');
  if(callBtn) callBtn.onclick = function(){ window.location.href='tel:'+cleanPhone; };

  var waBtn = document.querySelector('.ag-acts a[href*="wa.me"]');
  if(waBtn) {
    var waNum = cleanPhone.replace('+','');
    var waMsg = encodeURIComponent('Muraho! Ndashaka amakuru y\'imitungo: '+prop.type+' i '+(prop.district||'')+' - '+priceStr);
    waBtn.href = 'https://wa.me/'+waNum+'?text='+waMsg;
  }

  // === HAMAGARA BUTTON ===
  var callBtns = document.querySelectorAll('.ag-acts button');
  callBtns.forEach(function(btn) {
    if(btn.textContent.includes('Hamagara') || btn.getAttribute('onclick') && btn.getAttribute('onclick').includes('tel')) {
      btn.onclick = function(){ window.location.href='tel:'+cleanPhone; };
    }
  });

  // === REVIEWS TAB — real data ===
  renderReviewsTab(prop);

  // Navigate to detail page
  go('detail');
}

function switchGallery(el, imgUrl) {
  var heroBg = document.querySelector('.det-hero-bg');
  if(heroBg) { heroBg.style.backgroundImage = 'url('+imgUrl+')'; heroBg.style.backgroundSize='cover'; heroBg.style.backgroundPosition='center'; }
  document.querySelectorAll('.det-thumb').forEach(function(t){ t.style.border='1.5px solid var(--border)'; t.classList.remove('active'); });
  el.style.border = '2px solid var(--navy)'; el.classList.add('active');
}


// === SHAREABLE PROPERTY LINKS ===
// Store prop in URL hash so it can be shared
function sharePropLink(propId) {
  var url = window.location.origin + window.location.pathname + '#prop=' + propId;
  if(navigator.share) {
    navigator.share({ title: 'KOMISIYONERI - Imitungo', url: url })
      .catch(function(){});
  } else if(navigator.clipboard) {
    navigator.clipboard.writeText(url)
      .then(function(){ showToast('Link yakopiwe! Ohereza abandi.'); })
      .catch(function(){
        prompt('Kopya link iyi:', url);
      });
  } else {
    prompt('Kopya link iyi:', url);
  }
}

// Check URL hash on load — open listing if hash exists
function checkUrlHash() {
  var hash = window.location.hash;
  if(hash && hash.indexOf('#prop=') === 0) {
    var propId = hash.replace('#prop=', '');
    setTimeout(function() {
      openPropDetail(propId);
    }, 800);
  }
}

window.addEventListener('load', checkUrlHash);


// ═══════════════════════════════════════════
//  KOMISIYONERI PWA — Service Worker + Install
// ═══════════════════════════════════════════

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(reg) {
        console.log('[PWA] Service Worker registered:', reg.scope);
      })
      .catch(function(err) {
        console.log('[PWA] Service Worker registration failed:', err.message);
      });
  });
}

// PWA Install Prompt
var pwaInstallPrompt = null;

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  pwaInstallPrompt = e;
  // Show install button
  var installBtn = document.getElementById('pwa-install-btn');
  if(installBtn) installBtn.style.display = 'flex';
  console.log('[PWA] Install prompt ready');
});

function installPWA() {
  // If we have the native prompt - use it!
  if(pwaInstallPrompt) {
    pwaInstallPrompt.prompt();
    pwaInstallPrompt.userChoice.then(function(result) {
      if(result.outcome === 'accepted') {
        showToast('KOMISIYONERI yashyizweho! Reba Home Screen yawe.');
        var btn = document.getElementById('hm-install-btn');
        if(btn) btn.style.display = 'none';
      }
      pwaInstallPrompt = null;
    });
    return;
  }

  // Detect if already installed as PWA
  var isInstalled = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if(isInstalled) {
    showToast('KOMISIYONERI iri installed kare! Ugiye kuyikoresha.');
    return;
  }

  // Show manual install instructions modal
  openPWAInstallModal();
}

function openPWAInstallModal() {
  var existing = document.getElementById('pwa-modal');
  if(existing) { existing.style.display='flex'; return; }

  var ua = navigator.userAgent;
  var isIOS = /iPad|iPhone|iPod/.test(ua);
  var isSamsung = /SamsungBrowser/.test(ua);

  var steps = isIOS
    ? '<b>1.</b> Kanda <b>Share</b> button (arrow ↑) hepfo<br><b>2.</b> Hitamo <b>"Add to Home Screen"</b><br><b>3.</b> Kanda <b>"Add"</b>'
    : isSamsung
    ? '<b>1.</b> Kanda <b>⋮ menu</b> hejuru iburyo<br><b>2.</b> Hitamo <b>"Add page to"</b><br><b>3.</b> Kanda <b>"Home screen"</b>'
    : '<b>1.</b> Kanda <b>⋮ menu</b> hejuru iburyo ya Chrome<br><b>2.</b> Hitamo <b>"Install app"</b> cyangwa <b>"Add to Home Screen"</b><br><b>3.</b> Kanda <b>"Install"</b>';

  var modal = document.createElement('div');
  modal.id = 'pwa-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:1rem';
  
  var box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:20px;width:100%;max-width:440px;overflow:hidden';
  box.innerHTML = '<div style="background:linear-gradient(135deg,#0D3B8C,#1657CC);padding:1.2rem;text-align:center;color:#fff">'
    + '<div style="font-size:2.2rem">📱</div>'
    + '<div style="font-weight:700;font-size:1rem;margin-top:.3rem">Shyiraho KOMISIYONERI</div>'
    + '<div style="font-size:.75rem;opacity:.8">Install App ku telefoni yawe — ubuntu!</div></div>'
    + '<div style="padding:1.2rem">'
    + '<div style="font-weight:600;font-size:.82rem;color:#0D3B8C;margin-bottom:.7rem">Intambwe zo gushyiraho:</div>'
    + '<div style="font-size:.85rem;line-height:2;color:#374151">' + steps + '</div>'
    + '<div style="background:#e8f0fb;border-radius:8px;padding:.6rem .8rem;margin-top:.8rem;font-size:.75rem;color:#0D3B8C">'
    + '💡 App izagaragara kuri Home Screen nk\'icon ya KOMISIYONERI!</div>'
    + '</div>'
    + '<div style="display:flex;gap:.6rem;padding:.6rem 1.2rem 1.2rem">'
    + '<button id="pwa-close-b" style="flex:1;padding:.75rem;border:1.5px solid #e5e7eb;border-radius:10px;background:#fff;font-size:.85rem;cursor:pointer;font-family:sans-serif">Funga</button>'
    + '<button id="pwa-ok-b" style="flex:2;padding:.75rem;background:#0D3B8C;color:#fff;border:none;border-radius:10px;font-size:.85rem;font-weight:600;cursor:pointer;font-family:sans-serif">Nzabigeraho ✓</button>'
    + '</div>';

  modal.appendChild(box);
  document.body.appendChild(modal);

  document.getElementById('pwa-close-b').onclick = closePWAModal;
  document.getElementById('pwa-ok-b').onclick = closePWAModal;
  modal.addEventListener('click', function(e) { if(e.target===modal) closePWAModal(); });
}

function closePWAModal() {
  var m = document.getElementById('pwa-modal');
  if(m) m.style.display = 'none';
}

// Detect if running as PWA
window.addEventListener('DOMContentLoaded', function() {
  var isPWA = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if(isPWA) {
    console.log('[PWA] Running as installed app');
    document.body.classList.add('pwa-mode');
    // Hide browser-only elements
    var installBtn = document.getElementById('pwa-install-btn');
    if(installBtn) installBtn.style.display = 'none';
  }
});

// Online/Offline detection
window.addEventListener('online', function() {
  var ob = document.getElementById('online-bar');
  var ofb = document.getElementById('offline-bar');
  if(ob){ ob.style.display='block'; setTimeout(function(){ ob.style.display='none'; }, 3000); }
  if(ofb){ ofb.style.display='none'; }
});
window.addEventListener('offline', function() {
  var ofb = document.getElementById('offline-bar');
  if(ofb) ofb.style.display = 'block';
});


// === HAMBURGER MENU ===
var hamburgerOpen = false;

function toggleHamburger() {
  hamburgerOpen ? closeHamburger() : openHamburger();
}

function openHamburger() {
  hamburgerOpen = true;
  document.getElementById('hamburger-menu').style.display = 'block';
  document.getElementById('hamburger-overlay').style.display = 'block';
  // Animate bars to X
  var b1=document.getElementById('hb1'),b2=document.getElementById('hb2'),b3=document.getElementById('hb3');
  if(b1){b1.style.transform='rotate(45deg) translate(4px,4px)';}
  if(b2){b2.style.opacity='0';}
  if(b3){b3.style.transform='rotate(-45deg) translate(4px,-4px)';}
  // Update menu based on auth state
  updateHamburgerAuth();
}

function closeHamburger() {
  hamburgerOpen = false;
  document.getElementById('hamburger-menu').style.display = 'none';
  document.getElementById('hamburger-overlay').style.display = 'none';
  // Reset bars
  var b1=document.getElementById('hb1'),b2=document.getElementById('hb2'),b3=document.getElementById('hb3');
  if(b1){b1.style.transform='';}
  if(b2){b2.style.opacity='1';}
  if(b3){b3.style.transform='';}
}

function updateHamburgerAuth() {
  var isLoggedIn = !!currentUser;
  var isAdmin = isLoggedIn && currentUser.email === 'komisiyonericonnectproservices@gmail.com';

  // User info section
  var uInfo = document.getElementById('hm-user-info');
  var gInfo = document.getElementById('hm-guest-info');
  if(uInfo) uInfo.style.display = isLoggedIn ? 'block' : 'none';
  if(gInfo) gInfo.style.display = isLoggedIn ? 'none' : 'block';

  if(isLoggedIn && currentUser) {
    var nm = document.getElementById('hm-user-name');
    var em = document.getElementById('hm-user-email');
    if(nm) nm.textContent = currentUser.name || 'Umukoresha';
    if(em) em.textContent = currentUser.email || currentUser.phone || '';
    // Update avatar in topnav
    var av = document.getElementById('nav-avatar');
    if(av) {
      var ini = (currentUser.name||'U').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2)||'U';
      av.textContent = ini;
      av.style.display = 'flex';
    }
  } else {
    var av2 = document.getElementById('nav-avatar');
    if(av2) av2.style.display = 'none';
  }

  // Auth buttons
  var show = function(id, v){ var el=document.getElementById(id); if(el) el.style.display=v?'flex':'none'; };
  show('hm-login-btn', !isLoggedIn);
  show('hm-profile-btn', isLoggedIn);
  var isAgent = isLoggedIn && (currentUser.role === 'Agent' || isAdmin);
  show('hm-addprop-btn', isAgent);
  show('hm-agent-btn', isLoggedIn);
  show('hm-logout-btn', isLoggedIn);
  show('hm-admin-btn', isAdmin);
  // Install button - always show unless already installed
  // Install button always visible - shows instructions if no prompt
  var installBtn2 = document.getElementById('hm-install-btn');
  if(installBtn2) installBtn2.style.display = 'flex';
}

function handleLogout() {
  currentUser = null;
  try { localStorage.removeItem('km_current'); } catch(e) {}
  updateNavForUser(null);
  closeProfile();
  if(firebaseAuth) {
    firebaseAuth.signOut().catch(function(e) { console.error('signOut error:', e); });
  }
  showToast(curLang==='rw' ? 'Wasohowe neza!' : 'Signed out successfully!');
  go('home');
  setTimeout(function() {
    var av = document.getElementById('nav-avatar');
    if(av) av.style.display = 'none';
  }, 100);
}

// Close hamburger when navigating
var _goOrigHam = go;
go = function(page) {
  _goOrigHam(page);
  closeHamburger();
};


// ═══════════════════════════════════════════════════════════
//  AGENTS PAGE — Nationwide Directory
// ═══════════════════════════════════════════════════════════

function loadAgentsPage() {
  var agents = [];
  try { agents = JSON.parse(localStorage.getItem('km_agents')||'[]'); } catch(e){}

  // Add demo agents if none exist
  if(agents.length === 0) {
    agents = getDemoAgents();
    try { localStorage.setItem('km_agents', JSON.stringify(agents)); } catch(e){}
  }

  var active = agents.filter(function(a){ return a.status === 'Active'; });
  var zones = [...new Set(agents.map(function(a){ return a.zone; }))];

  var tc = document.getElementById('agents-total-count');
  var ac = document.getElementById('agents-active-count');
  var zc = document.getElementById('agents-zones-count');
  if(tc) tc.textContent = agents.length;
  if(ac) ac.textContent = active.length;
  if(zc) zc.textContent = zones.length;

  renderAgentsGrid(agents);
}

function getDemoAgents() {
  return [
    { id:'AG-DEMO-001', name:'Jean Marie Hakizimana', phone:'+250 788 123 456', email:'jmhakizimana@gmail.com', zone:'Gasabo', experience:'3', transport:'boda', languages:['Kinyarwanda','English'], status:'Active', rating:4.9, deals:23, registeredDate:new Date().toISOString() },
    { id:'AG-DEMO-002', name:'Claudine Uwimana', phone:'+250 722 234 567', email:'cuwimana@gmail.com', zone:'Kicukiro', experience:'5', transport:'car', languages:['Kinyarwanda','Français'], status:'Active', rating:4.8, deals:31, registeredDate:new Date().toISOString() },
    { id:'AG-DEMO-003', name:'Patrick Nshimiyimana', phone:'+250 783 345 678', email:'pnshimiyimana@gmail.com', zone:'Nyarugenge', experience:'1', transport:'boda', languages:['Kinyarwanda'], status:'Active', rating:4.6, deals:12, registeredDate:new Date().toISOString() },
    { id:'AG-DEMO-004', name:'Grace Mukandayisenga', phone:'+250 738 456 789', email:'gmukandayisenga@gmail.com', zone:'Musanze', experience:'3', transport:'car', languages:['Kinyarwanda','English'], status:'Active', rating:4.7, deals:18, registeredDate:new Date().toISOString() },
    { id:'AG-DEMO-005', name:'Innocent Habimana', phone:'+250 789 567 890', email:'ihabimana@gmail.com', zone:'Rubavu', experience:'0', transport:'boda', languages:['Kinyarwanda'], status:'Pending Verification', rating:0, deals:0, registeredDate:new Date().toISOString() },
    { id:'AG-DEMO-006', name:'Solange Nyiraneza', phone:'+250 725 678 901', email:'snyiraneza@gmail.com', zone:'Huye', experience:'5', transport:'car', languages:['Kinyarwanda','Français','English'], status:'Active', rating:5.0, deals:42, registeredDate:new Date().toISOString() },
  ];
}

function renderAgentsGrid(agents) {
  var grid = document.getElementById('agents-page-grid');
  if(!grid) return;

  if(agents.length === 0) {
    var noMsg = curLang==='rw' ? 'Nta agents babonetse' : 'No agents found';
    var noSub = curLang==='rw' ? 'Gerageza guhindura ubushakashatsi cyangwa zone.' : 'Try changing your search or zone filter.';
    var noBtn = curLang==='rw' ? 'Iyandikishe nk\'Agent' : 'Register as Agent';
    grid.innerHTML = '<div class="empty-state">'
      + '<div class="es-icon">👔</div>'
      + '<div class="es-title">' + noMsg + '</div>'
      + '<div class="es-sub">' + noSub + '</div>'
      + '<button class="btn btn-navy btn-sm" onclick="go(\'auth\')">' + noBtn + '</button>'
      + '</div>';
    return;
  }

  grid.innerHTML = agents.map(function(agent) {
    var isActive = agent.status === 'Active';
    var isPending = agent.status === 'Pending Verification';
    var stars = agent.rating ? '★'.repeat(Math.round(agent.rating)) + ' ' + agent.rating : '—';
    var initials = (agent.name||'A').split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase();
    var langs = (agent.languages||[]).join(' · ');
    var transport = agent.transport === 'car' ? '🚗 Imodoka' : agent.transport === 'boda' ? '🏍️ Boda' : '—';

    return '<div style="background:#fff;border-radius:14px;border:1.5px solid var(--border);overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)">'
      // Header
      + '<div style="background:linear-gradient(135deg,var(--navy),var(--blue));padding:1rem;display:flex;align-items:center;gap:.8rem">'
      +   '<div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.2);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;border:2px solid var(--gold)">' + initials + '</div>'
      +   '<div style="flex:1;min-width:0">'
      +     '<div style="font-weight:700;color:#fff;font-size:.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (agent.name||'Agent') + '</div>'
      +     '<div style="font-size:.72rem;color:rgba(255,255,255,.75);margin-top:.1rem">📍 ' + (agent.zone||'—') + '</div>'
      +   '</div>'
      +   '<div style="flex-shrink:0">'
      +     '<span style="background:' + (isActive?'#27A84A':isPending?'#F5A623':'#718096') + ';color:#fff;border-radius:20px;padding:.15rem .55rem;font-size:.62rem;font-weight:700">'
      +     (isActive?'● Active':isPending?'⏳ Pending':'Inactive') + '</span>'
      +   '</div>'
      + '</div>'
      // Body
      + '<div style="padding:.9rem">'
      +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.7rem">'
      +     '<div style="background:var(--light);border-radius:8px;padding:.5rem;text-align:center"><div style="font-size:1.1rem;font-weight:700;color:var(--navy)">' + (agent.deals||0) + '</div><div style="font-size:.65rem;color:var(--muted)">Deals</div></div>'
      +     '<div style="background:var(--light);border-radius:8px;padding:.5rem;text-align:center"><div style="font-size:.9rem;font-weight:700;color:var(--gold)">' + stars + '</div><div style="font-size:.65rem;color:var(--muted)">Rating</div></div>'
      +   '</div>'
      +   '<div style="font-size:.75rem;color:var(--muted);margin-bottom:.3rem">🌐 ' + (langs||'Kinyarwanda') + '</div>'
      +   '<div style="font-size:.75rem;color:var(--muted);margin-bottom:.7rem">' + transport + ' · Uburambe: ' + (agent.experience==='0'?'Mushya':agent.experience+'yr+') + '</div>'
      +   '<div style="display:flex;gap:.4rem">'
      +     '<a href="tel:' + (agent.phone||'') + '" style="flex:1;background:var(--navy);color:#fff;border:none;border-radius:8px;padding:.5rem;text-align:center;font-size:.78rem;font-weight:600;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:.3rem">📞 Hamagara</a>'
      +     '<a href="https://wa.me/' + (agent.phone||'').replace(/[^0-9]/g,'') + '?text=' + encodeURIComponent('Muraho! Ndabona kuri KOMISIYONERI ndashaka agent. Ni wowe '+agent.name+'?') + '" target="_blank" style="flex:1;background:#25D366;color:#fff;border:none;border-radius:8px;padding:.5rem;text-align:center;font-size:.78rem;font-weight:600;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:.3rem">💬 WhatsApp</a>'
      +   '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

function filterAgentsPage() {
  var search = (document.getElementById('agent-search-inp').value||'').toLowerCase();
  var zone = document.getElementById('agent-zone-filter').value;
  var agents = [];
  try { agents = JSON.parse(localStorage.getItem('km_agents')||'[]'); } catch(e){}
  if(agents.length === 0) agents = getDemoAgents();

  var filtered = agents.filter(function(a) {
    var matchSearch = !search || (a.name||'').toLowerCase().includes(search) || (a.zone||'').toLowerCase().includes(search);
    var matchZone = !zone || a.zone === zone;
    return matchSearch && matchZone;
  });
  renderAgentsGrid(filtered);
}

// ═══════════════════════════════════════════════════════════
//  ADMIN — Switch Tabs (Listings / Agents / Deals)
// ═══════════════════════════════════════════════════════════

var adminCurrentTab = 'listings';

function switchAdminTab(tab) {
  adminCurrentTab = tab;

  // Update tab buttons
  ['listings','agents','deals','platform'].forEach(function(t) {
    var btn = document.getElementById('adm-tab-'+t);
    if(!btn) return;
    if(t === tab) {
      btn.style.background = 'var(--navy)'; btn.style.color = '#fff'; btn.style.border = 'none';
    } else {
      btn.style.background = '#fff'; btn.style.color = 'var(--dark)'; btn.style.border = '1.5px solid var(--border)';
    }
  });

  // Show/hide panels
  var listingsPanel = document.getElementById('admin-list');
  var listingsFilters = document.getElementById('adm-listings-filters');
  var agentsPanel = document.getElementById('admin-agents-panel');
  var dealsPanel = document.getElementById('admin-deals-panel');
  var platformPanel = document.getElementById('admin-platform-panel');

  if(listingsPanel) listingsPanel.style.display = tab === 'listings' ? 'block' : 'none';
  if(listingsFilters) listingsFilters.style.display = tab === 'listings' ? 'flex' : 'none';
  if(agentsPanel) agentsPanel.style.display = tab === 'agents' ? 'block' : 'none';
  if(dealsPanel) dealsPanel.style.display = tab === 'deals' ? 'block' : 'none';
  if(platformPanel) platformPanel.style.display = tab === 'platform' ? 'block' : 'none';

  if(tab === 'agents') renderAdminAgents();
  if(tab === 'deals') renderAdminDeals();
  if(tab === 'platform') renderAdminPlatform();
}

// ═══════════════════════════════════════════════════════════
//  PLATFORM FLAGS — feature toggles persisted in localStorage
// ═══════════════════════════════════════════════════════════

function kmFlag(key) {
  // features that are OFF by default until admin explicitly enables them
  var offByDefault = { payments: true };
  try {
    var f = JSON.parse(localStorage.getItem('km_platform_flags') || '{}');
    if(f[key] === undefined) return !offByDefault[key];
    return f[key] !== false;
  } catch(e) { return !offByDefault[key]; }
}

function kmSetFlag(key, val) {
  try {
    var f = JSON.parse(localStorage.getItem('km_platform_flags') || '{}');
    f[key] = val;
    localStorage.setItem('km_platform_flags', JSON.stringify(f));
  } catch(e) {}
  applyPlatformFlags();
  renderAdminPlatform();
}

function applyPlatformFlags() {
  window._agentRegOpen = kmFlag('agent_reg');
  window._listingsOpen = kmFlag('new_listings');
}

function injectRealDepositForm() {
  var modal = document.querySelector('#deposit-modal .modal');
  if(!modal) return;
  modal.innerHTML =
    '<div class="modal-hdr">' +
      '<div class="modal-title">💰 Kwishyura Deposit — Tangira Transaction</div>' +
      '<button class="modal-x" onclick="closeDepositPay()"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
    '</div>' +
    '<div style="background:var(--light);border-radius:10px;padding:1rem;margin-bottom:1rem">' +
      '<div style="font-size:.75rem;color:var(--muted);margin-bottom:.3rem">Deposit (10% y\'igiciro)</div>' +
      '<div style="font-family:\'Cormorant Garamond\',serif;font-size:2rem;font-weight:700;color:var(--navy)" id="dep-amount-display">— RWF</div>' +
    '</div>' +
    '<div style="display:flex;flex-direction:column;gap:.8rem;padding:.3rem 0">' +
      '<div class="field"><label>Amazina Yawe</label><input type="text" id="dep-name" placeholder="Amazina yuzuye"></div>' +
      '<div class="field"><label>Telefoni (MoMo / Airtel)</label><input type="tel" id="dep-phone" placeholder="+250 7XX XXX XXX"></div>' +
      '<div class="field"><label>Uburyo bwo Kwishyura</label>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.3rem">' +
          '<div id="dep-m1" onclick="selectDepMethod(this)" style="border:2px solid var(--navy);border-radius:8px;padding:.6rem;text-align:center;cursor:pointer;background:rgba(13,59,140,.06)"><div style="font-weight:700;font-size:.82rem;color:var(--navy)">📱 MTN MoMo</div></div>' +
          '<div id="dep-m2" onclick="selectDepMethod(this)" style="border:1.5px solid var(--border);border-radius:8px;padding:.6rem;text-align:center;cursor:pointer"><div style="font-weight:700;font-size:.82rem">📱 Airtel Money</div></div>' +
          '<div id="dep-m3" onclick="selectDepMethod(this)" style="border:1.5px solid var(--border);border-radius:8px;padding:.6rem;text-align:center;cursor:pointer"><div style="font-weight:700;font-size:.82rem">💳 Karita ya Banki</div></div>' +
          '<div id="dep-m4" onclick="selectDepMethod(this)" style="border:1.5px solid var(--border);border-radius:8px;padding:.6rem;text-align:center;cursor:pointer"><div style="font-weight:700;font-size:.82rem">🏦 Bank Transfer</div></div>' +
        '</div>' +
      '</div>' +
      '<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:.7rem;font-size:.78rem;color:#856404">⚠️ Deposit igarukira kuri account ya KOMISIYONERI. Amasezerano azakufikira mu masaha 24.</div>' +
      '<button class="btn btn-gold btn-lg" style="width:100%;justify-content:center" onclick="submitDeposit()">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
        ' Emeza Kwishyura Deposit' +
      '</button>' +
    '</div>';
}

function injectRealPayForm() {
  var modal = document.querySelector('#pay-modal .modal');
  if(!modal) return;
  modal.innerHTML =
    '<div class="modal-hdr">' +
      '<div class="modal-title">💳 Kwishyura — Digital Payment</div>' +
      '<button class="modal-x" onclick="closePay()"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
    '</div>' +
    '<div style="background:var(--light);border-radius:10px;padding:1rem 1.2rem;margin-bottom:1.3rem;display:flex;justify-content:space-between;align-items:center">' +
      '<div><div style="font-size:.8rem;color:var(--muted)">Igiteranyo cy\'Amafaranga</div><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.7rem;font-weight:700;color:var(--navy)" id="pay-total-display">— RWF</div></div>' +
      '<span class="badge b-green"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Bwizewe</span>' +
    '</div>' +
    '<div style="font-size:.78rem;font-weight:700;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-bottom:.75rem">Hitamo Uburyo bwo Kwishyura</div>' +
    '<div class="pay-methods">' +
      '<div class="pay-m active" onclick="this.parentElement.querySelectorAll(\'.pay-m\').forEach(x=>x.classList.remove(\'active\'));this.classList.add(\'active\')"><svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18" stroke-width="2"/></svg><span>MTN Mobile Money</span></div>' +
      '<div class="pay-m" onclick="this.parentElement.querySelectorAll(\'.pay-m\').forEach(x=>x.classList.remove(\'active\'));this.classList.add(\'active\')"><svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18" stroke-width="2"/></svg><span>Airtel Money</span></div>' +
      '<div class="pay-m" onclick="this.parentElement.querySelectorAll(\'.pay-m\').forEach(x=>x.classList.remove(\'active\'));this.classList.add(\'active\')"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg><span>Karita ya Banki</span></div>' +
      '<div class="pay-m" onclick="this.parentElement.querySelectorAll(\'.pay-m\').forEach(x=>x.classList.remove(\'active\'));this.classList.add(\'active\')"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span>Bank Transfer</span></div>' +
    '</div>' +
    '<button class="btn btn-navy btn-lg" style="width:100%;justify-content:center;margin-top:.5rem" onclick="closePay();showToast(\'Kwishyura kwaratangiye! Uzabona ubutumwa.\')">' +
      '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Emeza Kwishyura' +
    '</button>' +
    '<div class="sec-badge"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>256-bit SSL</span><span>Secured by KOMISIYONERI</span></div>';
}

function renderAdminPlatform() {
  var panel = document.getElementById('admin-platform-panel');
  if(!panel) return;

  var flags = {};
  try { flags = JSON.parse(localStorage.getItem('km_platform_flags') || '{}'); } catch(e) {}

  var f = {
    payments:     flags.payments    === true,   // off by default
    agent_reg:    flags.agent_reg   !== false,  // on by default
    new_listings: flags.new_listings !== false  // on by default
  };

  // Count live features for score
  var liveCount = 28 + (f.payments ? 1 : 0) + (f.agent_reg ? 1 : 0) + (f.new_listings ? 1 : 0);
  var totalCount = 31;
  var pct = Math.round(liveCount / totalCount * 100);
  var scoreColor = pct >= 90 ? '#16a34a' : pct >= 70 ? '#d97706' : '#dc2626';

  function toggle(key, val) {
    return 'kmSetFlag(\'' + key + '\',' + val + ')';
  }
  function toggleRow(label, key, desc) {
    var on = flags[key] !== false;
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.55rem 0;border-bottom:1px solid var(--border)">' +
      '<div>' +
        '<div style="font-size:.82rem;font-weight:600">' + label + '</div>' +
        '<div style="font-size:.72rem;color:var(--muted)">' + desc + '</div>' +
      '</div>' +
      '<label class="km-toggle" onclick="' + toggle(key, !on) + '">' +
        '<input type="checkbox"' + (on ? ' checked' : '') + ' readonly>' +
        '<div class="km-toggle-track"></div>' +
        '<span style="font-size:.72rem;color:' + (on ? 'var(--navy)' : 'var(--muted)') + ';font-weight:600">' + (on ? 'ON' : 'OFF') + '</span>' +
      '</label>' +
    '</div>';
  }
  function liveRow(label, desc) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border)">' +
      '<div>' +
        '<div style="font-size:.82rem;font-weight:600">' + label + '</div>' +
        '<div style="font-size:.72rem;color:var(--muted)">' + desc + '</div>' +
      '</div>' +
      '<span style="font-size:.72rem;font-weight:700;color:#16a34a;background:#dcfce7;padding:.2rem .5rem;border-radius:20px">✅ Live</span>' +
    '</div>';
  }
  function group(title, rows) {
    return '<div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:1rem 1.2rem;margin-bottom:.8rem">' +
      '<div style="font-size:.7rem;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:.3rem">' + title + '</div>' +
      rows +
    '</div>';
  }

  var html =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">' +
      '<div style="font-size:1rem;font-weight:700;color:var(--navy)">Platform Readiness</div>' +
      '<div style="font-size:1.1rem;font-weight:800;color:' + scoreColor + ';background:' + (pct>=90?'#dcfce7':pct>=70?'#fef3c7':'#fee2e2') + ';padding:.3rem .9rem;border-radius:20px">' + pct + '% Ready</div>' +
    '</div>' +

    group('🏠 Property Listings',
      liveRow('Add / Edit / Delete', 'Full form with images, coords, amenities') +
      liveRow('Search & Filters', 'Fuzzy search, type/location/price/beds/size filters') +
      liveRow('Detail View', '5 tabs: Description, Tour, Map, Docs, Reviews') +
      toggleRow('New Listings Open', 'new_listings', 'Agents can submit new property listings')
    ) +

    group('👔 Agent Management',
      toggleRow('Agent Registration', 'agent_reg', 'New agents can apply to join the platform') +
      liveRow('Approval Flow', 'Admin approves → live role update, no re-login') +
      liveRow('Agent Dashboard', 'KPIs, my listings, upcoming visits, leads') +
      liveRow('Lead Auto-Assignment', 'Fairness algorithm by zone & fewest leads')
    ) +

    group('🔐 Authentication',
      liveRow('Email / Password', 'Register + login') +
      liveRow('Google Sign-In', 'Firebase + Google Identity Services') +
      liveRow('Phone OTP', 'Firebase Phone Auth + reCAPTCHA') +
      liveRow('Password Reset', 'Email reset via Firebase')
    ) +

    group('💬 Communication',
      liveRow('WhatsApp Links', 'Property cards + detail page → admin number') +
      liveRow('Lead Capture', 'Zone auto-assignment with agent WhatsApp notify') +
      liveRow('Email Notifications', 'EmailJS — leads, bookings, approvals') +
      liveRow('AI Chat', 'Claude-powered property assistant')
    ) +

    group('💰 Payments',
      toggleRow('Payment Gateway', 'payments', 'Show real payment form instead of Coming Soon')
    ) +

    group('🗺️ Maps & Discovery',
      liveRow('Dynamic Map', 'Exact coords → district fallback → Kigali default') +
      liveRow('Nearby POI', 'School, hospital, bank cards per district') +
      liveRow('Property Comparison', 'Side-by-side dynamic picker') +
      liveRow('Mortgage Calculator', 'Real-time amortization')
    ) +

    group('⭐ Reviews & Bookings',
      liveRow('Reviews & Ratings', 'Per-property, live avg recalculation') +
      liveRow('Site Visits / Bookings', 'Saved per property + visible in agent dashboard')
    ) +

    group('🔥 Firebase & Data',
      liveRow('Realtime Listeners', 'on(\'value\') for all 6 collections') +
      liveRow('Firebase Storage', 'Image upload with imgbb fallback') +
      liveRow('Bidirectional Sync', 'localStorage writes pushed to RTDB')
    ) +

    group('📱 PWA & Mobile',
      liveRow('Install Prompt', 'iOS / Samsung / Chrome platform-specific guide') +
      liveRow('Offline Indicator', 'online/offline event banner') +
      liveRow('Service Worker', 'Network-first + cache fallback') +
      liveRow('Push Notifications', 'Leads, bookings, approvals via SW')
    ) +

    group('🌐 Translation',
      liveRow('RW / EN Toggle', 'data-rw / data-en on all UI strings')
    ) +

    '<div style="font-size:.7rem;color:var(--muted);text-align:center;margin-top:.5rem">Last updated: ' + new Date().toLocaleString() + '</div>';

  panel.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════
//  ADMIN — Agents Management
// ═══════════════════════════════════════════════════════════

function renderAdminAgents() {
  var list = document.getElementById('admin-agents-list');
  if(!list) return;
  list.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.82rem">⏳ Gutegura...</div>';

  // Pull live from Firebase first, then render
  try {
    firebase.database().ref('agents').once('value').then(function(s) {
      if(s.exists()) {
        var fbAgents = [];
        s.forEach(function(c){ fbAgents.push(c.val()); });
        if(fbAgents.length > 0) {
          localStorage.setItem('km_agents', JSON.stringify(fbAgents));
        }
      }
      _renderAdminAgentsList();
    }).catch(function(){ _renderAdminAgentsList(); });
  } catch(e){ _renderAdminAgentsList(); }
}

function _renderAdminAgentsList() {
  var agents = [];
  try { agents = JSON.parse(localStorage.getItem('km_agents')||'[]'); } catch(e){}
  if(agents.length === 0) agents = getDemoAgents();

  var list = document.getElementById('admin-agents-list');
  if(!list) return;

  if(agents.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)">Nta agents biyandikishije ubu</div>';
    return;
  }

  var pending = agents.filter(function(a){ return a.status === 'Pending Verification'; });
  var pendingBanner = pending.length > 0
    ? '<div style="background:#fff3cd;border:1.5px solid #ffc107;border-radius:8px;padding:.6rem .9rem;margin-bottom:.7rem;font-size:.8rem;font-weight:600">⏳ ' + pending.length + ' agent(s) bategereje kwemezwa</div>'
    : '';

  list.innerHTML = pendingBanner + '<div style="font-weight:700;font-size:.82rem;color:var(--navy);margin-bottom:.7rem">Agents '+ agents.length +' — Shinja cyangwa Emeza</div>'
    + agents.map(function(agent, idx) {
    var isActive = agent.status === 'Active';
    var isPending = agent.status === 'Pending Verification';
    var statusColor = isActive ? '#27A84A' : isPending ? '#F5A623' : '#718096';

    return '<div style="border:1.5px solid var(--border);border-radius:10px;padding:.8rem;margin-bottom:.6rem;background:#fff">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">'
      +   '<div style="flex:1">'
      +     '<div style="font-weight:700;font-size:.88rem;color:var(--navy)">' + (agent.name||'—') + '</div>'
      +     '<div style="font-size:.75rem;color:var(--muted)">📍 ' + (agent.zone||'—') + ' | 📞 ' + (agent.phone||'—') + '</div>'
      +     '<div style="font-size:.73rem;color:var(--muted)">📧 ' + (agent.email||'—') + '</div>'
      +     '<div style="font-size:.73rem;color:var(--muted);margin-top:.2rem">🌐 ' + (agent.languages||[]).join(', ') + ' | ' + (agent.transport==='car'?'🚗':'🏍️') + ' | Deals: ' + (agent.deals||0) + '</div>'
      +   '</div>'
      +   '<span style="background:'+statusColor+';color:#fff;border-radius:20px;padding:.15rem .55rem;font-size:.62rem;font-weight:700;flex-shrink:0">' + agent.status + '</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem;margin-top:.6rem">'
      +   '<button onclick="adminAgentApprove('+idx+')" style="background:#27A84A;color:#fff;border:none;padding:.4rem;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:700">✅ Emeza</button>'
      +   '<button onclick="adminAgentSuspend('+idx+')" style="background:#F5A623;color:#000;border:none;padding:.4rem;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:700">⏸ Hagarika</button>'
      +   '<button onclick="adminAgentDelete('+idx+')" style="background:#718096;color:#fff;border:none;padding:.4rem;border-radius:6px;cursor:pointer;font-size:.72rem">🗑️ Siba</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

function adminAgentApprove(idx) {
  var agents = [];
  try { agents = JSON.parse(localStorage.getItem('km_agents')||'[]'); } catch(e){}
  if(!agents[idx] && agents.length === 0) agents = getDemoAgents();
  if(agents[idx]) {
    agents[idx].status = 'Active';
    try { localStorage.setItem('km_agents', JSON.stringify(agents)); } catch(e){}
    try { rtdb.ref('agents/' + agents[idx].id).update({ status: 'Active' }); } catch(e){}

    // Promote the matching user's role to 'Agent' in localStorage + Firebase
    var agentId = agents[idx].id;
    var users = [];
    try { users = JSON.parse(localStorage.getItem('km_users')||'[]'); } catch(e){}
    users = users.map(function(u) {
      if (u.agentId === agentId) {
        u.role = 'Agent';
        try { rtdb.ref('users/'+btoa(u.email).replace(/[.#$[\]]/g,'_')).update({ role: 'Agent' }); } catch(e){}
      }
      return u;
    });
    try { localStorage.setItem('km_users', JSON.stringify(users)); } catch(e){}

    showToast('✅ Agent yemejwe! Ubu ashobora guhabwa leads.');
    renderAdminAgents();
    var a = agents[idx];
    if(a.phone) window.open('https://wa.me/'+a.phone.replace(/[^0-9]/g,'')+'?text='+encodeURIComponent('Muraho '+a.name+'! KOMISIYONERI irashimishijwe kukemeza iyandikishe ryawe nka agent. Witeguye guhabwa leads. Urakoze!'), '_blank');
    if(a.email) {
      kmSendEmail(_ejsTmplApproval, {
        to_email:   a.email,
        agent_name: a.name || ''
      });
    }
  }
}

function adminAgentSuspend(idx) {
  var agents = [];
  try { agents = JSON.parse(localStorage.getItem('km_agents')||'[]'); } catch(e){}
  if(agents[idx]) {
    agents[idx].status = 'Suspended';
    try { localStorage.setItem('km_agents', JSON.stringify(agents)); } catch(e){}
    try { rtdb.ref('agents/' + agents[idx].id).update({ status: 'Suspended' }); } catch(e){}

    // Revoke Agent role from matching user in localStorage + Firebase
    var agentId = agents[idx].id;
    var users = [];
    try { users = JSON.parse(localStorage.getItem('km_users')||'[]'); } catch(e){}
    users = users.map(function(u) {
      if (u.agentId === agentId && u.role === 'Agent') {
        u.role = 'PendingAgent';
        try { rtdb.ref('users/'+btoa(u.email).replace(/[.#$[\]]/g,'_')).update({ role: 'PendingAgent' }); } catch(e){}
      }
      return u;
    });
    try { localStorage.setItem('km_users', JSON.stringify(users)); } catch(e){}
    showToast('⏸ Agent yahagaritswe.');
    renderAdminAgents();
  }
}

function adminAgentDelete(idx) {
  if(!confirm('Siba agent uyu burundu?')) return;
  var agents = [];
  try { agents = JSON.parse(localStorage.getItem('km_agents')||'[]'); } catch(e){}
  var deleted = agents[idx];
  agents.splice(idx, 1);
  try { localStorage.setItem('km_agents', JSON.stringify(agents)); } catch(e){}
  if(deleted) {
    try { rtdb.ref('agents/' + deleted.id).remove(); } catch(e){}
    // Revert user role to Buyer
    var users = [];
    try { users = JSON.parse(localStorage.getItem('km_users')||'[]'); } catch(e){}
    users = users.map(function(u) {
      if (u.agentId === deleted.id) {
        u.role = 'Buyer'; delete u.agentId; delete u.zone;
        try { rtdb.ref('users/'+btoa(u.email).replace(/[.#$[\]]/g,'_')).update({ role: 'Buyer', agentId: null, zone: null }); } catch(e){}
      }
      return u;
    });
    try { localStorage.setItem('km_users', JSON.stringify(users)); } catch(e){}
  }
  showToast('🗑️ Agent yasibwe.');
  renderAdminAgents();
}

// ═══════════════════════════════════════════════════════════
//  ADMIN — Deals / Completed Transactions
// ═══════════════════════════════════════════════════════════

function renderAdminDeals() {
  var list = document.getElementById('admin-deals-list');
  if(!list) return;
  list.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--muted);font-size:.82rem">⏳ Gutegura...</div>';

  // Pull live leads from Firebase first, then render
  try {
    firebase.database().ref('leads').once('value').then(function(s) {
      if(s.exists()) {
        var fbLeads = [];
        s.forEach(function(c){ fbLeads.push(c.val()); });
        if(fbLeads.length > 0) localStorage.setItem('km_leads', JSON.stringify(fbLeads));
      }
      _renderAdminDealsList();
    }).catch(function(){ _renderAdminDealsList(); });
  } catch(e){ _renderAdminDealsList(); }
}

function _renderAdminDealsList() {
  var list = document.getElementById('admin-deals-list');
  if(!list) return;

  var leads = [];
  try { leads = JSON.parse(localStorage.getItem('km_leads')||'[]'); } catch(e){}
  var closedLeads = leads.filter(function(l){ return l.status === 'Closed'; });

  list.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.8rem">'
    + '<div style="background:#27A84A;color:#fff;border-radius:8px;padding:.6rem;text-align:center"><div style="font-size:1.2rem;font-weight:700">' + closedLeads.length + '</div><div style="font-size:.68rem">Deals Zarangiye</div></div>'
    + '<div style="background:var(--navy);color:#fff;border-radius:8px;padding:.6rem;text-align:center"><div style="font-size:1.2rem;font-weight:700">' + leads.filter(function(l){return l.status==='Active';}).length + '</div><div style="font-size:.68rem">Deals Zikorwa</div></div>'
    + '</div>';

  if(closedLeads.length === 0 && leads.length === 0) {
    list.innerHTML += '<div style="text-align:center;padding:2rem;color:var(--muted)">'
      + '<div style="font-size:2rem;margin-bottom:.5rem">💰</div>'
      + '<div style="font-weight:600;color:var(--navy)">Nta deals irahari ubu</div>'
      + '<div style="font-size:.8rem;margin-top:.3rem">Deals zizagaragara iyo leads zisojwe</div>'
      + '</div>';
    return;
  }

  // Show all leads with ability to mark as sold
  list.innerHTML += leads.map(function(lead, idx) {
    var statusColor = lead.status==='Closed'?'#27A84A':lead.status==='Active'?'var(--blue)':'#F5A623';
    var commission = lead.budgetMax ? Math.round(parseInt(lead.budgetMax) * 0.04).toLocaleString() + ' RWF' : '—';

    return '<div style="border:1.5px solid var(--border);border-radius:10px;padding:.8rem;margin-bottom:.6rem;background:#fff">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'
      +   '<div>'
      +     '<div style="font-weight:700;font-size:.85rem;color:var(--navy)">' + (lead.clientName||'—') + '</div>'
      +     '<div style="font-size:.75rem;color:var(--muted)">📞 ' + (lead.clientPhone||'—') + ' | 📍 ' + (lead.zone||'—') + '</div>'
      +     '<div style="font-size:.75rem;color:var(--muted)">' + (lead.action||'—') + '</div>'
      +     (lead.agentName ? '<div style="font-size:.73rem;color:var(--blue)">👔 Agent: ' + lead.agentName + '</div>' : '')
      +     '<div style="font-size:.72rem;color:var(--muted)">💰 Est. Commission: ' + commission + '</div>'
      +   '</div>'
      +   '<span style="background:'+statusColor+';color:#fff;border-radius:20px;padding:.15rem .5rem;font-size:.62rem;font-weight:700;flex-shrink:0">' + lead.status + '</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.35rem;margin-top:.6rem">'
      +   '<button onclick="markDealSold('+idx+')" style="background:#27A84A;color:#fff;border:none;padding:.4rem;border-radius:6px;cursor:pointer;font-size:.7rem;font-weight:700">✅ Yagurishijwe</button>'
      +   '<button onclick="markDealActive('+idx+')" style="background:var(--blue);color:#fff;border:none;padding:.4rem;border-radius:6px;cursor:pointer;font-size:.7rem">🔄 Active</button>'
      +   '<a href="tel:' + (lead.clientPhone||'') + '" style="background:var(--navy);color:#fff;border:none;padding:.4rem;border-radius:6px;cursor:pointer;font-size:.7rem;text-decoration:none;text-align:center;display:flex;align-items:center;justify-content:center">📞</a>'
      + '</div>'
      + '</div>';
  }).join('');
}

function markDealSold(idx) {
  var leads = [];
  try { leads = JSON.parse(localStorage.getItem('km_leads')||'[]'); } catch(e){}
  if(leads[idx]) {
    leads[idx].status = 'Closed';
    leads[idx].closedAt = new Date().toISOString();
    try { localStorage.setItem('km_leads', JSON.stringify(leads)); } catch(e){}
    try { if(leads[idx].id) rtdb.ref('leads/'+leads[idx].id).update({ status: 'Closed', closedAt: leads[idx].closedAt }); } catch(e){}
    showToast('Deal yemejwe nk\'igurishwa - Commission ibazwa!');
    renderAdminDeals();
  }
}

function markDealActive(idx) {
  var leads = [];
  try { leads = JSON.parse(localStorage.getItem('km_leads')||'[]'); } catch(e){}
  if(leads[idx]) {
    leads[idx].status = 'Active';
    try { localStorage.setItem('km_leads', JSON.stringify(leads)); } catch(e){}
    try { if(leads[idx].id) rtdb.ref('leads/'+leads[idx].id).update({ status: 'Active' }); } catch(e){}
    showToast('🔄 Deal yasubijwe Active.');
    renderAdminDeals();
  }
}

// Load agents page when navigating to it
var _goOrigAgents = go;
go = function(page) {
  _goOrigAgents(page);
  if(page === 'agents') {
    setTimeout(loadAgentsPage, 100);
  }
};

