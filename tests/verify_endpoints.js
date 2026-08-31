async function verifyEndpoints() {
  const tests = [
    { url: 'http://localhost:3000/api/health', expectStatus: 200 },
    { url: 'http://localhost:3000/admin', expectStatus: 200 },
    { url: 'http://localhost:3000/menu/downtown-flagship', expectStatus: 200 },
    { url: 'http://localhost:3000/api/v1/public/menu/downtown-flagship', expectStatus: 200 },
    { url: 'http://localhost:3000/api/v1/public/qr/resolve/QR_DT01_MAIN', expectStatus: 200 },
    { url: 'http://localhost:3000/qr/QR_DT01_MAIN', expectStatus: 302, redirect: 'manual' }
  ];

  let passed = 0;
  for (const t of tests) {
    const res = await fetch(t.url, { redirect: t.redirect || 'follow' });
    const isPass = res.status === t.expectStatus;
    if (isPass) passed++;
    console.log(`[${isPass ? 'PASS' : 'FAIL'}] ${t.url} -> Status ${res.status} (expected ${t.expectStatus})`);
    if (t.url.includes('/api/v1/public/menu')) {
      const data = await res.json();
      console.log('   Branch:', data.data?.branch?.name, '| Menus count:', data.data?.menus?.length);
    }
  }

  console.log(`\nEndpoint Verification: ${passed}/${tests.length} passed.`);
}

verifyEndpoints();
