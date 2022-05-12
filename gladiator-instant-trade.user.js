// ==UserScript==
// @name         Gladiator.tf Instant Trade
// @namespace    https://steamcommunity.com/profiles/76561198320810968
// @version      0.3
// @author       manic
// @description  Start a trade with a Gladiator.tf bot in a single click
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      gladiator.tf
// @license      MIT

// @homepageURL     https://github.com/mninc/gladiator.tf-instant-trade
// @supportURL      https://github.com/mninc/gladiator.tf-instant-trade/issues
// @downloadURL     https://github.com/mninc/gladiator.tf-instant-trade/raw/master/gladiator-instant-trade.user.js

// @run-at       document-end
// @include      /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\//

// @require https://unpkg.com/popper.js@1
// @require https://unpkg.com/tippy.js@4
// ==/UserScript==


(function () {
    'use strict';

    const Modal = function (title, ...content) {
        __NUXT__.state.modal = { title: title, modalBundle: null, modalContext: "gladiator" };
        // wait for modal to be created :)
        setTimeout(() => {
            const dialog = document.getElementsByClassName("page-dialog")[0];
            if (!dialog) return;
            for (const child of content) {
                const p = document.createElement("p");
                p.innerText = child;
                dialog.append(p);
            }
        }, 100);
    }

    const URL = "https://gladiator.tf";
    let data = localStorage.getItem("gladiator.tf bots");
    if (data) {
        data = JSON.parse(data);
        if (new Date() - new Date(data.at) < 1000 * 60 * 60 * 24 && data.url === URL) return addLinks(data.bots);
    }
    GM_xmlhttpRequest({
        method: "GET",
        url: `${URL}/api/bots`,
        onload: function (data) {
            data = JSON.parse(data.responseText);
            if (!data.success) return Modal(data.message);

            let bots = data.bots;
            addLinks(bots);
            localStorage.setItem("gladiator.tf bots", JSON.stringify({ at: new Date(), bots, url: URL }));
        }
    });

    function addLinks(bots) {
        let currentlyTrading = false;

        GM_addStyle(`
        .glad-icon {
            cursor: pointer;
            height: 22px;
            width: 23px;
            margin-left: 0.5em;
        }

        .glad-icon.glad-static {
            background-image: url(https://gladiator.tf/img/logo.svg);
            background-repeat: no-repeat;
            background-position: center center;
            background-size: 70%;
        }

        .glad-icon.glad-loading {
            display: inline-block;
            width: 22px;
            height: 22px;
            }
        .glad-icon.glad-loading:after {
            content: " ";
            display: block;
            width: 10px;
            height: 10px;
            margin: 2px;
            border-radius: 50%;
            border: 4px solid #fff;
            border-color: #fff transparent #fff transparent;
            animation: lds-dual-ring 1.2s linear infinite;
            }
            @keyframes lds-dual-ring {
            0% {
                transform: rotate(0deg);
            }
            100% {
                transform: rotate(360deg);
            }
            }
            `);

        const callback = function (mutationsList) {
            for (const mutation of mutationsList) {
                if (mutation.type !== "childList") continue;

                for (const node of mutation.addedNodes) {
                    let child = node.children && node.children[0];
                    if (!child) continue;
                    child = child.children[0];
                    if (!child) continue;
                    if (child.innerText !== "BOT") continue;
                    let listing = node.parentNode.parentNode.parentNode.parentNode;
                    let links = listing.getElementsByTagName("a");
                    let bot;
                    for (const link of links) {
                        let href = link.getAttribute("href");
                        if (href.startsWith("/profiles/")) bot = href.split("/")[2];
                    }
                    if (!bots.includes(bot)) continue;

                    const intent = listing.getElementsByClassName("text-sell").length ? "sell" : "buy";
                    const cart = { buy: [], sell: [] };
                    if (intent === "sell") {
                        let assetid;
                        for (const link of links) {
                            let href = link.getAttribute("href");
                            if (href.startsWith("/classifieds/")) assetid = href.split("440_")[1];
                        }
                        cart.buy.push({
                            assetid
                        });
                    } else {
                        let listingID;
                        for (const link of links) {
                            let href = link.getAttribute("href");
                            if (href.startsWith("/classifieds/")) listingID = href.split("/")[2];
                        }
                        cart.sell.push({
                            listingID
                        });
                    }

                    const buttons = listing.getElementsByClassName("listing__details__actions")[0];
                    const button = document.createElement("a");
                    button.setAttribute("data-tippy-content", "Gladiator.tf Instant Trade");
                    button.setAttribute("href", `steam://friends/add/${bot}`);
                    button.classList.add("glad-icon");
                    button.classList.add("glad-static");
                    buttons.append(button);
                    tippy(button);
                    button.addEventListener("click", function () {
                        if (currentlyTrading) return Modal("Error creating trade", "You already have a trade processing! Wait for it to finish before starting another.");
                        currentlyTrading = true;
                        button.classList.remove("glad-static")
                        button.classList.add("glad-loading");
                        GM_xmlhttpRequest({
                            method: "POST",
                            url: `${URL}/api/start_trade`,
                            data: JSON.stringify({ bot, cart }),
                            headers: {
                                "Content-Type": "application/json"
                            },
                            onload: function (data) {
                                currentlyTrading = false;
                                data = JSON.parse(data.responseText);
                                button.classList.add("glad-static")
                                button.classList.remove("glad-loading");
                                if (data.success) window.open(data.tradeOfferURL);
                                else {
                                    if (data.error === "Not signed in") window.open(`${URL}/auth/steam`);
                                    else Modal("Error creating trade", data.message);
                                }
                            }
                        })
                    }, false);
                }
            }
        };

        const observer = new MutationObserver(callback);

        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    }
})();
