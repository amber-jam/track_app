const STORAGE_KEY = 'trackflow_pro_data_v3';

const entryForm = document.getElementById('entryForm');
const clearAllBtn = document.getElementById('clearAllTop');

const meetTypeBtn = document.getElementById('meetTypeBtn');
const practiceTypeBtn = document.getElementById('practiceTypeBtn');
const meetFields = document.getElementById('meetFields');
const practiceFields = document.getElementById('practiceFields');
const saveEntryBtn = document.getElementById('saveEntryBtn');

const eventInput = document.getElementById('event');
const resultInput = document.getElementById('result');
const entryDateInput = document.getElementById('entryDate');

const sessionInput = document.getElementById('session');
const metricInput = document.getElementById('metric');
const metricValueInput = document.getElementById('metricValue');

const profileForm = document.getElementById('profileForm');
const syncProfilesBtn = document.getElementById('syncProfilesBtn');
const tffrsUrlInput = document.getElementById('tffrsUrl');
const milesplitUrlInput = document.getElementById('milesplitUrl');
const openTffrs = document.getElementById('openTffrs');
const openMileSplit = document.getElementById('openMileSplit');
const profileMessage = document.getElementById('profileMessage');

const totalEntries = document.getElementById('totalEntries');
const eventCount = document.getElementById('eventCount');
const bestPR = document.getElementById('bestPR');
const bestPREvent = document.getElementById('bestPREvent');
const mainEventSelect = document.getElementById('mainEventSelect');
const eventFilter = document.getElementById('eventFilter');

const meetFeed = document.getElementById('meetFeed');
const practiceFeed = document.getElementById('practiceFeed');
const meetEmpty = document.getElementById('meetEmpty');
const practiceEmpty = document.getElementById('practiceEmpty');

const prBoard = document.getElementById('prBoard');
const prEmpty = document.getElementById('prEmpty');

const canvas = document.getElementById('progressChart');
const ctx = canvas.getContext('2d');
const chartTooltip = document.getElementById('chartTooltip');

const today = new Date().toISOString().split('T')[0];
entryDateInput.value = today;

let entryType = 'meet';
let entries = loadData();
let profiles = loadProfiles();
let preferences = loadPreferences();
let chartPoints = [];

render();
renderProfiles();
setEntryMode('meet');
configureCanvas();

meetTypeBtn.addEventListener('click', () => setEntryMode('meet'));
practiceTypeBtn.addEventListener('click', () => setEntryMode('practice'));

eventFilter.addEventListener('change', renderChart);
mainEventSelect.addEventListener('change', () => {
  preferences.mainEvent = mainEventSelect.value;
  persistPreferences();
  renderSummary();
});
canvas.addEventListener('mousemove', onChartHover);
canvas.addEventListener('mouseleave', () => chartTooltip.classList.add('hidden'));
canvas.addEventListener('click', onChartClick);
window.addEventListener('resize', () => {
  configureCanvas();
  renderChart();
});

profileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  profiles = {
    tffrs: tffrsUrlInput.value.trim(),
    milesplit: milesplitUrlInput.value.trim(),
  };
  localStorage.setItem('trackflow_profiles', JSON.stringify(profiles));
  profileMessage.textContent = 'Profile links saved.';
  renderProfiles();
});

syncProfilesBtn.addEventListener('click', async () => {
  profileMessage.textContent = 'Syncing profile data...';
  const syncedEntries = [];

  try {
    if (profiles.tffrs) syncedEntries.push(...await syncSiteEntries('tffrs', profiles.tffrs));
    if (profiles.milesplit) syncedEntries.push(...await syncSiteEntries('milesplit', profiles.milesplit));

    if (!syncedEntries.length) {
      profileMessage.textContent = 'No meet results were found during sync.';
      return;
    }

    console.log('[syncProfilesBtn] parsedResultsBeforeMerge', syncedEntries);
    const existingKeys = new Set(entries.filter((entry) => entry.type === 'meet').map((entry) => entryKey(entry)));
    const deduped = syncedEntries.filter((entry) => !existingKeys.has(entryKey(entry)));

    entries = [...deduped, ...entries];
    persist();
    render();
    profileMessage.textContent = `Synced ${deduped.length} new meet results.`;
  } catch (error) {
    profileMessage.textContent = error?.message || 'Unable to sync profile data right now. Try again later.';
  }
});

entryForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (entryType === 'meet') {
    if (!eventInput.value || !resultInput.value.trim()) {
      return;
    }

    entries.unshift({
      id: crypto.randomUUID(),
      type: 'meet',
      source: 'manual',
      event: eventInput.value,
      result: resultInput.value.trim(),
      date: entryDateInput.value,
      createdAt: Date.now(),
    });
  } else {
    if (!sessionInput.value.trim() || !metricInput.value.trim() || !metricValueInput.value.trim()) {
      return;
    }

    entries.unshift({
      id: crypto.randomUUID(),
      type: 'practice',
      source: 'manual',
      session: sessionInput.value.trim(),
      metric: metricInput.value.trim(),
      value: metricValueInput.value.trim(),
      date: entryDateInput.value,
      createdAt: Date.now(),
    });
  }

  persist();
  clearTypeFields();
  entryDateInput.value = today;
  render();
});

clearAllBtn.addEventListener('click', () => {
  entries = [];
  persist();
  render();
});

function setEntryMode(mode) {
  entryType = mode;
  const isMeet = mode === 'meet';

  meetTypeBtn.classList.toggle('active', isMeet);
  practiceTypeBtn.classList.toggle('active', !isMeet);

  meetFields.classList.toggle('hidden', !isMeet);
  practiceFields.classList.toggle('hidden', isMeet);

  eventInput.required = isMeet;
  resultInput.required = isMeet;
  sessionInput.required = !isMeet;
  metricInput.required = !isMeet;
  metricValueInput.required = !isMeet;

  saveEntryBtn.textContent = isMeet ? 'Save Meet Result' : 'Save Practice Set';
}

function clearTypeFields() {
  eventInput.value = '';
  resultInput.value = '';
  sessionInput.value = '';
  metricInput.value = '';
  metricValueInput.value = '';
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadProfiles() {
  const raw = localStorage.getItem('trackflow_profiles');
  if (!raw) return { tffrs: '', milesplit: '' };
  try {
    const parsed = JSON.parse(raw);
    return {
      tffrs: parsed.tffrs || '',
      milesplit: parsed.milesplit || '',
    };
  } catch {
    return { tffrs: '', milesplit: '' };
  }
}

function loadPreferences() {
  const raw = localStorage.getItem('trackflow_preferences');
  if (!raw) return { mainEvent: '' };
  try {
    const parsed = JSON.parse(raw);
    return { mainEvent: parsed.mainEvent || '' };
  } catch {
    return { mainEvent: '' };
  }
}

function persistPreferences() {
  localStorage.setItem('trackflow_preferences', JSON.stringify(preferences));
}

function renderProfiles() {
  tffrsUrlInput.value = profiles.tffrs;
  milesplitUrlInput.value = profiles.milesplit;

  openTffrs.href = profiles.tffrs || '#';
  openMileSplit.href = profiles.milesplit || '#';

  openTffrs.style.pointerEvents = profiles.tffrs ? 'auto' : 'none';
  openMileSplit.style.pointerEvents = profiles.milesplit ? 'auto' : 'none';
  openTffrs.style.opacity = profiles.tffrs ? '1' : '0.45';
  openMileSplit.style.opacity = profiles.milesplit ? '1' : '0.45';
}

function render() {
  renderSummary();
  renderEventFilter();
  renderPRBoard();
  renderFeeds();
  renderChart();
}

function renderSummary() {
  const meetEntries = entries.filter((entry) => entry.type === 'meet');
  const eventNames = [...new Set(meetEntries.map((entry) => entry.event))].sort();
  totalEntries.textContent = String(entries.length);
  eventCount.textContent = String(eventNames.length);
  renderMainEventOptions(eventNames);

  const scopedEntries = preferences.mainEvent
    ? meetEntries.filter((entry) => entry.event === preferences.mainEvent)
    : meetEntries;
  const top = findGlobalPR(scopedEntries);
  if (!top) {
    bestPR.textContent = '—';
    bestPREvent.textContent = 'No results yet';
    return;
  }
  bestPR.textContent = top.result;
  bestPREvent.textContent = `${top.event} • ${formatDate(top.date)}${preferences.mainEvent ? ' • Main Event' : ''}`;
}

function renderMainEventOptions(eventNames) {
  const selected = preferences.mainEvent;
  mainEventSelect.innerHTML = '<option value=\"\">Auto (best overall)</option>';
  eventNames.forEach((eventName) => {
    const option = document.createElement('option');
    option.value = eventName;
    option.textContent = eventName;
    mainEventSelect.appendChild(option);
  });

  if (eventNames.includes(selected)) {
    mainEventSelect.value = selected;
  } else if (selected) {
    preferences.mainEvent = '';
    persistPreferences();
    mainEventSelect.value = '';
  }
}

function renderEventFilter() {
  const meetEntries = entries.filter((entry) => entry.type === 'meet');
  const events = ['All events', ...new Set(meetEntries.map((entry) => entry.event))];
  const selected = eventFilter.value;

  eventFilter.innerHTML = '';
  events.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    eventFilter.appendChild(option);
  });

  if (events.includes(selected)) eventFilter.value = selected;
}

function renderPRBoard() {
  const meetEntries = entries.filter((entry) => entry.type === 'meet' && !isRelayEvent(entry.event));
  const byEvent = new Map();

  meetEntries.forEach((entry) => {
    const normalizedEvent = normalizeEventName(entry.event);
    const eventKey = normalizedEvent;
    const current = byEvent.get(eventKey);
    if (!current) {
      byEvent.set(eventKey, entry);
      return;
    }

    const a = parseNumeric(entry.result);
    const b = parseNumeric(current.result);
    if (isBetterMark(entry.event, a, b) || (a === b && new Date(entry.date) > new Date(current.date))) {
      byEvent.set(eventKey, entry);
    }
  });

  const prList = [...byEvent.values()].sort((a, b) => a.event.localeCompare(b.event));
  prBoard.innerHTML = '';

  if (!prList.length) {
    prEmpty.hidden = false;
    return;
  }

  prEmpty.hidden = true;
  const grouped = groupEventsByCategory(prList);
  Object.entries(grouped).forEach(([category, categoryEntries]) => {
    if (!categoryEntries.length) return;
    const heading = document.createElement('li');
    heading.className = 'group-title';
    heading.textContent = category;
    prBoard.appendChild(heading);

    categoryEntries.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'pr-item';
    li.innerHTML = `
      <div class="pr-top">
        <span>${entry.event}</span>
        <span class="red">PR</span>
      </div>
      <p class="feed-result red">${entry.result}</p>
      <p class="micro">${formatDate(entry.date)} • ${entry.source.toUpperCase()}${entry.season ? ` • ${entry.season}` : ''}</p>
    `;
    prBoard.appendChild(li);
    });
  });
}

function renderFeeds() {
  const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);
  const meetEntries = sorted.filter((entry) => entry.type === 'meet');
  const practiceEntries = sorted.filter((entry) => entry.type === 'practice');

  meetFeed.innerHTML = '';
  practiceFeed.innerHTML = '';

  meetEmpty.hidden = meetEntries.length > 0;
  practiceEmpty.hidden = practiceEntries.length > 0;

  meetEntries.forEach((entry) => {
    meetFeed.appendChild(feedItem(entry.id, `
      <div class="feed-head">
        <span>${entry.event}</span>
        <span>${formatDate(entry.date)}</span>
      </div>
      <p class="feed-result">${entry.result}</p>
      <p class="micro">${entry.source.toUpperCase()}</p>
      <div class="entry-actions">
        <button type="button" class="ghost action-btn" data-action="edit" data-id="${entry.id}">Edit</button>
        <button type="button" class="ghost action-btn" data-action="delete" data-id="${entry.id}">Delete</button>
      </div>
    `));
  });

  practiceEntries.forEach((entry) => {
    practiceFeed.appendChild(feedItem(entry.id, `
      <div class="feed-head">
        <span>${entry.session}</span>
        <span>${formatDate(entry.date)}</span>
      </div>
      <p class="feed-result">${entry.metric}: ${entry.value}</p>
      <div class="entry-actions">
        <button type="button" class="ghost action-btn" data-action="edit" data-id="${entry.id}">Edit</button>
        <button type="button" class="ghost action-btn" data-action="delete" data-id="${entry.id}">Delete</button>
      </div>
    `));
  });

  attachEntryActionHandlers();
}

function feedItem(id, content) {
  const li = document.createElement('li');
  li.className = 'feed-item';
  li.id = `entry-${id}`;
  li.innerHTML = content;
  return li;
}

function renderChart() {
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 180;
  const filter = eventFilter.value;
  const meetEntries = entries.filter((entry) => entry.type === 'meet');
  const filtered = filter && filter !== 'All events'
    ? meetEntries.filter((entry) => entry.event === filter)
    : meetEntries;

  const points = [...filtered]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-8)
    .map((entry) => ({
      entry,
      value: parseNumeric(entry.result),
    }))
    .filter((point) => !Number.isNaN(point.value));

  ctx.clearRect(0, 0, width, height);
  chartPoints = [];
  if (!points.length) {
    drawChartMessage('No numeric meet data for selected event.');
    return;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const left = 14;
  const right = width - 14;
  const top = 20;
  const bottom = height - 20;
  const xStep = points.length === 1 ? 0 : (right - left) / (points.length - 1);

  chartPoints = points.map((point, index) => {
    const normalized = (point.value - min) / range;
    return {
      x: left + xStep * index,
      y: bottom - normalized * (bottom - top),
      value: point.value,
      entry: point.entry,
    };
  });

  ctx.strokeStyle = '#b9bec7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  chartPoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  // Personal best progression line.
  const pbPoints = [];
  let bestSoFar = null;
  chartPoints.forEach((point) => {
    if (bestSoFar === null || isBetterMark(point.entry.event, point.value, bestSoFar)) {
      bestSoFar = point.value;
    }
    const normalized = (bestSoFar - min) / range;
    pbPoints.push({
      x: point.x,
      y: bottom - normalized * (bottom - top),
    });
  });
  ctx.strokeStyle = '#d91515';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  pbPoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  chartPoints.forEach((point, index) => {
    ctx.beginPath();
    ctx.fillStyle = index === chartPoints.length - 1 ? '#d91515' : '#8e96a3';
    ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#61666d';
  ctx.font = '12px Inter';
  ctx.fillText(`PR ${min.toFixed(2)}`, 10, 12);
  ctx.fillText(`Latest ${values.at(-1).toFixed(2)}`, width - 84, 12);
}

function configureCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(320, Math.floor(rect.width || 320));
  const cssHeight = Math.max(180, Math.floor(rect.height || 180));
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

function drawChartMessage(message) {
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 180;
  ctx.fillStyle = '#61666d';
  ctx.font = '13px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(message, width / 2, height / 2);
  ctx.textAlign = 'left';
}

function findGlobalPR(meetEntries) {
  return meetEntries.reduce((best, current) => {
    if (!best) return current;
    const currentValue = parseNumeric(current.result);
    const bestValue = parseNumeric(best.result);
    if (isBetterMark(current.event, currentValue, bestValue)) return current;
    return best;
  }, null);
}

function isBetterMark(eventName, candidateValue, baselineValue) {
  if (Number.isNaN(candidateValue)) return false;
  if (Number.isNaN(baselineValue)) return true;
  const isField = isFieldEvent(eventName);
  return isField ? candidateValue > baselineValue : candidateValue < baselineValue;
}

function isFieldEvent(eventName) {
  const name = String(eventName || '').toLowerCase();
  return ['long jump', 'triple jump', 'high jump', 'shot put'].some((event) => name.includes(event));
}

function parseNumeric(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return NaN;
  if (/^(19|20)\d{2}$/.test(text)) return NaN;

  const timeMatch = text.match(/^(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (timeMatch) {
    return Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
  }

  const feetInchesMatch = text.match(/^(\d{1,2})-(\d{1,2}(?:\.\d+)?)$/);
  if (feetInchesMatch) {
    const feet = Number(feetInchesMatch[1]);
    const inches = Number(feetInchesMatch[2]);
    return feet * 0.3048 + inches * 0.0254;
  }

  const match = text.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function onChartHover(event) {
  if (!chartPoints.length) return;
  const point = nearestPoint(event);
  if (!point) return;

  chartTooltip.textContent = `${point.entry.event}: ${point.entry.result} (${formatDate(point.entry.date)})`;
  chartTooltip.classList.remove('hidden');
  chartTooltip.style.left = `${point.x}px`;
  chartTooltip.style.top = `${point.y}px`;
}

function onChartClick(event) {
  if (!chartPoints.length) return;
  const point = nearestPoint(event);
  if (!point) return;
  const target = document.getElementById(`entry-${point.entry.id}`);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function nearestPoint(mouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const x = mouseEvent.clientX - rect.left;
  const y = mouseEvent.clientY - rect.top;

  let candidate = null;
  let minDistance = Number.POSITIVE_INFINITY;
  chartPoints.forEach((point) => {
    const dx = point.x - x;
    const dy = point.y - y;
    const distance = Math.hypot(dx, dy);
    if (distance < minDistance) {
      minDistance = distance;
      candidate = point;
    }
  });
  return minDistance <= 20 ? candidate : null;
}

async function syncSiteEntries(source, profileUrl) {
  const proxiedUrl = `/api/profile-proxy?url=${encodeURIComponent(profileUrl)}&debug=1`;
  const response = await fetch(proxiedUrl);
  if (!response.ok) {
    const message = await response.json().catch(() => ({}));
    throw new Error(message.error || `Sync failed with status ${response.status}`);
  }

  const payload = await response.json();
  const html = payload.html || '';
  if (payload.debug) {
    console.log('[syncSiteEntries] proxyDebug', payload.debug);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = [...doc.querySelectorAll('table')];
  console.log(`[syncSiteEntries] source=${source} tablesFound=${tables.length} htmlLength=${html.length}`);
  if (tables.length > 0) {
    console.log('[syncSiteEntries] firstTablePreview', (tables[0].innerText || '').slice(0, 1000));
  } else {
    console.log('[syncSiteEntries] no tables found. script tags:', doc.querySelectorAll('script').length);
  }
  const relevantTables = tables.filter((table) => isRelevantPerformanceTable(table));
  console.log(`[syncSiteEntries] relevantTables=${relevantTables.length}`);
  let mapped = relevantTables.flatMap((table) => parsePerformanceTable(table, source));
  if (!mapped.length) {
    mapped = tables.flatMap((table) => parseResultTable(table, source));
  }
  if (!mapped.length) {
    mapped = parseFallbackFromText(doc.body?.innerText || '', source);
  }
  mapped = keepBestPerEventBySeason(mapped);
  console.log('[syncSiteEntries] finalMappedResults', mapped);
  return dedupeImported(mapped.map((entry) => normalizeImportedEntry(entry)).filter(Boolean));
}

function isRelevantPerformanceTable(table) {
  const text = cleanText(table.innerText || '').toUpperCase();
  return /\b(60|100|200|400|800|60H|100H|LJ|TJ|SP|HJ|PENT)\b/.test(text);
}

function parsePerformanceTable(table, source) {
  const rows = [...table.querySelectorAll('tr')];
  const parsed = [];

  rows.forEach((row) => {
    const cells = [...row.querySelectorAll('th, td')].map((cell) => cleanText(cell.textContent || ''));
    if (cells.length < 2) return;
    const eventToken = cells.find((cell) => /\b(60|100|200|400|800|60H|100H|LJ|TJ|SP|HJ|PENT)\b/i.test(cell));
    const markToken = cells.find((cell) => isResultLike(cell));
    if (!eventToken || !markToken) return;

    const windToken = cells.find((cell) => /^\(?[-+]?\d+(\.\d+)?\)?$/.test(cell)) || null;
    const event = normalizeEventName(eventToken);
    const mark = markToken;
    const converted = convertMarkForDisplay(event, mark);
    const dateToken = cells.find((cell) => isDateLike(cell)) || today;

    parsed.push({
      id: crypto.randomUUID(),
      type: 'meet',
      source,
      event,
      result: mark,
      mark,
      wind: windToken,
      converted,
      date: normalizeImportedDate(dateToken),
      season: detectSeason(table, cells),
      createdAt: Date.now(),
    });
  });

  return dedupeImported(parsed);
}

function convertMarkForDisplay(eventName, mark) {
  const value = parseNumeric(mark);
  if (Number.isNaN(value)) return '';
  const event = normalizeEventName(eventName);
  if (/jump|shot put|discus|javelin|hammer/i.test(event)) {
    const totalInches = value / 0.0254;
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches - feet * 12;
    return `${feet}' ${inches.toFixed(2)}"`;
  }
  return '';
}

function normalizeImportedDate(value) {
  if (!isDateLike(String(value || ''))) return today;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return today;
  const year = parsed.getUTCFullYear();
  const currentYear = new Date().getUTCFullYear();
  if (year < 2010 || year > currentYear + 1) return today;
  return parsed.toISOString().split('T')[0];
}

function entryKey(entry) {
  return `${entry.type}|${entry.event || entry.session}|${entry.result || entry.value}|${entry.date}`;
}

function cleanText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function isDateLike(value) {
  return /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(value)
    || /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}\b/i.test(value);
}

function isEventLike(value) {
  return /\b(\d{2,4}m|hurdles?|relay|jump|put|vault|steeple|mile|discus|javelin|hammer|1600|3200)\b/i.test(value);
}

function isResultLike(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  if (/^(19|20)\d{2}$/.test(text)) return false;
  if (/^\d{4}\s*(indoor|outdoor)?$/.test(text)) return false;
  if (text.includes('outdoor') || text.includes('indoor')) return false;
  return /^(\d{1,2}:\d{1,2}(?:\.\d+)?|\d{1,2}-\d{1,2}(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:s|m|ft|in|\"|'|pts)?)$/i.test(text)
    || /^\d+\.\d+$/.test(text);
}

function parseResultTable(table, source) {
  const rows = [...table.querySelectorAll('tr')]
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cleanText(cell.textContent || '')))
    .filter((cells) => cells.some(Boolean));
  if (!rows.length) return [];

  const headerRowIndex = rows.findIndex((cells) => cells.some((cell) => /(event|discipline|mark|result|performance|date|wind)/i.test(cell)));
  const header = (headerRowIndex >= 0 ? rows[headerRowIndex] : rows[0]).map((cell) => cell.toLowerCase());
  const eventIndex = findIndex(header, /(event|discipline)/i);
  const resultIndex = findIndex(header, /(mark|result|time|performance)/i);
  const dateIndex = findIndex(header, /(date)/i);
  const dataRows = rows.slice(headerRowIndex >= 0 ? headerRowIndex + 1 : 1);

  return dataRows
    .map((cells) => {
      const date = dateIndex >= 0 ? cells[dateIndex] : cells.find((part) => isDateLike(part));
      const event = eventIndex >= 0 ? cells[eventIndex] : cells.find((part) => isEventLike(part) && !/^pr$/i.test(part));
      const result = resultIndex >= 0 ? cells[resultIndex] : cells.find((part) => isResultLike(part));
      if (!date || !event || !result) return null;
      if (!isEventLike(event)) return null;
      if (isResultLike(event)) return null;
      if (/^pr$/i.test(event)) return null;

      return {
        id: crypto.randomUUID(),
        type: 'meet',
        source,
        event,
        result,
        date: normalizeImportedDate(date),
        season: detectSeason(table, cells),
        createdAt: Date.now(),
      };
    })
    .filter(Boolean);
}

function findIndex(cells, pattern) {
  return cells.findIndex((cell) => pattern.test(cell));
}

function parseFallbackFromText(text, source) {
  const lines = text.split('\n').map((line) => cleanText(line)).filter(Boolean);
  const imported = [];
  let activeDate = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isDateLike(line) && /[a-z]{3,}\s+\d{1,2}|\/\d{2,4}/i.test(line)) {
      activeDate = line;
      continue;
    }
    if (!activeDate) continue;
    const event = extractEventFromLine(line);
    const result = extractResultFromLine(line);
    if (!event || !isEventLike(event) || !result) continue;

    imported.push({
      id: crypto.randomUUID(),
      type: 'meet',
      source,
      event,
      result,
      date: normalizeImportedDate(activeDate),
      season: detectSeasonFromText(line),
      createdAt: Date.now(),
    });
  }

  return dedupeImported(imported);
}

function extractResultFromLine(line) {
  const match = line.match(/(\d{1,2}:\d{1,2}(?:\.\d+)?|\d+\.\d+\s*m|\d+\.\d+|\d+\s*m)/i);
  if (!match) return '';
  return match[1].trim();
}

function extractEventFromLine(line) {
  const text = cleanText(line);
  const abbreviationMatch = text.match(/\b(LJ|TJ|HJ|SP|PV|DT|JT|HT|60|100|200|400|800|1500|1600|3000|3200|5000)\b/i);
  if (abbreviationMatch) {
    return normalizeEventName(abbreviationMatch[0]);
  }
  const explicitPatterns = [
    /triple jump/i,
    /long jump/i,
    /high jump/i,
    /shot put/i,
    /\b60m\b/i,
    /\b100m\b/i,
    /\b200m\b/i,
    /\b400m\b/i,
    /\b800m\b/i,
    /\b1500m\b/i,
    /\b1600m\b/i,
    /\b3000m\b/i,
    /\b3200m\b/i,
    /\b5000m\b/i,
    /hurdles?/i,
    /relay/i,
  ];

  const match = explicitPatterns.find((pattern) => pattern.test(text));
  if (!match) return '';
  const extracted = text.match(match);
  return extracted ? normalizeEventName(extracted[0]) : '';
}

function keepBestPerEventBySeason(list) {
  const bestMap = new Map();
  list.forEach((entry) => {
    const key = `${normalizeEventName(entry.event)}|${entry.season || ''}`;
    const existing = bestMap.get(key);
    if (!existing) {
      bestMap.set(key, entry);
      return;
    }
    const candidateValue = parseNumeric(entry.result);
    const existingValue = parseNumeric(existing.result);
    if (isBetterMark(entry.event, candidateValue, existingValue)) {
      bestMap.set(key, entry);
    }
  });
  return [...bestMap.values()];
}

function dedupeImported(list) {
  const seen = new Set();
  return list.filter((entry) => {
    const key = `${entryKey(entry)}|${entry.season || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeImportedEntry(entry) {
  const event = normalizeEventName(entry.event);
  if (!event || isRelayEvent(event)) return null;
  const resultText = String(entry.result || '').toLowerCase();
  if (/jump|shot put|discus|javelin|hammer/i.test(event) && resultText.includes(':')) return null;
  const value = parseNumeric(entry.result);
  if (!isPlausibleMark(event, value)) return null;
  const normalizedDate = normalizeImportedDate(entry.date);
  return {
    ...entry,
    event,
    date: normalizedDate,
  };
}

function normalizeEventName(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('4x') || raw.includes('relay')) return 'Relay';
  if (raw === 'lj') return 'Long Jump';
  if (raw === 'tj') return 'Triple Jump';
  if (raw === 'hj') return 'High Jump';
  if (raw === 'sp') return 'Shot Put';
  if (raw === 'pv') return 'Pole Vault';
  if (raw === 'jt') return 'Javelin';
  if (raw === 'dt') return 'Discus';
  if (raw === 'ht') return 'Hammer';
  if (raw === '60') return '60m';
  if (raw === '100') return '100m';
  if (raw === '200') return '200m';
  if (raw === '400') return '400m';
  if (raw === '800') return '800m';
  if (raw === '1500') return '1500m';
  if (raw === '1600') return '1600m';
  if (raw === '3000') return '3000m';
  if (raw === '3200') return '3200m';
  if (raw === '5000') return '5000m';
  if (raw === '60h' || raw.includes('60h')) return '60H';
  if (raw === '100h' || raw.includes('100h')) return '100H';
  if (raw.includes('pent')) return 'PENT';
  if (raw.includes('triple')) return 'Triple Jump';
  if (raw.includes('long jump')) return 'Long Jump';
  if (raw.includes('high jump')) return 'High Jump';
  if (raw.includes('shot')) return 'Shot Put';
  if (raw.match(/\b100m\b/)) return '100m';
  if (raw.match(/\b200m\b/)) return '200m';
  if (raw.match(/\b400m\b/)) return '400m';
  if (raw.match(/\b800m\b/)) return '800m';
  if (raw.match(/\b1500m\b/)) return '1500m';
  if (raw.match(/\b3000m\b/)) return '3000m';
  if (raw.match(/\b5000m\b/)) return '5000m';
  if (raw.match(/\b1600m?\b/)) return '1600m';
  if (raw.match(/\b3200m?\b/)) return '3200m';
  if (raw.match(/\b60m\b/)) return '60m';
  if (raw.match(/\b100\s*meters?\b/)) return '100m';
  if (raw.match(/\b200\s*meters?\b/)) return '200m';
  return value;
}

function isRelayEvent(eventName) {
  return /relay|4x|4×/i.test(String(eventName || ''));
}

function isPlausibleMark(eventName, value) {
  if (Number.isNaN(value)) return false;
  const event = normalizeEventName(eventName);
  const limits = {
    'Triple Jump': [8, 20],
    'Long Jump': [4, 10],
    'High Jump': [1.2, 2.7],
    'Shot Put': [6, 26],
    '100m': [9, 20],
    '200m': [19, 45],
    '400m': [42, 90],
    '800m': [100, 240],
    '1500m': [200, 500],
    '3000m': [400, 900],
    '5000m': [700, 1500],
    '1600m': [220, 600],
    '3200m': [500, 1400],
    '60m': [6, 12],
  };
  const range = limits[event];
  return range ? value >= range[0] && value <= range[1] : true;
}

function groupEventsByCategory(entriesList) {
  const categories = {
    Jumps: [],
    Sprints: [],
    Throws: [],
    Relays: [],
    Other: [],
  };
  entriesList.forEach((entry) => {
    const event = normalizeEventName(entry.event);
    if (/jump/i.test(event)) categories.Jumps.push(entry);
    else if (/shot|discus|javelin|hammer/i.test(event)) categories.Throws.push(entry);
    else if (/relay|4x|4×/i.test(event)) categories.Relays.push(entry);
    else if (/\b(60m|100m|200m|400m|800m|1500m|3000m|5000m)\b/i.test(event)) categories.Sprints.push(entry);
    else categories.Other.push(entry);
  });
  return categories;
}


function detectSeason(table, cells) {
  const tableText = cleanText(table.textContent || '');
  const cellText = cleanText(cells.join(' '));
  return detectSeasonFromText(`${tableText} ${cellText}`);
}

function detectSeasonFromText(text) {
  if (/indoor/i.test(text)) return 'Indoor';
  if (/outdoor/i.test(text)) return 'Outdoor';
  return '';
}

function attachEntryActionHandlers() {
  document.querySelectorAll('.action-btn').forEach((button) => {
    button.addEventListener('click', onEntryActionClick);
  });
}

function onEntryActionClick(event) {
  const action = event.currentTarget.dataset.action;
  const id = event.currentTarget.dataset.id;
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  if (action === 'delete') {
    entries = entries.filter((item) => item.id !== id);
    persist();
    render();
    return;
  }

  if (action === 'edit') {
    if (entry.type === 'meet') {
      const nextEvent = window.prompt('Event', entry.event);
      if (!nextEvent) return;
      const nextResult = window.prompt('Result', entry.result);
      if (!nextResult) return;
      const nextDate = window.prompt('Date (YYYY-MM-DD)', entry.date);
      if (!nextDate) return;
      entry.event = nextEvent.trim();
      entry.result = nextResult.trim();
      entry.date = nextDate.trim();
    } else {
      const nextSession = window.prompt('Session', entry.session);
      if (!nextSession) return;
      const nextMetric = window.prompt('Metric', entry.metric);
      if (!nextMetric) return;
      const nextValue = window.prompt('Value', entry.value);
      if (!nextValue) return;
      const nextDate = window.prompt('Date (YYYY-MM-DD)', entry.date);
      if (!nextDate) return;
      entry.session = nextSession.trim();
      entry.metric = nextMetric.trim();
      entry.value = nextValue.trim();
      entry.date = nextDate.trim();
    }

    entry.createdAt = Date.now();
    persist();
    render();
  }
}
