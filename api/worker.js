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

const RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 30,
  ipRequests: new Map()
};

function getRateLimitInfo(ip) {
  const now = Date.now();
  const record = RATE_LIMIT.ipRequests.get(ip);
  
  if (!record) {
    RATE_LIMIT.ipRequests.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
  }
  
  if (now > record.resetAt) {
    RATE_LIMIT.ipRequests.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
  }
  
  if (record.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT.maxRequests - record.count };
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractDomain(urlString) {
  try {
    return new URL(urlString).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isSuspiciousUrl(url) {
  const suspiciousPatterns = [
    /[a-z0-9]{20,}/,
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
    /[-]{3,}/,
    /[.]{5,}/
  ];
  
  const domain = extractDomain(url);
  if (!domain) return true;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(domain)) return true;
  }
  
  return false;
}

async function handleRequest(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimit = getRateLimitInfo(ip);
  
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    }), {
      status: 429,
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        ...corsHeaders 
      }
    });
  }
  
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/|\/$/g, '');

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (path === 'api/list' && request.method === 'GET') {
      return getList();
    }
    
    if (path === 'api/report' && request.method === 'POST') {
      return await submitReport(request);
    }
    
    if (path === 'api/stats' && request.method === 'GET') {
      return getStats();
    }

    if (path === 'api/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
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
    scams: DB.scams.filter(s => s.votes >= 3 || s.verified).map(s => ({
      url: s.url,
      reason: s.reason,
      votes: s.votes,
      verified: s.verified,
      reportedAt: s.reportedAt
    })),
    safe: DB.safe.filter(s => s.votes >= 2 || s.verified).map(s => ({
      url: s.url,
      protocolName: s.protocolName,
      category: s.category,
      votes: s.votes,
      verified: s.verified,
      reportedAt: s.reportedAt
    }))
  };

  return new Response(JSON.stringify(response), {
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      ...corsHeaders 
    }
  });
}

async function submitReport(request) {
  let body;
  
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  
  const { type, url, reason, protocolName, category } = body;

  if (!url || !type) {
    return new Response(JSON.stringify({ error: 'Missing required fields: url and type are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  if (!isValidUrl(url)) {
    return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  
  if (isSuspiciousUrl(url)) {
    return new Response(JSON.stringify({ error: 'Suspicious URL detected' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  if (!['scam', 'safe'].includes(type)) {
    return new Response(JSON.stringify({ error: 'Invalid type: must be "scam" or "safe"' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const normalizedUrl = url.toLowerCase().replace(/\/$/, '');
  
  const report = {
    id: crypto.randomUUID(),
    type,
    url: normalizedUrl,
    reason: String(reason || '').slice(0, 500),
    protocolName: String(protocolName || '').slice(0, 100),
    category: String(category || 'Unknown').slice(0, 50),
    reportedAt: Date.now(),
    votes: 1,
    verified: false
  };

  if (type === 'scam') {
    const existing = DB.scams.find(s => s.url === normalizedUrl);
    if (existing) {
      existing.votes++;
      existing.reason = existing.reason || report.reason;
      return new Response(JSON.stringify({ 
        success: true, 
        report: existing, 
        message: 'Vote recorded',
        votes: existing.votes
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    DB.scams.push(report);
  } else {
    const existing = DB.safe.find(s => s.url === normalizedUrl);
    if (existing) {
      existing.votes++;
      return new Response(JSON.stringify({ 
        success: true, 
        report: existing, 
        message: 'Vote recorded',
        votes: existing.votes
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    DB.safe.push(report);
  }

  DB.reports.push(report);

  return new Response(JSON.stringify({ 
    success: true, 
    report,
    message: 'Report submitted successfully'
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function getStats() {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  
  const recentReports = DB.reports.filter(r => r.reportedAt > oneDayAgo);
  const weeklyReports = DB.reports.filter(r => r.reportedAt > oneWeekAgo);

  return new Response(JSON.stringify({
    total: {
      scams: DB.scams.length,
      safe: DB.safe.length,
      reports: DB.reports.length
    },
    verified: {
      scams: DB.scams.filter(s => s.verified).length,
      safe: DB.safe.filter(s => s.verified).length
    },
    recentActivity: {
      last24h: {
        reports: recentReports.length,
        scams: recentReports.filter(r => r.type === 'scam').length,
        safe: recentReports.filter(r => r.type === 'safe').length
      },
      last7d: {
        reports: weeklyReports.length,
        scams: weeklyReports.filter(r => r.type === 'scam').length,
        safe: weeklyReports.filter(r => r.type === 'safe').length
      }
    },
    topVoted: {
      scams: DB.scams.sort((a, b) => b.votes - a.votes).slice(0, 5).map(s => ({ url: s.url, votes: s.votes })),
      safe: DB.safe.sort((a, b) => b.votes - a.votes).slice(0, 5).map(s => ({ url: s.url, votes: s.votes }))
    },
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

export default {
  fetch: handleRequest
};
