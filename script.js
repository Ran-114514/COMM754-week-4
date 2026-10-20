// script.js - one Papa.parse() call feeds the table, the stat cards and both charts.
// The geocoded columns (Latitude/Longitude) are here too: map.html uses the same file.

const NUMERIC_FIELDS = [
    'PopulationMillions', 'HealthSpendPerCapitaUSD', 'LifeExpectancyYears'
];

const INCOME_COLOURS = {
    'Low income': '#e15759',
    'Lower middle income': '#f28e2b',
    'Upper middle income': '#59a14f',
    'High income': '#4e79a7'
};

const state = {
    all: [],
    filtered: [],
    query: '',
    region: 'All',
    income: 'All',
    sortKey: 'LifeExpectancyYears',
    sortDir: 'desc'
};

// PapaParse hands us text; we need numbers we can sort and plot.
function cleanNumber(value) {
    const n = Number(String(value).replace(/[^0-9.eE+-]/g, ''));
    return Number.isFinite(n) ? n : NaN;
}

function formatNumber(value, decimals = 0) {
    return Number(value).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function setStatus(message, isError) {
    const el = document.getElementById('status');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', Boolean(isError));
}

function loadData() {
    Papa.parse('healthdata.csv', {
        download: true,
        header: true,
        skipEmptyLines: true,

        complete: function (results) {
            useRows(toRows(results.data));
        },

        error: function (err) {
            console.error('Failed to load healthdata.csv', err);
            setStatus(
                'Could not load healthdata.csv. Opening this page straight from disk (file://) ' +
                'blocks the download because of browser security - serve the folder over http ' +
                'instead (see README.md) or publish it on GitHub Pages.',
                true
            );
        }
    });
}

function toRows(data) {
    return data
        .map(row => ({
            Country: row.Country,
            ISO3: row.ISO3,
            Region: row.Region,
            IncomeGroup: row.IncomeGroup,
            PopulationMillions: cleanNumber(row.PopulationMillions),
            HealthSpendPerCapitaUSD: cleanNumber(row.HealthSpendPerCapitaUSD),
            LifeExpectancyYears: cleanNumber(row.LifeExpectancyYears),
            Latitude: cleanNumber(row.Latitude),
            Longitude: cleanNumber(row.Longitude)
        }))
        // Any row missing either measurement would silently corrupt the charts.
        .filter(row =>
            row.Country &&
            Number.isFinite(row.HealthSpendPerCapitaUSD) &&
            Number.isFinite(row.LifeExpectancyYears)
        );
}

function useRows(rows) {
    state.all = rows;
    console.log('Parsed rows:', state.all.length);

    buildFilters();
    bindControls();
    applyFilters();

    document.dispatchEvent(new CustomEvent('healthdata:ready', { detail: state.filtered }));
}

function buildFilters() {
    const regions = [...new Set(state.all.map(r => r.Region))].sort();
    const incomes = [...new Set(state.all.map(r => r.IncomeGroup))].sort();

    fillSelect('regionFilter', regions);
    fillSelect('incomeFilter', incomes);
}

function fillSelect(id, values) {
    const select = document.getElementById(id);
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
}

function bindControls() {
    document.getElementById('search').addEventListener('input', e => {
        state.query = e.target.value.trim().toLowerCase();
        applyFilters();
    });
    document.getElementById('regionFilter').addEventListener('change', e => {
        state.region = e.target.value;
        applyFilters();
    });
    document.getElementById('incomeFilter').addEventListener('change', e => {
        state.income = e.target.value;
        applyFilters();
    });
    document.getElementById('sortSelect').addEventListener('change', e => {
        const split = e.target.value.split('-');
        state.sortKey = split[0];
        state.sortDir = split[1];
        applyFilters();
    });
    document.getElementById('resetBtn').addEventListener('click', resetAll);
}

function resetAll() {
    state.query = '';
    state.region = 'All';
    state.income = 'All';
    state.sortKey = 'LifeExpectancyYears';
    state.sortDir = 'desc';
    document.getElementById('search').value = '';
    document.getElementById('regionFilter').value = 'All';
    document.getElementById('incomeFilter').value = 'All';
    document.getElementById('sortSelect').value = 'LifeExpectancyYears-desc';
    applyFilters();
}

function applyFilters() {
    state.filtered = state.all.filter(row => {
        const regionOk = state.region === 'All' || row.Region === state.region;
        const incomeOk = state.income === 'All' || row.IncomeGroup === state.income;
        const queryOk =
            state.query === '' ||
            row.Country.toLowerCase().includes(state.query) ||
            row.ISO3.toLowerCase().includes(state.query);
        return regionOk && incomeOk && queryOk;
    });

    const direction = state.sortDir === 'asc' ? 1 : -1;
    state.filtered.sort((a, b) => {
        const x = a[state.sortKey];
        const y = b[state.sortKey];
        if (NUMERIC_FIELDS.includes(state.sortKey)) {
            return (Number(x) - Number(y)) * direction;
        }
        return String(x).localeCompare(String(y)) * direction;
    });

    renderTable();
    renderStats();
    setStatus(`Showing ${state.filtered.length} of ${state.all.length} countries.`);

    // Keep both charts in step with the table.
    document.dispatchEvent(new CustomEvent('healthdata:filtered', { detail: state.filtered }));
}

function renderTable() {
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';

    if (state.filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No countries match that filter.</td></tr>';
        return;
    }

    state.filtered.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.Country} <span class="iso">${row.ISO3}</span></td>
            <td>${row.Region}</td>
            <td><span class="tag" style="background:${INCOME_COLOURS[row.IncomeGroup] || '#999'}">${row.IncomeGroup}</span></td>
            <td>${formatNumber(row.PopulationMillions, 1)}</td>
            <td>$${formatNumber(row.HealthSpendPerCapitaUSD)}</td>
            <td>${formatNumber(row.LifeExpectancyYears, 1)}</td>
            <td>${row.Latitude}</td>
            <td>${row.Longitude}</td>
        `;
        tbody.appendChild(tr);
    });
}

const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
const sum = values => values.reduce((a, b) => a + b, 0);

// Ordinary least squares on log10(spend) vs life expectancy: with two people earning nothing
// extra, this tells us how many years each extra tenfold of spending actually buys.
function fitSlope(rows) {
    const points = rows
        .filter(r => r.HealthSpendPerCapitaUSD > 0 && Number.isFinite(r.LifeExpectancyYears))
        .map(r => ({ x: Math.log10(r.HealthSpendPerCapitaUSD), y: r.LifeExpectancyYears }));

    if (points.length < 3) return null;

    const mx = mean(points.map(p => p.x));
    const my = mean(points.map(p => p.y));
    const denominator = points.reduce((sum, p) => sum + (p.x - mx) ** 2, 0);
    if (denominator === 0) return null;

    return points.reduce((sum, p) => sum + (p.x - mx) * (p.y - my), 0) / denominator;
}

function renderStats() {
    const rows = state.filtered;
    const panel = document.getElementById('stats');
    if (!panel) return;

    // 1. Years bought by a tenfold increase in spending.
    const slope = fitSlope(rows);
    document.getElementById('statSlope').textContent =
        slope === null ? 'too few rows'
        : slope >= 0 ? `+${slope.toFixed(1)} years`
        : `${slope.toFixed(1)} years`;

    // 2. Life expectancy gap between the highest and lowest income group in view.
    const byIncome = {};
    rows.forEach(r => {
        (byIncome[r.IncomeGroup] = byIncome[r.IncomeGroup] || []).push(r.LifeExpectancyYears);
    });
    const averages = Object.entries(byIncome).map(([group, values]) => ({ group, value: mean(values) }));
    document.getElementById('statGap').textContent = averages.length >= 2
        ? `${(Math.max(...averages.map(a => a.value)) - Math.min(...averages.map(a => a.value))).toFixed(1)} years`
        : 'one group only';

    // 3. Countries below 65, and how many people that is.
    const short = rows.filter(r => r.LifeExpectancyYears < 65);
    const shortPeople = sum(short.map(r => r.PopulationMillions));
    document.getElementById('statBelow65').textContent = `${short.length} countries`;
    document.getElementById('statBelow65Label').textContent = short.length
        ? `Countries here below 65 years, home to ${formatNumber(shortPeople, 0)}m people in total`
        : 'No country in this selection falls below 65 years';

    // 4. The biggest spender in view.
    const biggest = rows.reduce(
        (a, b) => (b.HealthSpendPerCapitaUSD > a.HealthSpendPerCapitaUSD ? b : a),
        rows[0]
    );
    document.getElementById('statSpender').textContent = biggest
        ? `$${formatNumber(biggest.HealthSpendPerCapitaUSD)}`
        : 'n/a';
    document.getElementById('statSpenderLabel').textContent = biggest
        ? `${biggest.Country} spends most here, yet life expectancy is ${formatNumber(biggest.LifeExpectancyYears, 1)} years`
        : 'No rows in view';

    panel.hidden = false;
}

// The scripts live in <head>, so wait for the DOM before touching elements.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadData);
} else {
    loadData();
}
