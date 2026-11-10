import http from "k6/http";
import { check } from "k6";

const vus = Number(__ENV.LOAD_TEST_VUS ?? "100");
const duration = __ENV.LOAD_TEST_DURATION ?? "3m";
const baseUrl = __ENV.LOAD_TEST_URL;
const sessionCookie = __ENV.LOAD_TEST_COOKIE;

if (!Number.isInteger(vus) || vus < 100 || vus > 500) {
  throw new Error("LOAD_TEST_VUS must be an integer from 100 through 500.");
}
if (!baseUrl || !sessionCookie) {
  throw new Error("Set LOAD_TEST_URL and LOAD_TEST_COOKIE for an authenticated staging account.");
}

export const options = {
  stages: [
    { duration: "1m", target: Math.ceil(vus / 4) },
    { duration, target: vus },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

function loadAuthenticatedData() {
  const response = http.get(`${baseUrl.replace(/\/+$/, "")}/api/data`, {
    headers: { Cookie: sessionCookie },
    tags: { endpoint: "authenticated-data-read" },
  });
  check(response, {
    "authenticated data request succeeds": (result) => result.status === 200,
  });
}

export default loadAuthenticatedData;
