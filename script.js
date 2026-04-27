const STORAGE_KEY = 'trackflow_pro_data_v3';

const entryForm = document.getElementById('entryForm');
const clearAllBtn = document.getElementById('clearAll');

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
const tffrsUrlInput = document.getElementById('tffrsUrl');
const milesplitUrlInput = document.getElementById('milesplitUrl');
const openTffrs = document.getElementById('openTffrs');
const openMileSplit = document.getElementById('openMileSplit');
const profileMessage = document.getElementById('profileMessage');

const totalEntries = document.getElementById('totalEntries');
const eventCount = document.getElementById('eventCount');
const bestPR = document.getElementById('bestPR');
const bestPREvent = document.getElementById('bestPREvent');
const eventFilter = document.getElementById('eventFilter');

const meetFeed = document.getElementById('meetFeed');
const practiceFeed = document.getElementById('practiceFeed');
const meetEmpty = document.getElementById('meetEmpty');
const practiceEmpty = document.getElementById('practiceEmpty');

const prBoard = document.getElementById('prBoard');
const prEmpty = document.getElementById('prEmpty');

const canvas = document.getElementById('progressChart');
const ctx = canvas.getContext('2d');

const today = new Date().toISOString().split('T')[0];
entryDateInput.value = today;

let entryType = 'meet';
let entries = loadData();
let profiles = loadProfiles();

render();
renderProfiles();
setEntryMode('meet');

meetTypeBtn.addEventListener('click', () => setEntryMode('meet'));
practiceTypeBtn.addEventListener('click', () => setEntryMode('practice'));

eventFilter.addEventListener('change', renderChart);

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
  totalEntries.textContent = String(entries.length);
  eventCount.textContent = String(new Set(meetEntries.map((entry) => entry.event)).size);

  const top = findGlobalPR(meetEntries);
  if (!top) {
    bestPR.textContent = '—';
    bestPREvent.textContent = 'No results yet';
    return;
  }
  bestPR.textContent = top.result;
  bestPREvent.textContent = `${top.event} • ${formatDate(top.date)}`;
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
    if (!Number.isNaN(a) && (Number.isNaN(b) || a < b)) byEvent.set(entry.event, entry);
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
      <p class="micro">${formatDate(entry.date)}</p>
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
    meetFeed.appendChild(feedItem(`
      <div class="feed-head">
        <span>${entry.event}</span>
        <span>${formatDate(entry.date)}</span>
      </div>
      <p class="feed-result">${entry.result}</p>
    `));
  });

  practiceEntries.forEach((entry) => {
    practiceFeed.appendChild(feedItem(`
      <div class="feed-head">
        <span>${entry.session}</span>
        <span>${formatDate(entry.date)}</span>
      </div>
      <p class="feed-result">${entry.metric}: ${entry.value}</p>
    `));
  });
}

function feedItem(content) {
  const li = document.createElement('li');
  li.className = 'feed-item';
  li.innerHTML = content;
  return li;
}

function renderChart() {
  const filter = eventFilter.value;
  const meetEntries = entries.filter((entry) => entry.type === 'meet');
  const filtered = filter && filter !== 'All events'
    ? meetEntries.filter((entry) => entry.event === filter)
    : meetEntries;

  const points = [...filtered]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-8)
    .map((entry) => parseNumeric(entry.result))
    .filter((point) => !Number.isNaN(point));

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!points.length) {
    drawChartMessage('No numeric meet data for selected event.');
    return;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const left = 10;
  const bottom = canvas.height - 16;
  const h = canvas.height - 30;
  const barGap = 8;
  const w = (canvas.width - left * 2 - barGap * (points.length - 1)) / points.length;

  points.forEach((value, index) => {
    const normalized = (value - min) / range;
    const barHeight = 22 + normalized * (h - 22);
    const x = left + index * (w + barGap);
    const y = bottom - barHeight;

    ctx.fillStyle = index === points.length - 1 ? '#d91515' : '#b9bec7';
    roundedRect(ctx, x, y, w, barHeight, 6);
    ctx.fill();
  });

  ctx.fillStyle = '#61666d';
  ctx.font = '12px Inter';
  ctx.fillText(`PR ${min.toFixed(2)}`, 10, 12);
  ctx.fillText(`Latest ${points.at(-1).toFixed(2)}`, canvas.width - 84, 12);
}

function drawChartMessage(message) {
  ctx.fillStyle = '#61666d';
  ctx.font = '13px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  ctx.textAlign = 'left';
}

function findGlobalPR(meetEntries) {
  return meetEntries.reduce((best, current) => {
    if (!best) return current;
    const currentValue = parseNumeric(current.result);
    const bestValue = parseNumeric(best.result);
    if (Number.isNaN(currentValue)) return best;
    if (Number.isNaN(bestValue) || currentValue < bestValue) return current;
    return best;
  }, null);
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
