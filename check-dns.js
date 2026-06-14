const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

const host = 'db.fxwgbpassouaddakgyus.supabase.co';

dns.resolve4(host, (err, addresses) => {
  if (err) {
    console.log('IPv4 resolution failed:', err.message);
  } else {
    console.log('IPv4 addresses:', addresses);
  }
});

dns.resolve6(host, (err, addresses) => {
  if (err) {
    console.log('IPv6 resolution failed:', err.message);
  } else {
    console.log('IPv6 addresses:', addresses);
  }
});

setTimeout(() => process.exit(0), 5000);
