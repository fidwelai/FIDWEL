const LOCATION_KEY = "fidwel_location";
const LOCATION_EVENT = "fidwel-location-change";

export function subscribeToPreferredLocation(callback: () => void) {
  window.addEventListener(LOCATION_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LOCATION_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function getPreferredLocationSnapshot(): string {
  return window.localStorage.getItem(LOCATION_KEY) ?? "Lagos";
}

export function getPreferredLocationServerSnapshot(): string {
  return "Lagos";
}

export function savePreferredLocation(location: string) {
  window.localStorage.setItem(LOCATION_KEY, location);
  window.dispatchEvent(new Event(LOCATION_EVENT));
}
