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

document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const body = Object.fromEntries(new FormData(e.target).entries());

    try {
        await api("/api/admin/login", {
            method: "POST",
            body: JSON.stringify(body)
        });

        document.getElementById("adminLoginBox").classList.add("hidden");
        document.getElementById("adminArea").classList.remove("hidden");
        await loadAdminOrders();
    } catch (err) {
        document.getElementById("adminLoginMsg").textContent = err.message;
    }
});

async function loadAdminOrders() {
    try {
        const orders = await api("/api/admin/orders");
        const tbody = document.getElementById("adminOrders");

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td>#${o.order_id}</td>
                <td>${escapeHtml(o.customer_name)}</td>
                <td>${escapeHtml(o.restaurant_name)}</td>
                <td>₹${Number(o.total_amount).toFixed(2)}</td>
                <td>${escapeHtml(o.payment_method || "")} / ${escapeHtml(o.payment_status || "")}</td>
                <td>
                    <select onchange="updateOrder(${o.order_id}, this.value)">
                        ${["Placed","Preparing","Out for Delivery","Delivered","Cancelled"]
                            .map(s => `<option ${o.order_status === s ? "selected" : ""}>${s}</option>`)
                            .join("")}
                    </select>
                </td>
                <td>${escapeHtml(o.delivery_status || "")}</td>
            </tr>
        `).join("");
    } catch (err) {
        alert(err.message);
    }
}

async function updateOrder(orderId, status) {
    try {
        await api(`/api/admin/orders/${orderId}/status`, {
            method: "PUT",
            body: JSON.stringify({ status })
        });
        await loadAdminOrders();
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
