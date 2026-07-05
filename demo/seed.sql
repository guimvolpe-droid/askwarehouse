CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, country TEXT);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, amount REAL, status TEXT, created_at TEXT);
INSERT INTO customers (id, name, country) VALUES (1,'Alice','US'), (2,'Bob','BR'), (3,'Carol','US');
INSERT INTO orders (id, customer_id, amount, status, created_at) VALUES
  (1,1,100.0,'paid','2026-01-05'),
  (2,1,50.0,'paid','2026-02-10'),
  (3,2,200.0,'paid','2026-01-20'),
  (4,3,75.0,'refunded','2026-03-01'),
  (5,2,25.0,'paid','2026-03-15');
