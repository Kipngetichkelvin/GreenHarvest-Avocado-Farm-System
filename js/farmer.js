/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   FARMER DASHBOARD JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const user =
        getGreenHarvestCurrentUser();

    if (user) {

        const nameElements =
            document.querySelectorAll(
                ".farmer-name, .current-user-name"
            );

        nameElements.forEach(
            function (element) {

                element.textContent =
                    user.name || "Farmer";

            }
        );

        const emailElements =
            document.querySelectorAll(
                ".farmer-email, .current-user-email"
            );

        emailElements.forEach(
            function (element) {

                element.textContent =
                    user.email || "";

            }
        );

    }

    updateFarmerStatistics();

    console.log(
        "GreenHarvest farmer module loaded."
    );

});


/* =========================================================
   FARMER STATISTICS
   ========================================================= */

function updateFarmerStatistics() {

    const orders =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestOrders"
            )
        ) || [];

    const services =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestServiceRequests"
            )
        ) || [];

    const orderCount =
        document.getElementById(
            "farmerOrderCount"
        );

    const serviceCount =
        document.getElementById(
            "farmerServiceCount"
        );

    if (orderCount) {

        orderCount.textContent =
            orders.length;

    }

    if (serviceCount) {

        serviceCount.textContent =
            services.length;

    }

}


/* =========================================================
   CURRENT USER
   ========================================================= */

function getGreenHarvestCurrentUser() {

    const savedUser =
        localStorage.getItem(
            "greenHarvestCurrentUser"
        );

    if (!savedUser) {
        return null;
    }

    try {

        return JSON.parse(
            savedUser
        );

    } catch (error) {

        return null;

    }

}