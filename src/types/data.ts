/**
 * Map Locations sheet row (columns A–D).
 * Column A=Location, B=Visual_Lat (Y), C=Visual_Lon (X), D=Shape.
 */
export type MapLocationRow = {
  location: string;
  visualLatY: number;
  visualLonX: number;
  shape: string;
};

/**
 * Oct_7th_DB sheet row (columns used: A, K, P, Q, AC, AD, AG, AJ).
 */
export type Oct7thDBRow = {
  pid: string;
  age: string;
  status: string;
  eventDate: string;
  latAlternate: number;
  longAlternate: number;
  newMaubDeathLoc: string;
  imageUrl: string;
};

/**
 * Location with overview dot metadata (size, shape) and optional map center for Detail view.
 */
export type OverviewLocation = MapLocationRow & {
  dotSize: number;
  shapeDisplay: string; // shape with '?' normalized to 'rest'
  centerLat?: number;
  centerLon?: number;
};

/**
 * Victim record for Detail view list (pid, age, image URL).
 */
export type VictimRecord = {
  pid: string;
  age: string;
  imageUrl: string;
};
