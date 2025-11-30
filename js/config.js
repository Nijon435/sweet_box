// Configuration for API endpoints
// Auto-detect: Production vs Local
if (
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
) {
  window.APP_STATE_ENDPOINT = "https://sweetbox-backend.onrender.com/api/state";
} else {
  window.APP_STATE_ENDPOINT = "http://localhost:8000/api/state";
}

console.log("API Endpoint configured:", window.APP_STATE_ENDPOINT);
