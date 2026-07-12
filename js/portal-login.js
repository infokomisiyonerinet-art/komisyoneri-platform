// KOMISIYONERI — Staff/Partner Portal Login (shared logic)
//
// Used by staff-login.html and partner-login.html — two standalone pages,
// deliberately separate from the main index.html SPA, so staff/partner
// visitors never see the public site's client/agent role-tabbed login
// form. Each host page sets a small config object before including this
// script (see PORTAL_LOGIN_CONFIG below); everything else is identical
// between the two.
//
// Role check mirrors index.html's own ROLE_TIERS.STAFF / role==='partner'
// gate exactly (see getPortalContext()/portalAllowsUser() there) — this is
// a client-side UX gate for a fast, clear rejection; the real security
// boundary is still firestore.rules.
(function () {
  'use strict';

  var CFG = window.PORTAL_LOGIN_CONFIG || {};
  var EXPECTED_ROLE = CFG.expectedRole; // 'staff' | 'partner'
  var REJECT_MESSAGE = CFG.rejectMessage || 'You are not authorized for this portal.';

  var STAFF_ROLE_TIER = [
    'super_admin', 'admin', 'staff', 'ceo', 'branch_manager', 'hr_manager',
    'operations_manager', 'marketing_manager', 'company_owner', 'director',
    'accountant', 'chief_broker', 'customer_support_manager', 'it_manager',
    'legal_adviser'
  ];

  function roleAllowed(role) {
    role = (role || '').toLowerCase();
    if (EXPECTED_ROLE === 'staff') return STAFF_ROLE_TIER.indexOf(role) > -1;
    if (EXPECTED_ROLE === 'partner') return role === 'partner';
    return false;
  }

  var firebaseConfig = {
    apiKey:            "AIzaSyCw9NYlw0XLC26Di-nFCNOuL7D6RX8k820",
    authDomain:        "komisyoneri-platform-prod.firebaseapp.com",
    databaseURL:       "https://komisyoneri-platform-prod-default-rtdb.firebaseio.com",
    projectId:         "komisyoneri-platform-prod",
    storageBucket:     "komisyoneri-platform-prod.firebasestorage.app",
    messagingSenderId: "766901928352",
    appId:             "1:766901928352:web:9df910b36a462e1fb524c5",
    measurementId:     "G-ERRNCE85E2"
  };
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();

  var form      = document.getElementById('pl-form');
  var emailEl   = document.getElementById('pl-email');
  var passEl    = document.getElementById('pl-pass');
  var errorEl   = document.getElementById('pl-error');
  var noticeEl  = document.getElementById('pl-notice');
  var submitBtn = document.getElementById('pl-submit');
  var forgotEl  = document.getElementById('pl-forgot');

  function showError(msg) {
    if (noticeEl) noticeEl.style.display = 'none';
    if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
  }
  function showNotice(msg) {
    if (errorEl) errorEl.style.display = 'none';
    if (noticeEl) { noticeEl.textContent = msg; noticeEl.style.display = 'block'; }
  }
  function clearMessages() {
    if (errorEl) errorEl.style.display = 'none';
    if (noticeEl) noticeEl.style.display = 'none';
  }
  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? (CFG.loadingLabel || 'Signing in…') : (CFG.submitLabel || 'Injira');
  }

  // Every session-establishing check in this app redirects here, whether
  // it's this login page succeeding or index.html's own routing finding an
  // already-valid session — '/' re-enters the SPA, which reads the same
  // Firebase Auth session (persisted per-origin) and routes straight to
  // 'dashboard' via its own getPortalContext()/portalAllowsUser() gate.
  function redirectToApp() {
    window.location.replace('/');
  }

  function handleSubmit(e) {
    e.preventDefault();
    clearMessages();
    var email = emailEl ? emailEl.value.trim() : '';
    var pass  = passEl ? passEl.value : '';
    if (!email || !pass) { showError('Enter your email and password.'); return; }
    setLoading(true);
    auth.signInWithEmailAndPassword(email, pass)
      .then(function (cred) {
        return db.collection('users').doc(cred.user.uid).get();
      })
      .then(function (doc) {
        var role = doc.exists ? (doc.data().role || '') : '';
        if (!roleAllowed(role)) {
          auth.signOut().catch(function () {});
          setLoading(false);
          showError(REJECT_MESSAGE);
          return;
        }
        redirectToApp();
      })
      .catch(function (err) {
        setLoading(false);
        var code = err && err.code || '';
        var msg = 'Sign-in failed. Please try again.';
        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') msg = 'Incorrect email or password.';
        else if (code === 'auth/user-not-found') msg = 'No account found with that email.';
        else if (code === 'auth/invalid-email') msg = 'Enter a valid email address.';
        else if (code === 'auth/too-many-requests') msg = 'Too many attempts. Please wait a moment and try again.';
        showError(msg);
      });
  }

  function handleForgotPassword(e) {
    e.preventDefault();
    clearMessages();
    var email = emailEl ? emailEl.value.trim() : '';
    if (!email) { showError('Enter your email above first, then tap "Forgot password?" again.'); return; }
    auth.sendPasswordResetEmail(email)
      .then(function () { showNotice('Password reset email sent to ' + email + '.'); })
      .catch(function (err) { showError('Could not send reset email: ' + (err.message || err.code || 'unknown error')); });
  }

  if (form) form.addEventListener('submit', handleSubmit);
  if (forgotEl) forgotEl.addEventListener('click', handleForgotPassword);

  // Already authenticated with the right, active role? Skip the form
  // entirely. Wrong role or not-yet-approved? Sign out and explain why,
  // rather than leaving a half-authenticated session sitting on the login
  // form. This mirrors index.html's own enforcePortalRoleOrSignOut().
  auth.onAuthStateChanged(function (fbUser) {
    if (!fbUser) return;
    db.collection('users').doc(fbUser.uid).get().then(function (doc) {
      var data = doc.exists ? doc.data() : {};
      var role = data.role || '';
      if (roleAllowed(role) && data.status !== 'pending') {
        redirectToApp();
      } else if (roleAllowed(role) && data.status === 'pending') {
        auth.signOut().catch(function () {});
        showNotice('Your account is awaiting approval. You will be notified once it is active.');
      } else {
        auth.signOut().catch(function () {});
        showError(REJECT_MESSAGE);
      }
    }).catch(function () {});
  });
})();
