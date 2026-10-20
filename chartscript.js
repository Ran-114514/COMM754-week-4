// chartscript.js - draws both charts from data handed over by script.js.
// It never parses the CSV itself, so there is still only one Papa.parse() on the page.
// It redraws whenever the table is searched, filtered or sorted, so charts and table agree.

let scatterPlot = null;
let groupBar = null;

// The palette lives in script.js (load order: script.js first) so it is defined once.
const INCOME_ORDER = [
    'Low income', 'Lower middle income', 'Upper middle income', 'High income'
];

// INCOME_COLOURS and mean() are defined once in script.js, which loads first.

// 1. Scatter plot: health spending against life expectancy.
// Spending runs from $17 to $13,473 per person, so the x axis has to be logarithmic.
function buildScatter(rows) {
    const canvas = document.getElementById('scatterChart');
    if (!canvas) return;

    const points = rows
        .filter(r => r.HealthSpendPerCapitaUSD > 0 && Number.isFinite(r.LifeExpectancyYears))
        .map(r => ({ x: r.HealthSpendPerCapitaUSD, y: r.LifeExpectancyYears, country: r.Country }));

    if (points.length === 0) {
        if (scatterPlot) scatterPlot.destroy();
        return;
    }

    if (scatterPlot) scatterPlot.destroy();

    scatterPlot = new Chart(canvas, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Countries',
                data: points,
                pointBackgroundColor: rows
                    .filter(r => r.HealthSpendPerCapitaUSD > 0 && Number.isFinite(r.LifeExpectancyYears))
                    .map(r => INCOME_COLOURS[r.IncomeGroup] || '#888'),
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: item => {
                            const p = item.raw;
                            return `${p.country}: $${Math.round(p.x).toLocaleString('en-US')} per person, ` +
                                   `${p.y.toFixed(1)} years`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'logarithmic',
                    title: { display: true, text: 'Health spending per person (USD, log scale)' },
                    ticks: {
                        autoSkip: false,
                        maxRotation: 0,
                        callback: LOG_TICK_FORMAT
                    }
                },
                y: {
                    title: { display: true, text: 'Life expectancy at birth (years)' }
                }
            }
        }
    });
}

// Tokens for the log axis: 1, 2, 5 times each power of ten, labelled as $, $1k etc.
const LOG_TICKS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

function LOG_TICK_FORMAT(value) {
    if (!LOG_TICKS.includes(value)) return '';
    if (value >= 1000) return `$${value / 1000}k`;
    return `$${value}`;
}

// Small Chart.js plugin: print the value on top of each bar.
// A bar chart should start at zero, which flattens a 17-year gap - so the numbers do the work.
const barValueLabels = {
    id: 'barValueLabels',
    afterDatasetsDraw(chart) {
        if (chart.config.type !== 'bar') return;
        const { ctx } = chart;
        chart.getDatasetMeta(0).data.forEach((bar, index) => {
            const value = chart.data.datasets[0].data[index];
            ctx.save();
            ctx.fillStyle = '#2c3e50';
            ctx.font = '600 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${value.toFixed(1)} yrs`, bar.x, bar.y - 7);
            ctx.restore();
        });
    }
};

// 2. Bar chart: average life expectancy per income group.
function buildGroupChart(rows) {
    const canvas = document.getElementById('groupChart');
    if (!canvas) return;

    const groups = INCOME_ORDER.filter(group => rows.some(r => r.IncomeGroup === group));
    const averages = groups.map(group =>
        mean(rows.filter(r => r.IncomeGroup === group).map(r => r.LifeExpectancyYears))
    );

    if (groupBar) groupBar.destroy();

    if (groups.length === 0) {
        return;
    }

    groupBar = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: groups,
            datasets: [{
                label: 'Average life expectancy (years)',
                data: averages,
                backgroundColor: groups.map(g => INCOME_COLOURS[g]),
                maxBarThickness: 80
            }]
        },
        plugins: [barValueLabels],
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: item => `${item.parsed.y.toFixed(1)} years` }
                }
            },
            scales: {
                // Bars must start at zero or the gaps lie about their size.
                y: {
                    beginAtZero: true,
                    max: 95,
                    title: { display: true, text: 'Average life expectancy (years)' }
                }
            }
        }
    });
}

function drawAll(rows) {
    buildScatter(rows);
    buildGroupChart(rows);
}

document.addEventListener('healthdata:ready', event => drawAll(event.detail));
document.addEventListener('healthdata:filtered', event => drawAll(event.detail));
