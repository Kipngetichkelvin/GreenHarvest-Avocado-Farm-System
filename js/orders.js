/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   ORDERS JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       DISPLAY ORDERS
       ===================================================== */

    displayGreenHarvestOrders();

    /* =====================================================
       CLEAR ORDERS
       ===================================================== */

    const clearOrdersButton =
        document.getElementById("clearOrders");

    if (clearOrdersButton) {

        clearOrdersButton.addEventListener(
            "click",
            function () {

                localStorage.removeItem(
                    "greenHarvestOrders"
                );

                displayGreenHarvestOrders();

            }
        );

    }

    console.log(
        "GreenHarvest orders module loaded."
    );

});


/* =========================================================
   CREATE ORDER
   ========================================================= */

function createGreenHarvestOrder(orderData) {

    if (!orderData || typeof orderData !== "object") {
        return null;
    }

    let orders =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestOrders"
            )
        );

    if (!Array.isArray(orders)) {
        orders = [];
    }

    const order = {

        id:
            "GH-" + Date.now(),

        ...orderData,

        status:
            orderData.status || "Pending",

        createdAt:
            new Date().toISOString()

    };

    orders.push(order);

    localStorage.setItem(
        "greenHarvestOrders",
        JSON.stringify(orders)
    );

    return order;
}


/* =========================================================
   GET ORDERS
   ========================================================= */

function getGreenHarvestOrders() {

    const orders =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestOrders"
            )
        );

    return Array.isArray(orders)
        ? orders
        : [];
}


/* =========================================================
   DISPLAY ORDERS
   ========================================================= */

function displayGreenHarvestOrders() {

    const container =
        document.getElementById(
            "ordersContainer"
        );

    if (!container) {
        return;
    }

    const orders =
        getGreenHarvestOrders();

    if (orders.length === 0) {

        container.innerHTML =
            "<p>No orders found.</p>";

        return;
    }

    container.innerHTML = "";

    orders.forEach(function (order) {

        const orderElement =
            document.createElement("div");

        orderElement.className =
            "order-item";

        orderElement.innerHTML = `
            <h3>Order ${escapeOrderText(order.id)}</h3>
            <p>
                <strong>Status:</strong>
                ${escapeOrderText(order.status)}
            </p>
            <p>
                <strong>Created:</strong>
                ${formatOrderDate(order.createdAt)}
            </p>
        `;

        container.appendChild(
            orderElement
        );

    });

}


/* =========================================================
   FORMAT ORDER DATE
   ========================================================= */

function formatOrderDate(dateValue) {

    const date =
        new Date(dateValue);

    if (isNaN(date.getTime())) {
        return "Unknown";
    }

    return date.toLocaleString();

}


/* =========================================================
   ESCAPE ORDER TEXT
   ========================================================= */

function escapeOrderText(text) {

    const element =
        document.createElement("div");

    element.textContent =
        text == null ? "" : String(text);

    return element.innerHTML;

}