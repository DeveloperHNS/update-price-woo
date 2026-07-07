import fetch from "node-fetch";

const wpUrl = "https://hnsitcenter.id";
const authHeader = "Basic " + Buffer.from("HNS IT CENTER:4tFk nL1h 2YtL uQ41 3jWk u6L4").toString("base64");

async function checkMedia() {
  const res = await fetch(`${wpUrl}/wp-json/wp/v2/media?per_page=5`, {
    headers: {
      Authorization: authHeader,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, */*",
    }
  });
  const data = await res.json();
  if (res.ok) {
    console.log("Success. First media source_url:", data[0]?.source_url);
    console.log("Alt text:", data[0]?.alt_text);
  } else {
    console.error("Error:", data);
  }
}
checkMedia();
