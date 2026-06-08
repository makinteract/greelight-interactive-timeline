function fit(){
  var tracks=[].slice.call(document.querySelectorAll('.track'));
  var s=1;
  tracks.forEach(function(t){
    var inner=t.querySelector('.track-inner');
    inner.style.transform='none';
    s=Math.min(s, t.clientWidth/inner.scrollWidth);
  });
  tracks.forEach(function(t){
    var inner=t.querySelector('.track-inner');
    inner.style.transformOrigin='left top';
    inner.style.transform='scale('+s+')';
    t.style.height=(inner.offsetHeight*s)+'px';
  });
}

/* ---------- Rendering from data.json ---------- */
function weekLabel(n){ return 'W' + String(n).padStart(2,'0'); }

function resolveNow(debug){
  if(debug && debug.enabled && debug.fakeDate) return new Date(debug.fakeDate + 'T00:00:00');
  return new Date();
}

function eventDate(section, ev){
  var d = new Date(section.startDate + 'T00:00:00');
  d.setDate(d.getDate() + (ev.week - 1) * 7);
  return d;
}

function el(tag, className, text){
  var e = document.createElement(tag);
  if(className) e.className = className;
  if(text != null) e.textContent = text;
  return e;
}

function buildNode(ev, isPast){
  var isMilestone = ev.type === 'milestone';
  var className = isMilestone ? 'node milestone' : 'node event ' + ev.type;
  if(isPast) className += ' past';
  var node = el('div', className);
  if(ev.url) node.dataset.url = ev.url;
  if(ev.notes) node.dataset.notes = ev.notes;
  var weekTag = el('span', 'week-tag', weekLabel(ev.week));
  var name = el('span', 'name', ev.content);
  if(isMilestone){
    node.setAttribute('data-screen-label', ev.content);
    node.appendChild(el('span', 'marker'));
    node.appendChild(name);
    node.appendChild(weekTag);
  } else {
    node.appendChild(weekTag);
    node.appendChild(name);
  }
  return node;
}

function buildArrow(prevWeek, week){
  var diff = week - prevWeek;
  var soft = diff === 0;
  var label = soft ? 'same week' : (diff + ' wk' + (diff===1 ? '' : 's'));
  var arrow = el('div', 'arrow' + (soft ? ' soft' : ''));
  arrow.appendChild(el('span','line'));
  arrow.appendChild(el('span','head'));
  arrow.appendChild(el('span','lab', label));
  return arrow;
}

function buildSection(section, index, now){
  var sectionEl = el('section', 'section');

  var head = el('div', 'section-head');
  head.appendChild(el('span', 'sec-num', String(index+1).padStart(2,'0')));
  head.appendChild(el('h2', null, section.title));
  head.appendChild(el('span', 'sec-rule'));
  head.appendChild(el('span', 'sec-weeks', 'W01 – ' + weekLabel(section.weeks)));
  sectionEl.appendChild(head);

  var inner = el('div', 'track-inner');
  section.events.forEach(function(ev, i){
    if(i > 0) inner.appendChild(buildArrow(section.events[i-1].week, ev.week));
    var isPast = section.startDate ? eventDate(section, ev) < now : false;
    inner.appendChild(buildNode(ev, isPast));
  });
  var track = el('div', 'track');
  track.appendChild(inner);
  sectionEl.appendChild(track);

  return sectionEl;
}

function renderSections(data){
  var now = resolveNow(data.debug);
  var wrap = document.querySelector('.wrap');
  var legend = wrap.querySelector('.legend');
  data.sections.forEach(function(section, i){
    wrap.insertBefore(buildSection(section, i, now), legend);
  });
}

/* ---------- Interactivity ---------- */
function setupInteractivity(){
  var nodes  = [].slice.call(document.querySelectorAll('.node'));
  var arrows = [].slice.call(document.querySelectorAll('.arrow'));
  var legendItems = [].slice.call(document.querySelectorAll('.legend .item[data-filter]'));
  var detail = document.getElementById('detail');
  var filters = {};
  var selected = null;

  function catInfo(node){
    if(node.classList.contains('milestone'))    return {key:'milestone',    label:'Milestone',    color:'#FF5A2C'};
    if(node.classList.contains('presentation'))  return {key:'presentation', label:'Presentation', color:'#DCE8FF'};
    if(node.classList.contains('submission'))    return {key:'submission',   label:'Submission',   color:'#14B457'};
    return {key:'plain', label:'Other', color:'#ffffff'};
  }
  function nameOf(node){ var n=node.querySelector('.name'); return n?n.textContent.replace(/\s+/g,' ').trim():''; }
  function weekOf(node){ var w=node.querySelector('.week-tag'); return w?w.textContent.trim():''; }
  function phaseOf(node){ var s=node.closest('.section'); var h=s&&s.querySelector('h2'); return h?h.textContent.trim():''; }

  function anyFilter(){ for(var k in filters){ if(filters[k]) return true; } return false; }

  function applyState(){
    nodes.forEach(function(n){ n.classList.remove('dim'); n.classList.toggle('is-selected', n===selected); });
    arrows.forEach(function(a){ a.classList.remove('dim'); });
    if(selected){
      nodes.forEach(function(n){ if(n!==selected) n.classList.add('dim'); });
      arrows.forEach(function(a){ a.classList.add('dim'); });
    } else if(anyFilter()){
      nodes.forEach(function(n){ if(!filters[catInfo(n).key]) n.classList.add('dim'); });
      arrows.forEach(function(a){ a.classList.add('dim'); });
    }
  }

  function showDetail(node){
    var c = catInfo(node);
    var week = weekOf(node);
    var num = parseInt(week.replace(/\D/g,''),10);
    var into = (num>1) ? (num-1)+' week'+((num-1)===1?'':'s')+' in' : 'semester start';
    document.getElementById('dDot').style.background = c.color;
    document.getElementById('dCat').textContent = c.label;
    document.getElementById('dName').textContent = nameOf(node);
    document.getElementById('dWeek').textContent = week + ' · ' + into;
    document.getElementById('dSem').textContent = phaseOf(node);
    document.getElementById('dNotes').innerHTML = node.dataset.notes || '—';
    detail.classList.add('show');
  }
  function hideDetail(){ detail.classList.remove('show'); }

  function syncLegend(){
    legendItems.forEach(function(li){ li.classList.toggle('is-on', !!filters[li.getAttribute('data-filter')]); });
  }

  function selectNode(node){
    if(selected===node){ clearAll(); return; }
    selected = node; filters = {}; syncLegend(); showDetail(node); applyState();
  }
  function toggleFilter(key){
    selected = null; hideDetail();
    filters[key] = !filters[key];
    syncLegend(); applyState();
  }
  function clearAll(){ selected=null; filters={}; hideDetail(); syncLegend(); applyState(); }

  nodes.forEach(function(n){
    n.tabIndex = 0; n.setAttribute('role','button');
    var url = n.dataset.url;
    if(url){
      n.setAttribute('role','link');
      n.setAttribute('title','Open '+url);
      n.setAttribute('aria-label', nameOf(n)+' — opens '+url);
    }
    n.addEventListener('click', function(e){
      e.stopPropagation();
      if(url){ window.open(url,'_blank','noopener'); return; }
      selectNode(n);
    });
    n.addEventListener('keydown', function(e){
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();
        if(url){ window.open(url,'_blank','noopener'); return; }
        selectNode(n);
      }
    });
  });
  legendItems.forEach(function(li){
    var key = li.getAttribute('data-filter');
    li.addEventListener('click', function(e){ e.stopPropagation(); toggleFilter(key); });
    li.addEventListener('keydown', function(e){
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggleFilter(key); }
    });
  });
  document.getElementById('detailClose').addEventListener('click', function(e){ e.stopPropagation(); clearAll(); });
  document.addEventListener('click', function(){ clearAll(); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') clearAll(); });
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', function(){
  fetch('data.json', { cache: 'no-store' })
    .then(function(r){ return r.json(); })
    .then(function(data){
      renderSections(data);
      window.addEventListener('resize', fit);
      window.addEventListener('load', fit);
      if(document.fonts && document.fonts.ready){ document.fonts.ready.then(fit); }
      fit();
      setupInteractivity();
    });
});
