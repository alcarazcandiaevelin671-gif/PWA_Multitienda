export function haversineDistanceKm(
  latitudeFrom: number,
  longitudeFrom: number,
  latitudeTo: number,
  longitudeTo: number,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitudeTo - latitudeFrom);
  const longitudeDelta = radians(longitudeTo - longitudeFrom);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeFrom)) * Math.cos(radians(latitudeTo)) * Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}