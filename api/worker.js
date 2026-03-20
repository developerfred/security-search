/**
 * Security Search Community API
 * Deploy to Cloudflare Workers: wrangler deploy
 * 
 * Endpoints:
 *   GET  /api/list        - Get community list
 *   POST /api/report      - Submit a report
 *   GET  /api/stats       - Get community stats
 */

const DB = {
  scams: [],
  safe: [],
  reports: []
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (path === '/api/list' && request.method === 'GET') {
      return getList();
    }
    
    if (path === '/api/report' && request.method === 'POST') {
      return await submitReport(request);
    }
    
    if (path === '/api/stats' && request.method === 'GET') {
      return getStats();
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

function getList() {
  const response = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    scams: DB.scams.filter(s => s.votes >= 3 || s.verified),
    safe: DB.safe.filter(s => s.votes >= 2 || s.verified)
  };

  return new Response(JSON.stringify(response, null, 2), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function submitReport(request) {
  const body = await request.json();
  const { type, url, reason, protocolName, category } = body;

  if (!url || !type) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const report = {
    id: crypto.randomUUID(),
    type,
    url,
    reason: reason || '',
    protocolName: protocolName || '',
    category: category || 'Unknown',
    reportedAt: Date.now(),
    votes: 1,
    verified: false
  };

  if (type === 'scam') {
    const existing = DB.scams.find(s => s.url === url);
    if (existing) {
      existing.votes++;
      return new Response(JSON.stringify({ success: true, report: existing, message: 'Vote recorded' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    DB.scams.push(report);
  } else {
    const existing = DB.safe.find(s => s.url === url);
    if (existing) {
      existing.votes++;
      return new Response(JSON.stringify({ success: true, report: existing, message: 'Vote recorded' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    DB.safe.push(report);
  }

  DB.reports.push(report);

  return new Response(JSON.stringify({ success: true, report }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function getStats() {
  return new Response(JSON.stringify({
    totalScams: DB.scams.length,
    totalSafe: DB.safe.length,
    totalReports: DB.reports.length,
    verifiedScams: DB.scams.filter(s => s.verified).length,
    verifiedSafe: DB.safe.filter(s => s.verified).length
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

export default {
  fetch: handleRequest
};
