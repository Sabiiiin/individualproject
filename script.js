(function () {
"use strict";

var STORE_KEY = "calendar-clock-events-v1";
var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
var DOWS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

var $ = function (id) { return document.getElementById(id); };
var pad = function (n) { return String(n).padStart(2, "0"); };
var keyOf = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };

/* ---------- Storage (events keyed by YYYY-MM-DD) ---------- */
var events = load();
function load() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) { var obj = JSON.parse(raw); if (obj && typeof obj === "object") return obj; }
  } catch (e) {}
  return {};
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(events)); } catch (e) {}
}
function eventsFor(k) {
  var list = (events[k] || []).slice();
  list.sort(function (a, b) { return (a.time || "") < (b.time || "") ? -1 : (a.time || "") > (b.time || "") ? 1 : 0; });
  return list;
}

/* ---------- State ---------- */
var now = new Date();
var viewYear = now.getFullYear();
var viewMonth = now.getMonth();
var selected = keyOf(now);
var is24 = false;

/* ---------- Clock ---------- */
function tickClock() {
  var d = new Date();
  var h = d.getHours();
  var suffix = "";
  if (!is24) { suffix = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; }
  var el = $("clockTime");
  el.textContent = "";
  el.appendChild(document.createTextNode(pad(h) + ":" + pad(d.getMinutes())));
  var s = document.createElement("span");
  s.className = "clock-sec";
  s.textContent = pad(d.getSeconds());
  el.appendChild(s);
  if (suffix) {
    var a = document.createElement("span");
    a.className = "clock-ampm";
    a.textContent = suffix;
    el.appendChild(a);
  }
  $("clockDate").textContent = d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  updateNext(d);
  checkReminders(d);
}

function updateNext(d) {
  var todays = eventsFor(keyOf(d)).filter(function (e) { return e.time && e.time >= pad(d.getHours()) + ":" + pad(d.getMinutes()); });
  $("clockNext").textContent = todays.length ? "Next today: " + todays[0].title + " at " + fmtTime(todays[0].time) : "";
}

var fired = {};
function checkReminders(d) {
  var k = keyOf(d);
  var t = pad(d.getHours()) + ":" + pad(d.getMinutes());
  (events[k] || []).forEach(function (e) {
    var id = k + e.id;
    if (e.time === t && !fired[id]) {
      fired[id] = true;
      toast((e.type === "reminder" ? "Reminder: " : "Event: ") + e.title);
    }
  });
}

function fmtTime(t) {
  if (!t) return "All day";
  var p = t.split(":"), h = +p[0], m = p[1];
  if (is24) return pad(h) + ":" + m;
  return (h % 12 || 12) + ":" + m + " " + (h >= 12 ? "PM" : "AM");
}

$("fmtBtn").addEventListener("click", function () {
  is24 = !is24;
  this.textContent = is24 ? "24 h" : "12 h";
  tickClock();
  renderPanel();
});

/* ---------- Calendar ---------- */
function renderDow() {
  var box = $("dow");
  DOWS.forEach(function (n) {
    var c = document.createElement("div");
    c.className = "dow";
    c.textContent = n;
    box.appendChild(c);
  });
}

function renderCalendar() {
  $("calTitle").textContent = MONTHS[viewMonth] + " " + viewYear;
  var grid = $("grid");
  grid.textContent = "";
  var first = new Date(viewYear, viewMonth, 1);
  var start = new Date(viewYear, viewMonth, 1 - first.getDay());
  var todayKey = keyOf(new Date());

  for (var i = 0; i < 42; i++) {
    var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    var k = keyOf(d);
    var list = events[k] || [];
    var nEvents = list.filter(function (e) { return e.type !== "reminder"; }).length;
    var nRem = list.length - nEvents;

    var cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day";
    cell.dataset.key = k;
    if (d.getMonth() !== viewMonth) cell.classList.add("outside");
    if (k === todayKey) cell.classList.add("today");
    if (k === selected) cell.classList.add("selected");
    if (nEvents) cell.classList.add("has-event");
    if (nRem) cell.classList.add("has-reminder");

    var label = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (k === todayKey) label += ", today";
    label += list.length ? ", " + list.length + (list.length === 1 ? " entry" : " entries") : ", no entries";
    cell.setAttribute("aria-label", label);
    if (k === todayKey) cell.setAttribute("aria-current", "date");

    var num = document.createElement("span");
    num.className = "num";
    num.textContent = d.getDate();
    cell.appendChild(num);

    var dots = document.createElement("span");
    dots.className = "dots";
    var sorted = eventsFor(k);
    sorted.slice(0, 3).forEach(function (e) {
      var dot = document.createElement("i");
      dot.className = "dot" + (e.type === "reminder" ? " reminder" : "");
      dots.appendChild(dot);
    });
    if (sorted.length > 3) {
      var more = document.createElement("span");
      more.className = "more";
      more.textContent = "+" + (sorted.length - 3);
      dots.appendChild(more);
    }
    cell.appendChild(dots);
    grid.appendChild(cell);
  }
}

function goToDate(k) {
  var p = k.split("-");
  var y = +p[0], m = +p[1] - 1;
  if (y !== viewYear || m !== viewMonth) { viewYear = y; viewMonth = m; }
  selected = k;
  renderCalendar();
  renderPanel();
}

// Single click = select + view. Double click = add.
$("grid").addEventListener("click", function (e) {
  var cell = e.target.closest(".day");
  if (!cell) return;
  goToDate(cell.dataset.key);
  var again = $("grid").querySelector('.day[data-key="' + cell.dataset.key + '"]');
  if (again && e.detail === 0) again.focus();
});
$("grid").addEventListener("dblclick", function (e) {
  var cell = e.target.closest(".day");
  if (!cell) return;
  goToDate(cell.dataset.key);
  openDialog(cell.dataset.key);
});

$("prevBtn").addEventListener("click", function () {
  viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});
$("nextBtn").addEventListener("click", function () {
  viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});
$("todayBtn").addEventListener("click", function () { goToDate(keyOf(new Date())); });

/* ---------- Day panel ---------- */
function parseKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }

function renderPanel() {
  var d = parseKey(selected);
  var isToday = selected === keyOf(new Date());
  $("panelTitle").textContent = isToday ? "Today" : d.toLocaleDateString(undefined, { weekday: "long" });
  $("panelSub").textContent = d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  var list = $("list");
  list.textContent = "";
  var items = eventsFor(selected);

  if (!items.length) {
    var li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No events or reminders on this day.";
    list.appendChild(li);
    return;
  }

  items.forEach(function (ev) {
    var li = document.createElement("li");
    li.className = "item" + (ev.type === "reminder" ? " reminder" : "");

    var bar = document.createElement("span");
    bar.className = "bar";
    li.appendChild(bar);

    var body = document.createElement("div");
    var t = document.createElement("p");
    t.className = "item-title";
    t.textContent = ev.title;
    var meta = document.createElement("p");
    meta.className = "item-meta";
    meta.textContent = (ev.type === "reminder" ? "Reminder" : "Event") + " \u00B7 " + fmtTime(ev.time);
    body.appendChild(t);
    body.appendChild(meta);
    if (ev.note) {
      var n = document.createElement("p");
      n.className = "item-note";
      n.textContent = ev.note;
      body.appendChild(n);
    }
    li.appendChild(body);

    var del = document.createElement("button");
    del.type = "button";
    del.className = "del";
    del.textContent = "Delete";
    del.setAttribute("aria-label", "Delete " + ev.title);
    del.addEventListener("click", function () { removeEvent(selected, ev.id); });
    li.appendChild(del);

    list.appendChild(li);
  });
}

function removeEvent(k, id) {
  events[k] = (events[k] || []).filter(function (e) { return e.id !== id; });
  if (!events[k].length) delete events[k];
  save();
  renderCalendar();
  renderPanel();
  tickClock();
}

/* ---------- Dialog ---------- */
var dlg = $("dlg");
var dlgKey = null;

function openDialog(k) {
  dlgKey = k;
  $("dlgTitle").textContent = "New entry";
  $("dlgDate").textContent = parseKey(k).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  $("fTitle").value = "";
  $("fTime").value = "";
  $("fNote").value = "";
  $("fErr").textContent = "";
  document.querySelector('input[name="ftype"][value="event"]').checked = true;
  if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  $("fTitle").focus();
}
function closeDialog() {
  if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
}

function saveEntry() {
  var title = $("fTitle").value.trim();
  if (!title) {
    $("fErr").textContent = "Enter a title to save this entry.";
    $("fTitle").focus();
    return;
  }
  var type = document.querySelector('input[name="ftype"]:checked').value;
  var entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: title,
    time: $("fTime").value,
    type: type,
    note: $("fNote").value.trim()
  };
  (events[dlgKey] = events[dlgKey] || []).push(entry);
  save();
  closeDialog();
  goToDate(dlgKey);
  tickClock();
  toast((type === "reminder" ? "Reminder" : "Event") + " added");
}

$("addBtn").addEventListener("click", function () { openDialog(selected); });
$("saveBtn").addEventListener("click", saveEntry);
$("cancelBtn").addEventListener("click", closeDialog);
dlg.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "radio") { e.preventDefault(); saveEntry(); }
});
dlg.addEventListener("click", function (e) { if (e.target === dlg) closeDialog(); });

/* ---------- Toast ---------- */
var toastTimer;
function toast(msg) {
  var t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove("show"); }, 4000);
}

/* ---------- Init ---------- */
renderDow();
renderCalendar();
renderPanel();
tickClock();
setInterval(function () {
  tickClock();
  // roll over at midnight so "today" stays accurate
  var nk = keyOf(new Date());
  if (nk !== todayRendered) { todayRendered = nk; renderCalendar(); renderPanel(); }
}, 1000);
var todayRendered = keyOf(new Date());
})();
