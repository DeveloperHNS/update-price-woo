import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, ck, cs, endpoint, method = 'GET', data, params } = body;

    if (!url || !ck || !cs || !endpoint) {
      return NextResponse.json({ error: 'Missing required credentials or endpoint' }, { status: 400 });
    }

    const base = url.replace(/\/+$/, '');
    const apiUrl = new URL(`${base}/wp-json/wc/v3/${endpoint}`);
    
    // Add authentication parameters
    apiUrl.searchParams.set('consumer_key', ck);
    apiUrl.searchParams.set('consumer_secret', cs);
    
    // Add any extra query parameters
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        apiUrl.searchParams.set(k, String(v));
      }
    }

    const opts: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      opts.body = JSON.stringify(data);
    }

    const response = await fetch(apiUrl.toString(), opts);
    
    // WooCommerce sometimes returns empty bodies for 204 No Content
    const responseText = await response.text();
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: responseData.message || `WooCommerce API Error: ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
