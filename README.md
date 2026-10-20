# Does Money Buy Years? — Week 4 workshop build

A civic-data website about health spending and life expectancy, built for the Week 4 workshop.
It does the four core files (`index.html`, `script.js`, `style.css`, `healthdata.csv`), then the
chart step, the sort/filter step, and the Leaflet map step from the end of the lecture. The
written reflection is in [REFLECTION.md](REFLECTION.md).

## 中文速览

- **看效果**：在 `health-inequality` 目录下运行 `python3 -m http.server 8000`，打开 <http://localhost:8000>；地图在 `/map.html`。**直接双击 index.html 会空白**，这是浏览器的 CORS 限制，不是代码坏了。
- **数据**：世界银行开放数据，三个指标（人均医疗支出、出生时预期寿命、人口），取 2018–2024 年间各国最新可用年份，保留人口最大的 100 个国家。
- **核心结论**：人均支出每增加 10 倍，预期寿命只多约 8.4 年（对数关系）；高收入组平均 81.4 岁，低收入组 64.1 岁，差 17.3 年。

## Files

| File | What it does |
|---|---|
| `index.html` | Heading, four stat cards, search/filter/sort controls, the data table, two charts |
| `script.js` | The single `Papa.parse()` call; builds table, stats, filters; emits events for the charts |
| `chartscript.js` | Scatter plot and grouped bar chart; redraws whenever the table changes |
| `style.css` | Shared styling for both pages |
| `healthdata.csv` | 100 rows, 9 columns, one header row |
| `map.html` | Leaflet page with a toggle between bubble map and heat map |
| `mapscript.js` | Builds both map layers from the same CSV, plus the tile fallback |
| `README.md` | This file: sources, cleaning log, debugging log, caveats |
| `REFLECTION.md` | Blog reflection (English + 中文) linking the build to Schrock (2016) |

## How the pages get their data

`index.html` and `map.html` both read `healthdata.csv` with `Papa.parse()`, which is the point of the
exercise — the CSV is the single source of truth, and there is no second copy anywhere. Edit the
CSV and both pages change immediately.

Because the data is fetched, the pages must be served rather than opened from disk:

| How you open it | What happens |
|---|---|
| Local web server (`python3 -m http.server`) | works — reads `healthdata.csv` |
| GitHub Pages | works — reads `healthdata.csv` |
| Double-clicking the HTML (`file://`) | **blank table**; the browser blocks the download. The page now says so in red, instead of failing silently |

That `file://` behaviour is not a bug in the page — it is the browser's security rule, and it is the
same one the workshop notes in Step 6. It disappears once the folder is served or published.

## The data

Pulled from the World Bank API on 20 October 2026 (the API's own last update was 8 October 2026).
**Every figure is for 2023** — the most recent year with near-complete coverage for all three
indicators; health spending currently covers only 24 countries for 2024. No year is mixed with
another, and countries without a published 2023 value were dropped.

`healthdata.csv` is the only copy of the data in this project — the pages read it at runtime, so
refreshing the numbers means replacing this one file.

| Indicator | Code | Page | API call |
|---|---|---|---|
| Current health expenditure per capita (current US$) | `SH.XPD.CHEX.PC.CD` | <https://data.worldbank.org/indicator/SH.XPD.CHEX.PC.CD> | `api.worldbank.org/v2/country/all/indicator/SH.XPD.CHEX.PC.CD?format=json&date=2023` |
| Life expectancy at birth, total (years) | `SP.DYN.LE00.IN` | <https://data.worldbank.org/indicator/SP.DYN.LE00.IN> | `api.worldbank.org/v2/country/all/indicator/SP.DYN.LE00.IN?format=json&date=2023` |
| Population, total | `SP.POP.TOTL` | <https://data.worldbank.org/indicator/SP.POP.TOTL> | `api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&date=2023` |

Country names, region, income group and capital-city coordinates come from
`https://api.worldbank.org/v2/country`. The coordinates are what make `map.html` possible.

**Check any figure yourself.** The API returns plain JSON you can open in a browser — no code
needed. Paste this and compare it with the table:

<https://api.worldbank.org/v2/country/USA/indicator/SH.XPD.CHEX.PC.CD?format=json&date=2023>

Replace `USA` with any ISO3 country code from the `ISO3` column, and the indicator code with
either of the other two in the table above. Every row in this project was checked against the API
this way when it was built, and all 100 matched.

### Cleaning log

1. **Dropped World Bank aggregates.** The API returns rows like "Euro area" and "Africa Eastern
   and Southern" alongside real countries. Filtered on `region != "Aggregates"`, because an
   average of countries is not a country and would double-count in every chart.
2. **Required all three indicators for 2023.** 211 countries have coordinates; 190 had all three
   values published for 2023. The rest were dropped rather than filled, because an imputed life
   expectancy would quietly bend the scatter plot.
3. **Cut to 100 rows.** The workshop caps files at about 100 rows. Kept the 100 most populous
   countries, down to Turkmenistan at 7.4 million, covering ~90% of the world's population.
   **This is a real exclusion**: about 90 states, many of them Pacific and Caribbean islands,
   are not in this file at all.
4. **No year mixing.** An earlier version took "the latest available year" per indicator, which
   quietly produced a table where one country's spending was 2022 and another's was 2023 — and
   made the headline numbers impossible to verify. Rebuilt on 2023 alone.
5. **Separated numbers from units.** The CSV stores `13473.19`, not `$13,473`; `script.js`
   formats for display. Currency symbols inside data break numeric sorting.
6. **Kept the coordinates as decimals** (`46.948`, `7.44821`) and made them the last two
   columns, so the table can be read without them but the map can use them.

### What the data says

- A tenfold increase in health spending is associated with **+8.4 years** of life expectancy
  (OLS on log₁₀ spending; Pearson r = 0.87 on the log scale, 0.61 on the raw scale).
- High-income countries average **81.2 years** and **$4,445** per person; low-income **63.9**
  and **$40** — a **17.3-year** gap for roughly **110×** the spending.
- **21 countries** in the set sit below 65 years; **759 million** people live in them.
- The United States spends the most per person (**$13,473**) and still lives **78.4 years** —
  5.8 years less than Switzerland ($11,784 → 84.2) and 5.6 years less than Japan ($3,638 → 84.0).
- Over-performers against the trend: Bangladesh (LE 74.7 on **$53** per person), Sri Lanka
  (77.7 on $134).

## Workshop checklist

| Step from the brief / lecture | Where it is |
|---|---|
| Four files: `index.html`, `script.js`, `style.css`, `.csv` | repo root |
| Read CSV with PapaParse, print a table | `script.js` → `loadData()` + `renderTable()` |
| Change the `<th>` headers to match my columns | `index.html`, table head |
| Add a `<canvas>` and Chart.js | `index.html` (two canvases) + `chartscript.js` |
| Pick a chart type that suits the data | scatter for the relationship, bar for group averages |
| Sorting and filtering ("a little bit of extra code") | `applyFilters()`, `bindControls()` |
| Leaflet bubble map | `map.html`, `drawBubbles()` |
| Leaflet heat map from the same CSV | `drawHeat()` |

## Run it

`Papa.parse()` fetches the CSV, and browsers block that on `file://`. Use one of these:

```bash
cd health-inequality
python3 -m http.server 8000     # then open http://localhost:8000 and /map.html
```

Or publish it: create a GitHub repository, upload every file to the root, then
**Settings → Pages → Deploy from a branch → main / (root)**. Both pages work from the Pages URL.

## Debugging log

The lecture asked to see the debugging, so here is every failure met during the build, with the
console message that identified it. Each one produced a *blank or partial* page rather than an
obvious crash, which is why the console mattered.

| # | Symptom | Console said | Cause | Fix |
|---|---|---|---|---|
| 1 | Table empty when the page was opened from disk | `Access to fetch ... has been blocked by CORS policy` (PapaParse `error` callback) | `file://` cannot fetch local files | Serve over http; added a status message that names the cause |
| 2 | Table rendered, both charts blank | `Uncaught SyntaxError: Identifier 'INCOME_COLOURS' has already been declared` | Colour palette declared in both `script.js` and `chartscript.js`, so the whole second file never executed | Keep the palette in `script.js` only |
| 3 | Charts still blank after #2 | `Identifier 'mean' has already been declared` | Same mistake again with a helper function | Deleted the duplicate; added a comment saying where it lives |
| 4 | Could not read the chart object while testing | variable resolved to `CANVAS`, not a chart | An element `id` becomes a global variable, shadowing nothing but confusing everything | Renamed the chart variables (`scatterPlot`, `groupBar`) to differ from the canvas ids |
| 5 | Log x-axis unreadable: labels collided into `60k 80k 100k` | — (visual, not an error) | Chart.js adds minor log ticks and my formatter labelled them | Pinned ticks to 1, 2 and 5 × 10ⁿ |
| 6 | Bar chart made a 17-year gap look like nothing | — | Bars must start at zero, and zero flattens the difference | Kept the zero baseline and printed the values above the bars instead of truncating the axis |
| 7 | `0` countries in the merged dataset | — | World Bank's `country.id` is **ISO2**, not ISO3; joining on it matched nothing | Rebuilt the join on `countryiso3code` |
| 8 | Map background blank, page load hung | — (requests stalled, no error) | OpenStreetMap tiles hang rather than fail on restricted networks | Added a 6-second timeout as well as a `tileerror` handler, falling back to Esri tiles |
| 9 | Heat map solid red | — | Population weights up to 1,450 against leaflet.heat's default `max` of 1 | Normalise weights to 1 and set `max: 1` |
| 10 | Page said **"Showing 0 of 0 countries"** and nothing else | no error at all | `Papa.parse()` had *completed* with zero rows because the CSV was never reachable (the page was opened without its sibling CSV). I had only handled the error case, never the empty-result case | The error path now says plainly that the file could not be loaded and why; the page is served over http, which is the actual fix |
| 11 | Table stayed empty even though the fallback ran | — | While deleting an unused variable I removed the `useRows(rows)` call with it, so data arrived and was dropped on the floor | Restored the call — then re-tested rather than assuming |
| 12 | Map said "Plotting 100 countries" but drew **no bubbles** | — | `plot(rows)` shadowed the shared `rows` array, so `drawBubbles()` read an empty global | Renamed the parameter and assigned the global first |

Bugs 10–12 are all the same lesson and it is the one the lecture was pointing at: **nothing showed
an error message**. A blank result after a successful-looking operation is the failure mode to
suspect next.

## Caveats

- **National averages hide the actual distribution.** A country can have a good mean and
  terrible internal inequality. Nothing here says who inside a country gets care.
- **Current US$ is not purchasing power.** `SH.XPD.CHEX.PC.CD` converts local spending at market
  exchange rates, which understates what money buys in poorer countries. The World Bank also
  publishes `SH.XPD.CHEX.PP.CD` (PPP-adjusted); switching to it would be the single most
  defensible improvement to this dataset.
- **One year only (2023).** This is auditable, but it is also a snapshot: a single year's health
  spending can be distorted by currency moves, and life expectancy by one-off events such as
  COVID-19. The 2023 life-expectancy figures are still affected by pandemic mortality in places.
- **Spending is not the only input.** Sanitation, diet, violence, road deaths and inequality all
  move life expectancy; the 8.4-year slope is an association, not a return on investment.
- **Correlation, read as a curve.** The log fit is a description of the cloud, not a causal model.

## Using your own data

Replace `healthdata.csv`, then update the eight `<th>` labels in `index.html` and the property
names inside `renderTable()` (`script.js`). Sorting, filtering and the charts need no changes if
the column names stay the same. For a different dataset, the map needs `Latitude` and
`Longitude` columns; without them, delete `map.html` and `mapscript.js`.
