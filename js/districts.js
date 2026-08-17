// KOMISIYONERI — Single source of truth for Rwanda's 30 districts.
//
// Every district dropdown/filter on the platform (property submission,
// property/agent/partner/site filters, branch network admin, financing
// applications, verification requests, agent lead capture, the Business
// Intelligence per-district map, etc.) reads from RWANDA_DISTRICTS below
// instead of hardcoding its own copy of the list — that duplication is
// exactly how the platform ended up with a dozen different, silently
// diverging subsets (7/9/10/17/29 districts, some missing Nyanza, one
// with a bogus "Kigali City" entry mixed in with real districts).
//
// Loaded as a plain classic <script src="/js/districts.js"> in
// index.html's <head> (this codebase has no bundler/module system —
// see js/portal-login.js for the same convention), so RWANDA_DISTRICTS/
// RWANDA_PROVINCES are plain globals, exactly like every other shared
// constant in the app (ROLE_TIERS, LANG_FLAGS, etc.).
//
// To add/rename a district: edit RWANDA_PROVINCES only. RWANDA_DISTRICTS
// (the flat list every dropdown actually consumes) is derived from it
// automatically, so the two can never drift apart.

var RWANDA_PROVINCES = [
  { name: 'Kigali City',       nameRw: 'Kigali',           districts: ['Gasabo', 'Kicukiro', 'Nyarugenge'] },
  { name: 'Northern Province', nameRw: 'Amajyaruguru',     districts: ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo'] },
  { name: 'Southern Province', nameRw: 'Amajyepfo',        districts: ['Gisagara', 'Huye', 'Kamonyi', 'Muhanga', 'Nyamagabe', 'Nyanza', 'Nyaruguru', 'Ruhango'] },
  { name: 'Eastern Province',  nameRw: 'Iburasirazuba',    districts: ['Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Rwamagana'] },
  { name: 'Western Province',  nameRw: 'Iburengerazuba',   districts: ['Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke', 'Rubavu', 'Rusizi', 'Rutsiro'] }
];

var RWANDA_DISTRICTS = RWANDA_PROVINCES.reduce(function(all, province) {
  return all.concat(province.districts);
}, []);

// Fills every <select class="district-select"> on the page with the 30
// canonical <option> elements, appended after whatever placeholder option
// (if any — "All Districts", "Select district...", etc.) already exists
// in that select's markup. Called once from the app's DOMContentLoaded
// handler; safe to call again since every one of these selects is
// populated once and never has its innerHTML rebuilt elsewhere.
function populateDistrictSelects() {
  var opts = RWANDA_DISTRICTS.map(function(d) {
    return '<option value="' + d + '">' + d + '</option>';
  }).join('');
  document.querySelectorAll('select.district-select').forEach(function(sel) {
    sel.insertAdjacentHTML('beforeend', opts);
  });
}

// Same idea, but grouped into <optgroup> blocks by province — for the one
// or two selects (e.g. the agent registration zone picker) whose existing
// UX groups districts by province instead of listing them flat. Still
// derived from the single RWANDA_PROVINCES source, so there's no second
// hardcoded list to drift out of sync — just a different rendering of the
// same data. Province labels follow the app's current language (falls
// back to English if curLang isn't set yet for some reason).
function populateDistrictSelectsGrouped() {
  var rw = (typeof curLang !== 'undefined' && curLang === 'rw');
  var html = RWANDA_PROVINCES.map(function(province) {
    var label = rw ? province.nameRw : province.name;
    var opts = province.districts.map(function(d) {
      return '<option value="' + d + '">' + d + '</option>';
    }).join('');
    return '<optgroup label="' + label + '">' + opts + '</optgroup>';
  }).join('');
  document.querySelectorAll('select.district-select-grouped').forEach(function(sel) {
    sel.insertAdjacentHTML('beforeend', html);
  });
}
