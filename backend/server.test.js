const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('./server');

function request(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ port, method, path, headers: data ? { 'Content-Type': 'application/json' } : {} }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => resolve({ status: res.statusCode, body: chunks ? JSON.parse(chunks) : null }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('book CRUD and borrow/return flow', async () => {
  const server = app.listen(0);
  try {
    const created = await request(server, 'POST', '/api/books', { title: 'Dune', author: 'Herbert', copies: 1 });
    assert.strictEqual(created.status, 201);
    const id = created.body.id;

    const listed = await request(server, 'GET', '/api/books');
    assert.strictEqual(listed.body.length, 1);

    const borrowed = await request(server, 'POST', `/api/books/${id}/borrow`);
    assert.strictEqual(borrowed.body.available, 0);

    const overBorrow = await request(server, 'POST', `/api/books/${id}/borrow`);
    assert.strictEqual(overBorrow.status, 409);

    const returned = await request(server, 'POST', `/api/books/${id}/return`);
    assert.strictEqual(returned.body.available, 1);

    const deleted = await request(server, 'DELETE', `/api/books/${id}`);
    assert.strictEqual(deleted.status, 204);

    const missing = await request(server, 'GET', `/api/books/${id}`);
    assert.strictEqual(missing.status, 404);
  } finally {
    server.close();
  }
});
