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
  const meetEntries = entries.filter((entry) => entry.type === 'meet');
  const byEvent = new Map();

  meetEntries.forEach((entry) => {
    const current = byEvent.get(entry.event);
    if (!current) {
      byEvent.set(entry.event, entry);
      return;
    }

    const a = parseNumeric(entry.result);
    const b = parseNumeric(current.result);
    if (isBetterMark(entry.event, a, b)) byEvent.set(entry.event, entry);
  });

  const prList = [...byEvent.values()].sort((a, b) => a.event.localeCompare(b.event));
  prBoard.innerHTML = '';

  if (!prList.length) {
    prEmpty.hidden = false;
    return;
  }

  prEmpty.hidden = true;
  prList.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'pr-item';
    li.innerHTML = `
      <div class="pr-top">
        <span>${entry.event}</span>
        <span class="red">PR</span>
      </div>
      <p class="feed-result red">${entry.result}</p>
      <p class="micro">${formatDate(entry.date)} • ${entry.source.toUpperCase()}</p>
    `;
    prBoard.appendChild(li);
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
  const match = String(value).match(/\d+(\.\d+)?/);
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
  const proxiedUrl = `/api/profile-proxy?url=${encodeURIComponent(profileUrl)}`;
  const response = await fetch(proxiedUrl);
  if (!response.ok) {
    const message = await response.json().catch(() => ({}));
    throw new Error(message.error || `Sync failed with status ${response.status}`);
  }

  const payload = await response.json();
  const html = payload.html || '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = [...doc.querySelectorAll('table')];
  let mapped = tables.flatMap((table) => parseResultTable(table, source));
  if (!mapped.length) {
    mapped = parseFallbackFromText(doc.body?.innerText || '', source);
  }

  return mapped;
}

function normalizeImportedDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return today;
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
  return /\b(\d{2,4}m|hurdles?|relay|jump|put|vault|steeple|mile|discus|javelin|hammer)\b/i.test(value);
}

function isResultLike(value) {
  if (/^(19|20)\d{2}$/.test(value.trim())) return false;
  return /^(\d{1,2}:\d{1,2}(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:s|m|ft|in|\"|'|pts)?)$/i.test(value)
    || /^\d+(?:\.\d+)?$/.test(value);
}

function parseResultTable(table, source) {
  const rows = [...table.querySelectorAll('tr')]
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cleanText(cell.textContent || '')))
    .filter((cells) => cells.some(Boolean));
  if (!rows.length) return [];

  const headerRowIndex = rows.findIndex((cells) => cells.some((cell) => /(event|discipline|mark|result|performance|date)/i.test(cell)));
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

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!isDateLike(line)) continue;
    const neighborhood = lines.slice(Math.max(0, index - 5), Math.min(lines.length, index + 6));
    const event = neighborhood.find((item) => isEventLike(item) && !isResultLike(item) && !/^pr$/i.test(item));
    const result = neighborhood.find((item) => isResultLike(item));
    if (!event || !result) continue;

    imported.push({
      id: crypto.randomUUID(),
      type: 'meet',
      source,
      event,
      result,
      date: normalizeImportedDate(line),
      createdAt: Date.now(),
    });
  }

  return dedupeImported(imported);
}

function dedupeImported(list) {
  const seen = new Set();
  return list.filter((entry) => {
    const key = entryKey(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
