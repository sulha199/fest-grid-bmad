import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const backendUrl = process.env.BACKEND_GRAPHQL_URL || 'http://localhost:4001/graphql';
  
  try {
    const body = await req.json();
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward authorization headers if any
        ...(req.headers.get('authorization') ? { 'authorization': req.headers.get('authorization')! } : {})
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('GraphQL Proxy Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
