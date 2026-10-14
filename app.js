let currentCustomer = null;
let currentCart = { items: [], subtotal: 0 };

document.addEventListener("DOMContentLoaded", async () => {
    await checkSession();
    await loadRestaurants();
    await loadCart();
    await loadOrders();
});

async function api(url, options = {}) {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

async function checkSession() {
    const data = await api("/api/me");
    currentCustomer = data.customer;

    const authArea = document.getElementById("authArea");
    const profileArea = document.getElementById("profileArea");
    const logoutBtn = document.getElementById("logoutBtn");
    const welcome = document.getElementById("welcomeText");

    if (currentCustomer) {
        authArea.classList.add("hidden");
        profileArea.classList.remove("hidden");
        logoutBtn.classList.remove("hidden");
        welcome.textContent = `Welcome, ${currentCustomer.name}`;

        document.getElementById("profileInfo").innerHTML = `
            <p><strong>Name:</strong> ${escapeHtml(currentCustomer.name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(currentCustomer.email)}</p>
        `;

        await loadAddresses();
    } else {
        authArea.classList.remove("hidden");
        profileArea.classList.add("hidden");
        logoutBtn.classList.add("hidden");
        welcome.textContent = "Login to start ordering";
    }
}

document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = new FormData(e.target);
    const body = Object.fromEntries(form.entries());

    try {
        const data = await api("/api/register", {
            method: "POST",
            body: JSON.stringify(body)
        });

        document.getElementById("registerMsg").textContent = data.message;
        e.target.reset();
        await checkSession();
        await loadCart();
    } catch (err) {
        document.getElementById("registerMsg").textContent = err.message;
    }
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = new FormData(e.target);
    const body = Object.fromEntries(form.entries());

    try {
        const data = await api("/api/login", {
            method: "POST",
            body: JSON.stringify(body)
        });

        document.getElementById("loginMsg").textContent = data.message;
        e.target.reset();
        await checkSession();
        await loadCart();
        await loadOrders();
    } catch (err) {
        document.getElementById("loginMsg").textContent = err.message;
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" });
    currentCustomer = null;
    await checkSession();
    await loadCart();
    await loadOrders();
});

document.getElementById("addressForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentCustomer) {
        alert("Please login first.");
        return;
    }

    const body = Object.fromEntries(new FormData(e.target).entries());

    try {
        const data = await api("/api/addresses", {
            method: "POST",
            body: JSON.stringify(body)
        });

        document.getElementById("addressMsg").textContent = data.message;
        e.target.reset();
        await loadAddresses();
    } catch (err) {
        document.getElementById("addressMsg").textContent = err.message;
    }
});

async function loadAddresses() {
    if (!currentCustomer) return;

    const addresses = await api("/api/addresses");
    const select = document.getElementById("addressSelect");

    if (!addresses.length) {
        select.innerHTML = `<option value="">No addresses found</option>`;
        return;
    }

    select.innerHTML = addresses.map(a => `
        <option value="${a.address_id}">
            ${escapeHtml(a.address)}, ${escapeHtml(a.city || "")} - ${escapeHtml(a.pincode || "")}
        </option>
    `).join("");
}

async function loadRestaurants() {
    try {
        const restaurants = await api("/api/restaurants");
        const list = document.getElementById("restaurantList");

        list.innerHTML = restaurants.map(r => `
            <div class="restaurant-card">
                <div class="restaurant-art">🍽️</div>
                <div class="restaurant-content">
                    <h3>${escapeHtml(r.name)}</h3>
                    <div class="meta">
                        ⭐ ${r.rating || "New"} · ${escapeHtml(r.cuisine || "Multi-cuisine")}
                        <br>${escapeHtml(r.location || "")}
                    </div>
                    <button class="btn" onclick="loadMenu(${r.restaurant_id}, '${escapeAttr(r.name)}')">
                        View Menu
                    </button>
                </div>
            </div>
        `).join("");
    } catch (err) {
        document.getElementById("restaurantList").innerHTML =
            `<div class="card">${err.message}</div>`;
    }
}

async function loadMenu(restaurantId, restaurantName) {
    try {
        const menu = await api(`/api/restaurants/${restaurantId}/menu`);

        document.getElementById("menu").classList.remove("hidden");
        document.getElementById("menuTitle").textContent = restaurantName + " Menu";

        document.getElementById("menuList").innerHTML = menu.map(item => `
            <div class="food-card">
                <p class="eyebrow">${escapeHtml(item.category_name || "Food")}</p>
                <h3>${escapeHtml(item.item_name)}</h3>
                <p class="price">₹${Number(item.price).toFixed(2)}</p>
                <button class="btn"
                    ${item.availability ? "" : "disabled"}
                    onclick="addToCart(${item.item_id})">
                    ${item.availability ? "Add to Cart" : "Unavailable"}
                </button>
            </div>
        `).join("");

        document.getElementById("menu").scrollIntoView({ behavior: "smooth" });
    } catch (err) {
        alert(err.message);
    }
}

async function addToCart(itemId) {
    if (!currentCustomer) {
        alert("Please login/register before ordering.");
        location.hash = "account";
        return;
    }

    try {
        await api("/api/cart", {
            method: "POST",
            body: JSON.stringify({ item_id: itemId, quantity: 1 })
        });

        await loadCart();
        location.hash = "cart";
    } catch (err) {
        alert(err.message);
    }
}

async function loadCart() {
    const box = document.getElementById("cartList");

    if (!currentCustomer) {
        box.innerHTML = `<p>Please login to see your cart.</p>`;
        document.getElementById("cartCount").textContent = "0";
        return;
    }

    try {
        currentCart = await api("/api/cart");
        document.getElementById("cartCount").textContent = currentCart.items.reduce(
            (sum, i) => sum + Number(i.quantity), 0
        );

        if (!currentCart.items.length) {
            box.innerHTML = `<p>Your cart is empty. Add something delicious!</p>`;
            document.getElementById("checkout").classList.add("hidden");
            return;
        }

        box.innerHTML = currentCart.items.map(item => `
            <div class="cart-row">
                <div>
                    <strong>${escapeHtml(item.item_name)}</strong>
                    <div class="meta">${escapeHtml(item.restaurant_name)} · ₹${Number(item.price).toFixed(2)}</div>
                </div>
                <div class="qty">
                    <button onclick="changeQty(${item.cart_item_id}, ${Number(item.quantity) - 1})">−</button>
                    <span>${item.quantity}</span>
                    <button onclick="changeQty(${item.cart_item_id}, ${Number(item.quantity) + 1})">+</button>
                    <button class="btn danger" onclick="removeCartItem(${item.cart_item_id})">Remove</button>
                </div>
            </div>
        `).join("") + `
            <div class="total-box">
                <span>Subtotal</span>
                <span>₹${Number(currentCart.subtotal).toFixed(2)}</span>
            </div>
            <br>
            <button class="btn full" onclick="openCheckout()">Proceed to Checkout</button>
        `;
    } catch (err) {
        box.innerHTML = `<p>${err.message}</p>`;
    }
}

async function changeQty(id, quantity) {
    if (quantity < 1) {
        return removeCartItem(id);
    }

    try {
        await api(`/api/cart/${id}`, {
            method: "PUT",
            body: JSON.stringify({ quantity })
        });
        await loadCart();
    } catch (err) {
        alert(err.message);
    }
}

async function removeCartItem(id) {
    try {
        await api(`/api/cart/${id}`, { method: "DELETE" });
        await loadCart();
    } catch (err) {
        alert(err.message);
    }
}

async function clearCart() {
    if (!currentCustomer) return;

    try {
        await api("/api/cart", { method: "DELETE" });
        await loadCart();
    } catch (err) {
        alert(err.message);
    }
}

async function openCheckout() {
    if (!currentCustomer) {
        alert("Please login first.");
        return;
    }

    await loadAddresses();

    const subtotal = Number(currentCart.subtotal);
    const discount = subtotal >= 500 ? subtotal * 0.10 : 0;
    const taxable = subtotal - discount;
    const tax = taxable * 0.05;
    const delivery = subtotal >= 300 ? 0 : 40;
    const total = taxable + tax + delivery;

    document.getElementById("billPreview").innerHTML = `
        <p class="eyebrow">BILL PREVIEW</p>
        <h2>QuickBite Invoice</h2>
        <div class="invoice-line"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
        <div class="invoice-line"><span>Discount</span><span>- ₹${discount.toFixed(2)}</span></div>
        <div class="invoice-line"><span>Tax (5%)</span><span>₹${tax.toFixed(2)}</span></div>
        <div class="invoice-line"><span>Delivery Fee</span><span>₹${delivery.toFixed(2)}</span></div>
        <div class="invoice-line invoice-total"><span>Total</span><span>₹${total.toFixed(2)}</span></div>
        <p class="meta">The same values are calculated again on the server and stored in the MySQL Bill table.</p>
    `;

    document.getElementById("checkout").classList.remove("hidden");
    document.getElementById("checkout").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("placeOrderBtn").addEventListener("click", async () => {
    const addressId = document.getElementById("addressSelect").value;
    const paymentMethod = document.getElementById("paymentMethod").value;

    if (!addressId) {
        document.getElementById("checkoutMsg").textContent = "Please select an address.";
        return;
    }

    try {
        const result = await api("/api/orders", {
            method: "POST",
            body: JSON.stringify({
                address_id: addressId,
                payment_method: paymentMethod
            })
        });

        document.getElementById("checkoutMsg").textContent =
            `Order #${result.order_id} placed. Invoice: ${result.invoice_number}`;

        await loadCart();
        await loadOrders();
        alert(`Order placed successfully!\nInvoice: ${result.invoice_number}\nTotal: ₹${Number(result.total).toFixed(2)}`);
        location.hash = "orders";
    } catch (err) {
        document.getElementById("checkoutMsg").textContent = err.message;
    }
});

async function loadOrders() {
    const box = document.getElementById("ordersList");

    if (!currentCustomer) {
        box.innerHTML = `<div class="card"><p>Login to see your orders.</p></div>`;
        return;
    }

    try {
        const orders = await api("/api/orders");

        if (!orders.length) {
            box.innerHTML = `<div class="card"><p>No orders yet.</p></div>`;
            return;
        }

        box.innerHTML = orders.map(order => `
            <div class="order-card">
                <div class="order-head">
                    <div>
                        <p class="eyebrow">ORDER #${order.order_id}</p>
                        <h3>${escapeHtml(order.restaurant_name)}</h3>
                        <p class="meta">${new Date(order.order_date).toLocaleString()}</p>
                    </div>
                    <div>
                        <span class="status">${escapeHtml(order.order_status)}</span>
                        <p><strong>₹${Number(order.total_amount).toFixed(2)}</strong></p>
                    </div>
                </div>

                ${order.items.map(item => `
                    <div class="order-item">
                        <span>${escapeHtml(item.item_name)} × ${item.quantity}</span>
                        <span>₹${Number(item.line_total).toFixed(2)}</span>
                    </div>
                `).join("")}

                <p class="meta">
                    Payment: ${escapeHtml(order.payment_method || "")}
                    (${escapeHtml(order.payment_status || "")})
                    · Delivery: ${escapeHtml(order.delivery_status || "")}
                </p>

                <button class="btn secondary" onclick="viewBill(${order.order_id})">
                    View Bill
                </button>

                ${order.order_status === "Delivered" ? `
                    <div class="review-box">
                        <h4>Rate this restaurant</h4>
                        <select id="rating-${order.order_id}">
                            <option value="5">★★★★★ - 5</option>
                            <option value="4">★★★★ - 4</option>
                            <option value="3">★★★ - 3</option>
                            <option value="2">★★ - 2</option>
                            <option value="1">★ - 1</option>
                        </select>
                        <input id="comment-${order.order_id}" placeholder="Write a review">
                        <button class="btn" onclick="submitReview(${order.order_id})">Submit Review</button>
                    </div>
                ` : ""}
            </div>
        `).join("");
    } catch (err) {
        box.innerHTML = `<div class="card">${err.message}</div>`;
    }
}

async function viewBill(orderId) {
    try {
        const data = await api(`/api/orders/${orderId}/bill`);
        const b = data.bill;

        const itemsHtml = data.items.map(item => `
            <div class="invoice-line">
                <span>${escapeHtml(item.item_name)} × ${item.quantity}</span>
                <span>₹${Number(item.line_total).toFixed(2)}</span>
            </div>
        `).join("");

        alert(
            `QUICKBITE INVOICE\n\n` +
            `Invoice: ${b.invoice_number}\n` +
            `Order: #${b.order_id}\n` +
            `Customer: ${b.customer_name}\n` +
            `Restaurant: ${b.restaurant_name}\n\n` +
            data.items.map(i => `${i.item_name} x ${i.quantity} = ₹${Number(i.line_total).toFixed(2)}`).join("\n") +
            `\n\nSubtotal: ₹${Number(b.subtotal).toFixed(2)}` +
            `\nDiscount: ₹${Number(b.discount).toFixed(2)}` +
            `\nTax: ₹${Number(b.tax).toFixed(2)}` +
            `\nDelivery: ₹${Number(b.delivery_fee).toFixed(2)}` +
            `\nTOTAL: ₹${Number(b.total_amount).toFixed(2)}`
        );
    } catch (err) {
        alert(err.message);
    }
}

async function submitReview(orderId) {
    const rating = document.getElementById(`rating-${orderId}`).value;
    const comment = document.getElementById(`comment-${orderId}`).value;

    try {
        const data = await api("/api/reviews", {
            method: "POST",
            body: JSON.stringify({ order_id: orderId, rating, comment })
        });

        alert(data.message);
        await loadRestaurants();
        await loadOrders();
    } catch (err) {
        alert(err.message);
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
    return String(value ?? "").replaceAll("'", "\\'");
}
