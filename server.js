require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || "quickbite_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 4
    }
}));

app.use(express.static(path.join(__dirname, "public")));

function requireCustomer(req, res, next) {
    if (!req.session.customer) {
        return res.status(401).json({ error: "Please login first." });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.admin) {
        return res.status(401).json({ error: "Admin login required." });
    }
    next();
}

/* =========================
   AUTH
========================= */

app.post("/api/register", async (req, res) => {
    try {
        const { name, email, phone, password, address, city, pincode } = req.body;

        if (!name || !email || !phone || !password || !address) {
            return res.status(400).json({ error: "Please fill all required fields." });
        }

        const [existing] = await pool.query(
            "SELECT customer_id FROM Customer WHERE email = ?",
            [email]
        );

        if (existing.length) {
            return res.status(409).json({ error: "Email already registered." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const conn = await pool.getConnection();

        try {
            await conn.beginTransaction();

            const [customerResult] = await conn.query(
                `INSERT INTO Customer (name, email, phone, password)
                 VALUES (?, ?, ?, ?)`,
                [name, email, phone, hashedPassword]
            );

            const customerId = customerResult.insertId;

            await conn.query(
                `INSERT INTO Address (customer_id, address, city, pincode)
                 VALUES (?, ?, ?, ?)`,
                [customerId, address, city || "", pincode || ""]
            );

            await conn.query(
                "INSERT INTO Cart (customer_id) VALUES (?)",
                [customerId]
            );

            await conn.commit();

            req.session.customer = {
                customer_id: customerId,
                name,
                email
            };

            res.json({ message: "Registration successful." });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Registration failed." });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await pool.query(
            "SELECT * FROM Customer WHERE email = ?",
            [email]
        );

        if (!rows.length) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const customer = rows[0];
        const valid = await bcrypt.compare(password, customer.password);

        if (!valid) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        req.session.customer = {
            customer_id: customer.customer_id,
            name: customer.name,
            email: customer.email
        };

        res.json({ message: "Login successful." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login failed." });
    }
});
app.post("/api/forgot-password", async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword || newPassword.length < 6) {
            return res.status(400).json({
                error: "Enter your email and a password of at least 6 characters."
            });
        }

        const [rows] = await pool.query(
            "SELECT customer_id FROM Customer WHERE email = ?",
            [email]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: "Email not found."
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(
            "UPDATE Customer SET password = ? WHERE email = ?",
            [hashedPassword, email]
        );

        res.json({ message: "Password reset successful! You can now log in." });

    } catch (err) {
        console.error("Forgot Password route failed:", err);
        res.status(500).json({ error: "Could not reset password. Check the CMD/terminal window running QuickBite for the exact error." });
    }
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ message: "Logged out." });
    });
});

app.get("/api/me", (req, res) => {
    res.json({
        customer: req.session.customer || null,
        admin: req.session.admin || null
    });
});

/* =========================
   CUSTOMER PROFILE / ADDRESS
========================= */

app.get("/api/addresses", requireCustomer, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM Address WHERE customer_id = ? ORDER BY address_id DESC",
            [req.session.customer.customer_id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not load addresses." });
    }
});

app.post("/api/addresses", requireCustomer, async (req, res) => {
    try {
        const { address, city, pincode } = req.body;

        if (!address) {
            return res.status(400).json({ error: "Address is required." });
        }

        await pool.query(
            `INSERT INTO Address (customer_id, address, city, pincode)
             VALUES (?, ?, ?, ?)`,
            [req.session.customer.customer_id, address, city || "", pincode || ""]
        );

        res.json({ message: "Address added." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not add address." });
    }
});

/* =========================
   RESTAURANTS / MENU
========================= */

app.get("/api/restaurants", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM Restaurant ORDER BY rating DESC, name"
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not load restaurants." });
    }
});

app.get("/api/restaurants/:id/menu", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT f.item_id, f.item_name, f.price, f.availability,
                    c.category_name
             FROM Food_Item f
             LEFT JOIN Category c ON f.category_id = c.category_id
             WHERE f.restaurant_id = ?
             ORDER BY c.category_name, f.item_name`,
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not load menu." });
    }
});

/* =========================
   CART
========================= */

app.get("/api/cart", requireCustomer, async (req, res) => {
    try {
        const customerId = req.session.customer.customer_id;

        const [rows] = await pool.query(
            `SELECT ci.cart_item_id, ci.item_id, ci.quantity,
                    f.item_name, f.price, f.restaurant_id,
                    r.name AS restaurant_name,
                    (ci.quantity * f.price) AS line_total
             FROM Cart c
             JOIN Cart_Item ci ON c.cart_id = ci.cart_id
             JOIN Food_Item f ON ci.item_id = f.item_id
             JOIN Restaurant r ON f.restaurant_id = r.restaurant_id
             WHERE c.customer_id = ?
             ORDER BY ci.cart_item_id`,
            [customerId]
        );

        let subtotal = 0;
        rows.forEach(item => subtotal += Number(item.line_total));

        res.json({ items: rows, subtotal });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not load cart." });
    }
});

app.post("/api/cart", requireCustomer, async (req, res) => {
    const conn = await pool.getConnection();

    try {
        const { item_id, quantity = 1 } = req.body;
        const customerId = req.session.customer.customer_id;

        if (!item_id || quantity < 1) {
            return res.status(400).json({ error: "Invalid item or quantity." });
        }

        await conn.beginTransaction();

        const [cartRows] = await conn.query(
            "SELECT cart_id FROM Cart WHERE customer_id = ?",
            [customerId]
        );

        let cartId;

        if (cartRows.length) {
            cartId = cartRows[0].cart_id;
        } else {
            const [result] = await conn.query(
                "INSERT INTO Cart (customer_id) VALUES (?)",
                [customerId]
            );
            cartId = result.insertId;
        }

        const [itemRows] = await conn.query(
            "SELECT item_id, restaurant_id, availability FROM Food_Item WHERE item_id = ?",
            [item_id]
        );

        if (!itemRows.length || !itemRows[0].availability) {
            await conn.rollback();
            return res.status(400).json({ error: "Item is unavailable." });
        }

        const restaurantId = itemRows[0].restaurant_id;

        // One order/cart is kept for one restaurant at a time.
        const [cartRestaurant] = await conn.query(
            `SELECT DISTINCT f.restaurant_id
             FROM Cart_Item ci
             JOIN Food_Item f ON ci.item_id = f.item_id
             WHERE ci.cart_id = ?`,
            [cartId]
        );

        if (cartRestaurant.length &&
            cartRestaurant[0].restaurant_id !== restaurantId) {
            await conn.rollback();
            return res.status(400).json({
                error: "Your cart already contains items from another restaurant. Clear the cart first."
            });
        }

        await conn.query(
            `INSERT INTO Cart_Item (cart_id, item_id, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
            [cartId, item_id, quantity]
        );

        await conn.commit();
        res.json({ message: "Item added to cart." });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: "Could not add item to cart." });
    } finally {
        conn.release();
    }
});

app.put("/api/cart/:cartItemId", requireCustomer, async (req, res) => {
    try {
        const quantity = Number(req.body.quantity);

        if (!Number.isInteger(quantity) || quantity < 1) {
            return res.status(400).json({ error: "Quantity must be at least 1." });
        }

        const [result] = await pool.query(
            `UPDATE Cart_Item ci
             JOIN Cart c ON ci.cart_id = c.cart_id
             SET ci.quantity = ?
             WHERE ci.cart_item_id = ? AND c.customer_id = ?`,
            [quantity, req.params.cartItemId, req.session.customer.customer_id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: "Cart item not found." });
        }

        res.json({ message: "Cart updated." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not update cart." });
    }
});

app.delete("/api/cart/:cartItemId", requireCustomer, async (req, res) => {
    try {
        const [result] = await pool.query(
            `DELETE ci FROM Cart_Item ci
             JOIN Cart c ON ci.cart_id = c.cart_id
             WHERE ci.cart_item_id = ? AND c.customer_id = ?`,
            [req.params.cartItemId, req.session.customer.customer_id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: "Cart item not found." });
        }

        res.json({ message: "Item removed." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not remove item." });
    }
});

app.delete("/api/cart", requireCustomer, async (req, res) => {
    try {
        await pool.query(
            `DELETE ci FROM Cart_Item ci
             JOIN Cart c ON ci.cart_id = c.cart_id
             WHERE c.customer_id = ?`,
            [req.session.customer.customer_id]
        );
        res.json({ message: "Cart cleared." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not clear cart." });
    }
});

/* =========================
   CHECKOUT + BILLING
========================= */

app.post("/api/orders", requireCustomer, async (req, res) => {
    const conn = await pool.getConnection();

    try {
        const customerId = req.session.customer.customer_id;
        const { address_id, payment_method } = req.body;

        if (!address_id || !payment_method) {
            return res.status(400).json({
                error: "Address and payment method are required."
            });
        }

        await conn.beginTransaction();

        const [addressRows] = await conn.query(
            "SELECT address_id FROM Address WHERE address_id = ? AND customer_id = ?",
            [address_id, customerId]
        );

        if (!addressRows.length) {
            await conn.rollback();
            return res.status(400).json({ error: "Invalid delivery address." });
        }

        const [cartRows] = await conn.query(
            `SELECT ci.item_id, ci.quantity, f.item_name, f.price,
                    f.restaurant_id, r.name AS restaurant_name
             FROM Cart c
             JOIN Cart_Item ci ON c.cart_id = ci.cart_id
             JOIN Food_Item f ON ci.item_id = f.item_id
             JOIN Restaurant r ON f.restaurant_id = r.restaurant_id
             WHERE c.customer_id = ?`,
            [customerId]
        );

        if (!cartRows.length) {
            await conn.rollback();
            return res.status(400).json({ error: "Your cart is empty." });
        }

        const restaurantId = cartRows[0].restaurant_id;

        if (cartRows.some(item => item.restaurant_id !== restaurantId)) {
            await conn.rollback();
            return res.status(400).json({
                error: "Cart contains multiple restaurants."
            });
        }

        const subtotal = cartRows.reduce(
            (sum, item) => sum + Number(item.price) * Number(item.quantity),
            0
        );

        // Simple college-project billing rules.
        const discount = subtotal >= 500 ? subtotal * 0.10 : 0;
        const taxableAmount = subtotal - discount;
        const tax = taxableAmount * 0.05;
        const deliveryFee = subtotal >= 300 ? 0 : 40;
        const total = taxableAmount + tax + deliveryFee;

        const [orderResult] = await conn.query(
            `INSERT INTO Orders
             (customer_id, restaurant_id, address_id, total_amount, order_status)
             VALUES (?, ?, ?, ?, 'Placed')`,
            [customerId, restaurantId, address_id, total.toFixed(2)]
        );

        const orderId = orderResult.insertId;

        for (const item of cartRows) {
            await conn.query(
                `INSERT INTO Order_Item
                 (order_id, item_id, quantity, price)
                 VALUES (?, ?, ?, ?)`,
                [orderId, item.item_id, item.quantity, item.price]
            );
        }

        const invoiceNumber =
            "QB-" + new Date().getFullYear() + "-" + String(orderId).padStart(5, "0");

        await conn.query(
            `INSERT INTO Bill
             (order_id, invoice_number, subtotal, discount, tax, delivery_fee, total_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [orderId, invoiceNumber, subtotal, discount, tax, deliveryFee, total]
        );

        const paymentStatus =
            payment_method.toLowerCase() === "cash" ? "Pending" : "Paid";

        await conn.query(
            `INSERT INTO Payment
             (order_id, payment_method, amount, payment_status)
             VALUES (?, ?, ?, ?)`,
            [orderId, payment_method, total, paymentStatus]
        );

        const [partnerRows] = await conn.query(
            "SELECT partner_id FROM Delivery_Partner ORDER BY partner_id LIMIT 1"
        );

        await conn.query(
            `INSERT INTO Delivery
             (order_id, partner_id, delivery_status)
             VALUES (?, ?, 'Assigned')`,
            [orderId, partnerRows.length ? partnerRows[0].partner_id : null]
        );

        await conn.query(
            `DELETE ci FROM Cart_Item ci
             JOIN Cart c ON ci.cart_id = c.cart_id
             WHERE c.customer_id = ?`,
            [customerId]
        );

        await conn.commit();

        res.json({
            message: "Order placed successfully.",
            order_id: orderId,
            invoice_number: invoiceNumber,
            subtotal,
            discount,
            tax,
            delivery_fee: deliveryFee,
            total
        });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: "Could not place order." });
    } finally {
        conn.release();
    }
});

app.get("/api/orders", requireCustomer, async (req, res) => {
    try {
        const [orders] = await pool.query(
            `SELECT o.order_id, o.order_date, o.total_amount, o.order_status,
                    r.name AS restaurant_name,
                    b.invoice_number, b.subtotal, b.discount, b.tax,
                    b.delivery_fee,
                    p.payment_method, p.payment_status,
                    d.delivery_status
             FROM Orders o
             JOIN Restaurant r ON o.restaurant_id = r.restaurant_id
             LEFT JOIN Bill b ON o.order_id = b.order_id
             LEFT JOIN Payment p ON o.order_id = p.order_id
             LEFT JOIN Delivery d ON o.order_id = d.order_id
             WHERE o.customer_id = ?
             ORDER BY o.order_date DESC`,
            [req.session.customer.customer_id]
        );

        for (const order of orders) {
            const [items] = await pool.query(
                `SELECT f.item_name, oi.quantity, oi.price,
                        (oi.quantity * oi.price) AS line_total
                 FROM Order_Item oi
                 JOIN Food_Item f ON oi.item_id = f.item_id
                 WHERE oi.order_id = ?`,
                [order.order_id]
            );
            order.items = items;
        }

        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not load orders." });
    }
});

app.get("/api/orders/:id/bill", requireCustomer, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT b.*, o.order_date, o.order_status,
                    c.name AS customer_name, c.email, c.phone,
                    r.name AS restaurant_name, r.location
             FROM Bill b
             JOIN Orders o ON b.order_id = o.order_id
             JOIN Customer c ON o.customer_id = c.customer_id
             JOIN Restaurant r ON o.restaurant_id = r.restaurant_id
             WHERE b.order_id = ? AND o.customer_id = ?`,
            [req.params.id, req.session.customer.customer_id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Bill not found." });
        }

        const [items] = await pool.query(
            `SELECT f.item_name, oi.quantity, oi.price,
                    (oi.quantity * oi.price) AS line_total
             FROM Order_Item oi
             JOIN Food_Item f ON oi.item_id = f.item_id
             WHERE oi.order_id = ?`,
            [req.params.id]
        );

        res.json({ bill: rows[0], items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not load bill." });
    }
});

/* =========================
   REVIEWS
========================= */

app.post("/api/reviews", requireCustomer, async (req, res) => {
    try {
        const { order_id, rating, comment } = req.body;
        const customerId = req.session.customer.customer_id;

        if (!order_id || !rating) {
            return res.status(400).json({ error: "Order and rating are required." });
        }

        const [orderRows] = await pool.query(
            `SELECT order_id, restaurant_id, order_status
             FROM Orders
             WHERE order_id = ? AND customer_id = ?`,
            [order_id, customerId]
        );

        if (!orderRows.length) {
            return res.status(404).json({ error: "Order not found." });
        }

        if (orderRows[0].order_status !== "Delivered") {
            return res.status(400).json({
                error: "You can review an order only after it is delivered."
            });
        }

        await pool.query(
            `INSERT INTO Review
             (customer_id, restaurant_id, order_id, rating, comment)
             VALUES (?, ?, ?, ?, ?)`,
            [
                customerId,
                orderRows[0].restaurant_id,
                order_id,
                rating,
                comment || ""
            ]
        );

        // Recalculate restaurant rating from actual reviews.
        await pool.query(
            `UPDATE Restaurant r
             SET rating = (
                 SELECT ROUND(AVG(rv.rating), 1)
                 FROM Review rv
                 WHERE rv.restaurant_id = r.restaurant_id
             )
             WHERE r.restaurant_id = ?`,
            [orderRows[0].restaurant_id]
        );

        res.json({ message: "Review submitted." });
    } catch (err) {
        console.error(err);
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "This order has already been reviewed." });
        }
        res.status(500).json({ error: "Could not submit review." });
    }
});

/* =========================
   ADMIN
========================= */

app.post("/api/admin/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const [rows] = await pool.query(
            "SELECT * FROM Admin WHERE username = ?",
            [username]
        );

        if (!rows.length) {
            return res.status(401).json({ error: "Invalid admin credentials." });
        }

        const valid = await bcrypt.compare(password, rows[0].password);

        if (!valid) {
            return res.status(401).json({ error: "Invalid admin credentials." });
        }

        req.session.admin = {
            admin_id: rows[0].admin_id,
            username: rows[0].username
        };

        res.json({ message: "Admin login successful." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Admin login failed." });
    }
});

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT o.order_id, o.order_date, o.total_amount, o.order_status,
                    c.name AS customer_name,
                    r.name AS restaurant_name,
                    p.payment_method, p.payment_status,
                    d.delivery_status
             FROM Orders o
             JOIN Customer c ON o.customer_id = c.customer_id
             JOIN Restaurant r ON o.restaurant_id = r.restaurant_id
             LEFT JOIN Payment p ON o.order_id = p.order_id
             LEFT JOIN Delivery d ON o.order_id = d.order_id
             ORDER BY o.order_date DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not load admin orders." });
    }
});

app.put("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;

        await pool.query(
            "UPDATE Orders SET order_status = ? WHERE order_id = ?",
            [status, req.params.id]
        );

        if (status === "Delivered") {
            await pool.query(
                `UPDATE Delivery
                 SET delivery_status = 'Delivered', delivery_time = NOW()
                 WHERE order_id = ?`,
                [req.params.id]
            );
        }

        res.json({ message: "Order status updated." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not update order." });
    }
});

app.put("/api/admin/delivery/:orderId/status", requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;

        await pool.query(
            "UPDATE Delivery SET delivery_status = ? WHERE order_id = ?",
            [status, req.params.orderId]
        );

        res.json({ message: "Delivery status updated." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not update delivery." });
    }
});

/* Fallback to homepage */
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`QuickBite running at http://localhost:${PORT}`);
});
