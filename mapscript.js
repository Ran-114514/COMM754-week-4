// mapscript.js - Leaflet bubble map and heat map, both built from healthdata.csv.
// map.html is a separate page, so it does its own Papa.parse(); within any single page
// we still only ever read the file once.

let map;
let bubbleLayer;
let heatLayer;
let rows = [];

const LIFE_BANDS = [
    { min: 0, colour: '#b2182b', label: 'under 60 years' },
    { min: 60, colour: '#ef8a62', label: '60-70 years' },
    { min: 70, colour: '#fddbc7', label: '70-75 years' },
    { min: 75, colour: '#d1e5f0', label: '75-80 years' },
    { min: 80, colour: '#2166ac', label: '80 years and over' }
];

function bandColour(years) {
    let colour = LIFE_BANDS[0].colour;
    LIFE_BANDS.forEach(band => {
        if (years >= band.min) colour = band.colour;
    });
    return colour;
}

// Area proportional to spending => radius proportional to the square root of spending.
function radiusFor(spendPerPerson) {
    const r = Math.sqrt(spendPerPerson) / 5.5;
    return Math.max(3.5, Math.min(34, r));
}

function setStatus(message, isError) {
    const el = document.getElementById('status');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', Boolean(isError));
}

function initMap() {
    map = L.map('map').setView([24, 12], 2);

    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 10,
        attribution: '&copy; OpenStreetMap contributors'
    });

    // Some networks (and some countries) block OpenStreetMap tiles. Tiles can either fail
    // outright or hang, so we switch once, either on the first error or after a timeout
    // with nothing loaded. The markers are drawn regardless - only the backdrop changes.
    const fallback = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 10, attribution: 'Tiles &copy; Esri' }
    );

    let switched = false;
    let tilesLoaded = 0;

    function useFallback(reason) {
        if (switched) return;
        switched = true;
        map.removeLayer(osm);
        fallback.addTo(map);
        console.log(`Map tiles: switched to the Esri fallback (${reason}).`);
    }

    osm.on('tileload', () => { tilesLoaded += 1; });
    osm.on('tileerror', () => useFallback('OpenStreetMap tiles failed to load'));
    setTimeout(() => {
        if (tilesLoaded === 0) useFallback('OpenStreetMap tiles did not load within 6 seconds');
    }, 6000);

    osm.addTo(map);
}

function toRows(data) {
    return data
        .map(row => ({
            Country: row.Country,
            LifeExpectancyYears: Number(row.LifeExpectancyYears),
            HealthSpendPerCapitaUSD: Number(row.HealthSpendPerCapitaUSD),
            PopulationMillions: Number(row.PopulationMillions),
            IncomeGroup: row.IncomeGroup,
            Latitude: Number(row.Latitude),
            Longitude: Number(row.Longitude)
        }))
        // A single bad coordinate would throw Leaflet off, so drop unusable rows first.
        .filter(row =>
            row.Country &&
            Number.isFinite(row.Latitude) &&
            Number.isFinite(row.Longitude) &&
            Number.isFinite(row.LifeExpectancyYears) &&
            Number.isFinite(row.HealthSpendPerCapitaUSD)
        );
}

function loadData() {
    Papa.parse('healthdata.csv', {
        download: true,
        header: true,
        skipEmptyLines: true,

        complete: function (results) {
            plot(toRows(results.data));
        },

        error: function (err) {
            console.error('Failed to load healthdata.csv', err);
            setStatus(
                'Could not load healthdata.csv - if you opened this page from disk (file://) the ' +
                'download is blocked. Serve the folder over http or publish it on GitHub Pages ' +
                '(see README.md).',
                true
            );
        }
    });
}

function plot(data) {
    rows = data;                 // drawBubbles() reads the shared `rows` array
    console.log('Map rows:', rows.length);
    setStatus(`Plotting ${rows.length} countries.`);
    drawBubbles();
}

function drawBubbles() {
    if (bubbleLayer) map.removeLayer(bubbleLayer);

    bubbleLayer = L.layerGroup().addTo(map);

    rows.forEach(row => {
        L.circleMarker([row.Latitude, row.Longitude], {
            radius: radiusFor(row.HealthSpendPerCapitaUSD),
            color: '#2c3e50',
            weight: 0.6,
            fillColor: bandColour(row.LifeExpectancyYears),
            fillOpacity: 0.75
        }).bindPopup(
            `<strong>${row.Country}</strong><br>` +
            `Life expectancy: ${row.LifeExpectancyYears} years<br>` +
            `Health spending: $${Math.round(row.HealthSpendPerCapitaUSD).toLocaleString('en-US')} per person<br>` +
            `Population: ${row.PopulationMillions}m<br>` +
            `<em>${row.IncomeGroup}</em>`
        ).addTo(bubbleLayer);
    });
}

function drawHeat() {
    if (heatLayer) map.removeLayer(heatLayer);

    // Weight each point by population, normalised so the biggest country is 1.
    // Without normalising, leaflet.heat's default max of 1 would saturate the whole map red.
    const maxPopulation = Math.max(...rows.map(row => row.PopulationMillions));
    const points = rows.map(row => [
        row.Latitude,
        row.Longitude,
        row.PopulationMillions / maxPopulation
    ]);

    heatLayer = L.heatLayer(points, {
        radius: 30,
        blur: 22,
        maxZoom: 4,
        max: 1,
        minOpacity: 0.25,
        gradient: { 0.15: '#2166ac', 0.4: '#92c5de', 0.65: '#fdb863', 0.85: '#e66101', 1: '#b2182b' }
    }).addTo(map);
}

function showBubbles() {
    if (heatLayer) map.removeLayer(heatLayer);
    if (!bubbleLayer) drawBubbles();
    map.addLayer(bubbleLayer);

    document.getElementById('bubbleBtn').classList.add('active');
    document.getElementById('heatBtn').classList.remove('active');
    document.getElementById('sizeLegend').hidden = false;
    document.getElementById('colourLegend').hidden = false;
    document.getElementById('heatLegend').hidden = true;
}

function showHeat() {
    if (bubbleLayer) map.removeLayer(bubbleLayer);
    if (!heatLayer) drawHeat();
    map.addLayer(heatLayer);

    document.getElementById('heatBtn').classList.add('active');
    document.getElementById('bubbleBtn').classList.remove('active');
    document.getElementById('sizeLegend').hidden = true;
    document.getElementById('colourLegend').hidden = true;
    document.getElementById('heatLegend').hidden = false;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initMap();
        loadData();
        document.getElementById('bubbleBtn').addEventListener('click', showBubbles);
        document.getElementById('heatBtn').addEventListener('click', showHeat);
    });
} else {
    initMap();
    loadData();
}
