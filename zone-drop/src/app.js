import {
  STATE_NAMES,
  ZONES,
  chooseRandomPointForZone,
  distanceMiles,
} from "./geo.js";
import {
  altitudeComparison,
  buildLivingProfile,
  densityLabel,
  distanceComparison,
  financialComparison,
  formatDistanceMiles,
  formatDriveMinutes,
  growingSeasonComparison,
  precipitationComparison,
  rainDaysComparison,
  snowfallComparison,
  snowDaysComparison,
  sunshineComparison,
  temperatureRangeComparison,
} from "./context.js";
import { livingContext } from "./api.js";

const ZONE_BY_STATE = Object.fromEntries(
  Object.entries(ZONES).flatMap(([zoneId, zone]) => (
    zone.states.map((state) => [state, zoneId])
  )),
);

const LABELS = [
  { zone: "A", map: "main", position: { lat: 45.4, lng: -108.4 } },
  { zone: "B", map: "main", position: { lat: 45.4, lng: -121.0 } },
  { zone: "D", map: "main", position: { lat: 45.1, lng: -88.3 } },
  { zone: "E", map: "main", position: { lat: 38.2, lng: -116.8 } },
  { zone: "F", map: "main", position: { lat: 32.0, lng: -99.7 } },
  { zone: "G", map: "main", position: { lat: 39.4, lng: -91.7 } },
  { zone: "H", map: "main", position: { lat: 34.8, lng: -80.5 } },
  { zone: "C", map: "alaska", position: { lat: 63.1, lng: -151.0 } },
  { zone: "C", map: "hawaii", position: { lat: 20.7, lng: -157.2 } },
];

const mapMessage = document.querySelector("#map-message");
const selectedGroup = document.querySelector("#selected-group");
const dropButton = document.querySelector("#drop-button");
const statusElement = document.querySelector("#status");
const resultElement = document.querySelector("#result");
const placeNameElement = document.querySelector("#place-name");
const coordinatesElement = document.querySelector("#coordinates");
const copyButton = document.querySelector("#copy-button");
const mapsLink = document.querySelector("#maps-link");
const contextElement = document.querySelector("#context");
const contextStatus = document.querySelector("#context-status");
const contextScorecard = document.querySelector("#context-scorecard");
const contextSummary = document.querySelector("#context-summary");
const contextList = document.querySelector("#context-list");
const contextSources = document.querySelector("#context-sources");

let selectedZoneId = null;
let featuresByState = new Map();
let dataLayers = [];
let maps = {};
let geocoder;
let elevationService;
let resultMarker;
let resultPoint;
let contextRequestId = 0;

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const callbackName = "__zoneDropGoogleMapsReady";
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };

    const script = document.createElement("script");
    script.async = true;
    script.onerror = () => reject(new Error("Map failed to load"));
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}&loading=async&v=weekly`;
    document.head.append(script);
  });
}

function styleForFeature(feature) {
  const state = feature.getProperty("STUSAB");
  const zoneId = ZONE_BY_STATE[state];
  if (!zoneId) {
    return {
      clickable: false,
      fillColor: "#eeeeda",
      fillOpacity: 0.32,
      strokeColor: "#65655f",
      strokeOpacity: 0.5,
      strokeWeight: 0.7,
    };
  }

  const selected = selectedZoneId === zoneId;
  return {
    clickable: true,
    cursor: "pointer",
    fillColor: ZONES[zoneId].color,
    fillOpacity: selected ? 0.76 : 0.57,
    strokeColor: selected ? "#111111" : "#45453f",
    strokeOpacity: 0.9,
    strokeWeight: selected ? 2.4 : 0.8,
    zIndex: selected ? 2 : 1,
  };
}

function selectZone(zoneId) {
  selectedZoneId = zoneId;
  selectedGroup.textContent = `Group ${zoneId}`;
  selectedGroup.hidden = false;
  dropButton.disabled = false;
  resultElement.hidden = true;
  contextRequestId += 1;
  contextElement.hidden = true;
  statusElement.hidden = true;
  dataLayers.forEach((layer) => layer.setStyle(styleForFeature));
}

function makeMap(element, options) {
  return new google.maps.Map(element, {
    ...options,
    clickableIcons: false,
    fullscreenControl: false,
    mapTypeControl: false,
    rotateControl: false,
    streetViewControl: false,
  });
}

function addBoundaries(map, geoJson) {
  const features = map.data.addGeoJson(geoJson, { idPropertyName: "STUSAB" });
  map.data.setStyle(styleForFeature);
  map.data.addListener("click", ({ feature }) => {
    const zoneId = ZONE_BY_STATE[feature.getProperty("STUSAB")];
    if (zoneId) selectZone(zoneId);
  });
  dataLayers.push(map.data);
  return features;
}

function addGroupLabels() {
  for (const label of LABELS) {
    new google.maps.Marker({
      clickable: false,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillOpacity: 0,
        scale: 1,
        strokeOpacity: 0,
      },
      label: {
        color: "#171717",
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: label.map === "main" ? "21px" : "17px",
        fontWeight: "700",
        text: label.zone,
      },
      map: maps[label.map],
      position: label.position,
      zIndex: 5,
    });
  }
}

function reverseGeocode(location) {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ location }, (results, status) => {
      if (status === "OK") resolve(results ?? []);
      else reject(new Error(status));
    });
  });
}

function elevationAt(location) {
  return new Promise((resolve, reject) => {
    elevationService.getElevationForLocations({ locations: [location] }, (results, status) => {
      if (status === "OK" && results?.length) resolve(results[0].elevation);
      else reject(new Error(status));
    });
  });
}

function locationPoint(location) {
  return [location.lng(), location.lat()];
}

function nearestRoadDistance(results, point) {
  const roadResults = results.filter((result) => (
    result.types?.some((type) => (
      type === "route"
      || type === "street_address"
      || type === "intersection"
      || type === "premise"
    ))
  ));
  if (roadResults.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...roadResults.map((result) => (
    distanceMiles(point, locationPoint(result.geometry.location))
  )));
}

function looksLikeWater(results) {
  const waterTypes = new Set(["natural_feature", "establishment"]);
  const firstResult = results[0];
  if (!firstResult) return false;
  const typeMatch = firstResult.types?.some((type) => waterTypes.has(type));
  const nameMatch = /\b(ocean|sea|reservoir|bay)\b/i.test(firstResult.formatted_address ?? "");
  return Boolean(typeMatch && nameMatch);
}

function addressPart(result, type) {
  return result?.address_components?.find((part) => part.types.includes(type))?.long_name;
}

function placeLabel(results, state) {
  const result = results[0];
  const locality = addressPart(result, "locality")
    || addressPart(result, "postal_town")
    || addressPart(result, "administrative_area_level_2");
  const region = addressPart(result, "administrative_area_level_1") || STATE_NAMES[state];
  return locality ? `Near ${locality}, ${region}` : STATE_NAMES[state];
}

async function inspectCandidate(candidate, settings) {
  const [longitude, latitude] = candidate.point;
  const location = { lat: latitude, lng: longitude };
  const geocodePromise = reverseGeocode(location);
  const elevationPromise = settings.avoidWater
    ? elevationAt(location)
    : Promise.resolve(null);
  const [geocodeResult, elevationResult] = await Promise.allSettled([
    geocodePromise,
    elevationPromise,
  ]);
  const results = geocodeResult.status === "fulfilled" ? geocodeResult.value : [];

  if (settings.avoidWater) {
    if (elevationResult.status === "fulfilled" && elevationResult.value <= 0) return null;
    if (looksLikeWater(results)) return null;
  }

  if (settings.nearRoad && geocodeResult.status === "fulfilled") {
    if (nearestRoadDistance(results, candidate.point) > 5) return null;
  }

  return {
    ...candidate,
    elevationMeters: elevationResult.status === "fulfilled" ? elevationResult.value : null,
    geocode: results,
  };
}

function mapForState(state) {
  if (state === "AK") return maps.alaska;
  if (state === "HI") return maps.hawaii;
  return maps.main;
}

async function showResult(result) {
  const [longitude, latitude] = result.point;
  const coordinateText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  const targetMap = mapForState(result.state);
  const position = { lat: latitude, lng: longitude };

  resultPoint = coordinateText;
  placeNameElement.textContent = placeLabel(result.geocode, result.state);
  coordinatesElement.textContent = coordinateText;
  mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  resultElement.hidden = true;

  let contextReady = true;
  try {
    contextReady = await loadLivingContext(result, position);
  } catch {
    contextElement.hidden = true;
  }
  if (!contextReady) return;

  resultElement.hidden = false;
  statusElement.hidden = true;

  if (resultMarker) resultMarker.setMap(null);
  resultMarker = new google.maps.Marker({
    map: targetMap,
    position,
    title: coordinateText,
  });

}

function addContextRow(label, value, benchmark) {
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  const valueElement = document.createElement("span");
  term.textContent = label;
  valueElement.className = "context-value";
  valueElement.textContent = value;
  description.append(valueElement);

  if (benchmark) {
    const comparisonElement = document.createElement("span");
    const signal = document.createElement("span");
    const marker = document.createElement("span");
    const comparisonLabel = document.createElement("span");
    comparisonElement.className = "comparison";
    signal.className = "comparison-signal";
    signal.setAttribute("aria-hidden", "true");
    marker.className = "comparison-marker";
    marker.style.setProperty("--position", `${benchmark.position}%`);
    comparisonLabel.className = "comparison-label";
    comparisonLabel.textContent = `${benchmark.label} (${benchmark.detail})`;
    signal.append(marker);
    comparisonElement.append(signal, comparisonLabel);
    description.append(comparisonElement);
  }
  contextList.append(term, description);
}

function addContextGroup(label) {
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.className = "context-group";
  term.textContent = label;
  description.className = "context-group-spacer";
  contextList.append(term, description);
}

function routedPlaceValue(place, name = place.name) {
  const miles = place.driveMiles ?? place.miles;
  const driveTime = formatDriveMinutes(place.driveMinutes);
  const parts = [driveTime ? `${driveTime} drive` : "", formatDistanceMiles(miles)].filter(Boolean);
  return `${parts.join(" · ")} — ${name}`;
}

function money(value) {
  return `$${Math.round(value).toLocaleString()}`;
}

function renderLivingProfile(profile) {
  contextScorecard.replaceChildren();
  for (const score of profile.scores) {
    const item = document.createElement("span");
    const label = document.createElement("span");
    const value = document.createElement("u");
    item.className = "scorecard-item";
    label.className = "scorecard-label";
    label.textContent = `${score.label} `;
    value.textContent = score.value;
    item.append(label, value);
    contextScorecard.append(item);
  }

  contextSummary.replaceChildren();
  profile.paragraphs.forEach((paragraph) => {
    const paragraphElement = document.createElement("p");
    if (paragraph.label) {
      const heading = document.createElement("span");
      heading.className = "profile-heading";
      heading.textContent = `${paragraph.label}: `;
      paragraphElement.append(heading);
    }
    for (const part of paragraph.parts) {
      if (part.underlined) {
        const inserted = document.createElement("u");
        inserted.textContent = part.text;
        paragraphElement.append(inserted);
      } else {
        paragraphElement.append(document.createTextNode(part.text));
      }
    }
    contextSummary.append(paragraphElement);
  });
  contextScorecard.hidden = false;
  contextSummary.hidden = false;
}

async function loadLivingContext(result, position) {
  const requestId = ++contextRequestId;
  contextList.replaceChildren();
  contextScorecard.replaceChildren();
  contextSummary.replaceChildren();
  contextScorecard.hidden = true;
  contextSummary.hidden = true;
  contextStatus.textContent = "Getting the lay of the land…";
  contextStatus.hidden = false;
  contextSources.hidden = true;
  contextElement.hidden = false;

  const contextPromise = livingContext(position.lat, position.lng);
  const elevationPromise = Number.isFinite(result.elevationMeters)
    ? Promise.resolve(result.elevationMeters)
    : elevationAt(position);
  const [contextResult, elevationResult] = await Promise.allSettled([
    contextPromise,
    elevationPromise,
  ]);
  if (requestId !== contextRequestId) return false;

  const livingData = {
    placeName: placeNameElement.textContent.replace(/^Near /, ""),
    placePreposition: placeNameElement.textContent.startsWith("Near ") ? "near" : "in",
    elevationFeet: elevationResult.status === "fulfilled"
      ? Math.round(elevationResult.value * 3.28084)
      : null,
    amenities: null,
    climate: null,
    road: null,
  };

  if (contextResult.status === "fulfilled") {
    const { amenities, climate, road, community, census, hazards } = contextResult.value;
    livingData.amenities = Object.fromEntries(Object.entries(amenities ?? {}).map(([key, place]) => [
      key,
      { ...place, miles: place.driveMiles ?? place.miles },
    ]));
    livingData.climate = climate;
    livingData.road = road;
    livingData.community = community;
    livingData.census = census;
    livingData.hazards = hazards;

    addContextGroup("Access");
    const nearby = [
      ["Grocery", "grocery", amenities?.grocery],
      ["Gas station", "gas", amenities?.gas],
      ["Movie theater", "theater", amenities?.theater],
      ["Hospital", "hospital", amenities?.hospital],
    ];
    for (const [label, kind, place] of nearby) {
      if (place) {
        addContextRow(
          label,
          routedPlaceValue(place),
          distanceComparison(kind, place.driveMiles ?? place.miles),
        );
      }
    }
    if (road) {
      addContextRow(
        "Major road",
        `${formatDistanceMiles(road.miles)} — ${road.name}`,
        distanceComparison("road", road.miles),
      );
    }
    if (community?.town) {
      const town = community.town;
      addContextRow(
        "Substantial town",
        town.miles < 1
          ? `In ${town.name}, ${town.state} · pop. ${town.population.toLocaleString()}`
          : routedPlaceValue(town, `${town.name}, ${town.state} · pop. ${town.population.toLocaleString()}`),
      );
    }
    if (community?.airport) {
      const airport = community.airport;
      addContextRow(
        "Major airport",
        routedPlaceValue(airport, `${airport.code} · ${airport.name}`),
      );
    }

    addContextGroup("Area");
    if (Number.isFinite(livingData.elevationFeet)) {
      const feet = livingData.elevationFeet;
      addContextRow("Altitude", `${feet.toLocaleString()} ft`, altitudeComparison(feet));
    }
    if (Number.isFinite(census?.populationDensity)) {
      addContextRow(
        "Population density",
        `${Math.round(census.populationDensity).toLocaleString()} people/sq mi — ${densityLabel(census.populationDensity)}`,
      );
    }
    if (Number.isFinite(census?.medianHomeValue)) {
      addContextRow(
        "Typical home value",
        `${money(census.medianHomeValue)} — ${census.area ?? "county estimate"}`,
        financialComparison("home", census.medianHomeValue),
      );
    }
    if (Number.isFinite(census?.medianRent)) {
      addContextRow(
        "Typical rent",
        `${money(census.medianRent)}/month — ${census.area ?? "county estimate"}`,
        financialComparison("rent", census.medianRent),
      );
    }
    if (Number.isFinite(census?.medianPropertyTax)) {
      addContextRow(
        "Property tax",
        `${money(census.medianPropertyTax)}/year — ${census.area ?? "county estimate"}`,
        financialComparison("propertyTax", census.medianPropertyTax),
      );
    }
    if (Number.isFinite(census?.medianHouseholdIncome)) {
      addContextRow(
        "Household income",
        `${money(census.medianHouseholdIncome)}/year — ${census.area ?? "county estimate"}`,
        financialComparison("income", census.medianHouseholdIncome),
      );
    }

    if (hazards?.overall || hazards?.top?.length) {
      addContextGroup("Natural hazards");
      if (hazards.overall) addContextRow("Overall risk", `${hazards.overall} — ${hazards.area}`);
      if (hazards.top?.length) {
        addContextRow(
          "Highest risks",
          hazards.top.slice(0, 5).map((hazard) => `${hazard.name} ${hazard.rating}`).join(" · "),
        );
      }
    }

    const hasClimate = Object.values(climate ?? {}).some(Number.isFinite);
    if (hasClimate) addContextGroup("Climate");
    if (Number.isFinite(climate?.typicalLowF) && Number.isFinite(climate?.typicalHighF)) {
      const low = Math.round(climate.typicalLowF);
      const high = Math.round(climate.typicalHighF);
      addContextRow(
        "Yearly range",
        `${low}–${high}°F`,
        temperatureRangeComparison(low, high),
      );
    }
    if (Number.isFinite(climate?.annualPrecipitationIn)) {
      addContextRow(
        "Precipitation",
        `${Math.round(climate.annualPrecipitationIn)} in/year`,
        precipitationComparison(climate.annualPrecipitationIn),
      );
    }
    if (Number.isFinite(climate?.annualSnowfallIn)) {
      addContextRow(
        "Snowfall",
        `${Math.round(climate.annualSnowfallIn)} in/year`,
        snowfallComparison(climate.annualSnowfallIn),
      );
    }
    if (Number.isFinite(climate?.annualRainDays)) {
      addContextRow(
        "Rain days",
        `${Math.round(climate.annualRainDays)} days/year`,
        rainDaysComparison(climate.annualRainDays),
      );
    }
    if (Number.isFinite(climate?.annualSnowDays)) {
      addContextRow(
        "Snow days",
        `${Math.round(climate.annualSnowDays)} days/year`,
        snowDaysComparison(climate.annualSnowDays),
      );
    }
    if (Number.isFinite(climate?.annualSunshineHours)) {
      addContextRow(
        "Sunshine",
        `${Math.round(climate.annualSunshineHours).toLocaleString()} hr/year`,
        sunshineComparison(climate.annualSunshineHours),
      );
    }
    if (Number.isFinite(climate?.growingSeasonDays)) {
      addContextRow(
        "Growing season",
        `${Math.round(climate.growingSeasonDays)} frost-free days`,
        growingSeasonComparison(climate.growingSeasonDays),
      );
    }
    if (Number.isFinite(climate?.winterDaylightHours)) {
      const hours = Math.floor(climate.winterDaylightHours);
      const minutes = Math.round((climate.winterDaylightHours - hours) * 60);
      addContextRow("Shortest day", `${hours} hr ${minutes} min of daylight`);
    }
  }

  if (contextResult.status !== "fulfilled" && Number.isFinite(livingData.elevationFeet)) {
    addContextGroup("Area");
    const feet = livingData.elevationFeet;
    addContextRow("Altitude", `${feet.toLocaleString()} ft`, altitudeComparison(feet));
  }

  const hasDetails = contextList.children.length > 0;
  if (hasDetails) renderLivingProfile(buildLivingProfile(livingData));
  contextStatus.hidden = hasDetails;
  contextStatus.textContent = hasDetails ? "" : "No extra details available for this spot.";
  contextSources.hidden = !hasDetails;
  return true;
}

async function handleDrop() {
  if (!selectedZoneId || featuresByState.size === 0) return;

  const settings = {
    nearRoad: document.querySelector('input[name="near-road"]').checked,
    avoidWater: document.querySelector('input[name="avoid-water"]').checked,
  };
  const maxAttempts = settings.nearRoad || settings.avoidWater ? 16 : 1;
  let fallback;

  dropButton.disabled = true;
  resultElement.hidden = true;
  statusElement.textContent = "Getting the lay of the land…";
  statusElement.hidden = false;

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = chooseRandomPointForZone(selectedZoneId, featuresByState);
      fallback ??= { ...candidate, elevationMeters: null, geocode: [] };
      const accepted = await inspectCandidate(candidate, settings);
      if (accepted) {
        await showResult(accepted);
        return;
      }
    }

    await showResult(fallback);
  } catch {
    if (fallback) await showResult(fallback);
    else {
      statusElement.textContent = "Couldn't find a place. Try again.";
      statusElement.hidden = false;
    }
  } finally {
    dropButton.disabled = false;
  }
}

async function initialize() {
  try {
    const [keyResponse, geoJsonResponse] = await Promise.all([
      fetch("./google-maps-key.txt", { cache: "no-store" }),
      fetch("./data/states.geojson"),
    ]);
    const [googleMapsApiKey, geoJson] = await Promise.all([
      keyResponse.text().then((value) => value.trim()),
      geoJsonResponse.json(),
    ]);
    if (!googleMapsApiKey) throw new Error("Missing map key");

    featuresByState = new Map(
      geoJson.features.map((feature) => [feature.properties.STUSAB, feature]),
    );
    await loadGoogleMaps(googleMapsApiKey);

    maps = {
      main: makeMap(document.querySelector("#map"), {
        center: { lat: 38.2, lng: -96.3 },
        gestureHandling: "cooperative",
        zoom: 4,
        zoomControl: true,
      }),
      alaska: makeMap(document.querySelector("#alaska-map"), {
        center: { lat: 63.0, lng: -151.0 },
        disableDefaultUI: true,
        draggable: false,
        gestureHandling: "none",
        zoom: 3,
      }),
      hawaii: makeMap(document.querySelector("#hawaii-map"), {
        center: { lat: 20.7, lng: -157.0 },
        disableDefaultUI: true,
        draggable: false,
        gestureHandling: "none",
        zoom: 5,
      }),
    };

    for (const map of Object.values(maps)) addBoundaries(map, geoJson);
    addGroupLabels();
    geocoder = new google.maps.Geocoder();
    elevationService = new google.maps.ElevationService();
    mapMessage.hidden = true;
  } catch {
    mapMessage.textContent = "Map didn't load. Refresh to try again.";
  }
}

copyButton.addEventListener("click", async () => {
  if (!resultPoint) return;
  await navigator.clipboard.writeText(resultPoint);
  copyButton.textContent = "Copied";
  window.setTimeout(() => { copyButton.textContent = "Copy"; }, 1_200);
});

dropButton.addEventListener("click", handleDrop);
initialize();
