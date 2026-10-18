/* =========================================================
   GREENHARVEST AVOCADO FARM SYSTEM
   MARKETPLACE JAVASCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       ADD TO CART BUTTONS
       ===================================================== */

    const cartButtons =
        document.querySelectorAll(
            "[data-add-to-cart]"
        );

    cartButtons.forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                const productName =
                    button.getAttribute(
                        "data-add-to-cart"
                    );

                if (!productName) {
                    return;
                }


                /* GET PRODUCT PRICE */

                let price = 0;

                const priceAttribute =
                    button.getAttribute(
                        "data-price"
                    );

                if (priceAttribute) {

                    price =
                        parseFloat(
                            priceAttribute
                        );

                }


                /* GET QUANTITY */

                let quantity = 1;

                const card =
                    button.closest(
                        ".product-card, .market-card, .marketplace-card"
                    );

                if (card) {

                    const quantityInput =
                        card.querySelector(
                            'input[type="number"]'
                        );

                    if (quantityInput) {

                        const enteredQuantity =
                            parseInt(
                                quantityInput.value,
                                10
                            );

                        if (
                            !isNaN(enteredQuantity) &&
                            enteredQuantity > 0
                        ) {

                            quantity =
                                enteredQuantity;

                        }

                    }

                }


                /* GET EXISTING CART */

                let cart =
                    JSON.parse(
                        localStorage.getItem(
                            "greenHarvestCart"
                        )
                    );

                if (!Array.isArray(cart)) {
                    cart = [];
                }


                /* FIND EXISTING PRODUCT */

                const existingProduct =
                    cart.find(function (item) {

                        return (
                            item.name ===
                            productName
                        );

                    });


                if (existingProduct) {

                    existingProduct.quantity +=
                        quantity;

                } else {

                    cart.push({

                        name:
                            productName,

                        price:
                            isNaN(price) ?
                            0 :
                            price,

                        quantity:
                            quantity,

                        addedAt:
                            new Date().toISOString()

                    });

                }


                /* SAVE CART */

                localStorage.setItem(
                    "greenHarvestCart",
                    JSON.stringify(cart)
                );


                /* UPDATE CART */

                updateMarketplaceCartCount();


                /* BUTTON FEEDBACK */

                const originalText =
                    button.textContent;

                button.textContent =
                    "✓ Added to Cart";

                button.disabled = true;


                setTimeout(function () {

                    button.textContent =
                        originalText;

                    button.disabled = false;

                }, 1500);


                console.log(
                    productName +
                    " added to cart."
                );

            }
        );

    });


    /* =====================================================
       CART COUNT
       ===================================================== */

    updateMarketplaceCartCount();


    /* =====================================================
       DISPLAY CART ITEMS
       ===================================================== */

    displayMarketplaceCart();


    /* =====================================================
       CLEAR CART
       ===================================================== */

    const clearCartButton =
        document.getElementById(
            "clearCart"
        );

    if (clearCartButton) {

        clearCartButton.addEventListener(
            "click",
            function () {

                localStorage.removeItem(
                    "greenHarvestCart"
                );

                updateMarketplaceCartCount();

                displayMarketplaceCart();

            }
        );

    }


    /* =====================================================
       PAGE READY
       ===================================================== */

    console.log(
        "GreenHarvest marketplace module loaded."
    );

});


/* =========================================================
   UPDATE CART COUNT
   ========================================================= */

function updateMarketplaceCartCount() {

    let cart =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestCart"
            )
        );

    if (!Array.isArray(cart)) {
        cart = [];
    }

    let totalItems = 0;

    cart.forEach(function (item) {

        const quantity =
            parseInt(
                item.quantity,
                10
            );

        if (!isNaN(quantity)) {

            totalItems += quantity;

        }

    });


    const countElements =
        document.querySelectorAll(
            ".cart-count"
        );

    countElements.forEach(function (element) {

        element.textContent =
            totalItems;

    });

}


/* =========================================================
   DISPLAY CART
   ========================================================= */

function displayMarketplaceCart() {

    const cartContainer =
        document.getElementById(
            "cartItems"
        );

    if (!cartContainer) {
        return;
    }


    let cart =
        JSON.parse(
            localStorage.getItem(
                "greenHarvestCart"
            )
        );

    if (!Array.isArray(cart)) {
        cart = [];
    }


    if (cart.length === 0) {

        cartContainer.innerHTML =
            "<p>Your cart is currently empty.</p>";

        return;

    }


    cartContainer.innerHTML = "";


    let total = 0;


    cart.forEach(function (item, index) {

        const price =
            parseFloat(item.price) || 0;

        const quantity =
            parseInt(item.quantity, 10) || 1;

        const itemTotal =
            price * quantity;

        total += itemTotal;


        const itemElement =
            document.createElement("div");

        itemElement.className =
            "cart-item";


        itemElement.innerHTML = `
            <div class="cart-item-info">
                <h4>${escapeMarketplaceText(item.name)}</h4>
                <p>Quantity: ${quantity}</p>
                <p>Price: KSh ${price.toLocaleString()}</p>
            </div>

            <div class="cart-item-total">
                KSh ${itemTotal.toLocaleString()}
            </div>

            <button
                type="button"
                class="remove-cart-item"
                data-cart-index="${index}">
                Remove
            </button>
        `;


        cartContainer.appendChild(
            itemElement
        );

    });


    const totalElement =
        document.getElementById(
            "cartTotal"
        );

    if (totalElement) {

        totalElement.textContent =
            "KSh " +
            total.toLocaleString();

    }


    /* =====================================================
       REMOVE CART ITEM
       ===================================================== */

    const removeButtons =
        cartContainer.querySelectorAll(
            ".remove-cart-item"
        );

    removeButtons.forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                const index =
                    parseInt(
                        button.getAttribute(
                            "data-cart-index"
                        ),
                        10
                    );

                if (isNaN(index)) {
                    return;
                }

                cart.splice(index, 1);

                localStorage.setItem(
                    "greenHarvestCart",
                    JSON.stringify(cart)
                );

                updateMarketplaceCartCount();

                displayMarketplaceCart();

            }
        );

    });

}


/* =========================================================
   ESCAPE MARKETPLACE TEXT
   ========================================================= */

function escapeMarketplaceText(text) {

    const element =
        document.createElement("div");

    element.textContent =
        text;

    return element.innerHTML;

}