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
