import SteamID from 'steamid';
import Bot from '../../Bot';
import CommandParser from '../../CommandParser';
import { TokenType, SubTokenType } from '../../TF2GC';

import log from '../../../lib/logger';
import {
    ClassesForCraftableWeapons,
    CraftWeaponsBySlot,
    SlotsForCraftableWeapons
} from 'src/classes/MyHandler/utils/craftClassWeapons';
import {getHighValueItems} from "../../../lib/tools/export";

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const classes = ['scout', 'soldier', 'pyro', 'demoman', 'heavy', 'engineer', 'medic', 'sniper', 'spy'];
const slotType = ['primary', 'secondary', 'melee', 'pda2'];
const combineToken = classes.concat(slotType);

export default class CraftingCommands {
    private craftWeaponsBySlot: CraftWeaponsBySlot;

    private isCrafting = false;

    constructor(private readonly bot: Bot) {
        this.bot = bot;
    }
/*
		"4": "Combine Scrap Metal",
		"5": "Combine Reclaimed Metal",
		"22": "Smelt Reclaimed Metal",
		"23": "Smelt Refined Metal",

 */
    craftTokenCommand(steamID: SteamID, message: string): void {
        const opt = this.bot.options.crafting;
        if (opt.manual === false) {
            return this.bot.sendMessage(
                steamID,
                '❌ Please set crafting.manual option to true in order to use this command.'
            );
        }

        if (this.isCrafting) {
            return this.bot.sendMessage(
                steamID,
                "❌ Crafting still in progress. Please wait until it's completed."
            );
        }

        message = CommandParser.removeCommand(message).trim();
        const parts = message.toLowerCase().split(' ');

        if (parts.length === 1 && ['check', 'info'].includes(parts[0])) {
            return this.getCraftTokenInfo(steamID);
        }

        if (parts.length > 2) { // Efficiencify this with the previous parts.len===1 later
            return this.bot.sendMessage(
                steamID,
                '❌ Wrong syntax. Correct syntax: !craftToken <tokenName> <amount>' +
                '\n - TokenName: one of the 9 TF2 class characters, or "primary"/"secondary"/"melee"/"pda2" slot' +
                '\n - amount: Must be an integer, or "max"'
            );
        }

        const tokenName = parts[0];
        let amount: number | 'max';

        if (!parts[1]) {
            amount = 1;
        } else if (parts[1] === 'max') {
            amount = 'max';
        } else {
            amount = parseInt(parts[1]);
        }

        if (amount !== 'max') {
            if (isNaN(amount)) {
                return this.bot.sendMessage(steamID, '❌ Amount must be type integer!');
            }
        }

        if (!combineToken.includes(tokenName)) {
            return this.bot.sendMessage(
                steamID,
                '❌ Invalid token name!' +
                '\n• Slot: primary/secondary/melee/pda2' +
                '\n• Classes: scout/soldier/pyro/demoman/heavy/engineer/medic/sniper/spy'
            );
        }

        let isSlotToken = false;

        if (slotType.includes(tokenName)) {
            isSlotToken = true;
            this.defineCraftWeaponsBySlots();
        }

        const assetids: string[] = [];

        let craftableItems = this.bot.inventoryManager.getInventory.getCurrencies(
            !isSlotToken
                ? this.bot.craftWeaponsByClass[tokenName as ClassesForCraftableWeapons]
                : this.craftWeaponsBySlot[tokenName as SlotsForCraftableWeapons],
            false
        );

        // 🟢 NEW: If Spy, exclude Dead Ringer (59;6) and Cloak and Dagger (60;6)
        if (!isSlotToken && tokenName === 'spy') {
            delete craftableItems['59;6'];
            delete craftableItems['60;6'];
        }
        delete craftableItems['998;6'];
        delete craftableItems['411;6'];
        delete craftableItems['237;6'];

        for (const sku in craftableItems) {
            if (!Object.prototype.hasOwnProperty.call(craftableItems, sku)) {
                continue;
            }

            if (craftableItems[sku].length === 0) {
                delete craftableItems[sku];
                continue;
            }

            assetids.push(...craftableItems[sku]);
        }

        const availableAmount = assetids.length;
        const amountCanCraft = Math.floor(availableAmount / 3);
        const capTokenName = tokenName === 'pda2' ? 'PDA2' : capitalize(tokenName);
        const tokenType = isSlotToken ? 'slot' : 'class';
        const capTokenType = capitalize(tokenType);

        if (amount === 'max' && amountCanCraft === 0) {
            return this.bot.sendMessage(
                steamID,
                `❌ Unable to craft ${capTokenType} Token - ${capTokenName} since I only have ${availableAmount} of ${capTokenName} ${capTokenType} items.`
            );
        }

        if (amount !== 'max' && amount > amountCanCraft) {
            return this.bot.sendMessage(
                steamID,
                `❌ I can only craft ${amountCanCraft} ${capTokenType} Token - ${capTokenName} at the moment, since I only ` +
                `have ${availableAmount} of ${capTokenName} ${capTokenType} items.`
            );
        }
        this.isCrafting = true;

        let crafted = 0;
        let callbackIndex = 0;
        const amountToCraft = amount === 'max' ? amountCanCraft : amount;


        this.bot.sendMessage(steamID, `⏳ Crafting ${amountToCraft} tokens 🔨...`);
        for (let i = 0; i < amountToCraft; i++) {
            const assetidsToCraft = assetids.splice(0, 3);
            this.bot.tf2gc.craftToken(assetidsToCraft, tokenType as TokenType, tokenName as SubTokenType, err => {
                if (err) {
                    log.debug(
                        `Error crafting ${assetidsToCraft.join(', ')} for ${capTokenType} Token - ${capTokenName}`
                    );
                    crafted--;
                }

                callbackIndex++;
                crafted++;

                if (amountToCraft - callbackIndex === 0) {
                    this.isCrafting = false;

                    this.bot.client.gamesPlayed([]);
                    this.bot.client.gamesPlayed(
                        this.bot.options.miscSettings.game.playOnlyTF2 ? 440 : [this.bot.handler.customGameName, 440]
                    );

                    if (crafted < amountToCraft) {
                        return this.bot.sendMessage(
                            steamID,
                            `✅ Successfully crafted ${crafted} ${capTokenType} Token - ${capTokenName} (there were some error while crafting).`
                        );
                    }

                    return this.bot.sendMessage(
                        steamID,
                        `✅ Successfully crafted ${crafted} ${capTokenType} Token - ${capTokenName}!`
                    );
                }
            });
        }
    }

    private getTokenSKU(token: string): string {
        switch (token) {
            // Class tokens
            case 'scout': return '5003;6';
            case 'soldier': return '5005;6';
            case 'pyro': return '5009;6';
            case 'demoman': return '5006;6';
            case 'heavy': return '5007;6';
            case 'engineer': return '5011;6';
            case 'medic': return '5008;6';
            case 'sniper': return '5004;6';
            case 'spy': return '5010;6';

            // Slot tokens
            case 'primary': return '5012;6';
            case 'secondary': return '5013;6';
            case 'melee': return '5014;6';
            case 'pda2': return '5018;6';

            default:
                return ''; // Or throw error if you prefer
        }
    }
// Make sure these are available in this file top-level imports if not already:
// import SteamID from 'steamid';
// import CommandParser from '...'; // wherever your CommandParser lives
// import log from '../../../../lib/logger';


    /**
     * Helper: map token friendly names to their token SKUs.
     * classToken: scout -> '5003;6', soldier->'5005;6', ...
     * slotToken: primary->'5012;6', secondary->'5013;6', melee->'5014;6', pda2->'5018;6'
     */


    delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }




    private getCraftTokenInfo(steamID: SteamID): void {
        this.defineCraftWeaponsBySlots();

        const reply: string[] = [];
        const craftWeaponsByClass = this.bot.craftWeaponsByClass;
        const inventory = this.bot.inventoryManager.getInventory;

        for (const charClass in craftWeaponsByClass) {
            if (!Object.prototype.hasOwnProperty.call(craftWeaponsByClass, charClass)) {
                continue;
            }

            const craftableItems = this.bot.inventoryManager.getInventory.getCurrencies(
                craftWeaponsByClass[charClass as ClassesForCraftableWeapons],
                false
            );

            const assetids: string[] = [];

            for (const sku in craftableItems) {
                if (!Object.prototype.hasOwnProperty.call(craftableItems, sku) || sku === '59;6' || sku === '60;6' || sku === '237;6' || sku === '411;6' || sku === '998;6') { // Why does this only affect the spy token and pda2 token?
                    continue;
                }

                if (craftableItems[sku].length === 0) {
                    delete craftableItems[sku];
                    continue;
                }

                assetids.push(...craftableItems[sku]);
            }

            const availableAmount = assetids.length;
            const amountCanCraft = Math.floor(availableAmount / 3);
            const capSubTokenType = capitalize(charClass);

            let sku: string;
            switch (charClass) {
                case 'scout':
                    sku = '5003;6';
                    break;
                case 'soldier':
                    sku = '5005;6';
                    break;
                case 'pyro':
                    sku = '5009;6';
                    break;
                case 'demoman':
                    sku = '5006;6';
                    break;
                case 'heavy':
                    sku = '5007;6';
                    break;
                case 'engineer':
                    sku = '5011;6';
                    break;
                case 'medic':
                    sku = '5008;6';
                    break;
                case 'sniper':
                    sku = '5004;6';
                    break;
                case 'spy':
                    sku = '5010;6';
            }

            const currentTokenStock = inventory.getAmount({
                priceKey: sku,
                includeNonNormalized: false,
                tradableOnly: true
            });

            reply.push(
                `Class Token - ${capSubTokenType}: can craft ${amountCanCraft} (${availableAmount} items), token stock: ${currentTokenStock}`
            );
        }

        const craftWeaponsBySlots = this.craftWeaponsBySlot;

        for (const slot in craftWeaponsBySlots) {
            if (!Object.prototype.hasOwnProperty.call(craftWeaponsBySlots, slot)) {
                continue;
            }

            const craftableItems = this.bot.inventoryManager.getInventory.getCurrencies(
                craftWeaponsBySlots[slot],
                false
            );

            const assetids: string[] = [];

            for (const sku in craftableItems) {
                if (!Object.prototype.hasOwnProperty.call(craftableItems, sku)) {
                    continue;
                }

                if (craftableItems[sku].length === 0) {
                    delete craftableItems[sku];
                    continue;
                }

                assetids.push(...craftableItems[sku]);
            }

            const availableAmount = assetids.length;
            const amountCanCraft = Math.floor(availableAmount / 3);
            const capSubTokenType = slot === 'pda2' ? 'PDA2' : capitalize(slot);

            let sku: string;
            switch (slot) {
                case 'primary':
                    sku = '5012;6';
                    break;
                case 'secondary':
                    sku = '5013;6';
                    break;
                case 'melee':
                    sku = '5014;6';
                    break;
                case 'pda2':
                    sku = '5018;6';
                    break;
            }

            const currentTokenStock = inventory.getAmount({
                priceKey: sku,
                includeNonNormalized: false,
                tradableOnly: true
            });

            reply.push(
                `Slot Token - ${capSubTokenType}: can craft ${amountCanCraft} (${availableAmount} items), token stock: ${currentTokenStock}`
            );
        }

        this.bot.sendMessage(steamID, '🔨 Crafting token info:\n\n- ' + reply.join('\n- '));
    }

    private defineCraftWeaponsBySlots(): void {
        if (this.craftWeaponsBySlot === undefined) {
            // only load on demand
            this.craftWeaponsBySlot = {
                primary: [],
                secondary: [],
                melee: [],
                pda2: []
            };
            const craftableWeapons = this.bot.schema.getCraftableWeaponsSchema();
            const count = craftableWeapons.length;

            for (let i = 0; i < count; i++) {
                const item = craftableWeapons[i];

                if (['primary', 'secondary', 'melee', 'pda2'].includes(item.item_slot)) {
                    this.craftWeaponsBySlot[item.item_slot as SlotsForCraftableWeapons].push(`${item.defindex};6`);
                }
            }
        }
    }
}
