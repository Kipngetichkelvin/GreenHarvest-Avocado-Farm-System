/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   SEEDLINGS JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       SEEDLING QUANTITY VALIDATION
       ===================================================== */

    const quantityInputs =
        document.querySelectorAll(
            'input[type="number"][data-seedling-quantity]'
        );

    quantityInputs.forEach(function (input) {

        input.addEventListener(
            "input",
            function () {

                let quantity =
                    parseInt(input.value, 10);

                if (isNaN(quantity) || quantity < 1) {
                    input.value = 1;
                    return;
                }

                if (quantity > 1000) {
                    input.value = 1000;
                }

            }
        );

    });


    /* =====================================================
       ADD SEEDLING TO ORDER
       ===================================================== */

    const orderButtons =
        document.querySelectorAll(
            "[data-seedling-order]"
        );

    orderButtons.forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                const seedlingName =
                    button.getAttribute(
                        "data-seedling-order"
                    );

                if (!seedlingName) {
                    return;
                }

                const card =
                    button.closest(
                        ".seedling-card, .product-card, .seedling-item"
                    );

                let quantity = 1;

                let quantityInput = null;

                if (card) {

                    quantityInput =
                        card.querySelector(
                            'input[type="number"]'
                        );

                }

                if (quantityInput) {

                    quantity =
                        parseInt(
                            quantityInput.value,
                            10
                        );

                    if (
                        isNaN(quantity) ||
                        quantity < 1
                    ) {
                        quantity = 1;
                    }

                }


                /* GET EXISTING ORDER */

                let order =
                    JSON.parse(
                        localStorage.getItem(
                            "greenHarvestSeedlingOrder"
                        )
                    );

                if (!Array.isArray(order)) {
                    order = [];
                }


                /* CHECK WHETHER ITEM ALREADY EXISTS */

                const existingItem =
                    order.find(function (item) {

                        return (
                            item.name ===
                            seedlingName
                        );

                    });


                if (existingItem) {

                    existingItem.quantity +=
                        quantity;

                } else {

                    order.push({

                        name: seedlingName,

                        quantity: quantity,

                        addedAt:
                            new Date().toISOString()

                    });

                }


                /* SAVE ORDER */

                localStorage.setItem(
                    "greenHarvestSeedlingOrder",
                    JSON.stringify(order)
                );


                /* UPDATE BUTTON */

                const originalText =
                    button.textContent;

                button.textContent =
                    "✓ Added to Order";

                button.disabled = true;


                setTimeout(function () {

                    button.textContent =
                        originalText;

                    button.disabled = false;

                }, 1500);


                updateSeedlingOrderCount();

                console.log(
                    quantity +
                    " x " +
                    seedlingName +
                    " added to order."
                );

            }
        );

    });


    /* =====================================================
       UPDATE ORDER COUNT
       ===================================================== */

    updateSeedlingOrderCount();


    /* =====================================================
       CLEAR SEEDLING ORDER
       ===================================================== */

    const clearOrderButton =
        document.getElementById(
            "clearSeedlingOrder"
        );

    if (clearOrderButton) {

        clearOrderButton.addEventListener(
            "click",
            function () {

                localStorage.removeItem(
                    "greenHarvestSeedlingOrder"
                );

                updateSeedlingOrderCount();

                alert(
                    "Your seedling order has been cleared."
                );

            }
        );

    }


    /* =====================================================
       PAGE READY
       ===================================================== */

    console.log(
        "GreenHarvest seedlings module loaded."
    );

});


/* =========================================================
   UPDATE SEEDLING ORDER COUNT
   ========================================================= */

function updateSeedlingOrderCount() {

    const order =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestSeedlingOrder"
            )
        );

    if (!Array.isArray(order)) {
        return;
    }

    let totalQuantity = 0;

    order.forEach(function (item) {

        const quantity =
            parseInt(
                item.quantity,
                10
            );

        if (!isNaN(quantity)) {

            totalQuantity += quantity;

        }

    });


    const countElements =
        document.querySelectorAll(
            ".seedling-order-count"
        );

    countElements.forEach(function (element) {

        element.textContent =
            totalQuantity;

    });

}