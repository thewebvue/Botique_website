/* Ezhil Atelier — shared behaviour. Every feature checks that its elements exist. */
(function () {
  'use strict';

  // ----- Settings you may want to change -----
  var CONFIG = {
    // Set to your form service URL (e.g. Formspree, Getform, your own API) to receive fitting requests.
    // While empty, the form runs in preview mode and nothing is sent.
    endpoint: '',
    timeZone: 'Asia/Kolkata',
    closedDay: 0,                 // 0 = Sunday
    open: '10:30', close: '19:30',
    fitting: { from: '11:00', last: '18:00' }
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { } return null; }

  // ----- Time in the restaurant's time zone -----
  function nowParts() {
    var f = new Intl.DateTimeFormat('en-GB', { timeZone: CONFIG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
    var o = {};
    f.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    var dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var h = parseInt(o.hour, 10) % 24;
    return { date: o.year + '-' + o.month + '-' + o.day, day: dayMap[o.weekday], mins: h * 60 + parseInt(o.minute, 10) };
  }
  function toMins(t) { var a = t.split(':'); return parseInt(a[0], 10) * 60 + parseInt(a[1], 10); }
  function dayOf(dateStr) { var a = dateStr.split('-'); return new Date(Date.UTC(+a[0], +a[1] - 1, +a[2])).getUTCDay(); }
  function fmt12(t) { var m = toMins(t), h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap; }
  function prettyDate(s) { var a = s.split('-'); return new Date(Date.UTC(+a[0], +a[1] - 1, +a[2])).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }

  // ----- Header -----
  var header = $('.site-header');
  if (header) {
    var tg = $('.nav-toggle', header);
    if (tg) {
      tg.addEventListener('click', function () {
        var open = header.getAttribute('data-open') === 'true';
        header.setAttribute('data-open', open ? 'false' : 'true');
        tg.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
      $$('.nav-links a', header).forEach(function (a) { a.addEventListener('click', function () { header.setAttribute('data-open', 'false'); tg.setAttribute('aria-expanded', 'false'); }); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && header.getAttribute('data-open') === 'true') { header.setAttribute('data-open', 'false'); tg.setAttribute('aria-expanded', 'false'); tg.focus(); } });
    }
  }

  // ----- Photo fallbacks -----
  function wirePhotos(root) {
    $$('.ph img', root).forEach(function (img) {
      var box = img.parentNode;
      var fail = function () { box.classList.add('nophoto'); };
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail();
      img.addEventListener('error', fail);
    });
  }
  wirePhotos(document);


  // ----- Open now -----
  $$('[data-open-now]').forEach(function (el) {
    var n = nowParts(), m = n.mins, state = 'closed', text;
    var o = toMins(CONFIG.open), c = toMins(CONFIG.close);
    if (n.day === CONFIG.closedDay) text = 'Closed today (Sunday). Opens Monday at 10:30 am';
    else if (m >= o && m < c) { state = 'open'; text = 'Open now until 7:30 pm'; }
    else if (m < o) text = 'Closed. Opens today at 10:30 am';
    else text = n.day === 6 ? 'Closed for today. Opens Monday at 10:30 am' : 'Closed for today. Opens tomorrow at 10:30 am';
    el.setAttribute('data-state', state);
    var t = $('.txt', el); if (t) t.textContent = text;
  });

  // ----- Copy buttons -----
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var txt = b.getAttribute('data-copy'), orig = b.textContent;
      var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = orig; }, 1600); };
      var fallback = function () {
        var target = b.previousElementSibling;
        if (target && window.getSelection) { var r = document.createRange(); r.selectNodeContents(target); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
        b.textContent = 'Selected'; setTimeout(function () { b.textContent = orig; }, 1600);
      };
      try { navigator.clipboard.writeText(txt).then(done, fallback); } catch (e) { fallback(); }
    });
  });

  // ===== Motion system =====
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var fine = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
  var io = null;

  function splitWords(el) {
    var n = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = document.createDocumentFragment();
          c.nodeValue.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var i = document.createElement('span'); i.textContent = p; i.style.setProperty('--i', n++);
            w.appendChild(i); frag.appendChild(w);
          });
          c.parentNode.replaceChild(frag, c);
        } else if (c.nodeType === 1) walk(c);
      });
    })(el);
  }

  try {
    $$('[data-stagger]').forEach(function (p) {
      var mod = p.classList.contains('pieces') ? 4 : 9;
      Array.prototype.forEach.call(p.children, function (c, i) {
        if (!c.hasAttribute('data-words') && !c.hasAttribute('data-reveal')) c.setAttribute('data-reveal', '');
        c.style.setProperty('--d', ((i % mod) * 0.08).toFixed(2) + 's');
      });
    });
    $$('[data-words]').forEach(splitWords);
    var targets = $$('[data-reveal], [data-words]');
    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(function (t) { t.classList.add('in'); });
    } else {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { threshold: 0.1, rootMargin: '0px 0px -4% 0px' });
      targets.forEach(function (t) { io.observe(t); });
    }
  } catch (err) {
    $$('[data-reveal], [data-words]').forEach(function (t) { t.classList.add('in'); });
  }

  // Counters
  var counters = $$('[data-count]');
  if (counters.length && !reduce && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        var el = e.target, to = parseInt(el.getAttribute('data-count'), 10), t0 = null;
        var step = function (t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / 1500, 1);
          el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        };
        el.textContent = '0'; requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  }

  // Scroll: progress bar, header hide/show, parallax
  var progress = $('.progress'), pxImgs = $$('[data-px] img'), lastY = window.scrollY, tick = false;
  function parallax() {
    if (reduce || !pxImgs.length) return;
    var vh = window.innerHeight;
    pxImgs.forEach(function (img) {
      var r = img.parentNode.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) return;
      var p = (r.top + r.height / 2 - vh / 2) / vh;
      img.style.transform = 'translate3d(0,' + (p * -7).toFixed(2) + '%,0) scale(1.16)';
    });
  }
  function onScroll() {
    tick = false;
    var y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = 'scaleX(' + (h > 0 ? Math.min(y / h, 1) : 0).toFixed(4) + ')';
    if (header) {
      header.setAttribute('data-stuck', y > 8 ? 'true' : 'false');
      var open = header.getAttribute('data-open') === 'true';
      if (!open && y > 240 && y > lastY + 6) { header.setAttribute('data-hidden', 'true'); document.documentElement.classList.add('hdr-hidden'); }
      else if (open || y < 240 || y < lastY - 6) { header.setAttribute('data-hidden', 'false'); document.documentElement.classList.remove('hdr-hidden'); }
    }
    lastY = y; parallax();
  }
  window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', parallax);
  onScroll();
  if (header) header.addEventListener('focusin', function () { header.setAttribute('data-hidden', 'false'); document.documentElement.classList.remove('hdr-hidden'); });

  // Menu: lock page scroll while the full-screen menu is open
  if (header) {
    new MutationObserver(function () { document.body.classList.toggle('menu-open', header.getAttribute('data-open') === 'true'); }).observe(header, { attributes: true, attributeFilter: ['data-open'] });
  }

  // Magnetic buttons (mouse only)
  if (!reduce && fine) {
    $$('.btn, .rail-btn, .lb-btn').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  // Rail: buttons + mouse drag
  var rail = $('#rail');
  if (rail) {
    var padL = function () { return parseFloat(getComputedStyle(rail).paddingLeft) || 0; };
    $$('[data-rail]').forEach(function (b) {
      b.addEventListener('click', function () {
        var step = (rail.querySelector('.piece') || { offsetWidth: 320 }).offsetWidth + 24;
        rail.scrollBy({ left: step * parseInt(b.getAttribute('data-rail'), 10), behavior: 'smooth' });
      });
    });
    rail.addEventListener('dragstart', function (e) { e.preventDefault(); });
    var down = false, sx = 0, sl = 0, moved = 0;
    rail.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; sx = e.clientX; sl = rail.scrollLeft; moved = 0; });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx));
      if (moved > 5) { rail.classList.add('drag'); rail.scrollLeft = sl - dx; }
    });
    window.addEventListener('pointerup', function () {
      if (!down) return; down = false;
      if (!rail.classList.contains('drag')) return;
      rail.classList.remove('drag');
      var best = null, bd = 1e9;
      $$('.piece', rail).forEach(function (it) { var d = Math.abs(it.offsetLeft - padL() - rail.scrollLeft); if (d < bd) { bd = d; best = it; } });
      if (best) rail.scrollTo({ left: best.offsetLeft - padL(), behavior: 'smooth' });
    });
    rail.addEventListener('click', function (e) { if (moved > 5) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  }

  // Quote slider (crossfade, auto-advances)
  var qs = $$('#quotes .quote');
  if (qs.length) {
    var qi = 0, qn = $('#q-i'), qt = null;
    var showQ = function (i) {
      qi = (i + qs.length) % qs.length;
      qs.forEach(function (q, k) { q.classList.toggle('on', k === qi); });
      if (qn) qn.textContent = '0' + (qi + 1);
    };
    var auto = function () { clearInterval(qt); if (!reduce) qt = setInterval(function () { if (!document.hidden) showQ(qi + 1); }, 8000); };
    $$('[data-q]').forEach(function (b) { b.addEventListener('click', function () { showQ(qi + parseInt(b.getAttribute('data-q'), 10)); auto(); }); });
    auto();
  }

  function setDateMin(input) {
    var n = nowParts(); input.min = n.date;
    var d = new Date(Date.UTC(+n.date.slice(0, 4), +n.date.slice(5, 7) - 1, +n.date.slice(8, 10)));
    d.setUTCDate(d.getUTCDate() + 120); input.max = d.toISOString().slice(0, 10);
  }
  function fillSlots(select, dateStr, keep) {
    var n = nowParts(), html = '<option value="">Choose a time</option>';
    for (var m = toMins(CONFIG.fitting.from); m <= toMins(CONFIG.fitting.last); m += 60) {
      var h = Math.floor(m / 60), v = (h < 10 ? '0' : '') + h + ':00';
      var past = dateStr === n.date && m < n.mins + 60;
      html += '<option value="' + v + '"' + (past ? ' disabled' : '') + '>' + fmt12(v) + (past ? ' (passed)' : '') + '</option>';
    }
    select.innerHTML = html;
    if (keep) { var opt = $('option[value="' + keep + '"]', select); if (opt && !opt.disabled) select.value = keep; }
  }

  // ----- Collections: filter + deep links -----
  var root = $('#coll-root');
  if (root) {
    var secs = $$('.coll-sec', root), chips = $$('.tabs button'), count = $('#coll-count'), empty = $('#coll-empty');
    var active = 'all';
    var pick = function (id) {
      active = id; var shown = 0;
      chips.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-cat') === id ? 'true' : 'false'); });
      secs.forEach(function (s) {
        var on = id === 'all' || s.id === id;
        s.hidden = !on;
        if (on) shown += $$('.piece', s).length;
      });
      count.textContent = shown + (shown === 1 ? ' piece' : ' pieces');
      if (io && !reduce) { secs.forEach(function (s) { if (s.hidden) return; $$('[data-reveal]', s).forEach(function (e) { e.classList.remove('in'); void e.offsetWidth; io.observe(e); }); }); }
      empty.hidden = shown !== 0;
    };
    chips.forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-cat'); pick(id);
        if (id === 'all') { history.replaceState(null, '', location.pathname + location.search); window.scrollTo({ top: 0 }); }
        else { history.replaceState(null, '', '#' + id); var t = document.getElementById(id); if (t) t.scrollIntoView({ block: 'start' }); }
      });
    });
    var fromHash = function () {
      var id = (location.hash || '').replace('#', '');
      if (id && secs.some(function (s) { return s.id === id; })) { pick(id); var t = document.getElementById(id); if (t) t.scrollIntoView({ block: 'start' }); } else pick('all');
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
  }

  // ----- Photo viewer (lookbook and pieces) -----
  var lb = $('#lb');
  if (lb) {
    var sel = '.g-item, .piece-ph', idx = 0, last = null, list = [];
    var stage = $('.lb-stage', lb), cap = $('.lb-bar .cap', lb);
    var collect = function () { list = $$(sel).filter(function (el) { return !el.closest('[hidden]'); }); };
    var esc = function (t) { var d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; };
    var show = function (i) {
      idx = (i + list.length) % list.length;
      var it = list[idx], src = it.querySelector('.ph'), clone = src.cloneNode(true);
      clone.classList.add('nolabel'); clone.classList.remove('nophoto');
      if (it.classList.contains('piece-ph')) clone.classList.add('tall');
      stage.innerHTML = ''; stage.appendChild(clone);
      var im = $('img', clone);
      if (im) { im.removeAttribute('loading'); var big = im.getAttribute('data-big'), s = im.getAttribute('src'); if (big) im.setAttribute('src', big); else if (s) im.setAttribute('src', s.replace(/w=\d+/, 'w=1600')); }
      wirePhotos(stage);
      var by = it.getAttribute('data-by'), from = it.getAttribute('data-srcname') || 'Unsplash';
      var credit = by ? 'Photo: ' + by + ' / ' + from : '';
      if (it.classList.contains('piece-ph')) {
        var no = it.getAttribute('data-no');
        cap.innerHTML = '<b>' + esc(it.getAttribute('data-cap')) + '  ·  Style ' + esc(no) + '  ·  from &#8377;' + esc(Number(it.getAttribute('data-price')).toLocaleString('en-IN')) + '</b>' +
          '<small>' + esc(it.getAttribute('data-fabric')) + '  ·  ' + esc(it.getAttribute('data-weeks')) + ' weeks</small>' +
          '<small>' + esc(it.getAttribute('data-sub')) + '</small>' +
          '<small><a href="appointment.html?style=' + encodeURIComponent(no) + '">Enquire about this piece</a>' + (credit ? '  ·  ' + esc(credit) + '. Illustrative photo.' : '') + '</small>';
      } else {
        cap.textContent = it.getAttribute('data-cap') + (credit ? '  ·  ' + credit : '');
      }
    };
    var open = function (el) { collect(); last = document.activeElement; lb.hidden = false; document.body.style.overflow = 'hidden'; show(Math.max(0, list.indexOf(el))); $('.lb-close', lb).focus(); };
    var close = function () { lb.hidden = true; document.body.style.overflow = ''; if (last) last.focus(); };
    document.addEventListener('click', function (e) { var t = e.target.closest ? e.target.closest(sel) : null; if (t) open(t); });
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', function () { show(idx - 1); });
    $('.lb-next', lb).addEventListener('click', function () { show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target === stage) close(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') show(idx - 1); else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'Tab') { var f = $$('button, a', lb), a = document.activeElement; if (e.shiftKey && a === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && a === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } }
    });
  }

  // ----- Appointment form -----
  var form = $('#res-form');
  if (form) {
    var F = { name: $('#r-name'), phone: $('#r-phone'), date: $('#r-date'), time: $('#r-time'), service: $('#r-service'), style: $('#r-style'), event: $('#r-event'), budget: $('#r-budget'), notes: $('#r-notes') };
    var params = new URLSearchParams(location.search);
    setDateMin(F.date); setDateMin(F.event);
    fillSlots(F.time, nowParts().date);
    var qs = (params.get('style') || '').toUpperCase();
    if (/^EZ-\d{3}$/.test(qs)) {
      F.style.value = qs;
    }
    F.date.addEventListener('change', function () { fillSlots(F.time, F.date.value || nowParts().date, F.time.value); validateOne('date'); });

    var rules = {
      name: function (v) { return v.trim().length < 2 ? 'Please tell us your name.' : ''; },
      phone: function (v) {
        var d = v.replace(/[\s\-()]/g, '').replace(/^\+?91/, '').replace(/^0/, '');
        return /^[6-9]\d{9}$/.test(d) ? '' : 'Enter a 10-digit mobile number, for example 98400 12345.';
      },
      date: function (v) {
        if (!v) return 'Choose a date.';
        if (v < nowParts().date) return 'That date has passed. Please choose today or later.';
        if (dayOf(v) === CONFIG.closedDay) return 'We are closed on Sundays. Please choose another day.';
        return '';
      },
      time: function (v) { return v ? '' : 'Choose a time.'; },
      service: function (v) { return v ? '' : 'Choose what the fitting is for.'; }
    };
    var KEYS = ['name', 'phone', 'date', 'time', 'service'];
    var setErr = function (key, msg) {
      var f = F[key], wrap = f.closest('.field'), e = $('.err', wrap);
      wrap.setAttribute('data-invalid', msg ? 'true' : 'false');
      f.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (e) e.textContent = msg;
      return msg;
    };
    var validateOne = function (key) { return setErr(key, rules[key](F[key].value)); };
    KEYS.forEach(function (k) {
      F[k].addEventListener('blur', function () { if (F[k].value || F[k].closest('.field').getAttribute('data-invalid') === 'true') validateOne(k); });
      F[k].addEventListener('input', function () { if (F[k].closest('.field').getAttribute('data-invalid') === 'true') validateOne(k); });
      F[k].addEventListener('change', function () { if (F[k].closest('.field').getAttribute('data-invalid') === 'true') validateOne(k); });
    });

    var success = $('#res-success'), card = $('#res-card');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      KEYS.forEach(function (k) { if (validateOne(k) && !firstBad) firstBad = F[k]; });
      if (firstBad) { firstBad.focus(); return; }
      var data = {
        name: F.name.value.trim(), phone: F.phone.value.trim(), date: F.date.value, time: F.time.value, service: F.service.value,
        style: F.style.value.trim(), event: F.event.value, budget: F.budget.value, notes: F.notes.value.trim()
      };
      var ref = 'EZ-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      var btn = $('button[type=submit]', form); btn.disabled = true; btn.textContent = 'Sending...';
      var finish = function (sent) {
        $('#s-name').textContent = data.name.split(' ')[0];
        $('#s-date').textContent = prettyDate(data.date);
        $('#s-time').textContent = fmt12(data.time);
        $('#s-service').textContent = data.service;
        $('#s-ref').textContent = ref;
        $('#s-style-row').hidden = !data.style; $('#s-style').textContent = data.style;
        $('#s-demo').hidden = sent;
        form.hidden = true; success.hidden = false;
        $('h2', success).setAttribute('tabindex', '-1'); $('h2', success).focus();
        card.scrollIntoView({ block: 'start' });
      };
      if (CONFIG.endpoint) {
        data.reference = ref;
        fetch(CONFIG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) })
          .then(function (r) { if (!r.ok) throw new Error('bad'); finish(true); })
          .catch(function () { btn.disabled = false; btn.textContent = 'Request this fitting'; $('#res-fail').hidden = false; });
      } else {
        setTimeout(function () { finish(false); }, 400);
      }
    });
    var again = $('#res-again');
    if (again) again.addEventListener('click', function () {
      form.reset(); form.hidden = false; success.hidden = true;
      var btn = $('button[type=submit]', form); btn.disabled = false; btn.textContent = 'Request this fitting';
      fillSlots(F.time, nowParts().date); setDateMin(F.date);
      $('#res-fail').hidden = true;
      F.name.focus();
    });
  }

  // ----- Year -----
  $$('[data-year]').forEach(function (e) { e.textContent = new Date().getFullYear(); });
})();
