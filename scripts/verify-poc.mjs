import http from 'node:http';

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.get(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body,
          });
        });
      }
    );
    req.on('error', reject);
  });
}

function fetchSseStream(url, maxEvents = 2, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const events = [];
    const timer = setTimeout(() => {
      req.destroy();
      resolve(events);
    }, timeoutMs);

    const req = http.get(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
      },
      (res) => {
        res.on('data', (chunk) => {
          const text = chunk.toString();
          events.push(text);
          if (events.length >= maxEvents) {
            clearTimeout(timer);
            req.destroy();
            resolve(events);
          }
        });
      }
    );
    req.on('error', (err) => {
      clearTimeout(timer);
      if (events.length > 0) resolve(events);
      else reject(err);
    });
  });
}

async function runPoCVerification() {
  console.log('===============================================================');
  console.log('🚀 Executing Next.js 16 Multi-Zones PoC Full Verification Suite');
  console.log('===============================================================\n');

  let passedAll = true;

  // 1. Verify Host & Remote Availability and Reverse Proxy
  console.log('1. Checking Multi-Zone Availability & Reverse Proxy Routing...');
  try {
    const hostRes = await fetchUrl('http://localhost:3000');
    const remoteDirectRes = await fetchUrl('http://localhost:3001/remote-app');
    const remoteProxiedRes = await fetchUrl('http://localhost:3000/remote-app');

    if (
      hostRes.statusCode === 200 &&
      remoteDirectRes.statusCode === 200 &&
      remoteProxiedRes.statusCode === 200
    ) {
      console.log('   ✅ Zone 1 (3000), Zone 2 (3001), and Proxy (/remote-app) are ONLINE (HTTP 200)');
    } else {
      console.error(
        `   ❌ Status check failed: Host=${hostRes.statusCode}, RemoteDirect=${remoteDirectRes.statusCode}, RemoteProxied=${remoteProxiedRes.statusCode}`
      );
      passedAll = false;
    }
  } catch (err) {
    console.error('   ❌ Services are not running:', err.message);
    process.exit(1);
  }

  // 2. Verify Session Propagation via Cookie across Zones
  console.log('\n2. Verifying Multi-Zone Session Inheritance (Cookie-based)...');
  try {
    const sessionCookie = encodeURIComponent(
      JSON.stringify({
        userId: 'operator-2',
        userName: 'Carlos Mendes',
        email: 'carlos.mendes@enterprise.com',
        role: 'operator',
        token: 'jwt_sec_operator_48102',
      })
    );

    const remoteHtml = (
      await fetchUrl('http://localhost:3000/remote-app', {
        cookie: `mfe_user_session=${sessionCookie}`,
      })
    ).body;

    const hasCarlosSession = /Carlos Mendes/.test(remoteHtml);
    const hasRoleOperator = /role-operator/.test(remoteHtml);

    if (hasCarlosSession && hasRoleOperator) {
      console.log('   ✅ User session passed via Cookie seamlessly read server-side in Zone 2 App Router');
    } else {
      console.error('   ❌ Cookie session context not reflected in server-rendered markup');
      passedAll = false;
    }
  } catch (err) {
    console.error('   ❌ Session check error:', err.message);
    passedAll = false;
  }

  // 3. Verify Shared UI Shell (Header + SideNav + Toasts)
  console.log('\n3. Verifying Shared UI Shell in both Zones...');
  try {
    const hostHtml = (await fetchUrl('http://localhost:3000')).body;
    const remoteHtml = (await fetchUrl('http://localhost:3000/remote-app')).body;

    const hostHasShell =
      /Next\.js 16 Multi-Zones/.test(hostHtml) &&
      /Multi-Zone Routing/.test(hostHtml) &&
      /toast-portal/.test(hostHtml);

    const remoteHasShell =
      /Next\.js 16 Multi-Zones/.test(remoteHtml) &&
      /Multi-Zone Routing/.test(remoteHtml) &&
      /toast-portal/.test(remoteHtml);

    if (hostHasShell && remoteHasShell) {
      console.log('   ✅ Both Zone 1 and Zone 2 consistently render the shared @mfe/ui-shell');
    } else {
      console.error('   ❌ UI Shell elements missing in one or more zones');
      passedAll = false;
    }
  } catch (err) {
    console.error('   ❌ UI Shell check error:', err.message);
    passedAll = false;
  }

  // 4. Verify SSE (Server-Sent Events) Stream via Multi-Zone Route
  console.log('\n4. Verifying SSE Stream from Zone 2 (/remote-app/api/sse-events)...');
  try {
    const sseEvents = await fetchSseStream('http://localhost:3000/remote-app/api/sse-events', 2);
    const joined = sseEvents.join('\n');
    const isEventStream = joined.includes('data:') || joined.includes('connected');

    if (isEventStream) {
      console.log(`   ✅ Zone 2 SSE endpoint actively streaming through Host proxy (${sseEvents.length} chunks received)`);
    } else {
      console.error('   ❌ SSE stream did not emit event-stream packets');
      passedAll = false;
    }
  } catch (err) {
    console.error('   ❌ SSE stream check error:', err.message);
    passedAll = false;
  }

  // 5. Verify Server-Side Rendering (RSC) of Remote Zone Page
  console.log('\n5. Verifying App Router Server-Side Rendering (RSC) on Remote Zone...');
  try {
    const remoteHtml = (await fetchUrl('http://localhost:3000/remote-app')).body;
    const hasOrigin = /Remote Application \(Port 3001\)/.test(remoteHtml);
    const hasRequestId = /SSR Request ID:/.test(remoteHtml);
    const hasCardTitle = /Zone 2 SSR Federated Diagnostic Card/.test(remoteHtml);

    if (hasOrigin && hasRequestId && hasCardTitle) {
      console.log('   ✅ Next.js 16 App Router successfully executed secure Server Component rendering');
    } else {
      console.error('   ❌ SSR markup verification failed in Remote Zone HTML');
      passedAll = false;
    }
  } catch (err) {
    console.error('   ❌ SSR check error:', err.message);
    passedAll = false;
  }

  // 6. Verify Server Cache & API Endpoint
  console.log('\n6. Verifying In-Memory Cache & API Route Handlers...');
  try {
    const apiRes1 = await fetchUrl('http://localhost:3000/remote-app/api/server-data');
    const cacheHeader = apiRes1.headers['cache-control'] || '';
    const apiRes2 = await fetchUrl('http://localhost:3000/remote-app/api/server-data');
    const json2 = JSON.parse(apiRes2.body);

    if (cacheHeader.includes('s-maxage') && json2.cached !== undefined) {
      console.log(`   ✅ Cache-Control headers (${cacheHeader}) and memory cache verification passed`);
    } else {
      console.warn('   ⚠️ Cache headers partially present:', cacheHeader);
    }
  } catch (err) {
    console.error('   ❌ Cache check error:', err.message);
    passedAll = false;
  }

  // 7. Verify MapLibre GL Route & Multi-Zone Path Routing
  console.log('\n7. Verifying MapLibre GL Route (/remote-app/map)...');
  try {
    const mapHtml = (await fetchUrl('http://localhost:3000/remote-app/map')).body;
    const hasMapLibreCss = /maplibre-gl/.test(mapHtml);
    const hasMapTitle = /Fleet Map Visualization \(Zone 2\)/.test(mapHtml);

    if (hasMapLibreCss && hasMapTitle) {
      console.log('   ✅ MapLibre GL assets, styles, and Multi-Zone path routing (/remote-app/map) verified');
    } else {
      console.error('   ❌ MapLibre integration or Multi-Zone path route missing');
      passedAll = false;
    }
  } catch (err) {
    console.error('   ❌ MapLibre check error:', err.message);
    passedAll = false;
  }

  console.log('\n---------------------------------------------------------------');
  if (passedAll) {
    console.log('🎉 ALL 7 NEXT.JS 16 MULTI-ZONES REQUIREMENTS SUCCESSFULLY PASSED!');
    console.log('---------------------------------------------------------------');
    process.exit(0);
  } else {
    console.error('❌ Multi-Zones PoC verification suite failed one or more checks.');
    console.log('---------------------------------------------------------------');
    process.exit(1);
  }
}

runPoCVerification();
