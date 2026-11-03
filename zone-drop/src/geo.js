export const ZONES = {
  A: { states: ["ID", "MT", "WY", "ND", "SD"], color: "#d9bd79" },
  B: { states: ["WA", "OR"], color: "#79a394" },
  C: { states: ["AK", "HI"], color: "#83aabd" },
  D: { states: ["MN", "WI", "MI", "VT", "NH", "ME"], color: "#919fc7" },
  E: { states: ["CA", "NV", "UT", "CO"], color: "#c98f7d" },
  F: { states: ["AZ", "NM", "TX", "OK", "AR", "LA"], color: "#d69daa" },
  G: { states: ["NE", "KS", "IA", "MO", "IL", "IN", "OH", "KY", "TN"], color: "#b3ad74" },
  H: { states: ["PA", "NJ", "DE", "MD", "WV", "VA", "NC", "SC", "GA", "AL", "MS"], color: "#d89b69" },
};

export const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function pointInRing([x, y], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [currentX, currentY] = ring[index];
    const [previousX, previousY] = ring[previous];
    const crossesRay = currentY > y !== previousY > y;
    const intersectionX = ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX;
    if (crossesRay && x < intersectionX) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, rings) {
  return rings.length > 0
    && pointInRing(point, rings[0])
    && !rings.slice(1).some((hole) => pointInRing(point, hole));
}

export function pointInGeometry(point, geometry) {
  if (geometry.type === "Polygon") return pointInPolygon(point, geometry.coordinates);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
  }
  return false;
}

function polygonBounds(polygon) {
  const longitudes = polygon[0].map(([longitude]) => longitude);
  const latitudes = polygon[0].map(([, latitude]) => latitude);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

function polygonWeight(polygon) {
  const [west, south, east, north] = polygonBounds(polygon);
  const middleLatitude = ((south + north) / 2) * (Math.PI / 180);
  return Math.max(0.000001, (east - west) * (north - south) * Math.cos(middleLatitude));
}

function weightedChoice(items, weightFor, random) {
  const weights = items.map(weightFor);
  let cursor = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < items.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return items[index];
  }
  return items.at(-1);
}

export function chooseRandomLandPoint(features, random = Math.random) {
  const feature = weightedChoice(features, (item) => {
    const polygons = item.geometry.type === "Polygon"
      ? [item.geometry.coordinates]
      : item.geometry.coordinates;
    return polygons.reduce((sum, polygon) => sum + polygonWeight(polygon), 0);
  }, random);
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
  const polygon = weightedChoice(polygons, polygonWeight, random);
  const [west, south, east, north] = polygonBounds(polygon);

  for (let attempt = 0; attempt < 20_000; attempt += 1) {
    const point = [
      west + random() * (east - west),
      south + random() * (north - south),
    ];
    if (pointInPolygon(point, polygon)) return point;
  }
  throw new Error("Could not choose a point.");
}

export function chooseRandomPointForZone(zoneId, featuresByState, random = Math.random) {
  const states = ZONES[zoneId].states;
  const state = weightedChoice(states, (abbreviation) => {
    const feature = featuresByState.get(abbreviation);
    const polygons = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
    return polygons.reduce((sum, polygon) => sum + polygonWeight(polygon), 0);
  }, random);

  return {
    state,
    point: chooseRandomLandPoint([featuresByState.get(state)], random),
  };
}

export function distanceMiles([longitudeA, latitudeA], [longitudeB, latitudeB]) {
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitudeA))
    * Math.cos(toRadians(latitudeB))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 3_958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
