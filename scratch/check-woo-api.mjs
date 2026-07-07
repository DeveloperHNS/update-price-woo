import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const wpUrl = process.env.WOO_URL;
const key = process.env.WOO_CONSUMER_KEY;
const secret = process.env.WOO_CONSUMER_SECRET;

const authHeader = "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");

async function checkWoo() {
  console.log("Fetching from:", `${wpUrl}/wp-json/wc/v3/products?per_page=1`);
  const res = await fetch(`${wpUrl}/wp-json/wc/v3/products?per_page=1`, {
    headers: {
      Authorization: authHeader,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, */*",
    }
  });
  
  console.log("Status:", res.status, res.statusText);
  const text = await res.text();
  console.log("Response Text:", text.slice(0, 500));
}
checkWoo();
