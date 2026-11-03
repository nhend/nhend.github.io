import { distanceMiles } from "./geo.js";
import {
  nearestPrimaryRoad,
  summarizeClimate,
  summarizeHazards,
} from "./context.js";

const SQUARE_METERS_PER_SQUARE_MILE = 2_589_988.11;
const townsPromise = fetch(new URL("../data/substantial-towns.json", import.meta.url))
  .then((response) => response.json())
  .catch(() => []);
const airportsPromise = fetch(new URL("../data/major-airports.json", import.meta.url))
  .then((response) => response.json())
  .catch(() => []);
const countyDemographicsPromise = fetch(new URL("../data/county-demographics.json", import.meta.url))
  .then((response) => response.json())
  .catch(() => ({ data: {} }));

async function fetchJson(url, options = {}, timeoutMilliseconds = 15_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function within(promise, timeoutMilliseconds) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Context source timed out")), timeoutMilliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function nearbyPlace(latitude, longitude, category, namePattern = null) {
  const longitudeRadius = Math.min(4, 1.5 / Math.max(0.35, Math.cos(latitude * Math.PI / 180)));
  const url = new URL("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates");
  url.search = new URLSearchParams({
    category,
    location: `${longitude},${latitude}`,
    searchExtent: `${longitude - longitudeRadius},${latitude - 1.5},${longitude + longitudeRadius},${latitude + 1.5}`,
    outFields: "PlaceName,Type",
    maxLocations: "10",
    forStorage: "false",
    f: "json",
  });
  const data = await fetchJson(url, {}, 10_000);
  return (data.candidates ?? []).filter((candidate) => (
    !namePattern || namePattern.test(candidate.attributes?.PlaceName || candidate.address || "")
  )).map((candidate) => ({
    miles: distanceMiles([longitude, latitude], [candidate.location.x, candidate.location.y]),
    name: candidate.attributes?.PlaceName || candidate.address || category,
    latitude: candidate.location.y,
    longitude: candidate.location.x,
  })).sort((left, right) => left.miles - right.miles)[0] ?? null;
}

async function nearbyAmenities(latitude, longitude) {
  const categories = {
    grocery: { category: "Grocery" },
    gas: { category: "Gas Station" },
    theater: { category: "Cinema" },
    hospital: { category: "Hospital", namePattern: /hospital|medical center|health center|emergency/i },
  };
  const results = await Promise.allSettled(
    Object.values(categories).map(({ category, namePattern }) => (
      nearbyPlace(latitude, longitude, category, namePattern)
    )),
  );
  return Object.fromEntries(
    Object.keys(categories).flatMap((key, index) => (
      results[index].status === "fulfilled" && results[index].value
        ? [[key, results[index].value]]
        : []
    )),
  );
}

async function climateSummary(latitude, longitude) {
  const lastYear = new Date().getUTCFullYear() - 1;
  const firstYear = lastYear - 4;
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.search = new URLSearchParams({
    latitude: `${latitude}`,
    longitude: `${longitude}`,
    start_date: `${firstYear}-01-01`,
    end_date: `${lastYear}-12-31`,
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,sunshine_duration,daylight_duration",
    temperature_unit: "fahrenheit",
    precipitation_unit: "inch",
    timezone: "auto",
    cell_selection: "land",
  });
  const data = await fetchJson(url, {}, 14_000);
  return summarizeClimate(data.daily);
}

async function primaryRoad(latitude, longitude) {
  const url = new URL("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation_LargeScale/MapServer/0/query");
  url.search = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    distance: "100",
    units: "esriSRUnit_StatuteMile",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "NAME,BASENAME,RTTYP",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
    resultRecordCount: "2000",
  });
  const data = await fetchJson(url, {}, 10_000);
  return nearestPrimaryRoad(data, [longitude, latitude]);
}

function nearestReferencePlace(places, latitude, longitude) {
  let nearest = null;
  for (const place of places) {
    const miles = distanceMiles([longitude, latitude], [place.longitude, place.latitude]);
    if (!nearest || miles < nearest.miles) nearest = { ...place, miles };
  }
  return nearest;
}

async function nearbyReferencePlaces(latitude, longitude) {
  const [towns, airports] = await Promise.all([townsPromise, airportsPromise]);
  return {
    town: nearestReferencePlace(towns, latitude, longitude),
    airport: nearestReferencePlace(airports, latitude, longitude),
  };
}

async function countyGeography(latitude, longitude) {
  const url = new URL("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/82/query");
  url.search = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GEOID,NAME,AREALAND",
    returnGeometry: "false",
    f: "json",
  });
  const data = await fetchJson(url, {}, 10_000);
  const county = data.features?.[0]?.attributes;
  if (!county) return null;
  return {
    geoid: county.GEOID,
    countyName: county.NAME,
    areaLandSquareMeters: Number(county.AREALAND),
  };
}

async function censusProfile(latitude, longitude) {
  const [geography, demographics] = await Promise.all([
    countyGeography(latitude, longitude),
    countyDemographicsPromise,
  ]);
  if (!geography) return null;
  const data = demographics.data?.[geography.geoid];
  if (!data) return null;
  const population = data.population;
  const squareMiles = geography.areaLandSquareMeters / SQUARE_METERS_PER_SQUARE_MILE;
  return {
    area: geography.countyName,
    release: demographics.release,
    population,
    populationDensity: population && squareMiles > 0 ? population / squareMiles : null,
    medianHomeValue: data.medianHomeValue,
    medianRent: data.medianRent,
    medianHouseholdIncome: data.medianHouseholdIncome,
    medianPropertyTax: data.medianPropertyTax,
  };
}

async function hazardProfile(latitude, longitude) {
  const fields = [
    "COUNTY", "STATEABBRV", "RISK_RATNG", "AVLN_RISKR", "CFLD_RISKR",
    "CWAV_RISKR", "DRGT_RISKR", "ERQK_RISKR", "HAIL_RISKR", "HRCN_RISKR",
    "HWAV_RISKR", "ISTM_RISKR", "LNDS_RISKR", "LTNG_RISKR", "RFLD_RISKR",
    "SWND_RISKR", "TRND_RISKR", "TSUN_RISKR", "VLCN_RISKR", "WFIR_RISKR",
  ];
  const url = new URL("https://services.arcgis.com/HdtZMT2FmI4wPzTM/ArcGIS/rest/services/FEMA_National_Risk_Index/FeatureServer/0/query");
  url.search = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: fields.join(","),
    returnGeometry: "false",
    f: "json",
  });
  const data = await fetchJson(url, {}, 10_000);
  const attributes = data.features?.[0]?.attributes;
  return attributes ? summarizeHazards(attributes) : null;
}

async function addDrivingTimes(latitude, longitude, places) {
  const destinations = places.filter((place) => (
    Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude)
  ));
  if (destinations.length === 0) return;
  const coordinates = [
    `${longitude},${latitude}`,
    ...destinations.map((place) => `${place.longitude},${place.latitude}`),
  ].join(";");
  const url = new URL(`https://router.project-osrm.org/table/v1/driving/${coordinates}`);
  url.search = new URLSearchParams({ annotations: "duration,distance", sources: "0" });
  const data = await fetchJson(url, {}, 12_000);
  destinations.forEach((place, index) => {
    const seconds = data.durations?.[0]?.[index + 1];
    const meters = data.distances?.[0]?.[index + 1];
    if (Number.isFinite(seconds)) place.driveMinutes = Math.max(1, Math.round(seconds / 60));
    if (Number.isFinite(meters)) place.driveMiles = meters / 1_609.344;
  });
}

export async function livingContext(latitude, longitude) {
  const amenitiesPromise = within(nearbyAmenities(latitude, longitude), 10_000);
  const referencePlacesPromise = nearbyReferencePlaces(latitude, longitude);
  const routingPromise = within(Promise.allSettled([amenitiesPromise, referencePlacesPromise])
    .then(async ([amenities, referencePlaces]) => {
      const amenityValue = amenities.status === "fulfilled" ? amenities.value : null;
      const referenceValue = referencePlaces.status === "fulfilled" ? referencePlaces.value : null;
      await addDrivingTimes(latitude, longitude, [
        ...Object.values(amenityValue ?? {}),
        referenceValue?.town,
        referenceValue?.airport,
      ].filter(Boolean));
    }), 14_000);

  const [amenities, climate, road, referencePlaces, census, hazards] = await Promise.allSettled([
    amenitiesPromise,
    within(climateSummary(latitude, longitude), 14_000),
    within(primaryRoad(latitude, longitude), 10_000),
    referencePlacesPromise,
    within(censusProfile(latitude, longitude), 14_000),
    within(hazardProfile(latitude, longitude), 10_000),
    routingPromise,
  ]);

  return {
    amenities: amenities.status === "fulfilled" ? amenities.value : null,
    climate: climate.status === "fulfilled" ? climate.value : null,
    road: road.status === "fulfilled" ? road.value : null,
    community: referencePlaces.status === "fulfilled" ? referencePlaces.value : null,
    census: census.status === "fulfilled" ? census.value : null,
    hazards: hazards.status === "fulfilled" ? hazards.value : null,
  };
}
