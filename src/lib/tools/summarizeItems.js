"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = listItems;
const tf2_sku_1 = __importDefault(require("@tf2autobot/tf2-sku"));
const tf2_currencies_1 = __importDefault(require("@tf2autobot/tf2-currencies"));
const export_1 = require("../tools/export");
function listItems(offer, bot, items, isSteamChat) {
    const itemsPrices = bot.options.tradeSummary.showItemPrices ? listPrices(offer, bot, isSteamChat) : '';
    let list = itemsPrices;
    const itemsPricesLength = itemsPrices.length;
    const invalidCount = items.invalid.length;
    const disabledCount = items.disabled.length;
    const overstockedCount = items.overstock.length;
    const understockedCount = items.understock.length;
    const dupedCount = items.duped.length;
    const dupedFailedCount = items.dupedFailed.length;
    const highValueCount = items.highValue.length;
    list +=
        invalidCount > 0
            ? (itemsPricesLength > 0 ? '\n\n' : '') +
                (isSteamChat
                    ? '🟨_INVALID_ITEMS:\n- ' + items.invalid.join(',\n- ')
                    : '🟨`_INVALID_ITEMS:`\n- ' + items.invalid.join(',@\n- '))
            : '';
    list +=
        disabledCount > 0
            ? (itemsPricesLength > 0 || invalidCount > 0 ? '\n\n' : '') +
                (isSteamChat
                    ? '🟧_DISABLED_ITEMS:\n- ' + items.disabled.join(',\n- ')
                    : '🟧`_DISABLED_ITEMS:`\n- ' + items.disabled.join(',@\n- '))
            : '';
    list +=
        overstockedCount > 0
            ? (itemsPricesLength > 0 || invalidCount > 0 || disabledCount > 0 ? '\n\n' : '') +
                (isSteamChat
                    ? '🟦_OVERSTOCKED:\n- ' + items.overstock.join(',\n- ')
                    : '🟦`_OVERSTOCKED:`\n- ' + items.overstock.join(',@\n- '))
            : '';
    list +=
        understockedCount > 0
            ? (itemsPricesLength > 0 || invalidCount > 0 || disabledCount > 0 || overstockedCount > 0 ? '\n\n' : '') +
                (isSteamChat
                    ? '🟩_UNDERSTOCKED:\n- ' + items.understock.join(',\n- ')
                    : '🟩`_UNDERSTOCKED:`\n- ' + items.understock.join(',@\n- '))
            : '';
    list +=
        dupedCount > 0
            ? (itemsPricesLength > 0 ||
                invalidCount > 0 ||
                disabledCount > 0 ||
                overstockedCount > 0 ||
                understockedCount > 0
                ? '\n\n'
                : '') +
                (isSteamChat
                    ? '🟫_DUPED_ITEMS:\n- ' + items.duped.join(',\n- ')
                    : '🟫`_DUPED_ITEMS:`\n- ' + items.duped.join(',@\n- '))
            : '';
    list +=
        dupedFailedCount > 0
            ? (itemsPricesLength > 0 ||
                invalidCount > 0 ||
                disabledCount > 0 ||
                overstockedCount > 0 ||
                understockedCount > 0 ||
                dupedCount > 0
                ? '\n\n'
                : '') +
                (isSteamChat
                    ? '🟪_DUPE_CHECK_FAILED:\n- ' + items.dupedFailed.join(',\n- ')
                    : '🟪`_DUPE_CHECK_FAILED:`\n- ' + items.dupedFailed.join(',@\n- '))
            : '';
    list +=
        highValueCount > 0
            ? (itemsPricesLength > 0 ||
                invalidCount > 0 ||
                disabledCount > 0 ||
                overstockedCount > 0 ||
                understockedCount > 0 ||
                dupedCount > 0 ||
                dupedFailedCount > 0
                ? '\n\n'
                : '') +
                (isSteamChat
                    ? '🔶_HIGH_VALUE_ITEMS:\n- ' + items.highValue.join('\n\n- ')
                    : '🔶`_HIGH_VALUE_ITEMS`\n- ' + items.highValue.join('@\n\n- '))
            : '';
    if (list.length === 0) {
        list = '-';
    }
    return export_1.replace.itemName(list);
}
function listPrices(offer, bot, isSteamChat) {
    const prices = offer.data('prices');
    let text = '';
    const toJoin = [];
    const properName = bot.options.tradeSummary.showProperName;
    let buyPrice;
    let sellPrice;
    for (const priceKey in prices) {
        let autoprice = 'removed/not listed';
        if (!Object.prototype.hasOwnProperty.call(prices, priceKey)) {
            continue;
        }
        buyPrice = new tf2_currencies_1.default(prices[priceKey].buy).toString();
        sellPrice = new tf2_currencies_1.default(prices[priceKey].sell).toString();
        const entry = bot.pricelist.getPriceBySkuOrAsset({ priceKey, onlyEnabled: false });
        if (entry !== null) {
            autoprice = entry.autoprice ? `autopriced${entry.isPartialPriced ? ' - ppu' : ''}` : 'manual';
        }
        const name = (0, export_1.testPriceKey)(priceKey)
            ? bot.schema.getName(tf2_sku_1.default.fromString(entry?.sku ?? priceKey), properName)
            : priceKey;
        toJoin.push(`${isSteamChat
            ? `${name} - ${buyPrice} / ${sellPrice} (${autoprice})`
            : `_${name}_ - ${buyPrice} / ${sellPrice} (${autoprice})`}`);
    }
    if (toJoin.length > 0) {
        text = isSteamChat
            ? '📜_ITEMS_PRICES\n- ' + toJoin.join(',\n- ')
            : '📜`_ITEMS_PRICES`\n- ' + toJoin.join(',@\n- ');
    }
    return text;
}
