import http from 'node:http';

/**
 * Perform a raw HTTP GET request to verify SSR HTML payload.
 * @param {string} url
 * @param {Record<string, string>} headers
 * @returns {Promise<{ statusCode: number, body: string }>}
 */
function fetchHtml(url, headers = {}) {
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
          resolve({ statusCode: res.statusCode || 0, body });
        });
      }
    );
    req.on('error', reject);
  });
}

async function verifySsr() {
  console.log('🔍 Checking Next.js 16 Multi-Zones SSR Rendering...\n');

  try {
    // 1. Check Zone 1 (Host App Router root on port 3000)
    console.log('1️⃣ Checking Zone 1 Host Gateway SSR (http://localhost:3000)...');
    const hostRes = await fetchHtml('http://localhost:3000');
    if (hostRes.statusCode !== 200) {
      console.error(`❌ Host returned status code ${hostRes.statusCode}`);
      process.exit(1);
    }

    const hostAssertions = [
      { name: 'Host Shell Title', pattern: /Next\.js 16 Multi-Zones/ },
      { name: 'Host Zone Diagnostic Title', pattern: /Enterprise Multi-Zone Gateway \(Zone 1\)/ },
      { name: 'Host RSC Rendering Engine', pattern: /React 19 Server Components \(RSC \/ App Router\)/ },
      { name: 'Host Default Session Server Identity', pattern: /Ana Souza/ },
    ];

    for (const { name, pattern } of hostAssertions) {
      if (pattern.test(hostRes.body)) {
        console.log(`  ✅ Asserted: ${name}`);
      } else {
        console.error(`  ❌ Failed: ${name} was not found in Host SSR response!`);
        process.exit(1);
      }
    }

    // 2. Check Zone 2 (Remote App Router proxied through Host on port 3000)
    console.log('\n2️⃣ Checking Zone 2 Remote App SSR via Host Proxy (http://localhost:3000/remote-app)...');
    const remoteRes = await fetchHtml('http://localhost:3000/remote-app');
    if (remoteRes.statusCode !== 200) {
      console.error(`❌ Remote zone via proxy returned status code ${remoteRes.statusCode}`);
      process.exit(1);
    }

    const remoteAssertions = [
      { name: 'Remote Zone App Router Title', pattern: /Zone 2 Remote Overview \(App Router\)/ },
      { name: 'Remote SSR Diagnostic Card', pattern: /Zone 2 SSR Federated Diagnostic Card/ },
      { name: 'SSR Request ID Label', pattern: /SSR Request ID:/ },
      { name: 'Remote Origin Text', pattern: /Remote Application \(Port 3001\)/ },
      { name: 'Session Inheritance on Server', pattern: /Inherited Multi-Zone Session|Ana Souza/ },
    ];

    for (const { name, pattern } of remoteAssertions) {
      if (pattern.test(remoteRes.body)) {
        console.log(`  ✅ Asserted: ${name}`);
      } else {
        console.error(`  ❌ Failed: ${name} was not found in Remote Zone SSR response!`);
        process.exit(1);
      }
    }

    console.log('\n🎉 SUCCESS: Next.js 16 Multi-Zones SSR is fully verified across both zones!');
  } catch (err) {
    console.error('❌ Error during Multi-Zones SSR verification:', err.message);
    process.exit(1);
  }
}

verifySsr();
