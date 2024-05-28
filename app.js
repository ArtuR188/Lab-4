// app.js

const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(bodyParser.json());

// Підключення до бази даних PostgreSQL
const pool = new Pool({
  user: 'your_user',
  host: 'localhost',
  database: 'your_database',
  password: 'your_password',
  port: 5432,
});

// Функція для перевірки існування адресів в базі даних
async function checkAddressesExist(from, to) {
  const query = {
    text: 'SELECT COUNT(*) FROM addresses WHERE address = $1 OR address = $2',
    values: [from, to],
  };
  const result = await pool.query(query);
  return result.rows[0].count === '2';
}

// Функція для розрахунку відстані між двома адресами
function calculateDistance(from, to) {
  // Реалізація розрахунку відстані
}

// Роутер для користувачів
const usersRouter = require('./routers/users.router');
app.use('/users', usersRouter);

// Роутер для адрес
const addressesRouter = require('./routers/addresses.router');
app.use('/addresses', addressesRouter);

// Реєстрація користувача з роллю "Customer"
app.post('/users/register', async (req, res) => {
  const { login, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const query = {
    text: 'INSERT INTO users (login, password, role) VALUES ($1, $2, $3) RETURNING id',
    values: [login, hashedPassword, 'Customer'],
  };
  try {
    const result = await pool.query(query);
    res.status(201).json({ message: 'User registered successfully', userId: result.rows[0].id });
  } catch (error) {
    console.error('Error during user registration:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Роутер для адміністратора
app.post('/admin', async (req, res) => {
  const { login, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const query = {
    text: 'INSERT INTO users (login, password, role) VALUES ($1, $2, $3) RETURNING id',
    values: [login, hashedPassword, 'Admin'],
  };
  try {
    const result = await pool.query(query);
    res.status(201).json({ message: 'Admin user created successfully', userId: result.rows[0].id });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Роутер для водіїв
app.post('/drivers', async (req, res) => {
  const { login, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const query = {
    text: 'INSERT INTO users (login, password, role) VALUES ($1, $2, $3) RETURNING id',
    values: [login, hashedPassword, 'Driver'],
  };
  try {
    const result = await pool.query(query);
    res.status(201).json({ message: 'Driver user created successfully', userId: result.rows[0].id });
  } catch (error) {
    console.error('Error creating driver user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Реалізація логіки роуту для отримання списку замовлень
app.get('/orders', authenticateToken, async (req, res) => {
  const userRole = req.user.role;
  let orders;
  switch (userRole) {
    case 'Customer':
      orders = await getCustomerOrders(req.user.id);
      break;
    case 'Driver':
      orders = await getActiveOrders();
      break;
    case 'Admin':
      orders = await getAllOrders();
      break;
    default:
      return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(orders);
});

// Реалізація логіки зміни статусу замовлення
app.patch('/orders/:orderId', authenticateToken, async (req, res) => {
  const orderId = req.params.orderId;
  const { status } = req.body;
  const userRole = req.user.role;

  const order = await getOrder(orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Перевірка доступу для користувача з роллю Customer
  if (userRole === 'Customer') {
    if (order.status !== 'Active' || status !== 'Rejected') {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  // Перевірка доступу для користувача з роллю Driver
  if (userRole === 'Driver') {
    if (
      (order.status !== 'Active' && status !== 'In progress') ||
      (order.status !== 'In progress' && status !== 'Done')
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  // Перевірка доступу для користувача з роллю Admin
  if (userRole === 'Admin') {
    if (
      (order.status === 'Active' && status !== 'Rejected') ||
      (order.status === 'Active' && status !== 'In progress') ||
      (order.status === 'In progress' && status !== 'Done')
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  // Не дозволяти міняти статус з "Done"
  if (order.status === 'Done') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Оновлення статусу замовлення
  await updateOrderStatus(orderId, status);
  res.json({ message: 'Order status updated' });
});

// Реалізація функції аутентифікації токена
function authenticateToken(req
