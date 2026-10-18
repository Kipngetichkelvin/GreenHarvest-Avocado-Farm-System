/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   ADMIN DASHBOARD JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    updateAdminStatistics();

    console.log(
        "GreenHarvest admin module loaded."
    );

});


/* =========================================================
   ADMIN STATISTICS
   ========================================================= */

function updateAdminStatistics() {

    const orders =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestOrders"
            )
        ) || [];

    const serviceRequests =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestServiceRequests"
            )
        ) || [];

    const payments =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestPayments"
            )
        ) || [];

    const users =
        localStorage.getItem(
            "greenHarvestUser"
        )
        ? 1
        : 0;


    setAdminCount(
        "adminOrderCount",
        orders.length
    );

    setAdminCount(
        "adminServiceCount",
        serviceRequests.length
    );

    setAdminCount(
        "adminPaymentCount",
        payments.length
    );

    setAdminCount(
        "adminUserCount",
        users
    );

}


/* =========================================================
   SET ADMIN COUNT
   ========================================================= */

function setAdminCount(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );

    if (element) {

        element.textContent =
            value;

    }

}