"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULTS = void 0;
exports.removeCliOptions = removeCliOptions;
exports.loadOptions = loadOptions;
exports.getFilesPath = getFilesPath;
exports.getOptionsPath = getOptionsPath;
const change_case_1 = require("change-case");
const fs_1 = require("fs");
const jsonlint_1 = __importDefault(require("@tf2autobot/jsonlint"));
const path = __importStar(require("path"));
const deep_merge_1 = require("../lib/tools/deep-merge");
const validator_1 = __importDefault(require("../lib/validator"));
exports.DEFAULTS = {
    miscSettings: {
        showOnlyMetal: {
            enable: true
        },
        sortInventory: {
            enable: true,
            type: 3
        },
        createListings: {
            enable: true
        },
        startHalted: {
            enable: false
        },
        addFriends: {
            enable: true
        },
        sendGroupInvite: {
            enable: true
        },
        counterOffer: {
            enable: true,
            skipIncludeMessage: false,
            autoDeclineLazyOffer: false
        },
        skipItemsInTrade: {
            enable: true
        },
        weaponsAsCurrency: {
            enable: true,
            withUncraft: true
        },
        itemsOnBothSides: {
            enable: true
        },
        checkUses: {
            duel: true,
            noiseMaker: true
        },
        game: {
            playOnlyTF2: false,
            customName: ''
        },
        alwaysRemoveItemAttributes: {
            customTexture: {
                enable: true
            }
        },
        deleteUntradableJunk: {
            enable: false
        },
        reputationCheck: {
            checkMptfBanned: false
        },
        pricecheckAfterTrade: {
            enable: true
        },
        prefixes: {
            steam: '!',
            discord: '!'
        }
    },
    sendAlert: {
        enable: true,
        autokeys: {
            lowPure: true,
            failedToAdd: true,
            failedToUpdate: true,
            failedToDisable: true
        },
        backpackFull: true,
        highValue: {
            gotDisabled: true,
            receivedNotInPricelist: true,
            tryingToTake: true
        },
        autoRemoveIntentSellFailed: true,
        autoRemoveAssetidFailed: true,
        autoRemoveAssetidSuccess: true,
        autoUpdateAssetid: true,
        autoResetToAutopriceOnceSold: true,
        autoAddPaintedItems: true,
        failedAccept: true,
        unableToProcessOffer: true,
        partialPrice: {
            onUpdate: true,
            onSuccessUpdatePartialPriced: true,
            onFailedUpdatePartialPriced: true,
            onBulkUpdatePartialPriced: true,
            onResetAfterThreshold: true
        },
        receivedUnusualNotInPricelist: true,
        failedToUpdateOldPrices: true
    },
    pricelist: {
        partialPriceUpdate: {
            enable: false,
            thresholdInSeconds: 604800,
            excludeSKU: []
        },
        filterCantAfford: {
            enable: false
        },
        autoResetToAutopriceOnceSold: {
            enable: false
        },
        autoRemoveIntentSell: {
            enable: false
        },
        autoAddInvalidItems: {
            enable: true
        },
        autoAddInvalidUnusual: {
            enable: false
        },
        autoAddPaintedItems: {
            enable: true
        },
        priceAge: {
            maxInSeconds: 28800
        },
        rewriteFile: {
            count: 1
        }
    },
    bypass: {
        escrow: {
            allow: false
        },
        overpay: {
            allow: true
        },
        giftWithoutMessage: {
            allow: false
        }
    },
    tradeSummary: {
        declinedTrade: { enable: false },
        showStockChanges: false,
        showTimeTakenInMS: false,
        showDetailedTimeTaken: true,
        showItemPrices: true,
        showPureInEmoji: false,
        showProperName: false,
        showOfferMessage: false,
        customText: {
            summary: {
                steamChat: 'Summary',
                discordWebhook: '__**Summary**__'
            },
            asked: {
                steamChat: '• Asked:',
                discordWebhook: '**• Asked:**'
            },
            offered: {
                steamChat: '• Offered:',
                discordWebhook: '**• Offered:**'
            },
            offerMessage: {
                steamChat: '💬 Offer message:',
                discordWebhook: '💬 **Offer message:**'
            },
            profitFromOverpay: {
                steamChat: '📈 Profit from overpay:',
                discordWebhook: '📈 ***Profit from overpay:***'
            },
            lossFromUnderpay: {
                steamChat: '📉 Loss from underpay:',
                discordWebhook: '📉 ***Loss from underpay:***'
            },
            timeTaken: {
                steamChat: '⏱ Time taken:',
                discordWebhook: '⏱ **Time taken:**'
            },
            keyRate: {
                steamChat: '🔑 Key rate:',
                discordWebhook: '🔑 Key rate:'
            },
            pureStock: {
                steamChat: '💰 Pure stock:',
                discordWebhook: '💰 Pure stock:'
            },
            totalItems: {
                steamChat: '🎒 Total items:',
                discordWebhook: '🎒 Total items:'
            },
            spells: '🎃 Spells:',
            strangeParts: '🎰 Parts:',
            killstreaker: '🔥 Killstreaker:',
            sheen: '✨ Sheen:',
            painted: '🎨 Painted:'
        }
    },
    steamChat: {
        customInitializer: {
            acceptedTradeSummary: '/me',
            declinedTradeSummary: '/me',
            review: '',
            message: {
                onReceive: '/quote',
                toOtherAdmins: '/quote'
            }
        },
        notifyTradePartner: {
            onSuccessAccepted: true,
            onSuccessAcceptedEscrow: true,
            onDeclined: true,
            onCancelled: true,
            onTradedAway: true,
            onOfferForReview: true
        }
    },
    highValue: {
        enableHold: true,
        retainOldGroup: false,
        customGroup: 'highValue',
        spells: {
            names: [],
            exceptionSkus: []
        },
        sheens: {
            names: [],
            exceptionSkus: []
        },
        killstreakers: {
            names: [],
            exceptionSkus: []
        },
        strangeParts: {
            names: [],
            exceptionSkus: []
        },
        painted: {
            names: [],
            exceptionSkus: []
        }
    },
    normalize: {
        festivized: {
            our: false,
            their: false,
            amountIncludeNonFestivized: false
        },
        strangeAsSecondQuality: {
            our: false,
            their: false,
            amountIncludeNonStrange: false
        },
        painted: {
            our: true,
            their: true,
            amountIncludeNonPainted: false
        },
        craftNumber: {
            our: false,
            their: false
        }
    },
    details: {
        buy: 'I am buying your %name% for %price%, I have %current_stock% / %max_stock%.',
        sell: 'I am selling my %name% for %price%, I am selling %amount_trade%.',
        showAutokeys: true,
        showBoldText: {
            onPrice: false,
            onAmount: false,
            onCurrentStock: false,
            onMaxStock: false,
            style: 1
        },
        highValue: {
            showSpells: true,
            showStrangeParts: false,
            showKillstreaker: true,
            showSheen: true,
            showPainted: true,
            customText: {
                spells: '🎃 Spells:',
                strangeParts: '🎰 Parts:',
                killstreaker: '🤩 Killstreaker:',
                sheen: '✨ Sheen:',
                painted: '🎨 Painted:',
                separator: '| ',
                ender: ' |'
            }
        },
        uses: {
            duel: '(𝗢𝗡𝗟𝗬 𝗪𝗜𝗧𝗛 𝟱x 𝗨𝗦𝗘𝗦)',
            noiseMaker: '(𝗢𝗡𝗟𝗬 𝗪𝗜𝗧𝗛 𝟐𝟱x 𝗨𝗦𝗘𝗦)'
        }
    },
    statistics: {
        lastTotalTrades: 0,
        startingTimeInUnix: 0,
        lastTotalProfitMadeInRef: 0,
        lastTotalProfitOverpayInRef: 0,
        profitDataSinceInUnix: 0,
        sendStats: {
            enable: false,
            time: []
        }
    },
    autokeys: {
        enable: false,
        minKeys: 3,
        maxKeys: 15,
        minRefined: 30,
        maxRefined: 150,
        banking: {
            enable: false
        },
        scrapAdjustment: {
            enable: false,
            value: 1
        },
        accept: {
            understock: false
        }
    },
    crafting: {
        manual: false,
        weapons: {
            enable: false
        },
        metals: {
            enable: false,
            minScrap: 9,
            minRec: 9,
            threshold: 9
        }
    },
    offerReceived: {
        sendPreAcceptMessage: {
            enable: true
        },
        alwaysDeclineNonTF2Items: true,
        invalidValue: {
            autoDecline: {
                enable: true,
                declineReply: ''
            },
            exceptionValue: {
                skus: [],
                valueInRef: 0
            }
        },
        invalidItems: {
            givePrice: false,
            autoAcceptOverpay: true,
            autoDecline: {
                enable: false,
                declineReply: ''
            }
        },
        disabledItems: {
            autoAcceptOverpay: false,
            autoDecline: {
                enable: false,
                declineReply: ''
            }
        },
        overstocked: {
            autoAcceptOverpay: false,
            autoDecline: {
                enable: false,
                declineReply: ''
            }
        },
        understocked: {
            autoAcceptOverpay: false,
            autoDecline: {
                enable: false,
                declineReply: ''
            }
        },
        duped: {
            enableCheck: true,
            minKeys: 10,
            autoDecline: {
                enable: false,
                declineReply: ''
            }
        },
        failedToCheckDuped: {
            autoDecline: {
                enable: false,
                declineReply: ''
            }
        },
        escrowCheckFailed: {
            ignoreFailed: false
        },
        bannedCheckFailed: {
            ignoreFailed: false
        },
        halted: {
            ignoreHalted: false
        },
        reviewForced: {
            enable: true
        }
    },
    manualReview: {
        enable: true,
        showOfferSummary: true,
        showReviewOfferNote: true,
        showOwnerCurrentTime: true,
        showItemPrices: true,
        invalidValue: {
            note: ''
        },
        invalidItems: {
            note: ''
        },
        disabledItems: {
            note: ''
        },
        overstocked: {
            note: ''
        },
        understocked: {
            note: ''
        },
        duped: {
            note: ''
        },
        dupedCheckFailed: {
            note: ''
        },
        escrowCheckFailed: {
            note: ''
        },
        bannedCheckFailed: {
            note: ''
        },
        halted: {
            note: ''
        },
        reviewForced: {
            note: ''
        },
        additionalNotes: ''
    },
    inventoryApis: {
        steamSupply: {
            enable: false
        },
        steamApis: {
            enable: false
        }
    },
    discordChat: {
        online: {
            type: 'LISTENING',
            name: 'incoming offers',
            status: 'online'
        },
        halt: {
            type: 'PLAYING',
            name: '? No, Halted ⛔',
            status: 'idle'
        }
    },
    discordWebhook: {
        ownerID: [],
        displayName: '',
        avatarURL: '',
        embedColor: '9171753',
        tradeSummary: {
            enable: true,
            url: [],
            misc: {
                showQuickLinks: true,
                showKeyRate: true,
                showPureStock: true,
                showInventory: true,
                note: ''
            },
            mentionOwner: {
                enable: false,
                itemSkus: [],
                tradeValueInRef: 0
            }
        },
        declinedTrade: {
            enable: true,
            url: [],
            misc: {
                showQuickLinks: true,
                showKeyRate: true,
                showPureStock: true,
                showInventory: true,
                note: ''
            }
        },
        offerReview: {
            enable: true,
            url: '',
            mentionInvalidValue: true,
            isMention: true,
            misc: {
                showQuickLinks: true,
                showKeyRate: true,
                showPureStock: true,
                showInventory: true
            }
        },
        messages: {
            enable: true,
            isMention: true,
            url: '',
            showQuickLinks: true
        },
        priceUpdate: {
            enable: true,
            showOnlyInStock: false,
            showFailedToUpdate: true,
            url: '',
            note: ''
        },
        sendAlert: {
            enable: true,
            isMention: true,
            url: {
                main: '',
                partialPriceUpdate: ''
            }
        },
        sendStats: {
            enable: false,
            url: ''
        },
        sendTf2Events: {
            systemMessage: {
                enable: true,
                url: '',
                custom: {
                    content: ''
                }
            },
            displayNotification: {
                enable: true,
                url: '',
                custom: {
                    content: ''
                }
            },
            itemBroadcast: {
                enable: true,
                url: '',
                custom: {
                    content: ''
                }
            }
        }
    },
    customMessage: {
        sendOffer: '',
        counterOffer: '',
        welcome: '',
        commandNotFound: '',
        success: '',
        successEscrow: '',
        halted: '',
        decline: {
            general: '',
            hasNonTF2Items: '',
            giftNoNote: '',
            giftFailedCheckBanned: '',
            crimeAttempt: '',
            onlyMetal: '',
            duelingNot5Uses: '',
            noiseMakerNot25Uses: '',
            highValueItemsNotSelling: '',
            notTradingKeys: '',
            notSellingKeys: '',
            notBuyingKeys: '',
            halted: '',
            banned: '',
            escrow: '',
            manual: '',
            failedToCounter: '',
            takingItemsWithIntentBuy: '',
            givingItemsWithIntentSell: '',
            containsKeysOnBothSides: '',
            containsItemsOnBothSides: ''
        },
        accepted: {
            automatic: {
                largeOffer: '',
                smallOffer: ''
            },
            manual: {
                largeOffer: '',
                smallOffer: ''
            }
        },
        tradedAway: '',
        failedMobileConfirmation: '',
        cancelledActiveForAwhile: '',
        clearFriends: ''
    },
    commands: {
        enable: true,
        customDisableReply: '',
        how2trade: {
            customReply: {
                reply: ''
            }
        },
        price: {
            enable: true,
            customReply: {
                disabled: ''
            }
        },
        buy: {
            enable: true,
            disableForSKU: [],
            customReply: {
                disabled: '',
                disabledForSKU: ''
            }
        },
        sell: {
            enable: true,
            disableForSKU: [],
            customReply: {
                disabled: '',
                disabledForSKU: ''
            }
        },
        buycart: {
            enable: true,
            disableForSKU: [],
            customReply: {
                disabled: '',
                disabledForSKU: ''
            }
        },
        sellcart: {
            enable: true,
            disableForSKU: [],
            customReply: {
                disabled: '',
                disabledForSKU: ''
            }
        },
        cart: {
            enable: true,
            customReply: {
                title: '',
                disabled: ''
            }
        },
        clearcart: {
            customReply: {
                reply: ''
            }
        },
        checkout: {
            customReply: {
                empty: ''
            }
        },
        addToQueue: {
            alreadyHaveActiveOffer: '',
            alreadyInQueueProcessingOffer: '',
            alreadyInQueueWaitingTurn: '',
            addedToQueueWaitingTurn: '',
            alteredOffer: '',
            processingOffer: {
                donation: '',
                isBuyingPremium: '',
                offer: ''
            },
            hasBeenMadeAcceptingMobileConfirmation: {
                donation: '',
                isBuyingPremium: '',
                offer: ''
            }
        },
        cancel: {
            customReply: {
                isBeingSent: '',
                isCancelling: '',
                isRemovedFromQueue: '',
                noActiveOffer: '',
                successCancel: ''
            }
        },
        queue: {
            customReply: {
                notInQueue: '',
                offerBeingMade: '',
                hasPosition: ''
            }
        },
        owner: {
            enable: true,
            customReply: {
                disabled: '',
                reply: ''
            }
        },
        discord: {
            enable: true,
            inviteURL: '',
            customReply: {
                disabled: '',
                reply: ''
            }
        },
        more: {
            enable: true,
            customReply: {
                disabled: ''
            }
        },
        autokeys: {
            enable: true,
            customReply: {
                disabled: ''
            }
        },
        message: {
            enable: true,
            showOwnerName: true,
            customReply: {
                disabled: '',
                wrongSyntax: '',
                fromOwner: '',
                success: ''
            }
        },
        time: {
            enable: true,
            customReply: {
                disabled: '',
                reply: ''
            }
        },
        uptime: {
            enable: true,
            customReply: {
                disabled: '',
                reply: ''
            }
        },
        pure: {
            enable: true,
            customReply: {
                disabled: '',
                reply: ''
            }
        },
        rate: {
            enable: true,
            customReply: {
                disabled: '',
                reply: ''
            }
        },
        stock: {
            enable: true,
            maximumItems: 20,
            customReply: {
                disabled: '',
                reply: ''
            }
        },
        craftweapon: {
            enable: true,
            showOnlyExist: true,
            customReply: {
                disabled: '',
                dontHave: '',
                have: ''
            }
        },
        uncraftweapon: {
            enable: true,
            showOnlyExist: true,
            customReply: {
                disabled: '',
                dontHave: '',
                have: ''
            }
        }
    },
    detailsExtra: {
        spells: {
            'Putrescent Pigmentation': 'PP 🍃',
            'Die Job': 'DJ 🍐',
            'Chromatic Corruption': 'CC 🪀',
            'Spectral Spectrum': 'Spec 🔵🔴',
            'Sinister Staining': 'Sin 🍈',
            'Voices from Below': 'VFB 🗣️',
            'Team Spirit Footprints': 'TS-FP 🔵🔴',
            'Gangreen Footprints': 'GG-FP 🟡',
            'Corpse Gray Footprints': 'CG-FP 👽',
            'Violent Violet Footprints': 'VV-FP ♨️',
            'Rotten Orange Footprints': 'RO-FP 🍊',
            'Bruised Purple Footprints': 'BP-FP 🍷',
            'Headless Horseshoes': 'HH 🍇',
            Exorcism: '👻',
            'Pumpkin Bombs': '🎃💣',
            'Halloween Fire': '🔥🟢'
        },
        sheens: {
            'Team Shine': '🔵🔴',
            'Hot Rod': '🌸',
            Manndarin: '🟠',
            'Deadly Daffodil': '🟡',
            'Mean Green': '🟢',
            'Agonizing Emerald': '🟩',
            'Villainous Violet': '🟣'
        },
        killstreakers: {
            'Cerebral Discharge': '⚡',
            'Fire Horns': '🔥🐮',
            Flames: '🔥',
            'Hypno-Beam': '😵💫',
            Incinerator: '🚬',
            Singularity: '🔆',
            Tornado: '🌪️'
        },
        painted: {
            'A Color Similar to Slate': {
                stringNote: '🧪',
                price: {
                    keys: 0,
                    metal: 11
                }
            },
            'A Deep Commitment to Purple': {
                stringNote: '🪀',
                price: {
                    keys: 0,
                    metal: 15
                }
            },
            'A Distinctive Lack of Hue': {
                stringNote: '🎩',
                price: {
                    keys: 1,
                    metal: 5
                }
            },
            "A Mann's Mint": {
                stringNote: '👽',
                price: {
                    keys: 0,
                    metal: 30
                }
            },
            'After Eight': {
                stringNote: '🏴',
                price: {
                    keys: 1,
                    metal: 5
                }
            },
            'Aged Moustache Grey': {
                stringNote: '👤',
                price: {
                    keys: 0,
                    metal: 5
                }
            },
            'An Extraordinary Abundance of Tinge': {
                stringNote: '🏐',
                price: {
                    keys: 1,
                    metal: 5
                }
            },
            'Australium Gold': {
                stringNote: '🏆',
                price: {
                    keys: 0,
                    metal: 15
                }
            },
            'Color No. 216-190-216': {
                stringNote: '🧠',
                price: {
                    keys: 0,
                    metal: 7
                }
            },
            'Dark Salmon Injustice': {
                stringNote: '🐚',
                price: {
                    keys: 0,
                    metal: 15
                }
            },
            'Drably Olive': {
                stringNote: '🥝',
                price: {
                    keys: 0,
                    metal: 5
                }
            },
            'Indubitably Green': {
                stringNote: '🥦',
                price: {
                    keys: 0,
                    metal: 5
                }
            },
            'Mann Co. Orange': {
                stringNote: '🏀',
                price: {
                    keys: 0,
                    metal: 6
                }
            },
            Muskelmannbraun: {
                stringNote: '👜',
                price: {
                    keys: 0,
                    metal: 2
                }
            },
            "Noble Hatter's Violet": {
                stringNote: '🍇',
                price: {
                    keys: 0,
                    metal: 7
                }
            },
            'Peculiarly Drab Tincture': {
                stringNote: '🪑',
                price: {
                    keys: 0,
                    metal: 3
                }
            },
            'Pink as Hell': {
                stringNote: '🎀',
                price: {
                    keys: 1,
                    metal: 10
                }
            },
            'Radigan Conagher Brown': {
                stringNote: '🚪',
                price: {
                    keys: 0,
                    metal: 2
                }
            },
            'The Bitter Taste of Defeat and Lime': {
                stringNote: '💚',
                price: {
                    keys: 1,
                    metal: 10
                }
            },
            "The Color of a Gentlemann's Business Pants": {
                stringNote: '🧽',
                price: {
                    keys: 0,
                    metal: 5
                }
            },
            'Ye Olde Rustic Colour': {
                stringNote: '🥔',
                price: {
                    keys: 0,
                    metal: 2
                }
            },
            "Zepheniah's Greed": {
                stringNote: '🌳',
                price: {
                    keys: 0,
                    metal: 4
                }
            },
            'An Air of Debonair': {
                stringNote: '👜🔷',
                price: {
                    keys: 0,
                    metal: 30
                }
            },
            'Balaclavas Are Forever': {
                stringNote: '👜🔷',
                price: {
                    keys: 0,
                    metal: 30
                }
            },
            "Operator's Overalls": {
                stringNote: '👜🔷',
                price: {
                    keys: 0,
                    metal: 30
                }
            },
            'Cream Spirit': {
                stringNote: '🍘🥮',
                price: {
                    keys: 0,
                    metal: 30
                }
            },
            'Team Spirit': {
                stringNote: '🔵🔴',
                price: {
                    keys: 0,
                    metal: 30
                }
            },
            'The Value of Teamwork': {
                stringNote: '🎎',
                price: {
                    keys: 0,
                    metal: 30
                }
            },
            'Waterlogged Lab Coat': {
                stringNote: '🎏',
                price: {
                    keys: 0,
                    metal: 30
                }
            },
            'Legacy Paint': {
                stringNote: '🔵⛔',
                price: {
                    keys: 4,
                    metal: 0
                }
            }
        },
        strangeParts: {
            'Robots Destroyed': '',
            Kills: '',
            'Airborne Enemy Kills': '',
            'Damage Dealt': '',
            Dominations: '',
            'Snipers Killed': '',
            'Buildings Destroyed': '',
            'Projectiles Reflected': '',
            'Headshot Kills': '',
            'Medics Killed': '',
            'Fires Survived': '',
            'Teammates Extinguished': '',
            'Freezecam Taunt Appearances': '',
            'Spies Killed': '',
            'Allied Healing Done': '',
            'Sappers Removed': '',
            'Players Hit': '',
            'Gib Kills': '',
            'Scouts Killed': '',
            'Taunt Kills': '',
            'Point Blank Kills': '',
            'Soldiers Killed': '',
            'Long-Distance Kills': '',
            'Giant Robots Destroyed': '',
            'Critical Kills': '',
            'Demomen Killed': '',
            'Unusual-Wearing Player Kills': '',
            Assists: '',
            'Medics Killed That Have Full ÜberCharge': '',
            'Cloaked Spies Killed': '',
            'Engineers Killed': '',
            'Kills While Explosive-Jumping': '',
            'Kills While Low Health': '',
            'Burning Player Kills': '',
            'Kills While Invuln ÜberCharged': '',
            'Posthumous Kills': '',
            'Not Crit nor MiniCrit Kills': '',
            'Full Health Kills': '',
            'Killstreaks Ended': '',
            'Defenders Killed': '',
            Revenges: '',
            'Robot Scouts Destroyed': '',
            'Heavies Killed': '',
            'Tanks Destroyed': '',
            'Kills During Halloween': '',
            'Pyros Killed': '',
            'Submerged Enemy Kills': '',
            'Kills During Victory Time': '',
            'Taunting Player Kills': '',
            'Robot Spies Destroyed': '',
            'Kills Under A Full Moon': '',
            'Robots Killed During Halloween': ''
        }
    }
};
function getOption(option, def, parseFn, options) {
    try {
        if (options && options[option]) {
            return options[option];
        }
        const envVar = (0, change_case_1.snakeCase)(option).toUpperCase();
        return process.env[envVar] ? parseFn(process.env[envVar]) : def;
    }
    catch {
        return def;
    }
}
function throwLintError(filepath, e) {
    if (e instanceof Error && 'message' in e) {
        throw new Error(`${filepath}\n${e.message}`);
    }
    throw e;
}
function lintPath(filepath) {
    const rawOptions = (0, fs_1.readFileSync)(filepath, { encoding: 'utf8' });
    try {
        jsonlint_1.default.parse(rawOptions);
    }
    catch (e) {
        throwLintError(filepath, e);
    }
}
function lintAllTheThings(directory) {
    if ((0, fs_1.existsSync)(directory)) {
        (0, fs_1.readdirSync)(directory, { withFileTypes: true })
            .filter(ent => path.extname(ent.name) === '.json')
            .forEach(ent => lintPath(path.join(directory, ent.name)));
    }
}
function loadJsonOptions(optionsPath, options) {
    let fileOptions;
    const workingDefault = (0, deep_merge_1.deepMerge)({}, exports.DEFAULTS);
    const incomingOptions = options ? (0, deep_merge_1.deepMerge)({}, options) : (0, deep_merge_1.deepMerge)({}, exports.DEFAULTS);
    try {
        const rawOptions = (0, fs_1.readFileSync)(optionsPath, { encoding: 'utf8' });
        try {
            const parsedRaw = JSON.parse(rawOptions);
            if (replaceOldProperties(parsedRaw)) {
                (0, fs_1.writeFileSync)(optionsPath, JSON.stringify(parsedRaw, null, 4), { encoding: 'utf8' });
            }
            fileOptions = (0, deep_merge_1.deepMerge)({}, workingDefault, parsedRaw);
            return (0, deep_merge_1.deepMerge)(fileOptions, incomingOptions);
        }
        catch (e) {
            if (e instanceof SyntaxError) {
                try {
                    jsonlint_1.default.parse(rawOptions);
                }
                catch (e) {
                    throwLintError(optionsPath, e);
                }
            }
            throw e;
        }
    }
    catch (e) {
        if (!(0, fs_1.existsSync)(path.dirname(optionsPath))) {
            (0, fs_1.mkdirSync)(path.dirname(optionsPath), { recursive: true });
            (0, fs_1.writeFileSync)(optionsPath, JSON.stringify(exports.DEFAULTS, null, 4), { encoding: 'utf8' });
            return (0, deep_merge_1.deepMerge)({}, exports.DEFAULTS);
        }
        else if (!(0, fs_1.existsSync)(optionsPath)) {
            (0, fs_1.writeFileSync)(optionsPath, JSON.stringify(exports.DEFAULTS, null, 4), { encoding: 'utf8' });
            return (0, deep_merge_1.deepMerge)({}, exports.DEFAULTS);
        }
        else {
            throw e;
        }
    }
}
function removeCliOptions(incomingOptions) {
    const findNonEnv = (0, validator_1.default)(incomingOptions, 'options');
    if (findNonEnv) {
        findNonEnv
            .filter(e => e.includes('unknown property'))
            .map(e => e.slice(18, -1))
            .map(e => delete incomingOptions[e]);
    }
}
function replaceOldProperties(options) {
    let isChanged = false;
    const hv = options.highValue;
    if (hv) {
        const spells = hv.spells;
        if (Array.isArray(spells)) {
            options.highValue.spells = {
                names: spells,
                exceptionSkus: []
            };
            isChanged = true;
        }
        const sheens = hv.sheens;
        if (Array.isArray(sheens)) {
            options.highValue.sheens = {
                names: sheens,
                exceptionSkus: []
            };
            isChanged = true;
        }
        const killstreakers = hv.killstreakers;
        if (Array.isArray(killstreakers)) {
            options.highValue.killstreakers = {
                names: killstreakers,
                exceptionSkus: []
            };
            isChanged = true;
        }
        const strangeParts = hv.strangeParts;
        if (Array.isArray(strangeParts)) {
            options.highValue.strangeParts = {
                names: strangeParts,
                exceptionSkus: []
            };
            isChanged = true;
        }
        const painted = hv.painted;
        if (Array.isArray(painted)) {
            options.highValue.painted = {
                names: painted,
                exceptionSkus: []
            };
            isChanged = true;
        }
    }
    if (options.discordWebhook) {
        const ownerID = options.discordWebhook.ownerID;
        if (!Array.isArray(ownerID)) {
            options.discordWebhook.ownerID = ownerID === '' ? [] : [ownerID];
            isChanged = true;
        }
        else {
            if (ownerID[0] === '') {
                if (ownerID.length > 1) {
                    options.discordWebhook.ownerID.shift();
                }
                else {
                    options.discordWebhook.ownerID.length = 0;
                }
                isChanged = true;
            }
        }
    }
    if (options.customMessage?.decline?.takingItemsWithZeroSellingPrice !== undefined) {
        delete options.customMessage.decline.takingItemsWithZeroSellingPrice;
        options.customMessage.decline['takingItemsWithIntentBuy'] = '';
        options.customMessage.decline['givingItemsWithIntentSell'] = '';
        isChanged = true;
    }
    if (options.miscSettings?.autobump !== undefined) {
        delete options.miscSettings.autobump;
        isChanged = true;
    }
    if (typeof options.discordWebhook?.sendAlert?.url === 'string') {
        const mainUrl = options.discordWebhook.sendAlert.url;
        options.discordWebhook.sendAlert.url = {
            main: mainUrl,
            partialPriceUpdate: ''
        };
        isChanged = true;
    }
    if (options.bypass?.bannedPeople !== undefined) {
        const mptfCheckValue = options.bypass.bannedPeople?.checkMptfBanned;
        if (options.miscSettings.reputationCheck !== undefined) {
            options.miscSettings.reputationCheck.checkMptfBanned =
                typeof mptfCheckValue === 'boolean' ? mptfCheckValue : true;
        }
        else {
            options.miscSettings['reputationCheck'] = {
                checkMptfBanned: process.env.MPTF_API_KEY !== undefined ? mptfCheckValue : false
            };
        }
        delete options.bypass.bannedPeople;
        isChanged = true;
    }
    if (options.customMessage?.iDontKnowWhatYouMean !== undefined) {
        delete options.customMessage.iDontKnowWhatYouMean;
        options.customMessage['commandNotFound'] = '';
        isChanged = true;
    }
    if (options.detailsExtra?.spells?.['Voices From Below'] !== undefined) {
        options.detailsExtra.spells['Voices from Below'] = options.detailsExtra?.spells?.['Voices From Below'];
        delete options.detailsExtra.spells['Voices From Below'];
        isChanged = true;
    }
    if (options.miscSettings.reputationCheck?.['reptfAsPrimarySource'] !== undefined) {
        delete options.miscSettings.reputationCheck?.['reptfAsPrimarySource'];
        isChanged = true;
    }
    return isChanged;
}
function loadOptions(options) {
    const incomingOptions = options ? (0, deep_merge_1.deepMerge)({}, options) : {};
    const steamAccountName = getOption('steamAccountName', '', String, incomingOptions);
    lintAllTheThings(getFilesPath(steamAccountName));
    const jsonParseArray = (jsonString) => JSON.parse(jsonString);
    const jsonParseBoolean = (jsonString) => JSON.parse(jsonString);
    const jsonParseNumber = (jsonString) => JSON.parse(jsonString);
    const jsonParseAdminData = (jsonString) => JSON.parse(jsonString);
    const envOptions = {
        steamAccountName: steamAccountName,
        steamPassword: getOption('steamPassword', '', String, incomingOptions),
        steamSharedSecret: getOption('steamSharedSecret', '', String, incomingOptions),
        steamIdentitySecret: getOption('steamIdentitySecret', '', String, incomingOptions),
        steamApiKey: getOption('steamApiKey', '', String, incomingOptions),
        bptfAccessToken: getOption('bptfAccessToken', '', String, incomingOptions),
        bptfApiKey: getOption('bptfApiKey', '', String, incomingOptions),
        useragentHeaderCustom: getOption('useragentHeaderCustom', '', String, incomingOptions),
        useragentHeaderShowVersion: getOption('useragentHeaderShowVersion', false, jsonParseBoolean, incomingOptions),
        mptfApiKey: getOption('mptfApiKey', '', String, incomingOptions),
        discordBotToken: getOption('discordBotToken', '', String, incomingOptions),
        steamSupplyApiKey: getOption('steamsupplyApiKey', '', String, incomingOptions),
        steamApisApiKey: getOption('steamapisApiKey', '', String, incomingOptions),
        admins: getOption('admins', [], jsonParseAdminData, incomingOptions),
        keep: getOption('keep', [], jsonParseArray, incomingOptions),
        itemStatsWhitelist: getOption('itemStatsWhitelist', [], jsonParseArray, incomingOptions),
        groups: getOption('groups', ['103582791469033930'], jsonParseArray, incomingOptions),
        alerts: getOption('alerts', ['trade'], jsonParseArray, incomingOptions),
        enableSocket: getOption('enableSocket', true, jsonParseBoolean, incomingOptions),
        customPricerApiToken: getOption('customPricerApiToken', '', String, incomingOptions),
        customPricerUrl: getOption('customPricerUrl', '', String, incomingOptions),
        skipBPTFTradeofferURL: getOption('skipBPTFTradeofferURL', true, jsonParseBoolean, incomingOptions),
        skipUpdateProfileSettings: getOption('skipUpdateProfileSettings', true, jsonParseBoolean, incomingOptions),
        tf2Language: getOption('tf2Language', 'english', String, incomingOptions),
        timezone: getOption('timezone', '', String, incomingOptions),
        customTimeFormat: getOption('customTimeFormat', '', String, incomingOptions),
        timeAdditionalNotes: getOption('timeAdditionalNotes', '', String, incomingOptions),
        debug: getOption('debug', true, jsonParseBoolean, incomingOptions),
        debugFile: getOption('debugFile', true, jsonParseBoolean, incomingOptions),
        enableSaveLogFile: getOption('enableSaveLogFile', true, jsonParseBoolean, incomingOptions),
        enableHttpApi: getOption('enableHttpApi', false, jsonParseBoolean, incomingOptions),
        httpApiPort: getOption('httpApiPort', 3001, jsonParseNumber, incomingOptions)
    };
    if (!envOptions.steamAccountName) {
        throw new Error('STEAM_ACCOUNT_NAME must be set in the environment');
    }
    removeCliOptions(incomingOptions);
    const jsonOptions = loadJsonOptions(getOptionsPath(envOptions.steamAccountName), incomingOptions);
    const errors = (0, validator_1.default)(jsonOptions, 'options');
    if (errors !== null) {
        throw new Error(errors.join(', '));
    }
    return (0, deep_merge_1.deepMerge)(jsonOptions, envOptions, incomingOptions);
}
function getFilesPath(accountName) {
    return path.resolve(__dirname, '..', '..', 'files', accountName);
}
function getOptionsPath(accountName) {
    return path.resolve(getFilesPath(accountName), 'options.json');
}
