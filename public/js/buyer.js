/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   BUYER DASHBOARD JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const user =
        getBuyerCurrentUser();

    if (user) {

        document
            .querySelectorAll(
                ".buyer-name, .current-user-name"
            )
            .forEach(function (element) {

                element.textContent =
                    user.name || "Buyer";

            });

        document
            .querySelectorAll(
                ".buyer-email, .current-user-email"
            )
            .forEach(function (element) {

                element.textContent =
                    user.email || "";

            });

    }

    updateBuyerStatistics();

    console.log(
        "GreenHarvest buyer module loaded."
    );

});


/* =========================================================
   BUYER STATISTICS
   ========================================================= */

function updateBuyerStatistics() {

    const orders =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestOrders"
            )
        ) || [];

    const orderCount =
        document.getElementById(
            "buyerOrderCount"
        );

    if (orderCount) {

        orderCount.textContent =
            orders.length;

    }

}


/* =========================================================
   GET CURRENT USER
   ========================================================= */

function getBuyerCurrentUser() {

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