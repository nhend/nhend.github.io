import { distanceMiles } from "./geo.js";

const EARTH_RADIUS_MILES = 3_958.8;

function roundedAverage(values) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function formatDistanceMiles(miles) {
  if (!Number.isFinite(miles)) return "";
  if (miles < 0.1) {
    const feet = Math.max(50, Math.round((miles * 5_280) / 50) * 50);
    return `about ${feet.toLocaleString()} ft`;
  }
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function precipitationBand(inches) {
  if (inches < 10) return "very dry";
  if (inches < 20) return "dry";
  if (inches < 40) return "moderate";
  if (inches < 60) return "wet";
  return "very wet";
}

function benchmarkDetail(value, average, unit) {
  const averageText = Number.isInteger(average) ? average.toLocaleString() : average.toFixed(1);
  return `${averageText}${unit.startsWith("°") ? "" : " "}${unit}`;
}

function comparison(label, position, value, average, unit) {
  return { label, position, detail: benchmarkDetail(value, average, unit) };
}

export function altitudeComparison(feet) {
  const average = 2_500;
  if (feet < 250) return comparison("very low elevation", 12, feet, average, "ft");
  if (feet < 1_000) return comparison("lower than average", 30, feet, average, "ft");
  if (feet < 2_500) return comparison("fairly typical", 50, feet, average, "ft");
  if (feet < 4_000) return comparison("higher than average", 70, feet, average, "ft");
  if (feet < 6_000) return comparison("higher than most U.S. locations", 85, feet, average, "ft");
  if (feet < 8_000) return comparison("unusually high", 95, feet, average, "ft");
  return comparison("higher than about 99% of U.S. locations", 99, feet, average, "ft");
}

export function distanceComparison(kind, miles) {
  const references = {
    gas: 3,
    grocery: 3,
    hospital: 10,
    road: 8,
    theater: 10,
  };
  const average = references[kind] ?? references.road;
  const ratio = miles / average;
  if (ratio < 0.5) return comparison("closer than for most people", 12, miles, average, "mi");
  if (ratio < 0.85) return comparison("closer than average", 30, miles, average, "mi");
  if (ratio <= 1.25) return comparison("about average", 50, miles, average, "mi");
  if (ratio <= 2) return comparison("farther than average", 68, miles, average, "mi");
  if (ratio <= 4) return comparison("farther than most people", 86, miles, average, "mi");
  return comparison("very remote", 98, miles, average, "mi");
}

export function precipitationComparison(inches) {
  const average = 30;
  if (inches < 10) return comparison("exceptionally dry", 3, inches, average, "in/year");
  if (inches < 20) return comparison("much drier than most", 15, inches, average, "in/year");
  if (inches < 30) return comparison("drier than average", 34, inches, average, "in/year");
  if (inches < 45) return comparison("around the U.S. average", 50, inches, average, "in/year");
  if (inches < 60) return comparison("wetter than average", 70, inches, average, "in/year");
  if (inches < 80) return comparison("wetter than most", 90, inches, average, "in/year");
  return comparison("exceptionally wet", 98, inches, average, "in/year");
}

export function snowfallComparison(inches) {
  const average = 28;
  if (inches < 2) return comparison("very little snow", 8, inches, average, "in/year");
  if (inches < 14) return comparison("less snow than average", 28, inches, average, "in/year");
  if (inches < 42) return comparison("around the U.S. average", 50, inches, average, "in/year");
  if (inches < 70) return comparison("snowier than average", 72, inches, average, "in/year");
  if (inches < 100) return comparison("snowier than most", 91, inches, average, "in/year");
  return comparison("exceptionally snowy", 99, inches, average, "in/year");
}

export function temperatureRangeComparison(low, high) {
  const spread = high - low;
  const average = 70;
  if (spread < 45) return comparison("mild seasons", 14, spread, average, "°F span");
  if (spread < 70) return comparison("distinct seasons", 45, spread, average, "°F span");
  if (spread < 85) return comparison("big seasonal swing", 73, spread, average, "°F span");
  return comparison("extreme seasonal swing", 96, spread, average, "°F span");
}

export function rainDaysComparison(days) {
  const average = 110;
  if (days < 60) return comparison("fewer rainy days than most", 12, days, average, "days/year");
  if (days < 90) return comparison("fewer rainy days than average", 32, days, average, "days/year");
  if (days <= 130) return comparison("about average", 50, days, average, "days/year");
  if (days <= 170) return comparison("more rainy days than average", 72, days, average, "days/year");
  return comparison("more rainy days than most", 92, days, average, "days/year");
}

export function snowDaysComparison(days) {
  const average = 20;
  if (days < 3) return comparison("snow is rare", 8, days, average, "days/year");
  if (days < 12) return comparison("fewer snowy days than average", 28, days, average, "days/year");
  if (days <= 28) return comparison("about average", 50, days, average, "days/year");
  if (days <= 50) return comparison("more snowy days than average", 75, days, average, "days/year");
  return comparison("more snowy days than most", 95, days, average, "days/year");
}

export function sunshineComparison(hours) {
  const average = 2_500;
  if (hours < 1_800) return comparison("less sunshine than most", 10, hours, average, "hr/year");
  if (hours < 2_300) return comparison("less than average", 32, hours, average, "hr/year");
  if (hours <= 2_800) return comparison("about average", 50, hours, average, "hr/year");
  if (hours <= 3_200) return comparison("sunnier than average", 75, hours, average, "hr/year");
  return comparison("sunnier than most", 93, hours, average, "hr/year");
}

export function growingSeasonComparison(days) {
  const average = 190;
  if (days < 110) return comparison("much shorter than average", 12, days, average, "days");
  if (days < 165) return comparison("shorter than average", 32, days, average, "days");
  if (days <= 220) return comparison("about average", 50, days, average, "days");
  if (days <= 280) return comparison("longer than average", 75, days, average, "days");
  return comparison("nearly year-round", 95, days, average, "days");
}

export function densityLabel(peoplePerSquareMile) {
  if (peoplePerSquareMile < 10) return "very isolated";
  if (peoplePerSquareMile < 50) return "rural";
  if (peoplePerSquareMile < 500) return "small-town or exurban";
  if (peoplePerSquareMile < 2_500) return "suburban";
  return "urban";
}

const FINANCIAL_BENCHMARKS = {
  home: { average: 360_600, suffix: "", unit: "$" },
  income: { average: 81_604, suffix: "/year", unit: "$" },
  propertyTax: { average: 3_211, suffix: "/year", unit: "$" },
  rent: { average: 1_487, suffix: "/month", unit: "$" },
};

export function financialComparison(kind, value) {
  const reference = FINANCIAL_BENCHMARKS[kind];
  if (!reference || !Number.isFinite(value)) return null;
  const ratio = value / reference.average;
  let label = "about average";
  if (ratio < 0.7) label = "much lower than average";
  else if (ratio < 0.9) label = "lower than average";
  else if (ratio > 1.5) label = "much higher than average";
  else if (ratio > 1.1) label = "higher than average";
  return {
    label,
    position: Math.max(3, Math.min(97, ratio * 50)),
    detail: `${reference.unit}${reference.average.toLocaleString()}${reference.suffix}`,
  };
}

function accessLevel(data) {
  const references = { grocery: 3, gas: 3, theater: 10, hospital: 10 };
  const ratios = Object.entries(references).flatMap(([kind, average]) => (
    Number.isFinite(data.amenities?.[kind]?.miles) ? [data.amenities[kind].miles / average] : []
  ));
  if (Number.isFinite(data.road?.miles)) ratios.push(data.road.miles / 8);
  const burden = ratios.length ? ratios.reduce((sum, value) => sum + value, 0) / ratios.length : 1;
  if (burden <= 0.65) return "easy";
  if (burden <= 1.25) return "average";
  if (burden <= 2.5) return "limited";
  return "very limited";
}

function weatherLevel(climate) {
  climate ??= {};
  if (!Number.isFinite(climate.typicalLowF) || !Number.isFinite(climate.typicalHighF)) {
    return "unavailable";
  }
  let intensity = 0;
  const spread = climate.typicalHighF - climate.typicalLowF;
  if (spread >= 85) intensity += 2;
  else if (spread >= 70) intensity += 1;
  if (climate.annualSnowfallIn >= 60) intensity += 2;
  else if (climate.annualSnowfallIn >= 30) intensity += 1;
  if (climate.annualPrecipitationIn < 20 || climate.annualPrecipitationIn >= 70) intensity += 2;
  else if (climate.annualPrecipitationIn < 30 || climate.annualPrecipitationIn >= 55) intensity += 1;
  if (intensity >= 5) return "intense";
  if (intensity >= 3) return "pronounced";
  if (intensity >= 1) return "distinct";
  return "mild";
}

function settingLevel(feet) {
  if (feet >= 6_000) return "high country";
  if (feet >= 3_000) return "elevated";
  if (feet < 500) return "lowland";
  return "mid-elevation";
}

function text(value, underlined = false) {
  return { text: value, underlined };
}

export function formatDriveMinutes(minutes) {
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function travelPhrase(place) {
  if (Number.isFinite(place?.driveMinutes)) {
    const duration = formatDriveMinutes(place.driveMinutes);
    const article = /^(8\d|8|11|18)(?:\D|$)/.test(duration) ? "an" : "a";
    return `${article} ${duration} drive`;
  }
  if (Number.isFinite(place?.miles)) return formatDistanceMiles(place.miles).replace(/^about /, "");
  return "an unknown distance";
}

function money(value) {
  return `$${Math.round(value).toLocaleString()}`;
}

function daylightText(hoursValue) {
  const hours = Math.floor(hoursValue);
  const minutes = Math.round((hoursValue - hours) * 60);
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function naturalList(items) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

export function buildLivingProfile(data = {}) {
  const access = accessLevel(data);
  const weather = weatherLevel(data.climate);
  const setting = settingLevel(data.elevationFeet ?? 0);
  const paragraphs = [
    { label: null, parts: [
      text(`Your spot ${data.placePreposition || "near"} `), text(data.placeName || "this area", true), text(" is a "),
      text(`${access === "very limited" ? "remote" : access === "limited" ? "somewhat isolated" : "fairly connected"}, ${setting}`, true),
      text(" place."),
    ] },
  ];

  const grocery = data.amenities?.grocery;
  const gas = data.amenities?.gas;
  const hospital = data.amenities?.hospital;
  const theater = data.amenities?.theater;
  const accessParts = [];
  if (grocery || gas) {
    if (grocery && gas) {
      accessParts.push(
        text("Groceries are about "), text(travelPhrase(grocery), true),
        text(" away and gas about "), text(travelPhrase(gas), true), text(" away."),
      );
    } else {
      const place = grocery ?? gas;
      accessParts.push(
        text(`${grocery ? "Groceries are" : "Gas is"} about `),
        text(travelPhrase(place), true), text(" away."),
      );
    }
  }
  if (hospital || theater) {
    if (accessParts.length) accessParts.push(text(" "));
    if (hospital && theater) {
      accessParts.push(
        text("A hospital is about "), text(travelPhrase(hospital), true),
        text(" away and a movie theater about "), text(travelPhrase(theater), true), text(" away."),
      );
    } else {
      const place = hospital ?? theater;
      accessParts.push(
        text(`A ${hospital ? "hospital" : "movie theater"} is about `),
        text(travelPhrase(place), true), text(" away."),
      );
    }
  }
  const town = data.community?.town;
  const airport = data.community?.airport;
  if (town) {
    if (accessParts.length) accessParts.push(text(" "));
    accessParts.push(
      text("The nearest substantial town is "),
      text(`${town.name}, ${town.state} (population ${town.population.toLocaleString()})`, true),
      text(", about "), text(travelPhrase(town), true), text(" away."),
    );
  }
  if (airport) {
    if (accessParts.length) accessParts.push(text(" "));
    accessParts.push(
      text("The nearest major airport is "),
      text(`${airport.code} — ${airport.name}`, true),
      text(", about "), text(travelPhrase(airport), true), text(" away."),
    );
  }
  if (accessParts.length) paragraphs.push({ label: "Getting around", parts: accessParts });

  const climate = data.climate ?? {};
  const weatherParts = [];
  if (Number.isFinite(climate.typicalLowF) && Number.isFinite(climate.typicalHighF)) {
    const low = Math.round(climate.typicalLowF);
    const high = Math.round(climate.typicalHighF);
    weatherParts.push(
      text("Expect "), text(temperatureRangeComparison(low, high).label, true),
      text(", roughly "), text(`${low}–${high}°F`, true), text(" through the year."),
    );
  }
  const hasRain = Number.isFinite(climate.annualRainDays) && Number.isFinite(climate.annualPrecipitationIn);
  const hasSnow = Number.isFinite(climate.annualSnowDays) && Number.isFinite(climate.annualSnowfallIn);
  if (hasRain || hasSnow) {
    if (weatherParts.length) weatherParts.push(text(" "));
    if (hasRain && hasSnow) {
      const rainComparison = rainDaysComparison(climate.annualRainDays);
      const snowComparison = snowDaysComparison(climate.annualSnowDays);
      weatherParts.push(
        text("There are about "), text(`${Math.round(climate.annualRainDays)} rainy days (${Math.round(climate.annualPrecipitationIn)} in annually)`, true),
        text(" and "), text(`${Math.round(climate.annualSnowDays)} snowy days (${Math.round(climate.annualSnowfallIn)} in annually)`, true), text("—"),
        text(
          rainComparison.label === "about average" && snowComparison.label === "about average"
            ? "about average for both."
            : `${rainComparison.label} and ${snowComparison.label}.`,
          true,
        ),
      );
    } else if (hasRain) {
      weatherParts.push(
        text("There are about "), text(`${Math.round(climate.annualRainDays)} rainy days (${Math.round(climate.annualPrecipitationIn)} in annually)`, true),
        text("—"), text(`${rainDaysComparison(climate.annualRainDays).label}.`, true),
      );
    } else {
      weatherParts.push(
        text("There are about "), text(`${Math.round(climate.annualSnowDays)} snowy days (${Math.round(climate.annualSnowfallIn)} in annually)`, true),
        text("—"), text(`${snowDaysComparison(climate.annualSnowDays).label}.`, true),
      );
    }
  }
  if (Number.isFinite(climate.annualSunshineHours)) {
    if (weatherParts.length) weatherParts.push(text(" "));
    weatherParts.push(
      text("Expect "), text(`${Math.round(climate.annualSunshineHours).toLocaleString()} hours of sunshine a year`, true),
      text(" ("), text(sunshineComparison(climate.annualSunshineHours).label, true), text(")"),
    );
    if (Number.isFinite(climate.winterDaylightHours)) {
      weatherParts.push(
        text("; the shortest day has "), text(`${daylightText(climate.winterDaylightHours)} of daylight`, true), text("."),
      );
    } else {
      weatherParts.push(text("."));
    }
  }
  if (weatherParts.length) paragraphs.push({ label: "Weather", parts: weatherParts });

  const census = data.census ?? {};
  const costFacts = [
    ["Typical home value is ", census.medianHomeValue, "", "home"],
    ["rent is ", census.medianRent, "/month", "rent"],
    ["household income is ", census.medianHouseholdIncome, "/year", "income"],
  ].filter(([, value]) => Number.isFinite(value));
  if (costFacts.length) {
    const costParts = [];
    costFacts.forEach(([prefix, value, suffix, kind], index) => {
      if (index > 0) costParts.push(text(index === costFacts.length - 1 ? ", and " : ", "));
      costParts.push(
        text(prefix), text(`${money(value)}${suffix}`, true),
        text(" ("), text(financialComparison(kind, value).label, true), text(")"),
      );
    });
    costParts.push(text("."));
    paragraphs.push({ label: "Costs", parts: costParts });
  }

  const hazards = data.hazards;
  if (hazards?.overall || hazards?.top?.length) {
    const hazardParts = [];
    if (hazards.overall) {
      hazardParts.push(
        text(""), text(hazards.area || "The county", true), text(" has "),
        text(hazards.overall, true), text(" overall natural-hazard risk."),
      );
    }
    const highRisks = hazards.top?.filter(({ rating }) => rating === "high" || rating === "very high") ?? [];
    const moderateRisks = hazards.top?.filter(({ rating }) => rating === "moderate").slice(0, 3) ?? [];
    if (highRisks.length) {
      hazardParts.push(
        text(" High risks include "),
        text(naturalList(highRisks.map(({ name, rating }) => `${name.toLowerCase()} (${rating})`)), true),
        text("."),
      );
    }
    if (moderateRisks.length) {
      hazardParts.push(
        text(" Moderate risks include "),
        text(naturalList(moderateRisks.map(({ name }) => name.toLowerCase())), true), text("."),
      );
    }
    paragraphs.push({ label: "Hazards", parts: hazardParts });
  }

  return {
    scores: [
      { label: "Access", value: access },
      { label: "Weather", value: weather },
      { label: "Setting", value: setting },
    ],
    paragraphs,
  };
}

export function summarizeClimate(daily = {}) {
  const years = new Map();
  for (let index = 0; index < (daily.time?.length ?? 0); index += 1) {
    const year = daily.time[index]?.slice(0, 4);
    if (!year) continue;
    const values = years.get(year) ?? {
      dates: [], lows: [], highs: [], precipitation: 0, snowfall: 0,
      rainDays: 0, snowDays: 0, sunshineHours: 0, daylightHours: [],
    };
    const low = daily.temperature_2m_min?.[index];
    const high = daily.temperature_2m_max?.[index];
    const precipitation = daily.precipitation_sum?.[index];
    const snowfall = daily.snowfall_sum?.[index];
    const sunshine = daily.sunshine_duration?.[index];
    const daylight = daily.daylight_duration?.[index];
    values.dates.push({ date: daily.time[index], low });
    if (Number.isFinite(low)) values.lows.push(low);
    if (Number.isFinite(high)) values.highs.push(high);
    if (Number.isFinite(precipitation)) values.precipitation += precipitation;
    if (Number.isFinite(snowfall)) values.snowfall += snowfall;
    if (precipitation >= 0.04) values.rainDays += 1;
    if (snowfall >= 0.1) values.snowDays += 1;
    if (Number.isFinite(sunshine)) values.sunshineHours += sunshine / 3_600;
    if (Number.isFinite(daylight)) values.daylightHours.push(daylight / 3_600);
    years.set(year, values);
  }

  const completeYears = [...years.values()].filter((year) => year.lows.length && year.highs.length);
  const growingSeasons = completeYears.flatMap((year) => {
    const yearNumber = year.dates[0]?.date?.slice(0, 4);
    const freezes = year.dates.filter(({ low }) => Number.isFinite(low) && low <= 32);
    const spring = freezes.filter(({ date }) => date < `${yearNumber}-07-01`).at(-1);
    const fall = freezes.find(({ date }) => date >= `${yearNumber}-07-01`);
    if (!spring || !fall) return [];
    return [Math.round((Date.parse(fall.date) - Date.parse(spring.date)) / 86_400_000)];
  });
  return {
    typicalLowF: roundedAverage(completeYears.map((year) => Math.min(...year.lows))),
    typicalHighF: roundedAverage(completeYears.map((year) => Math.max(...year.highs))),
    annualPrecipitationIn: roundedAverage(completeYears.map((year) => year.precipitation)),
    annualSnowfallIn: roundedAverage(completeYears.map((year) => year.snowfall)),
    annualRainDays: roundedAverage(completeYears.map((year) => year.rainDays)),
    annualSnowDays: roundedAverage(completeYears.map((year) => year.snowDays)),
    annualSunshineHours: roundedAverage(completeYears.map((year) => year.sunshineHours)),
    winterDaylightHours: roundedAverage(completeYears.flatMap((year) => (
      year.daylightHours.length ? [Math.min(...year.daylightHours)] : []
    ))),
    growingSeasonDays: roundedAverage(growingSeasons),
    years: completeYears.length,
  };
}

const HAZARD_NAMES = {
  AVLN_RISKR: "Avalanche",
  CFLD_RISKR: "Coastal flooding",
  CWAV_RISKR: "Cold wave",
  DRGT_RISKR: "Drought",
  ERQK_RISKR: "Earthquake",
  HAIL_RISKR: "Hail",
  HRCN_RISKR: "Hurricane",
  HWAV_RISKR: "Heat wave",
  ISTM_RISKR: "Ice storm",
  LNDS_RISKR: "Landslide",
  LTNG_RISKR: "Lightning",
  RFLD_RISKR: "River flooding",
  SWND_RISKR: "Strong wind",
  TRND_RISKR: "Tornado",
  TSUN_RISKR: "Tsunami",
  VLCN_RISKR: "Volcanic activity",
  WFIR_RISKR: "Wildfire",
};

const RISK_ORDER = {
  "Very High": 5,
  "Relatively High": 4,
  "Relatively Moderate": 3,
  "Relatively Low": 2,
  "Very Low": 1,
};

function plainRiskRating(rating) {
  return rating?.replace(/^Relatively /, "").toLowerCase();
}

export function summarizeHazards(attributes = {}) {
  const top = Object.entries(HAZARD_NAMES).flatMap(([field, name]) => (
    RISK_ORDER[attributes[field]]
      ? [{ name, rating: plainRiskRating(attributes[field]), order: RISK_ORDER[attributes[field]] }]
      : []
  )).sort((left, right) => right.order - left.order || left.name.localeCompare(right.name));
  return {
    area: attributes.COUNTY
      ? `${attributes.COUNTY} County${attributes.STATEABBRV ? `, ${attributes.STATEABBRV}` : ""}`
      : null,
    overall: plainRiskRating(attributes.RISK_RATNG),
    top: top.map(({ name, rating }) => ({ name, rating })),
  };
}

export function summarizeAmenities(elements = [], point) {
  const categories = {
    grocery: (tags) => tags.shop === "supermarket" || tags.shop === "grocery",
    gas: (tags) => tags.amenity === "fuel",
    theater: (tags) => tags.amenity === "cinema",
    hospital: (tags) => tags.amenity === "hospital",
  };
  const fallbacks = {
    grocery: "Grocery store",
    gas: "Gas station",
    theater: "Movie theater",
    hospital: "Hospital",
  };
  const nearest = {};

  for (const element of elements) {
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const miles = distanceMiles(point, [longitude, latitude]);
    for (const [category, matches] of Object.entries(categories)) {
      if (!matches(element.tags ?? {})) continue;
      if (!nearest[category] || miles < nearest[category].miles) {
        nearest[category] = {
          miles,
          name: element.tags?.name || fallbacks[category],
        };
      }
    }
  }
  return nearest;
}

function lineStrings(geometry) {
  if (geometry?.type === "LineString") return [geometry.coordinates];
  if (geometry?.type === "MultiLineString") return geometry.coordinates;
  return [];
}

function distanceToSegmentMiles(point, start, end) {
  const [longitude, latitude] = point;
  const latitudeRadians = latitude * Math.PI / 180;
  const project = ([candidateLongitude, candidateLatitude]) => [
    (candidateLongitude - longitude) * Math.PI / 180 * Math.cos(latitudeRadians) * EARTH_RADIUS_MILES,
    (candidateLatitude - latitude) * Math.PI / 180 * EARTH_RADIUS_MILES,
  ];
  const [startX, startY] = project(start);
  const [endX, endY] = project(end);
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX ** 2 + deltaY ** 2;
  const amount = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared));
  return Math.hypot(startX + amount * deltaX, startY + amount * deltaY);
}

export function nearestPrimaryRoad(featureCollection = {}, point) {
  let nearest = null;
  for (const feature of featureCollection.features ?? []) {
    for (const line of lineStrings(feature.geometry)) {
      for (let index = 1; index < line.length; index += 1) {
        const miles = distanceToSegmentMiles(point, line[index - 1], line[index]);
        if (!nearest || miles < nearest.miles) {
          nearest = {
            miles,
            name: feature.properties?.NAME || feature.properties?.BASENAME || "Major road",
          };
        }
      }
    }
  }
  return nearest;
}
