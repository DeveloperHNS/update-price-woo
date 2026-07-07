import fs from 'fs';

const WOO_URL = process.env.WOO_URL;
const WOO_KEY = process.env.WOO_CONSUMER_KEY;
const WOO_SECRET = process.env.WOO_CONSUMER_SECRET;

async function check() {
  const auth = Buffer.from(`${WOO_KEY}:${WOO_SECRET}`).toString('base64');
  
  // Get main product
  const res = await fetch(`${WOO_URL}/wp-json/wc/v3/products/22075`, {
    headers: { 'Authorization': `Basic ${auth}` }
  });
  const data = await res.json();
  console.log("Product Name:", data.name);
  console.log("Status:", data.status);
  console.log("Type:", data.type);
  console.log("Catalog Visibility:", data.catalog_visibility);
  console.log("Stock Status:", data.stock_status);
  console.log("Price:", data.price);
  
  // Get variations
  const varRes = await fetch(`${WOO_URL}/wp-json/wc/v3/products/22075/variations`, {
    headers: { 'Authorization': `Basic ${auth}` }
  });
  const variations = await varRes.json();
  console.log("\nVariations count:", variations?.length);
  for (let v of (variations || [])) {
    console.log(`\nVariation ID: ${v.id}`);
    console.log(`Status: ${v.status}`);
    console.log(`Price: ${v.price}`);
    console.log(`Regular Price: ${v.regular_price}`);
    console.log(`Stock Status: ${v.stock_status}`);
    console.log(`Manage Stock: ${v.manage_stock}`);
    console.log(`Stock Quantity: ${v.stock_quantity}`);
  }
}

check();
