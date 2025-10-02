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
    craftScrapCommand(steamID: SteamID, message: string): void { // Doesn't say Unused method craftTokenCommand
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
        // !craftToken <tokenType (class/slot)> <subTokenType (scout, soldier, etc)> <amount>
        // All code above is probably good, but below, I don't know, it's just copy-pasted from another function. Syntax: !craftscrap <amount|max>
        // It should determine how many scraps to get in a smart way
        // For example, if I say !craftscrap 2, that gets hard, if you smelt a reclaimed you get 3 scrap. You're going to have to round it to whichever whole number is closest
        // So in this case, the target should be 3
        // If I run !craftscrap max, max should be the amount of refined metals * 9 + amount of reclaimed metals * 9
        // Skus are 5000;6 for scrap metal, 5001;6 for reclaimed metal and 5002;6 for refined metal
        // Use findBySKU to get tradable ones ONLY
        // And filter by ones not in trade
        // Start off with smelting reclaimed metals into scrap metal and if you smelt all reclaimed metals before the target is reached, smelt the amount of refined metal needed
        // The amount of refined metal needed to smelt into reclaimed metal should be the remaining target amount divided by nine, round to the nearest third, or 1/3 basically
        // So if the remaining target / 9 is 10.33, smelt 11 refined metal into reclaimed metal but since it's 0.66 ref off 11, you skip the last 2 reclaimed metals
        // Does my concept seem good?
        if (parts.length === 1 && ['check', 'info'].includes(parts[0])) {
            // !craftToken check
            // !craftToken info
            return this.getCraftTokenInfo(steamID);
        }

        if (parts.length < 2) {
            return this.bot.sendMessage(
                steamID,
                '❌ Wrong syntax. Correct syntax: !craftToken <tokenName> <amount>' +
                '\n - TokenName: one of the 9 TF2 class characters, or "primary"/"secondary"/"melee"/"pda2" slot' +
                '\n - amount: Must be an integer, or "max"'
            );
        }

        const tokenName = parts[0];
        const amount: number | 'max' = parts[1] === 'max' ? 'max' : parseInt(parts[1]);

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
            // only load on demand
            isSlotToken = true;
            this.defineCraftWeaponsBySlots();
        }

        const assetids: string[] = [];

        const craftableItems = this.bot.inventoryManager.getInventory.getCurrencies(
            !isSlotToken
                ? this.bot.craftWeaponsByClass[tokenName as ClassesForCraftableWeapons]
                : this.craftWeaponsBySlot[tokenName as SlotsForCraftableWeapons],
            false
        );

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
/* CURRENT WORK
    craftTokenCommand(steamID: SteamID, message: string): void { // Doesn't say Unused method craftTokenCommand
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
        // !craftToken <tokenType (class/slot)> <subTokenType (scout, soldier, etc)> <amount>

        if (parts.length === 1 && ['check', 'info'].includes(parts[0])) {
            // !craftToken check
            // !craftToken info
            return this.getCraftTokenInfo(steamID);
        }

        if (parts.length < 2) {
            return this.bot.sendMessage(
                steamID,
                '❌ Wrong syntax. Correct syntax: !craftToken <tokenName> <amount>' +
                '\n - TokenName: one of the 9 TF2 class characters, or "primary"/"secondary"/"melee"/"pda2" slot' +
                '\n - amount: Must be an integer, or "max"'
            );
        }

        const tokenName = parts[0];
        const amount: number | 'max' = parts[1] === 'max' ? 'max' : parseInt(parts[1]);

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
            // only load on demand
            isSlotToken = true;
            this.defineCraftWeaponsBySlots();
        }

        const assetids: string[] = [];
        const lessassetids: string[] = [];

        const craftableItems = this.bot.inventoryManager.getInventory.getCurrencies(
            !isSlotToken
                ? this.bot.craftWeaponsByClass[tokenName as ClassesForCraftableWeapons]
                : this.craftWeaponsBySlot[tokenName as SlotsForCraftableWeapons],
            false
        );

        for (const sku in craftableItems) {
            if (!Object.prototype.hasOwnProperty.call(craftableItems, sku)) {
                continue;
            }

            if (craftableItems[sku].length === 0) {
                delete craftableItems[sku];
                continue;
            }

            assetids.push(...craftableItems[sku]);
            if (sku !== '59;6' && sku !== '60;6') lessassetids.push(...craftableItems[sku]);
        }

        const availableAmount = assetids.length;
        const lessAvailableAmount = lessassetids.length;
        const amountCanCraft = Math.floor(availableAmount / 3);
        const lessAmountCanCraft = Math.floor(lessAvailableAmount / 3);
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

        this.bot.sendMessage(steamID, '⏳ Crafting 🔨...');
        this.isCrafting = true;

        let crafted = 0;
        let callbackIndex = 0;
        const amountToCraft = amount === 'max' ? amountCanCraft : amount;
        const lessAmountToCraft = amount === 'max' ? lessAmountCanCraft : amount;
        if (tokenName.toLowerCase() === 'spy') {
            for (let i = 0; i < lessAmountToCraft; i++) {
                const assetidsToCraft = lessassetids.splice(0, 3);
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
        } else {
            if (tokenName.toLowerCase() === 'spy') {
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
        }
    }

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
        console.log('craftableItems: ', craftableItems)

        // 🟢 NEW: If Spy, exclude Dead Ringer (59;6) and Cloak and Dagger (60;6)
        if (!isSlotToken && tokenName === 'spy') {
            console.log('You requested spy crafting, I will remove cloak and daggers and dead ringers..')
            delete craftableItems['59;6'];
            delete craftableItems['60;6'];
            console.log('craftableItems now: ', craftableItems)
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
    async combineTokenCommand(steamID: SteamID, message: string): Promise<void> {
        // Syntax: !ctk scout melee 50
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

        const classTokens = ['scout','soldier','pyro','demoman','heavy','engineer','medic','sniper','spy'];
        const slotTokens = ['primary','secondary','melee','pda2'];


        const parts = message.toLowerCase().split(' ');
        // Amount handling
        const amountPart = parts[2] || '1';
        const amount: number | 'max' = amountPart === 'max' ? 'max' : parseInt(amountPart, 10);
        // Require at least 2 tokens (class + slot) + optional amount
        if (parts.length < 2 || parts.length > 3) {
            return this.bot.sendMessage(
                steamID,
                '❌ Wrong syntax. Correct syntax: !combinetoken <classToken> <slotToken> <amount|max>'
            );
        }

        // Detect tokens regardless of order
        const classToken = parts.find(p => classTokens.includes(p));
        const slotToken = parts.find(p => slotTokens.includes(p));

        if (!classToken || !slotToken) {
            return this.bot.sendMessage(
                steamID,
                '❌ Invalid tokens! Class tokens: ' + classTokens.join('/') +
                '. Slot tokens: ' + slotTokens.join('/')
            );
        }

        if (amount !== 'max' && (isNaN(amount) || amount < 1)) {
            return this.bot.sendMessage(steamID, '❌ Amount must be a positive integer or "max"!');
        }

        const inventory = this.bot.inventoryManager.getInventory;

        const scrapMetalAssetIDs = inventory.findBySKU('5000;6', true)
            .filter(id => !this.bot.trades.isInTrade(id));
        const classTokenAssetIDs = inventory.findBySKU(this.getTokenSKU(classToken), true)
            .filter(id => !this.bot.trades.isInTrade(id));
        const slotTokenAssetIDs = inventory.findBySKU(this.getTokenSKU(slotToken), true)
            .filter(id => !this.bot.trades.isInTrade(id));

        const availableAmount = Math.min(
            scrapMetalAssetIDs.length,
            classTokenAssetIDs.length,
            slotTokenAssetIDs.length
        );
        const amountToCraft = amount === 'max' ? availableAmount : Math.min(amount, availableAmount);

        if (amountToCraft === 0) {
            return this.bot.sendMessage(
                steamID,
                `❌ Not enough tokens to combine. I have ${scrapMetalAssetIDs.length} scrap metal, ${classTokenAssetIDs.length} ${classToken}(s) and ${slotTokenAssetIDs.length} ${slotToken}s.`
            );
        }

        // Begin sequential crafting
        this.isCrafting = true;
        this.bot.sendMessage(steamID, `⏳ Sending ${amountToCraft} token combination requests...`);

        let crafted = 0;

        for (let i = 0; i < amountToCraft; i++) {
            const assetidsToCraft = [
                scrapMetalAssetIDs.shift()!,
                classTokenAssetIDs.shift()!,
                slotTokenAssetIDs.shift()!
            ];

            try {
                // wrap callback-style API in a Promise and await it so execution is sequential
                await new Promise<void>((resolve, reject) => {
                    this.bot.tf2gc.combineTokens(assetidsToCraft, (err?: Error | null) => {
                        if (err) {
                            log.error('This happened: ', err);
                            return reject(err);
                        }
                        // success: TF2GC will emit craftingComplete and update inventory internally
                        resolve();
                    });
                });

                crafted++;
            } catch (err) {
                // Stop immediately on first failure, restore state and report partial progress
                this.isCrafting = false;

                this.bot.client.gamesPlayed([]);
                this.bot.client.gamesPlayed(
                    this.bot.options.miscSettings.game.playOnlyTF2 ? 440 : [this.bot.handler.customGameName, 440]
                );

                if (crafted === 0) {
                    await this.bot.sendMessage(steamID, '❌ Not a single crafting operation succeeded, check logs for details.');
                } else {
                    await this.bot.sendMessage(steamID, `✅ Successfully combined ${crafted}/${amountToCraft} pairs (stopped after an error).`);
                }

                return; // exit the function — no retry/fallback
            }
        }

        // All done successfully
        this.isCrafting = false;

        this.bot.client.gamesPlayed([]);
        this.bot.client.gamesPlayed(
            this.bot.options.miscSettings.game.playOnlyTF2 ? 440 : [this.bot.handler.customGameName, 440]
        );

        return this.bot.sendMessage(
            steamID,
            `✅ Successfully combined ${crafted} pairs of ${classToken} + ${slotToken} tokens!`
        );
    }
// Make sure these are available in this file top-level imports if not already:
// import SteamID from 'steamid';
// import CommandParser from '...'; // wherever your CommandParser lives
// import log from '../../../../lib/logger';

    async craftHatsCommand(steamID: SteamID, message: string): Promise<void> {
        // Syntax: !ch <amount|max>
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

        // remove the command prefix
        message = CommandParser.removeCommand(message).trim();

        const parts = message.toLowerCase().split(/\s+/).filter(Boolean);

        // Amount handling: last part may be amount or 'max'
        let amountPart = '1';
        if (parts.length >= 1) {
            const last = parts[parts.length - 1];
            if (last === 'max' || /^\d+$/.test(last)) {
                amountPart = last;
                // strip amount from token parts so detection works regardless of position
                parts.pop();
            }
        }

        // For hats we only expect optionally an amount (or 'max').
        // Accept both "!ch" and "!ch <amount|max>"
        const amount: number | 'max' = amountPart === 'max' ? 'max' : parseInt(amountPart, 10);
        if (amount !== 'max' && (isNaN(amount) || amount < 1)) {
            return this.bot.sendMessage(steamID, '❌ Amount must be a positive integer or "max"!');
        }

        const inventory = this.bot.inventoryManager.getInventory;

        // refined metal sku — you used '5002;6' which is correct for Refined Metal in your codebase
        const refAssetIDs = inventory.findBySKU('5002;6', true)
            .filter(id => !this.bot.trades.isInTrade(id));

        const availableAmount = Math.floor(refAssetIDs.length / 3);
        const amountToCraft = amount === 'max' ? availableAmount : Math.min(amount, availableAmount);

        if (amountToCraft === 0) {
            return this.bot.sendMessage(
                steamID,
                `❌ Not enough metal to combine. I have ${refAssetIDs.length} ref. (need 3 ref per craft)`
            );
        }

        // Begin sequential crafting
        this.isCrafting = true;
        await this.bot.sendMessage(steamID, `⏳ Crafting ${amountToCraft} hats...`);

        let crafted = 0;

        for (let i = 0; i < amountToCraft; i++) {
            // take 3 refined metal asset ids for this craft
            const assetidsToCraft = [
                refAssetIDs.shift()!,
                refAssetIDs.shift()!,
                refAssetIDs.shift()!
            ];

            try {
                // Enqueue a craftHats job and wait for its callback to resolve
                await new Promise<void>((resolve, reject) => {
                    this.bot.tf2gc.craftHats(assetidsToCraft, (err?: Error | null) => {
                        if (err) {
                            log.error('Craft hat returned error:', err);
                            return reject(err);
                        }
                        resolve();
                    });
                });

                crafted++;
            } catch (err) {
                // Stop immediately on first failure, restore state and report partial progress
                this.isCrafting = false;

                try {
                    this.bot.client.gamesPlayed([]);
                    this.bot.client.gamesPlayed(
                        this.bot.options.miscSettings.game.playOnlyTF2 ? 440 : [this.bot.handler.customGameName, 440]
                    );
                } catch (_) {
                    // ignore if gamesPlayed throws
                }

                if (crafted === 0) {
                    await this.bot.sendMessage(steamID, '❌ Not a single crafting operation succeeded, check logs for details.');
                } else {
                    await this.bot.sendMessage(steamID, `✅ Successfully crafted ${crafted}/${amountToCraft} hats (stopped after an error).`);
                }

                return; // exit the function — no retry/fallback
            }
        }

        // All done successfully
        this.isCrafting = false;

        try {
            this.bot.client.gamesPlayed([]);
            this.bot.client.gamesPlayed(
                this.bot.options.miscSettings.game.playOnlyTF2 ? 440 : [this.bot.handler.customGameName, 440]
            );
        } catch (_) {
            // ignore
        }

        await this.bot.sendMessage(
            steamID,
            `✅ Successfully crafted ${crafted} hats!`
        );
    }

    /**
     * Helper: map token friendly names to their token SKUs.
     * classToken: scout -> '5003;6', soldier->'5005;6', ...
     * slotToken: primary->'5012;6', secondary->'5013;6', melee->'5014;6', pda2->'5018;6'
     */


    delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /*
    old code, I don't know how long this one has been commented out for
        combineTokenCommand(steamID: SteamID, message: string, remaining: number, fallback: boolean): void {
            if (remaining === -1) {
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
                const originalMessage = message;
                message = CommandParser.removeCommand(message).trim();
                const parts = message.toLowerCase().split(' ');

                const classTokens = ['scout', 'soldier', 'pyro', 'demoman', 'heavy', 'engineer', 'medic', 'sniper', 'spy'];
                const slotTokens = ['primary', 'secondary', 'melee', 'pda2'];

                // Require at least 2 tokens (class + slot) + optional amount
                if (parts.length < 2 || parts.length > 3) {
                    return this.bot.sendMessage(
                        steamID,
                        '❌ Wrong syntax. Correct syntax: !combinetoken <classToken> <slotToken> <amount|max>'
                    );
                }

                // Detect tokens regardless of order
                let classToken = parts.find(p => classTokens.includes(p));
                let slotToken = parts.find(p => slotTokens.includes(p));

                if (!classToken || !slotToken) {
                    return this.bot.sendMessage(
                        steamID,
                        '❌ Invalid tokens! Class tokens: ' + classTokens.join('/') +
                        '. Slot tokens: ' + slotTokens.join('/')
                    );
                }

                // Amount handling
                const amountPart = parts[2] || '1';
                const amount: number | 'max' = amountPart === 'max' ? 'max' : parseInt(amountPart);

                if (amount !== 'max' && (isNaN(amount) || amount < 1)) {
                    return this.bot.sendMessage(steamID, '❌ Amount must be a positive integer or "max"!');
                }

                const inventory = this.bot.inventoryManager.getInventory;

                const scrapMetalAssetIDs = inventory.findBySKU('5000;6', true)
                    .filter(id => !this.bot.trades.isInTrade(id));
                const classTokenAssetIDs = inventory.findBySKU(this.getTokenSKU(classToken), true)
                    .filter(id => !this.bot.trades.isInTrade(id));
                const slotTokenAssetIDs = inventory.findBySKU(this.getTokenSKU(slotToken), true)
                    .filter(id => !this.bot.trades.isInTrade(id));

                const availableAmount = Math.min(
                    scrapMetalAssetIDs.length,
                    classTokenAssetIDs.length,
                    slotTokenAssetIDs.length
                );
                const amountToCraft = amount === 'max' ? availableAmount : Math.min(amount, availableAmount);

                if (amountToCraft === 0) {
                    return this.bot.sendMessage(
                        steamID,
                        `❌ Not enough tokens to combine. I have ${scrapMetalAssetIDs.length} scrap metal, ${classTokenAssetIDs.length} ${classToken}(s) and ${slotTokenAssetIDs.length} ${slotToken}s.`
                    );
                }

                this.isCrafting = true;
                this.bot.sendMessage(steamID, '⏳ Combining tokens...');

                let crafted = 0;
                let callbackIndex = 0;

                for (let i = 0; i < amountToCraft; i++) {
                    const assetidsToCraft = [
                        scrapMetalAssetIDs.shift()!,
                        classTokenAssetIDs.shift()!,
                        slotTokenAssetIDs.shift()!
                    ];

                    this.bot.tf2gc.combineTokens(assetidsToCraft, async (err?: Error | null) => {
                        if (err) {
                            log.debug('First loop, Crafting operation failed after ' + crafted + ' items were crafted')
                            let remaining = amountToCraft - crafted;
                            log.debug(`steamID: ${steamID} originalMessage: ${originalMessage} remaining: ${remaining} fallback: ${fallback}, now recalling the function for the first time`)
                            return this.combineTokenCommand(steamID, originalMessage, remaining, true)
                        }
                        crafted++;
                        callbackIndex++;

                        if (callbackIndex >= amountToCraft) {
                            this.isCrafting = false;

                            this.bot.client.gamesPlayed([]);
                            this.bot.client.gamesPlayed(
                                this.bot.options.miscSettings.game.playOnlyTF2 ? 440 : [this.bot.handler.customGameName, 440]
                            );

                            if (crafted < amountToCraft) {
                                if (crafted === 0) {
                                    return this.bot.sendMessage(
                                        steamID,
                                        `❌ Not a single crafting operation succeeded, check logs for details.`
                                    );
                                } else {
                                    return this.bot.sendMessage(
                                        steamID,
                                        `✅ Successfully combined ${(100 * crafted / amountToCraft).toFixed(2)}% of pairs (some errors occurred).`
                                    );
                                }
                            }
                            return this.bot.sendMessage(
                                steamID,
                                `✅ Successfully combined ${crafted} pairs of ${classToken} + ${slotToken} tokens!`
                            );
                        }
                    });
                }
            }
            else if (fallback) {
                const originalMessage = message;
                message = CommandParser.removeCommand(message).trim();
                const parts = message.toLowerCase().split(' ');
                const classTokens = ['scout', 'soldier', 'pyro', 'demoman', 'heavy', 'engineer', 'medic', 'sniper', 'spy'];
                const slotTokens = ['primary', 'secondary', 'melee', 'pda2'];

                // Require at least 2 tokens (class + slot) + optional amount
                if (parts.length < 2 || parts.length > 3) {
                    return this.bot.sendMessage(
                        steamID,
                        "❌ 1. You shouldn't get this error, show this to the developer if you do."
                    );
                }

                // Detect tokens regardless of order
                let classToken = parts.find(p => classTokens.includes(p));
                let slotToken = parts.find(p => slotTokens.includes(p));

                if (!classToken || !slotToken) {
                    this.bot.sendMessage(steamID, `steamID: ${steamID}, message: ${message}, remaining: ${remaining}, fallback: ${fallback}`);
                    this.bot.sendMessage(steamID, "2. steamID: " + steamID + "message: " + message + "remaining" + remaining + "fallback: " + fallback);
                    this.bot.sendMessage(steamID, "test");
                    return this.bot.sendMessage(steamID, "❌ 2. You shouldn't get this error, show this to the developer if you do.");
                }

                // Amount handling
                const amountPart = parts[2] || '1';
                const amount: number | 'max' = amountPart === 'max' ? 'max' : parseInt(amountPart);

                if (amount !== 'max' && (isNaN(amount) || amount < 1)) {
                    return this.bot.sendMessage(steamID, "❌ 3. You shouldn't get this error, show this to the developer if you do.");
                }

                const inventory = this.bot.inventoryManager.getInventory;

                const scrapMetalAssetIDs = inventory.findBySKU('5000;6', true)
                    .filter(id => !this.bot.trades.isInTrade(id));
                const classTokenAssetIDs = inventory.findBySKU(this.getTokenSKU(classToken), true)
                    .filter(id => !this.bot.trades.isInTrade(id));
                const slotTokenAssetIDs = inventory.findBySKU(this.getTokenSKU(slotToken), true)
                    .filter(id => !this.bot.trades.isInTrade(id));

                const availableAmount = Math.min(
                    scrapMetalAssetIDs.length,
                    classTokenAssetIDs.length,
                    slotTokenAssetIDs.length
                );
                const amountToCraft = amount === 'max' ? availableAmount : Math.min(amount, availableAmount);

                if (amountToCraft === 0) {
                    return this.bot.sendMessage(steamID, "❌ 4. You shouldn't get this error, show this to the developer if you do.");
                }

                let crafted = 0;
                let callbackIndex = 0;

                const assetidsToCraft = [
                    scrapMetalAssetIDs.shift()!,
                    classTokenAssetIDs.shift()!,
                    slotTokenAssetIDs.shift()!
                ];
                this.bot.tf2gc.combineTokens(assetidsToCraft, async (err?: Error | null) => {
                    if (err) {
                        log.error('This happened:', err);
                        let remaining = amountToCraft - crafted;
                        this.bot.sendMessage(steamID, `❌ Fallback failed, retrying.`);
                        return this.combineTokenCommand(steamID, originalMessage, remaining, true);
                    }
                    remaining--;
                    this.bot.sendMessage(steamID, `✅ Fallback succeeded, continuing with the crafting operation.`);
                    if (remaining === 0) {
                        return this.bot.sendMessage(steamID, `✅ Crafting operation is now complete, all items should have been crafted successfully.`);
                    }
                    return this.combineTokenCommand(steamID, originalMessage, remaining, false); // Should I use return here? I basically want it to run the combineToken function and not continue with anything in this instance if it was going to after THAT calling was complete
                });
            }
            else {
                const opt = this.bot.options.crafting;
                if (opt.manual === false) {
                    return this.bot.sendMessage(steamID, "❌ 4.5. You shouldn't get this error, show this to the developer if you do.");
                }
                const originalMessage = message;
                message = CommandParser.removeCommand(message).trim();
                const parts = message.toLowerCase().split(' ');
                const classTokens = ['scout', 'soldier', 'pyro', 'demoman', 'heavy', 'engineer', 'medic', 'sniper', 'spy'];
                const slotTokens = ['primary', 'secondary', 'melee', 'pda2'];
                // Require at least 2 tokens (class + slot) + optional amount
                if (parts.length < 2 || parts.length > 3) {
                    return this.bot.sendMessage(steamID, "❌ 5. You shouldn't get this error, show this to the developer if you do.");
                }
                // Detect tokens regardless of order
                let classToken = parts.find(p => classTokens.includes(p));
                let slotToken = parts.find(p => slotTokens.includes(p));
                if (!classToken || !slotToken) {
                    return this.bot.sendMessage(steamID, "❌ 6. You shouldn't get this error, show this to the developer if you do.");
                }
                const inventory = this.bot.inventoryManager.getInventory;
                const scrapMetalAssetIDs = inventory.findBySKU('5000;6', true)
                    .filter(id => !this.bot.trades.isInTrade(id));
                const classTokenAssetIDs = inventory.findBySKU(this.getTokenSKU(classToken), true)
                    .filter(id => !this.bot.trades.isInTrade(id));
                const slotTokenAssetIDs = inventory.findBySKU(this.getTokenSKU(slotToken), true)
                    .filter(id => !this.bot.trades.isInTrade(id));
                const availableAmount = Math.min(
                    scrapMetalAssetIDs.length,
                    classTokenAssetIDs.length,
                    slotTokenAssetIDs.length
                );
                const amountToCraft = remaining;
                if (amountToCraft === 0) {
                    return this.bot.sendMessage(steamID, "❌ 7. You shouldn't get this error, show this to the developer if you do.");
                }
                let crafted = 0;
                let callbackIndex = 0;
                for (let i = 0; i < amountToCraft; i++) {
                    const assetidsToCraft = [
                        scrapMetalAssetIDs.shift()!,
                        classTokenAssetIDs.shift()!,
                        slotTokenAssetIDs.shift()!
                    ];
                    this.bot.tf2gc.combineTokens(assetidsToCraft, async (err?: Error | null) => {
                        if (err) {
                            log.error('This happened:', err);
                            let remaining = amountToCraft - crafted;
                            return this.combineTokenCommand(steamID, originalMessage, remaining, true)
                        }
                        crafted++;
                        callbackIndex++;
                        if (callbackIndex >= amountToCraft) {
                            this.isCrafting = false;
                            this.bot.client.gamesPlayed([]);
                            this.bot.client.gamesPlayed(
                                this.bot.options.miscSettings.game.playOnlyTF2 ? 440 : [this.bot.handler.customGameName, 440]
                            );
                            if (crafted < amountToCraft) {
                                if (crafted === 0) {
                                    return this.bot.sendMessage(
                                        steamID,
                                        `❌ Not a single crafting operation succeeded, check logs for details.`
                                    );
                                } else {
                                    return this.bot.sendMessage(
                                        steamID,
                                        `✅ Successfully combined ${(100 * crafted / amountToCraft).toFixed(2)}% of pairs (some errors occurred).`
                                    );
                                }
                            }
                            return this.bot.sendMessage(
                                steamID,
                                `✅ Successfully combined ${crafted} pairs of ${classToken} + ${slotToken} tokens!`
                            );
                        }
                    });
                }
                }

        }
     */


    craftVaccinatorCommand(steamID: SteamID, message: string): void {
        log.debug('craftVaccinatorCommand called!');
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
        const parts = message.toLowerCase().split(' ');
        // Amount handling
        const amountPart = parts[1] || '1'; // WTF IN THE HELL?
        let amount: number | 'max' = amountPart === 'max' ? 'max' : parseInt(amountPart, 10);
        const quickFixSKU = '411;6';
        const reclaimedSKU = '5001;6';

        const inventory = this.bot.inventoryManager.getInventory;

// returns tradable quick-fix/reclaimed assetids, excluding items in active trades
        const quickFixes = inventory
            .findBySKU(quickFixSKU, true) // tradable only
            .filter(assetid => !this.bot.trades.isInTrade(assetid));

        const reclaimeds = inventory
            .findBySKU(reclaimedSKU, true)
            .filter(assetid => !this.bot.trades.isInTrade(assetid));


        const numQuickFix = quickFixes.length;
        const numReclaimed = reclaimeds.length;

        const amountCanCraft = Math.min(Math.floor(numQuickFix / 3), numReclaimed);
        if (amount === 'max') {
            amount = amountCanCraft;
        } else if (amountCanCraft < amount) {
            amount = amountCanCraft;
            return this.bot.sendMessage(
                steamID,
                `❌ Cannot craft that many vaccinator.\nI have ${numQuickFix} Quick-Fix(es) and ${numReclaimed} Reclaimed Metal(s).`
            );
        }

        this.bot.sendMessage(steamID, `⏳ Crafting ${amount} Vaccinator(s)... 🔨`);
        this.isCrafting = true;

        let crafted = 0;
        let callbackIndex = 0;

        for (let i = 0; i < amount; i++) {
            const itemsToUse = [
                quickFixes.splice(0, 1)[0],
                quickFixes.splice(0, 1)[0],
                quickFixes.splice(0, 1)[0],
                reclaimeds.splice(0, 1)[0]
            ];

            this.bot.tf2gc.craftVaccinator(itemsToUse, err => {
                if (err) {
                    log.debug(`Error crafting Vaccinator using assetids: ${itemsToUse.join(', ')}`, { error: err });
                    crafted--; // reverse increment to reflect failure
                }

                callbackIndex++;
                crafted++;

                if (callbackIndex === amount) {
                    this.isCrafting = false;

                    this.bot.client.gamesPlayed([]);
                    this.bot.client.gamesPlayed(
                        this.bot.options.miscSettings.game.playOnlyTF2 ? 440 : [this.bot.handler.customGameName, 440]
                    );

                    if (crafted < amount) {
                        return this.bot.sendMessage(
                            steamID,
                            `✅ Crafted ${crafted} Vaccinator(s), but some crafts failed.`
                        );
                    }

                    return this.bot.sendMessage(steamID, `✅ Successfully crafted ${crafted} Vaccinator(s)!`);
                }
            });
        }
    }

    smeltUselessWeaponCommand(steamID: SteamID): void {
        log.debug('smeltUselessWeaponCommand called!');
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

        const uselessWeapons = [
            '1101;6',
            '133;6',
            '1099;6',
            '354;6',
            '129;6',
            '226;6',
            '442;6',
            '444;6',
            '131;6',
            '130;6',
            '406;6',
            '1150;6',
            '528;6',
            '140;6',
            '35;6'
        ];
        /* work
        const getHighValue: GetHighValue = {
            our: {
                items: {},
                isMention: false
            }
        }

        const valuableItems = getHighValueItems(getHighValue.our.items, this.bot)
         */
        const inventory = this.bot.inventoryManager.getInventory;
        const assetidsToSmelt: string[] = [];

        for (const sku of uselessWeapons) {
            const tradableItems = inventory.findBySKU(sku, true);
            // Try to filter out items with attachments especially "Gifted by" attachments
            assetidsToSmelt.push(...tradableItems);
        }


        // Calculate how many full pairs we can smelt (2 weapons per smelt)
        const amountCanCraft = Math.floor(assetidsToSmelt.length / 2);
        log.debug('assetidsToSmelt: ', assetidsToSmelt)
        log.debug('assetidsToSmelt.length: ', assetidsToSmelt.length)
        if (amountCanCraft === 0) {
            return this.bot.sendMessage(
                steamID,
                `❌ I lack enough useless weapons to smelt. Need at least 2.`
            );
        }

        this.bot.sendMessage(steamID, `⏳ Smelting ${amountCanCraft * 2} useless weapons... 🔨`);
        this.isCrafting = true;

        let crafted = 0;
        let callbackIndex = 0;

        for (let i = 0; i < amountCanCraft; i++) {
            const itemsToUse = assetidsToSmelt.splice(0, 2); // take 2 assetids for smelting

            this.bot.tf2gc.smeltUselessWeapons(itemsToUse, err => {
                if (err) {
                    log.debug(`Error smelting useless weapons using assetids: ${itemsToUse.join(', ')}`, { error: err });
                    crafted--; // reverse increment to reflect failure
                }

                callbackIndex++;
                crafted++;

                if (callbackIndex === amountCanCraft) {
                    this.isCrafting = false;

                    this.bot.client.gamesPlayed([]);
                    this.bot.client.gamesPlayed(
                        this.bot.options.miscSettings.game.playOnlyTF2 ? 440 : [this.bot.handler.customGameName, 440]
                    );

                    if (crafted < amountCanCraft) {
                        return this.bot.sendMessage(
                            steamID,
                            `✅ Smelted ${crafted * 2} weapons, but some crafts failed.`
                        );
                    }

                    return this.bot.sendMessage(steamID, `✅ Successfully smelted ${crafted * 2} weapons!`);
                }
            });
        }
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
