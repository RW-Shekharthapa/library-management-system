const express = require('express');
const app = express();
app.use(express.json());

app.get('/api/health', (_q, r) => r.json({ status: 'ok' }));
app.get('/api/db', async (_q, r) => { const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 }); try { await c.connect(); await c.query('select 1'); r.json({ db: 'ok' }); } catch (e) { r.status(503).json({ db: 'error', message: e.message }); } finally { c.end().catch(() => {}); } });

// ponytail: in-memory store, no DB wiring — swap for postgres if data needs to survive a restart
let books = [];
let nextId = 1;

app.get('/api/books', (_q, r) => r.json(books));

app.get('/api/books/:id', (req, r) => {
  const book = books.find(b => b.id === Number(req.params.id));
  if (!book) return r.status(404).json({ message: 'not found' });
  r.json(book);
});

app.post('/api/books', (req, r) => {
  const { title, author, isbn, copies } = req.body;
  if (!title || !author) return r.status(400).json({ message: 'title and author are required' });
  const book = { id: nextId++, title, author, isbn: isbn || null, copies: copies ?? 1, available: copies ?? 1 };
  books.push(book);
  r.status(201).json(book);
});

app.put('/api/books/:id', (req, r) => {
  const book = books.find(b => b.id === Number(req.params.id));
  if (!book) return r.status(404).json({ message: 'not found' });
  Object.assign(book, req.body);
  r.json(book);
});

app.delete('/api/books/:id', (req, r) => {
  const idx = books.findIndex(b => b.id === Number(req.params.id));
  if (idx === -1) return r.status(404).json({ message: 'not found' });
  books.splice(idx, 1);
  r.status(204).end();
});

app.post('/api/books/:id/borrow', (req, r) => {
  const book = books.find(b => b.id === Number(req.params.id));
  if (!book) return r.status(404).json({ message: 'not found' });
  if (book.available < 1) return r.status(409).json({ message: 'no copies available' });
  book.available--;
  r.json(book);
});

app.post('/api/books/:id/return', (req, r) => {
  const book = books.find(b => b.id === Number(req.params.id));
  if (!book) return r.status(404).json({ message: 'not found' });
  if (book.available >= book.copies) return r.status(409).json({ message: 'all copies already returned' });
  book.available++;
  r.json(book);
});

if (require.main === module) {
  const port = process.env.PORT || 8080;
  app.listen(port, '0.0.0.0', () => console.log('API on :' + port));
}

module.exports = app;
