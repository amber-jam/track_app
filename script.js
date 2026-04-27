const STORAGE_KEY = 'trackflow_pro_data_v2';

const meetForm = document.getElementById('meetForm');
const practiceForm = document.getElementById('practiceForm');
const importForm = document.getElementById('importForm');
const clearAllBtn = document.getElementById('clearAll');

const eventInput = document.getElementById('event');
const resultInput = document.getElementById('result');
const meetDateInput = document.getElementById('meetDate');

const sessionInput = document.getElementById('session');
const metricInput = document.getElementById('metric');
const metricValueInput = document.getElementById('metricValue');
const practiceDateInput = document.getElementById('practiceDate');

const importSource = document.getElementById('importSource');
const importFile = document.getElementById('importFile');
const importMessage = document.getElementById('importMessage');

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

const STORAGE_KEY = 'trackflow_performances';

const form = document.getElementById('performanceForm');
const eventField = document.getElementById('event');
const resultField = document.getElementById('result');
const dateField = document.getElementById('date');
const feed = document.getElementById('feed');
const emptyState = document.getElementById('emptyState');
const clearBtn = document.getElementById('clearBtn');
const prEvent = document.getElementById('prEvent');
const prResult = document.getElementById('prResult');
const prDate = document.getElementById('prDate');
const canvas = document.getElementById('progressChart');
const ctx = canvas.getContext('2d');

const today = new Date().toISOString().split('T')[0];
meetDateInput.value = today;
practiceDateInput.value = today;

let entries = loadData();
render();

meetForm.addEventListener('submit', (event) => {
  event.preventDefault();
  entries.unshift({
    id: crypto.randomUUID(),
    type: 'meet',
    source: 'manual',
    event: eventInput.value,
    result: resultInput.value.trim(),
    date: meetDateInput.value,
    createdAt: Date.now(),
  });
  persist();
  meetForm.reset();
  meetDateInput.value = today;
  render();
});

practiceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  entries.unshift({
    id: crypto.randomUUID(),
    type: 'practice',
    source: 'manual',
    session: sessionInput.value.trim(),
    metric: metricInput.value.trim(),
    value: metricValueInput.value.trim(),
    date: practiceDateInput.value,
    createdAt: Date.now(),
  });
  persist();
  practiceForm.reset();
  practiceDateInput.value = today;
  render();
});

importForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!importFile.files?.[0]) {
    setImportMessage('Choose a CSV file first.', true);
    return;
  }

  try {
    const csvText = await importFile.files[0].text();
    const rows = parseCSV(csvText);
    if (!rows.length) {
      setImportMessage('No rows found in CSV.', true);
      return;
    }

    const mapped = mapImportedRows(importSource.value, rows);
    if (!mapped.length) {
      setImportMessage('Could not map rows. Verify required columns.', true);
      return;
    }

    entries = [...mapped, ...entries];
    persist();
    importForm.reset();
    setImportMessage(`Imported ${mapped.length} entries from ${importSource.value.toUpperCase()}.`, false);
    render();
  } catch {
    setImportMessage('Import failed. Please use a valid CSV export.', true);
  }
});

clearAllBtn.addEventListener('click', () => {
  entries = [];
  persist();
  render();
  setImportMessage('All saved data cleared.', false);
});

function setImportMessage(message, isError) {
  importMessage.textContent = message;
  importMessage.style.color = isError ? '#d91515' : '#61666d';
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
dateField.value = today;

let performances = loadPerformances();
render();

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const entry = {
    id: crypto.randomUUID(),
    event: eventField.value,
    result: resultField.value.trim(),
    date: dateField.value,
    createdAt: Date.now(),
  };

  performances.unshift(entry);
  persist();
  form.reset();
  dateField.value = today;
  render();
});

clearBtn.addEventListener('click', () => {
  performances = [];
  persist();
  render();
});

function loadPerformances() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];

  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
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

eventFilter.addEventListener('change', renderChart);

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
    meetFeed.appendChild(feedItem(`
      <div class="feed-head">
        <span>${entry.event}</span>
        <span>${formatDate(entry.date)}</span>
      </div>
      <p class="feed-result">${entry.result}</p>
      <p class="micro">Source: ${entry.source.toUpperCase()}</p>
    `));
  });

  practiceEntries.forEach((entry) => {
    practiceFeed.appendChild(feedItem(`
      <div class="feed-head">
        <span>${entry.session}</span>
        <span>${formatDate(entry.date)}</span>
      </div>
      <p class="feed-result">${entry.metric}: ${entry.value}</p>
      <p class="micro">Source: ${entry.source.toUpperCase()}</p>
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
    .map((entry) => ({
      value: parseNumeric(entry.result),
      label: entry.event,
    }))
    .filter((point) => !Number.isNaN(point.value));

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!points.length) {
    drawChartMessage('No numeric meet data for selected event.');
    return;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const left = 10;
  const bottom = canvas.height - 16;
  const h = canvas.height - 30;
  const barGap = 8;
  const w = (canvas.width - left * 2 - barGap * (values.length - 1)) / values.length;

  values.forEach((value, index) => {
    const normalized = (value - min) / range;
    const barHeight = 22 + normalized * (h - 22);
    const x = left + index * (w + barGap);
    const y = bottom - barHeight;

    ctx.fillStyle = index === values.length - 1 ? '#d91515' : '#b9bec7';
    roundedRect(ctx, x, y, w, barHeight, 6);
    ctx.fill();
  });

  ctx.fillStyle = '#61666d';
  ctx.font = '12px Inter';
  ctx.fillText(`PR ${min.toFixed(2)}`, 10, 12);
  ctx.fillText(`Latest ${values.at(-1).toFixed(2)}`, canvas.width - 84, 12);
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(performances));
}

function render() {
  renderFeed();
  renderPR();
  renderChart();
}

function renderFeed() {
  feed.innerHTML = '';

  if (!performances.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  [...performances]
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt)
    .forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'feed-item';
      li.innerHTML = `
        <div class="feed-top">
          <span>${entry.event}</span>
          <span>${formatDate(entry.date)}</span>
        </div>
        <p class="feed-result">${entry.result}</p>
      `;
      feed.appendChild(li);
    });
}

function renderPR() {
  if (!performances.length) {
    prEvent.textContent = 'No event yet';
    prResult.textContent = '—';
    prDate.textContent = 'Add performances to begin';
    return;
  }

  const best = performances.reduce((winner, current) => {
    const winnerVal = parseNumericResult(winner.result);
    const currentVal = parseNumericResult(current.result);

    if (Number.isNaN(currentVal)) return winner;
    if (Number.isNaN(winnerVal)) return current;

    // Assumes lower values are better (appropriate for race times).
    return currentVal < winnerVal ? current : winner;
  });

  prEvent.textContent = best.event;
  prResult.textContent = best.result;
  prDate.textContent = `Set on ${formatDate(best.date)}`;
}

function renderChart() {
  const recent = [...performances].slice(0, 8).reverse();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!recent.length) {
    drawEmptyChart();
    return;
  }

  const values = recent.map((entry) => parseNumericResult(entry.result)).filter((v) => !Number.isNaN(v));
  if (!values.length) {
    drawEmptyChart('Use numeric results for charting');
    return;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const chartTop = 20;
  const chartBottom = canvas.height - 28;
  const barWidth = canvas.width / values.length - 12;

  values.forEach((value, i) => {
    const normalized = (value - min) / range;
    const height = 28 + normalized * (chartBottom - chartTop - 28);
    const x = 8 + i * (barWidth + 12);
    const y = chartBottom - height;

    ctx.fillStyle = i === values.length - 1 ? '#fc4c02' : '#4f7bff';
    roundRect(ctx, x, y, barWidth, height, 8);
    ctx.fill();
  });

  ctx.fillStyle = '#9ca9c5';
  ctx.font = '12px Inter';
  ctx.fillText(`Best: ${min.toFixed(2)}`, 8, 14);
  ctx.fillText(`Latest: ${values[values.length - 1].toFixed(2)}`, canvas.width - 92, 14);
}

function parseNumericResult(resultText) {
  const match = resultText.match(/\d+(\.\d+)?/);
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
function drawEmptyChart(message = 'Add performances to see trend') {
  ctx.fillStyle = '#9ca9c5';
  ctx.font = '14px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  ctx.textAlign = 'left';
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function parseCSV(content) {
  const rows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => splitCSVLine(line));

  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => normalizeKey(header));
  return rows.slice(1).map((cells) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    return row;
  });
}

function splitCSVLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function normalizeKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapImportedRows(source, rows) {
  if (!source) return [];

  if (source === 'practice') {
    return rows
      .map((row) => ({
        id: crypto.randomUUID(),
        type: 'practice',
        source,
        session: row.session || row.workout || 'Practice',
        metric: row.metric || row.exercise || row.drill || '',
        value: row.value || row.result || row.notes || '',
        date: row.date || today,
        createdAt: Date.now(),
      }))
      .filter((entry) => entry.metric || entry.value);
  }

  return rows
    .map((row) => ({
      id: crypto.randomUUID(),
      type: 'meet',
      source,
      event: row.event || row.discipline || row.race || '',
      result: row.result || row.mark || row.time || '',
      date: row.date || row.meetdate || today,
      createdAt: Date.now(),
    }))
    .filter((entry) => entry.event && entry.result);
}
