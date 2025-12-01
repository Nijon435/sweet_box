// Configuration for API endpoints
// Auto-detect: Production vs Local
if (
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
) {
  window.API_BASE_URL = "https://sweetbox-backend.onrender.com";
  window.APP_STATE_ENDPOINT = "https://sweetbox-backend.onrender.com/api/state";
} else {
  window.API_BASE_URL = "http://localhost:8000";
  window.APP_STATE_ENDPOINT = "http://localhost:8000/api/state";
}

console.log("API Base URL configured:", window.API_BASE_URL);
console.log("API State Endpoint configured:", window.APP_STATE_ENDPOINT);
