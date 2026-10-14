# QuickBite - Food Delivery Management System

This is a college DBMS project built from the original QuickBite SQL schema.

## Technology

- MySQL - database
- Node.js - backend runtime
- Express.js - API/server
- HTML + CSS + JavaScript - frontend
- bcryptjs - password hashing
- express-session - login sessions

## 1. Install MySQL

Make sure MySQL Server is installed and running.

## 2. Create the database

Open MySQL Workbench and run:

1. `database/schema.sql`
2. `database/seed.sql`

The schema keeps the original tables:

- Customer
- Address
- Restaurant
- Category
- Food_Item
- Orders
- Order_Item
- Payment
- Delivery_Partner
- Delivery
- Review

And adds the tables required by the website:

- Cart
- Cart_Item
- Bill
- Admin

The old hard-coded customer/order/review INSERTs were deliberately removed. Customers now enter their own data through the website.

Restaurant/menu/delivery-partner rows are seeded because these are management-side data.

## 3. Configure Node.js

Copy `.env.example` to `.env` and put your MySQL password in it.

Example:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=QuickBite
SESSION_SECRET=my_secret
PORT=3000

## 4. Install dependencies

Open Command Prompt/PowerShell inside this folder:

```text
npm install
```

## 5. Start the website

```text
node server.js
```

Then open:

http://localhost:3000

## Customer flow

Register
→ Login
→ Add/select address
→ Browse restaurants
→ View menu
→ Add to cart
→ Checkout
→ Select payment method
→ Place order
→ Bill is generated and stored in MySQL
→ View order history
→ Admin changes order to Delivered
→ Customer submits rating/review

## Admin demo

Open:

http://localhost:3000/admin.html

Demo credentials:

Username: `admin`
Password: `admin123`

The admin can update order status. When an order is changed to Delivered, the customer can review it.

## Billing

The server calculates:

Subtotal
- Discount
+ Tax
+ Delivery Fee
= Total

The calculation is repeated on the server instead of trusting the browser.

A Bill row is inserted into MySQL for every order, with:

- invoice number
- order ID
- subtotal
- discount
- tax
- delivery fee
- total
- bill date

## Important

This is a college-project payment simulation. It stores the selected payment method and payment status but does NOT connect to a real UPI/card payment gateway.

For a production application, HTTPS, stronger session configuration, CSRF protection, validation and a real payment provider would be required.
