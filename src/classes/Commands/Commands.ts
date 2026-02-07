import SteamID from 'steamid';
import SKU from '@tf2autobot/tf2-sku';
import pluralize from 'pluralize';
import Currencies from '@tf2autobot/tf2-currencies';
import dayjs from 'dayjs';

import * as c from './sub-classes/export';
import {getItemAndAmount, getItemFromParams, removeLinkProtocol} from './functions/utils';

import Bot from '../Bot';
import CommandParser from '../CommandParser';
import Inventory, {getSkuAmountCanTrade} from '../Inventory';
import Cart from '../Carts/Cart';
import AdminCart from '../Carts/AdminCart';
import UserCart from '../Carts/UserCart';
import DonateCart from '../Carts/DonateCart';
import PremiumCart from '../Carts/PremiumCart';
import CartQueue from '../Carts/CartQueue';
import IPricer from '../IPricer';
import {fixItem} from '../../lib/items';
import {UnknownDictionary} from '../../types/common';
import log from '../../lib/logger';
import {testPriceKey} from '../../lib/tools/export';
import {apiRequest} from '../../lib/apiRequest';
// @ts-ignore


type Instant = 'buy' | 'b' | 'sell' | 's'; // Almost at the top of the file
type CraftUncraft = 'craftweapon' | 'uncraftweapon';
type Misc = 'time' | 'uptime' | 'pure' | 'rate' | 'owner' | 'discord' | 'stock';
type BlockUnblock = 'block' | 'unblock';
type NameAvatar = 'name' | 'avatar';
type TF2GC = 'expand' | 'use' | 'delete';
type ActionOnTrade = 'accept' | 'accepttrade' | 'decline' | 'declinetrade';
type ForceAction = 'faccept' | 'fdecline';

export default class Commands {
    private isDonating = false;

    private help: c.HelpCommands;

    private manager: c.ManagerCommands;

    private message: c.MessageCommand;

    private misc: c.MiscCommands;

    private opt: c.OptionsCommand;

    private pManager: c.PricelistManager;

    private request: c.RequestCommands;

    private review: c.ReviewCommands;

    private status: c.StatusCommands;

    private crafting: c.CraftingCommands;

    private adminInventory: UnknownDictionary<Inventory> = {};

    private adminInventoryReset: NodeJS.Timeout;

    constructor(private readonly bot: Bot, private readonly pricer: IPricer) {
        this.help = new c.HelpCommands(bot);
        this.manager = new c.ManagerCommands(bot);
        this.message = new c.MessageCommand(bot);
        this.misc = new c.MiscCommands(bot);
        this.opt = new c.OptionsCommand(bot);
        this.pManager = new c.PricelistManager(bot, pricer);
        this.request = new c.RequestCommands(bot, pricer);
        this.review = new c.ReviewCommands(bot);
        this.status = new c.StatusCommands(bot);
        this.crafting = new c.CraftingCommands(bot);
    }

    private get cartQueue(): CartQueue {
        return this.bot.handler.cartQueue;
    }

    private get weaponsAsCurrency(): { enable: boolean; withUncraft: boolean } {
        return {
            enable: this.bot.options.miscSettings.weaponsAsCurrency.enable,
            withUncraft: this.bot.options.miscSettings.weaponsAsCurrency.withUncraft
        };
    }

    useStatsCommand(steamID: SteamID): void {
        void this.status.statsCommand(steamID);
    }

    useUpdateOptionsCommand(steamID: SteamID | null, message: string): void {
        this.opt.updateOptionsCommand(steamID, message);
    }

    async processMessage(steamID: SteamID, message: string): Promise<void> {
        const isAdmin = this.bot.isAdmin(steamID);
        const prefix = this.bot.getPrefix(steamID);
        const command = CommandParser.getCommand(message.toLowerCase(), prefix);
        const isWhitelisted = this.bot.isWhitelisted(steamID);
        const isInvalidType = steamID.type === 0;

        const checkMessage = message.split(' ').filter(word => word.includes(`!${command}`)).length;

        if (checkMessage > 1 && !isAdmin) {
            return this.bot.sendMessage(steamID, "⛔ Don't spam");
        }

        if (message.startsWith(prefix)) {
            if (command === 'help') {
                void this.help.helpCommand(steamID, prefix);
            } else if (command === 'how2trade') {
                this.help.howToTradeCommand(steamID, prefix);
            } else if (['price', 'p'].includes(command)) {
                this.priceCommand(steamID, message, prefix);
            } else if (['buy', 'b', 'sell', 's'].includes(command)) {
                if (isInvalidType) { // When tf is isInvalidType even true?         const isInvalidType = steamID.type === 0;
                    return this.bot.sendMessage(steamID, '❌ Command not available.');
                }
                this.buyOrSellCommand(steamID, message, command as Instant, prefix);
            } else if (['buycart', 'bcart'].includes(command)) {
                if (isInvalidType) {
                    return this.bot.sendMessage(steamID, '❌ Command not available.');
                }
                this.buyCartCommand(steamID, message, prefix);
            } else if (['sellcart', 'scart'].includes(command)) {
                if (isInvalidType) {
                    return this.bot.sendMessage(steamID, '❌ Command not available.');
                }
                this.sellCartCommand(steamID, message, prefix);
            } else if (command === 'cart') {
                if (isInvalidType) {
                    return this.bot.sendMessage(steamID, '❌ Command not available.');
                }
                this.cartCommand(steamID, prefix);
            } else if (command === 'clearcart' || command === 'clear') {
                if (isInvalidType) {
                    return this.bot.sendMessage(steamID, '❌ Command not available.');
                }
                this.clearCartCommand(steamID);
            } else if (command === 'checkout' || command === 'c') {
                if (isInvalidType) {
                    return this.bot.sendMessage(steamID, '❌ Command not available.');
                }
                this.checkoutCommand(steamID, prefix);
            } else if (command === 'pricedbgroup' && isAdmin) {
                void this.misc.pricedbGroup(steamID);
            } else if (command === 'pricedbinvite' && isAdmin) {
                void this.misc.pricedbInvite(steamID, CommandParser.removeCommand(message));
            } else if (command === 'pricedbinvites' && isAdmin) {
                void this.misc.pricedbInvites(steamID);
            } else if (command === 'pricedbaccept' && isAdmin) {
                void this.misc.pricedbAccept(steamID, CommandParser.removeCommand(message));
            } else if (command === 'pricedbleave' && isAdmin) {
                void this.misc.pricedbLeave(steamID, CommandParser.removeCommand(message));
            } else if (command === 'cancel') {
                if (isInvalidType) {
                    return this.bot.sendMessage(steamID, '❌ Command not available.');
                }
                this.cancelCommand(steamID);
            } else if (command === 'queue') {
                if (isInvalidType) {
                    return this.bot.sendMessage(steamID, '❌ Command not available.');
                }
                this.queueCommand(steamID);
            } else if (['time', 'uptime', 'pure', 'rate', 'owner', 'discord', 'stock'].includes(command)) {
                if (command === 'stock') {
                    return this.misc.miscCommand(steamID, command as Misc, message);
                }
                this.misc.miscCommand(steamID, command as Misc);
            } else if (['link', 'links'].includes(command)) {
                this.misc.links(steamID);
            } else if (command === 'sku') {
                this.getSKU(steamID, message);
            } else if (['msg', 'message'].includes(command)) {
                if (isInvalidType) {
                    return this.bot.sendMessage(steamID, '❌ Command not available.');
                }
                this.message.message(steamID, message, prefix);
            } else if (command === 'paints' && isAdmin) {
                this.misc.paintsCommand(steamID);
            } else if (command === 'more') {
                this.help.moreCommand(steamID, prefix);
            } else if (command === 'autokeys') {
                this.manager.autokeysCommand(steamID);
            } else if (['craftweapon', 'craftweapons', 'uncraftweapon', 'uncraftweapons'].includes(command)) {
                void this.misc.weaponCommand(
                    steamID,
                    command === 'craftweapons'
                        ? 'craftweapon'
                        : command === 'uncraftweapons'
                            ? 'uncraftweapon'
                            : (command as CraftUncraft)
                );
            } else if (['deposit', 'd'].includes(command) && isAdmin) {
                void this.depositCommand(steamID, message, prefix);
            }
            else if (['depositallkeys', 'dallkeys'].includes(command) && isAdmin) { // added just now
                this.depositAllKeysCommand(steamID, message, prefix);
            } else if (['depositkeys', 'dkeys'].includes(command) && isAdmin) { // added just now
                this.depositKeysCommand(steamID, message, prefix);
            } else if (['depositallpure', 'dallpure'].includes(command) && isAdmin) { // added just now
                this.depositAllPureCommand(steamID, message, prefix);
            } else if (['depositmetal', 'dmetal'].includes(command) && isAdmin) { // added just now
                this.depositMetalCommand(steamID, message, prefix);
            } else if (['depositscrap', 'dscrap'].includes(command) && isAdmin) { // added just now
                this.depositScrapCommand(steamID, message, prefix);
            } else if (['depositpure', 'dpure'].includes(command) && isAdmin) { // added just now
                this.depositPureCommand(steamID, message, prefix);
            } else if (['depositfestivized', 'depositfestive', 'dfestive', 'dfestivized'].includes(command) && isAdmin) { // added just now
                this.depositAllFestivizedCommand(steamID, message, prefix);
            } else if (['withdraw', 'w'].includes(command) && isAdmin) {
                this.withdrawCommand(steamID, message, prefix);
            } else if (['withdrawscrap', 'wscrap'].includes(command) && isAdmin) {
                this.withdrawScrapCommand(steamID, message, prefix);
            } else if (['withdrawallkeys', 'wallkeys'].includes(command) && isAdmin) { // added just now
                this.withdrawAllKeysCommand(steamID, message, prefix);
            } else if (['withdrawallpure', 'wallpure'].includes(command) && isAdmin) { // added just now
                this.withdrawAllPureCommand(steamID, message, prefix);
            } else if (['withdrawfestivized', 'wfestive', 'wfestivized', 'withdrawfestive'].includes(command) && isAdmin) { // added just now
                this.withdrawAllFestivizedCommand(steamID, message, prefix);
            } else if (['withdrawmetal', 'wmetal'].includes(command) && isAdmin) { // added just now
                this.withdrawMetalCommand(steamID, message, prefix);
            } else if (['withdrawpure', 'wpure'].includes(command) && isAdmin) { // added just now
                this.withdrawPureCommand(steamID, message, prefix);
            } /*else if (['withdrawitems', 'witems'].includes(command) && isAdmin) { // added just now
                this.withdrawItemsCommand(steamID, message, prefix);
            } */else if (command === 'withdrawmptf' && isAdmin) {
                void this.withdrawMptfCommand(steamID, message);
            } else if (['withdrawall', 'wall'].includes(command) && isAdmin) { // added just now
                void this.withdrawAllCommand(steamID, message);
            } else if (['withdrawalluncraftable', 'wallnc'].includes(command) && isAdmin) { // added just now
                void this.withdrawAllNCCommand(steamID, message);
            } else if (['withdrawallnormal', 'walln'].includes(command) && isAdmin) { // added just now
                void this.withdrawAllExceptCurrencyCommand(steamID, message);
            } else if (command === 'sort' && isAdmin) { // added just now
                this.bot.sendMessage(steamID, 'Sending sort request..');
                await this.bot.tf2gc.handleSortJob({"type":"sort","sortType":3}, steamID.toString());
            } else if (['add', 'a'].includes(command) && isAdmin) {
                await this.pManager.addCommand(steamID, message);
            } else if (['addbulk', 'abulk'].includes(command) && isAdmin) {
                void this.pManager.addbulkCommand(steamID, message);
            } else if (['u', 'update'].includes(command) && isAdmin) {
                void this.pManager.updateCommand(steamID, message, prefix);
            } else if (['updatebulk', 'ubulk', 'bulk'].includes(command) && isAdmin) {
                void this.pManager.updatebulkCommand(steamID, message);
            } else if (['remove', 'r'].includes(command) && isAdmin) {
                void this.pManager.removeCommand(steamID, message);
            } else if (['removebulk', 'rbulk', 'rb'].includes(command) && isAdmin) {
                this.pManager.removebulkCommand(steamID, message);
            } else if (command === 'get' && isAdmin) {
                this.pManager.getCommand(steamID, message);
            } else if (command === 'getall' && isAdmin) {
                void this.pManager.getAllCommand(steamID, message);
            } else if (command === 'ppu' && isAdmin) {
                void this.pManager.partialPriceUpdateCommand(steamID, message);
            } else if (['getslots', 'listings'].includes(command) && isAdmin) {
                void this.pManager.getSlotsCommand(steamID);
            } else if (command === 'groups' && isAdmin) {
                void this.pManager.getGroupsCommand(steamID);
            } else if (command === 'autoadd' && isAdmin) {
                this.pManager.autoAddCommand(steamID, message, prefix);
            } else if (command === 'stopautoadd' && isAdmin) {
                this.pManager.stopAutoAddCommand();
            } else if (['expand', 'delete', 'use'].includes(command) && isAdmin) {
                this.manager.TF2GCCommand(steamID, message, command as TF2GC);
            } else if (['name', 'avatar'].includes(command) && isAdmin) {
                this.manager.nameAvatarCommand(steamID, message, command as NameAvatar, prefix);
            } else if (['block', 'unblock'].includes(command) && isAdmin) {
                this.manager.blockUnblockCommand(steamID, message, command as BlockUnblock);
            } else if (['blockedlist', 'blocklist', 'blist'].includes(command) && isAdmin) {
                void this.manager.blockedListCommand(steamID);
            } else if (command === 'clearfriends' && isAdmin) {
                this.manager.clearFriendsCommand(steamID);
            } else if (command === 'stop' && isAdmin) {
                this.manager.stopCommand(steamID);
            } else if (command === 'halt' && isAdmin) {
                await this.manager.haltCommand(steamID);
            } else if (command === 'unhalt' && isAdmin) {
                await this.manager.unhaltCommand(steamID);
            } else if (command === 'haltstatus' && isAdmin) {
                this.manager.haltStatusCommand(steamID);
            } else if (command === 'restart' && isAdmin) {
                this.manager.restartCommand(steamID);
            } else if (command === 'updaterepo' && isAdmin) {
                this.manager.updaterepoCommand(steamID);
            } else if (command === 'refreshautokeys' && isAdmin) {
                this.manager.refreshAutokeysCommand(steamID);
            } else if (command === 'refreshlist' && isAdmin) {
                this.manager.refreshListingsCommand(steamID);
            } else if (command === 'stats' && isAdmin) {
                void this.status.statsCommand(steamID);
            } else if (command === 'statsdw' && isAdmin) {
                this.status.statsDWCommand(steamID);
            } else if (command === 'itemstats' && (isAdmin || isWhitelisted)) {
                void this.status.itemStatsCommand(steamID, message);
            } else if (command == 'wipestats' && isAdmin) {
                this.status.statsWipeCommand(steamID, message);
            } else if (['inventory','inv'].includes(command)) {
                this.status.inventoryCommand(steamID);
            } else if (command === 'version' && (isAdmin || isWhitelisted)) {
                this.status.versionCommand(steamID);
            } else if (command === 'trades' && isAdmin) {
                this.review.tradesCommand(steamID, prefix);
            } else if (command === 'trade' && isAdmin) {
                this.review.tradeCommand(steamID, message, prefix);
            } else if (['accepttrade', 'accept', 'declinetrade', 'decline'].includes(command) && isAdmin) {
                void this.review.actionOnTradeCommand(steamID, message, command as ActionOnTrade);
            } else if (['faccept', 'fdecline'].includes(command) && isAdmin) {
                void this.review.forceAction(steamID, message, command as ForceAction);
            } else if (command === 'offerinfo' && isAdmin) {
                this.review.offerInfo(steamID, message, prefix);
            } else if (['pricecheck', 'pc'].includes(command) && isAdmin) {
                this.request.pricecheckCommand(steamID, message);
            } else if (['pricecheckall', 'pcall'].includes(command) && isAdmin) {
                void this.request.pricecheckAllCommand(steamID);
            } else if (command === 'check' && isAdmin) {
                void this.request.checkCommand(steamID, message);
            } else if (command === 'find' && isAdmin) {
                void this.pManager.findCommand(steamID, message);
            } else if (command == 'backup' && isAdmin) {
                void this.opt.backupPricelistCommand(steamID);
            } else if (command === 'options' && isAdmin) {
                void this.opt.optionsCommand(steamID, message, prefix);
            } else if (command === 'config' && isAdmin) {
                this.opt.updateOptionsCommand(steamID, message);
            } else if (command === 'cleararray' && isAdmin) {
                this.opt.clearArrayCommand(steamID, message);
            } else if (command === 'donatebptf' && isAdmin) {
                this.donateBPTFCommand(steamID, message, prefix);
            } else if (command === 'donatenow' && isAdmin) {
                this.donateNowCommand(steamID, prefix);
            } else if (command === 'donatecart' && isAdmin) {
                this.donateCartCommand(steamID, prefix);
            } else if (command === 'premium'    && isAdmin) {
                this.buyBPTFPremiumCommand(steamID, message);
            } else if (command === 'refreshschema' && isAdmin) {
                this.manager.refreshSchema(steamID);
            } else if (['crafttoken', 'ct'].includes(command) && isAdmin) {
                this.crafting.craftTokenCommand(steamID, message);
            } else {
                const custom = this.bot.options.customMessage.commandNotFound;

                this.bot.sendMessage(
                    steamID,
                    custom ? custom.replace('%command%', command) : `❌ Command "${command}" not found!`
                );
            }
        }
    }

    private getSKU(steamID: SteamID, message: string): void {
        const itemNamesOrSkus = CommandParser.removeCommand(removeLinkProtocol(message));

        if (itemNamesOrSkus === '!sku') {
            return this.bot.sendMessage(steamID, `❌ Missing item name or item sku!`);
        }

        const itemsOrSkus = itemNamesOrSkus.split('\n');

        if (itemsOrSkus.length === 1) {
            if (!testPriceKey(itemNamesOrSkus)) {
                // Receive name
                const sku = this.bot.schema.getSkuFromName(itemNamesOrSkus);

                if (sku.includes('null') || sku.includes('undefined')) {
                    return this.bot.sendMessage(
                        steamID,
                        `Generated sku: ${sku}\nPlease check the name. If correct, please let us know. Thank you.`
                    );
                }

                this.bot.sendMessage(steamID, `• ${sku}\nhttps://autobot.tf/items/${sku}`);
            } else {
                // Receive sku
                const name = this.bot.schema.getName(SKU.fromString(itemNamesOrSkus), false);
                this.bot.sendMessage(steamID, `• ${name}\nhttps://autobot.tf/items/${itemNamesOrSkus}`);
            }
        } else {
            const results: { source: string; generated: string }[] = [];
            itemsOrSkus.forEach(item => {
                if (!testPriceKey(item)) {
                    // Receive name
                    results.push({ source: item, generated: this.bot.schema.getSkuFromName(item) });
                } else {
                    results.push({ source: item, generated: this.bot.schema.getName(SKU.fromString(item), false) });
                }
            });

            this.bot.sendMessage(
                steamID,
                `• ${results.map(item => `${item.source} => ${item.generated}`).join('\n• ')}`
            );
        }
    }
    tokenGroups = {
        nicekeys: [
            '5777;6',
            '5659;6',
            '5638;6 '
        ],
        metal: [
            '5000;6',
            '5001;6',
            '5002;6',
        ],
        pure: [
            '5000;6',
            '5001;6',
            '5002;6',
            '5021;6',
        ],
        1: [
            '411;6',
            '998;6'
        ],
        tods: [
            '5050;6',
            '725;6',
            '5050;6;uncraftable',
            '725;6;uncraftable'
        ],
        uselessweapons: [
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
        ],
        uw: [
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
        ],
        key: ['5021;6'], keys: ['5021;6'],
        tokens: [
            '5003;6', // Class Token - Scout
            '5005;6', // Class Token - Soldier
            '5009;6', // Class Token - Pyro
            '5006;6', // Class Token - Demoman
            '5007;6', // Class Token - Heavy
            '5011;6', // Class Token - Engineer
            '5008;6', // Class Token - Medic
            '5004;6', // Class Token - Sniper
            '5010;6', // Class Token - Spy
            '5012;6', // Slot Token - Primary
            '5013;6', // Slot Token - Secondary
            '5014;6', // Slot Token - Melee
            '5018;6'  // Slot Token - PDA2
        ],
        goodtokens: [
            '5003;6', // Class Token - Scout
            '5009;6', // Class Token - Pyro
            '5007;6', // Class Token - Heavy
            '5010;6', // Class Token - Spy
            '5014;6', // Slot Token - Melee
            '5018;6'  // Slot Token - PDA2
        ],
        badtokens: [
            '5005;6', // Class Token - Soldier
            '5006;6', // Class Token - Demoman
            '5011;6', // Class Token - Engineer
            '5008;6', // Class Token - Medic
            '5004;6', // Class Token - Sniper
            '5012;6', // Slot Token - Primary
            '5013;6', // Slot Token - Secondary
        ],
        // Grouped keywords (used for !w tokens)
        slot: [
            '5012;6', // Primary
            '5013;6', // Secondary
            '5014;6', // Melee
            '5018;6'  // PDA2
        ],
        hats0: [
            '94;6',
            '95;6',
            '96;6',
            '97;6',
            '98;6',
            '99;6',
            '100;6',
            '101;6',
            '102;6',
            '103;6',
            '104;6',
            '105;6',
            '106;6',
            '107;6',
            '108;6',
            '109;6',
            '110;6',
            '111;6',
            '117;6',
            '118;6',
            '120;6',
            '135;6',
            '137;6',
            '139;6',
            '144;6',
            '145;6',
            '146;6',
            '147;6',
            '175;6',
            '178;6',
            '179;6',
            '180;6',
            '181;6',
            '182;6',
            '183;6',
            '184;6',
            '185;6',
            '189;6',
            '246;6',
            '247;6',
            '248;6',
            '249;6',
            '250;6',
            '251;6',
            '252;6',
            '253;6',
            '254;6',
            '255;6',
            '259;6',
            '263;6',
            '290;6',
            '313;6',
            '314;6',
            '319;6',
            '322;6',
            '388;6',
            '395;6',
            '399;6',
            '400;6',
            '520;6',
            '521;6',
            '522;6',
            '523;6',
            '524;6',
            '590;6',
            '591;6',
            '600;6',
            '601;6',
            '602;6',
            '603;6'
        ],
        hats2: [
            '604;6',
            '605;6',
            '606;6',
            '607;6',
            '610;6',
            '611;6',
            '612;6',
            '613;6',
            '614;6',
            '615;6',
            '616;6',
            '617;6',
            '618;6',
            '619;6',
            '620;6',
            '621;6',
            '622;6',
            '623;6',
            '624;6',
            '625;6',
            '626;6',
            '627;6',
            '628;6',
            '629;6',
            '630;6',
            '631;6',
            '632;6',
            '633;6',
            '634;6',
            '635;6',
            '636;6',
            '637;6',
            '650;6',
            '651;6',
            '652;6',
            '653;6',
            '654;6',
            '655;6',
            '657;6',
            '658;6',
            '753;6',
            '754;6',
            '755;6',
            '756;6',
            '757;6',
            '758;6',
            '759;6',
            '760;6',
            '761;6',
            '762;6',
            '763;6',
            '764;6',
            '765;6',
            '766;6',
            '767;6',
            '768;6',
            '769;6',
            '770;6',
            '771;6',
            '772;6',
            '773;6',
            '774;6',
            '776;6',
            '777;6',
            '778;6',
            '779;6',
            '780;6',
            '781;6',
            '782;6'
        ],
        hats3: [
            '30757;6',
            '30332;6',
            '1023;6',
            '30429;6',
            '30430;6',
            '30431;6',
            '31346;6',
            '30908;6',
            '31434;6',
            '380;6',
            '30031;6',
            '30021;6',
            '30099;6',
            '345;6',
            '30019;6',
            '30557;6',
            '30309;6',
            '30377;6',
            '30064;6',
            '31512;6',
            '31500;6',
            '30024;6',
            '30040;6',
            '454;6',
            '393;6'
        ],
        hats5: [
            '783;6',
            '784;6',
            '785;6',
            '786;6',
            '787;6',
            '788;6',
            '789;6',
            '917;6',
            '918;6',
            '919;6',
            '920;6',
            '921;6',
            '922;6',
            '923;6',
            '924;6',
            '925;6',
            '926;6',
            '927;6',
            '942;6',
            '943;6',
            '944;6',
            '945;6',
            '946;6',
            '948;6',
            '949;6',
            '950;6',
            '951;6',
            '952;6',
            '953;6',
            '954;6',
            '955;6',
            '956;6',
            '977;6',
            '978;6',
            '979;6',
            '980;6',
            '981;6',
            '982;6',
            '983;6',
            '984;6',
            '985;6',
            '986;6',
            '987;6',
            '988;6',
            '989;6',
            '990;6',
            '991;6',
            '992;6',
            '993;6',
            '994;6',
            '1087;6',
            '1088;6',
            '1089;6',
            '1090;6',
            '1091;6',
            '1093;6',
            '1094;6',
            '1095;6',
            '1096;6',
            '1097;6',
            '30118;6',
            '30119;6',
            '30120;6',
            '30128;6',
            '30136;6',
            '30167;6',
            '30175;6',
            '30428;6'
        ],

        class: [
            '5003;6', '5004;6', '5005;6', '5006;6',
            '5007;6', '5008;6', '5009;6', '5010;6', '5011;6'
        ],
        scout: [
            '5003;6', // Class Token - Scout
            '5014;6' // Slot Token - Melee
        ],
        pyro: [
            '5009;6', // Class Token - Pyro
            '5012;6', // Slot Token - Primary
            '5014;6', // Slot Token - Melee
        ],
        heavy: [
            '5007;6', // Class Token - Heavy
            '5014;6', // Slot Token - Melee
        ],
        sniper: [
            '5004;6', // Class Token - Sniper
            '5012;6', // Slot Token - Primary
        ],
        spy: [ // Spy-themed useful tokens
            '5010;6', // Spy
            '5014;6', // Melee
            '5018;6'  // PDA2
        ],
        primary: [
            '5012;6', // Slot Token - Primary
            '5004;6', // Class Token - Sniper
            '5009;6', // Class Token - Pyro
        ],
        melee: [
            '5014;6', // Melee
            '5010;6', // Spy
            '5007;6', // Class Token - Heavy
            '5003;6', // Class Token - Scout
            '5009;6', // Class Token - Pyro
        ],
        /*
        tokens: [
            '5003;6', // Class Token - Scout
            '5009;6', // Class Token - Pyro
            '5007;6', // Class Token - Heavy
            '5010;6', // Spy
            '5014;6', // Melee
        ],
         */
        pda2: [
            '5010;6', // Spy
            '5018;6'  // PDA2
        ],
        scoutonly: [
            '5003;6', // Class Token - Scout
        ],
        pyroonly: [
            '5009;6', // Class Token - Pyro
        ],
        heavyonly: [
            '5007;6', // Class Token - Heavy
        ],
        sniperonly: [
            '5004;6', // Class Token - Sniper
        ],
        spyonly: [ // Spy-themed useful tokens
            '5010;6', // Spy
        ],
        primaryonly: [
            '5012;6', // Slot Token - Primary
        ],
        meleeonly: [
            '5014;6', // Melee
        ],
        pda2only: [
            '5018;6'  // PDA2
        ],
        pda2s: [ // short for pda2 stuff
            '60;6',
            '59;6'
        ],
        secondary: [
            '5013;6', // Secondary
        ],
        soldier: [
            '5005;6', // Class Token - Soldier
        ],
        demoman: [
            '5006;6', // Class Token - Demoman
        ],
        engineer: [
            '5011;6', // Class Token - Engineer
        ],
        medic: [
            '5008;6', // Class Token - Medic
        ],
        ref: [
            '5002;6'
        ],
        rec: [
            '5001;6'
        ],
        scrap: [
            '5000;6'
        ],
        valuable: [
            '237;6',
            '452;6',
            '466;6',
            '30474;6',
            '587;6',
            '851;6',
            '574;6',
            '638;6',
            '947;6',
            '474;6',
            '1013;6',
            '880;6',
            '939;6',
            '572;6',
            '237;6;uncraftable',
            '452;6;uncraftable',
            '466;6;uncraftable',
            '30474;6;uncraftable',
            '587;6;uncraftable',
            '851;6;uncraftable',
            '574;6;uncraftable',
            '638;6;uncraftable',
            '947;6;uncraftable',
            '474;6;uncraftable',
            '1013;6;uncraftable',
            '880;6;uncraftable',
            '939;6;uncraftable',
            '572;6;uncraftable',
        ],
        valuablemannco: [
            '237;6',
            '452;6',
            '466;6',
            '30474;6',
            '587;6',
            '851;6',
            '574;6',
            '638;6',
            '947;6',
            '474;6',
            '1013;6',
            '572;6',
            '237;6;uncraftable',
            '452;6;uncraftable',
            '466;6;uncraftable',
            '30474;6;uncraftable',
            '587;6;uncraftable',
            '851;6;uncraftable',
            '574;6;uncraftable',
            '638;6;uncraftable',
            '947;6;uncraftable',
            '474;6;uncraftable',
            '1013;6;uncraftable',
            '880;6;uncraftable',
            '939;6;uncraftable',
            '572;6;uncraftable',
        ],
        randomkeys: [
            '5777;6;uncraftable',
            '5659;6;uncraftable',
            '5638;6;uncraftable'
        ],
        loadout: [
            '30637;6',
            '30889;6',
            '30479;6',
            '126;6',
            '31450;6',
            '30339;6',
            '976;6',
            '31498;6',
            '31464;6',
            '342;6',
            '342;6;p12073019',
            '874;6',
            '30061;6',
            '31368;6',
            '31346;6',
            '31370;6',
            '94;6',
            '94;6;p6901050',
            '31264;6',
            '755;6',
            '30311;6',
            '30397;6',
            '31504;6',
            '981;6',
            '30310;6',
            '55;6',
            '462;6',
            '977;7',
            '5617;6',
            '5617;13',
            '5618;6',
            '5618;13',
            '5619;6',
            '5619;13',
            '5619;6',
            '5619;13',
            '5620;6',
            '5620;13',
            '5621;6',
            '5621;13',
            '5622;6',
            '5622;13',
            '5623;6',
            '5623;13',
            '5624;6',
            '5624;13',
            '5626;6',
            '5626;13',
            '30243;13',
            '30243;6',
            '278;6',
            '278;11',
            '266;5',
            '266;5;strange',
            '30407;6',
            '30408;6',
            '30409;6'
        ],
        christmas: [
            '652;6',
            '30325;6',
            '653;6',
            '666;6',
            '647;6',
            '30747;6;p15132390',
            '30835;6',
            '987;6',
            '30826;6',
            '30541;6',
            '30408;6',
            '978;6',
            '645;6',
            '879;6',
            '30975;6'
        ],
        robot: [
            '5700;6',
            '5701;6',
            '5702;6',
            '5703;6',
            '5704;6',
            '5705;6',
            '5706;6',
            '5707;6'
        ],

        tools: [
            '5044;6',
            '729;6',
            '5020;6',
            '729;6;uncraftable',
            '5020;6;uncraftable',
        ]
    };

    private priceCommand(steamID: SteamID, message: string, prefix: string): void {
        const opt = this.bot.options.commands.price;

        if (!opt.enable) {
            if (!this.bot.isAdmin(steamID)) {
                const custom = opt.customReply.disabled;
                return this.bot.sendMessage(steamID, custom ? custom : '❌ This command is disabled by the owner.');
            }
        }

        const info = getItemAndAmount(steamID, CommandParser.removeCommand(message), this.bot, prefix);
        if (info === null) {
            return;
        }

        const match = info.match;
        const amount = info.amount;

        let reply = '';

        const isBuying = match.intent === 0 || match.intent === 2;
        const isSelling = match.intent === 1 || match.intent === 2;

        const keyPrice = this.bot.pricelist.getKeyPrice;

        if (isBuying) {
            reply = '💲 I am buying ';

            if (amount !== 1) {
                reply += `${amount} `;
            }

            // If the amount is 1, then don't convert to value and then to currencies. If it is for keys, then don't use conversion rate
            reply += `${pluralize(match.name, 2)} for ${(amount === 1
                    ? match.buy
                    : Currencies.toCurrencies(
                        match.buy.toValue(keyPrice.metal) * amount,
                        match.sku === '5021;6' ? undefined : keyPrice.metal
                    )
            ).toString()}`;
        }

        if (isSelling) {
            const currencies =
                amount === 1
                    ? match.sell
                    : Currencies.toCurrencies(
                        match.sell.toValue(keyPrice.metal) * amount,
                        match.sku === '5021;6' ? undefined : keyPrice.metal
                    );

            if (reply === '') {
                reply = '💲 I am selling ';

                if (amount !== 1) {
                    reply += `${amount} `;
                } else {
                    reply += 'a ';
                }

                reply += `${pluralize(match.name, amount)} for ${currencies.toString()}`;
            } else {
                reply += ` and selling for ${currencies.toString()}`;
            }
        }

        reply += `.\n📦 I have ${this.bot.inventoryManager.getInventory.getAmount({
            priceKey: match.id ?? match.sku,
            includeNonNormalized: false,
            tradableOnly: true
        })}`;

        if (match.max !== -1 && isBuying) {
            reply += ` / ${match.max}`;
        }

        if (isSelling && match.min !== 0) {
            reply += ` and I can sell ${this.bot.inventoryManager.amountCanTrade({
                priceKey: match.sku,
                tradeIntent: 'selling'
            })}`;
        }

        reply += '. ';

        if (match.autoprice && this.bot.isAdmin(steamID)) {
            reply += ` (price last updated ${dayjs.unix(match.time).fromNow()})`;
        }

        this.bot.sendMessage(steamID, reply);
    }

    // Instant item trade


    private buyOrSellCommand(steamID: SteamID, message: string, command: Instant, prefix: string, ecp = false): void {
        const opt = this.bot.options.commands[command === 'b' ? 'buy' : command === 's' ? 'sell' : command];

        if (!opt.enable) {
            if (!this.bot.isAdmin(steamID)) {
                const custom = opt.customReply.disabled;
                return this.bot.sendMessage(steamID, custom ? custom : '❌ This command is disabled by the owner.');
            }
        }
        let arg = CommandParser.removeCommand(message).trim().toLowerCase();

        const cart = new UserCart(
            steamID,
            this.bot,
            this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
            this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
        );
        arg = this.bot.extractItem(arg).slice(5);
        // Normal case for single item
        const info = getItemAndAmount(
            steamID,
            arg,
            this.bot,
            prefix,
            command === 'b' ? 'buy' : command === 's' ? 'sell' : command
        );
        if (info === null) {
            return;
        }

        if (['b', 'buy'].includes(command)) {
            cart.addOurItem(info.priceKey, info.amount);
        } else {
            cart.addTheirItem(info.priceKey, info.amount);
        }

        return this.addCartToQueue(cart, false, false);
    }

    private buyCartCommand(steamID: SteamID, message: string, prefix: string): void {
        const currentCart = Cart.getCart(steamID);

        if (currentCart !== null && !(currentCart instanceof UserCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        const opt = this.bot.options.commands.buycart;

        if (!opt.enable) {
            if (!this.bot.isAdmin(steamID)) {
                const custom = opt.customReply.disabled;
                return this.bot.sendMessage(steamID, custom ? custom : '❌ This command is disabled by the owner.');
            }
        }

        const info = getItemAndAmount(steamID, CommandParser.removeCommand(message), this.bot, prefix, 'buycart');

        if (info === null) {
            return;
        }

        let amount = info.amount;
        const cart =
            Cart.getCart(steamID) ||
            new UserCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
            );

        const cartAmount = cart.getOurCount(info.priceKey);
        const ourAmount = this.bot.inventoryManager.getInventory.getAmount({
            priceKey: info.priceKey,
            includeNonNormalized: false,
            tradableOnly: true
        });
        const amountCanTrade =
            this.bot.inventoryManager.amountCanTrade({ priceKey: info.priceKey, tradeIntent: 'selling' }) - cartAmount;

        const name = info.match.name;

        // Correct trade if needed
        if (amountCanTrade <= 0) {
            return this.bot.sendMessage(
                steamID,
                'I ' +
                (ourAmount > 0 ? "can't sell" : "don't have") +
                ` any ${(cartAmount > 0 ? 'more ' : '') + pluralize(name, 0)}.`
            );
        }

        if (amount > amountCanTrade) {
            amount = amountCanTrade;

            if (amount === cartAmount && cartAmount > 0) {
                return this.bot.sendMessage(
                    steamID,
                    `I don't have any ${(ourAmount > 0 ? 'more ' : '') + pluralize(name, 0)}.`
                );
            }

            this.bot.sendMessage(
                steamID,
                `I can only sell ${pluralize(name, amount, true)}. ` +
                (amount > 1 ? 'They have' : 'It has') +
                ` been added to your cart. Type "${prefix}cart" to view your cart summary or "${prefix}checkout" to checkout. 🛒`
            );
        } else
            this.bot.sendMessage(
                steamID,
                `✅ ${pluralize(name, Math.abs(amount), true)}` +
                ` has been added to your cart. Type "${prefix}cart" to view your cart summary or "${prefix}checkout" to checkout. 🛒`
            );

        cart.addOurItem(info.priceKey, amount);
        Cart.addCart(cart);
    }

    private sellCartCommand(steamID: SteamID, message: string, prefix: string): void {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof UserCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        const opt = this.bot.options.commands.sellcart;
        if (!opt.enable) {
            if (!this.bot.isAdmin(steamID)) {
                const custom = opt.customReply.disabled;
                return this.bot.sendMessage(steamID, custom ? custom : '❌ This command is disabled by the owner.');
            }
        }

        const info = getItemAndAmount(steamID, CommandParser.removeCommand(message), this.bot, prefix, 'sellcart');
        if (info === null) {
            return;
        }

        let amount = info.amount;

        const cart =
            Cart.getCart(steamID) ||
            new UserCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
            );
        const skuCount = getSkuAmountCanTrade(info.match.sku, this.bot);

        const cartAmount =
            skuCount.amountCanTrade >= skuCount.amountCanTradeGeneric
                ? cart.getTheirCount(info.match.sku)
                : cart.getTheirGenericCount(info.match.sku);

        const amountCanTrade = skuCount.mostCanTrade - cartAmount;

        // Correct trade if needed
        if (amountCanTrade <= 0) {
            return this.bot.sendMessage(
                steamID,
                'I ' +
                (skuCount.mostCanTrade > 0 ? "can't buy" : "don't want") +
                ` any ${(cartAmount > 0 ? 'more ' : '') + pluralize(skuCount.name, 0)}.`
            );
        }

        if (amount > amountCanTrade) {
            amount = amountCanTrade;

            if (amount === cartAmount && cartAmount > 0) {
                return this.bot.sendMessage(steamID, `I unable to trade any more ${pluralize(skuCount.name, 0)}.`);
            }

            this.bot.sendMessage(
                steamID,
                `I can only buy ${pluralize(skuCount.name, amount, true)}. ` +
                (amount > 1 ? 'They have' : 'It has') +
                ` been added to your cart. Type "${prefix}cart" to view your cart summary or "${prefix}checkout" to checkout. 🛒`
            );
        } else {
            this.bot.sendMessage(
                steamID,
                `✅ ${pluralize(skuCount.name, Math.abs(amount), true)}` +
                ` has been added to your cart. Type "${prefix}cart" to view your cart summary or "${prefix}checkout" to checkout. 🛒`
            );
        }

        cart.addTheirItem(info.match.sku, amount);
        Cart.addCart(cart);
    }

    private cartCommand(steamID: SteamID, prefix: string): void {
        const opt = this.bot.options.commands.cart;

        if (!opt.enable) {
            if (!this.bot.isAdmin(steamID)) {
                const custom = opt.customReply.disabled;
                return this.bot.sendMessage(steamID, custom ? custom : '❌ This command is disabled by the owner.');
            }
        }
        if (this.isDonating) {
            return this.bot.sendMessage(
                steamID,
                `You're about to send donation. Send "${prefix}donatecart" to view your donation cart summary or "${prefix}donatenow" to send donation now.`
            );
        }
        this.bot.sendMessage(steamID, Cart.stringify(steamID, false, prefix));
    }

    private clearCartCommand(steamID: SteamID): void {
        Cart.removeCart(steamID);
        const custom = this.bot.options.commands.clearcart.customReply.reply;
        this.bot.sendMessage(steamID, custom ? custom : '🛒 Your cart has been cleared.');
    }

    private checkoutCommand(steamID: SteamID, prefix: string): void {
        if (this.isDonating) {
            return this.bot.sendMessage(
                steamID,
                `You're about to send donation. Send "${prefix}donatecart" to view your donation cart summary or "${prefix}donatenow" to send donation now.`
            );
        }

        const cart = Cart.getCart(steamID);
        if (cart === null) {
            const custom = this.bot.options.commands.checkout.customReply.empty;
            return this.bot.sendMessage(steamID, custom ? custom : '🛒 Your cart is empty.');
        }

        cart.setNotify = true;
        cart.isDonating = false;
        this.addCartToQueue(cart, false, false);

        clearTimeout(this.adminInventoryReset);
        delete this.adminInventory[steamID.getSteamID64()];
    }

    // Trade actions

    private cancelCommand(steamID: SteamID): void {
        // Maybe have the cancel command only cancel the offer in the queue, and have a command for canceling the offer?

        const positionInQueue = this.cartQueue.getPosition(steamID);

        // If a user is in the queue, then they can't have an active offer

        const custom = this.bot.options.commands.cancel.customReply;
        if (positionInQueue === 0) {
            // The user is in the queue and the offer is already being processed
            const cart = this.cartQueue.getCart(steamID);

            if (cart.isMade) {
                return this.bot.sendMessage(
                    steamID,
                    custom.isBeingSent
                        ? custom.isBeingSent
                        : '⚠️ Your offer is already being sent! Please try again when the offer is active.'
                );
            } else if (cart.isCanceled) {
                return this.bot.sendMessage(
                    steamID,
                    custom.isCancelling
                        ? custom.isCancelling
                        : '⚠️ Your offer is already being canceled. Please wait a few seconds for it to be canceled.'
                );
            }

            cart.setCanceled = 'BY_USER';
        } else if (positionInQueue !== -1) {
            // The user is in the queue
            this.cartQueue.dequeue(steamID);
            this.bot.sendMessage(
                steamID,
                custom.isRemovedFromQueue ? custom.isRemovedFromQueue : '✅ You have been removed from the queue.'
            );

            clearTimeout(this.adminInventoryReset);
            delete this.adminInventory[steamID.getSteamID64()];
        } else {
            // User is not in the queue, check if they have an active offer

            const activeOffer = this.bot.trades.getActiveOffer(steamID);

            if (activeOffer === null) {
                return this.bot.sendMessage(
                    steamID,
                    custom.noActiveOffer ? custom.noActiveOffer : "❌ You don't have an active offer."
                );
            }

            void this.bot.trades.getOffer(activeOffer).asCallback((err, offer) => {
                if (err || !offer) {
                    const errStringify = JSON.stringify(err);
                    const errMessage = errStringify === '' ? (err as Error)?.message : errStringify;
                    return this.bot.sendMessage(
                        steamID,
                        `❌ Ohh nooooes! Something went wrong while trying to get the offer: ${errMessage}` +
                        (!offer ? ` (or the offer might already be canceled)` : '')
                    );
                }

                offer.data('canceledByUser', true);

                offer.cancel(err => {
                    // Only react to error, if the offer is canceled then the user
                    // will get an alert from the onTradeOfferChanged handler

                    if (err) {
                        log.warn('Error while trying to cancel an offer: ', err);
                        return this.bot.sendMessage(
                            steamID,
                            `❌ Ohh nooooes! Something went wrong while trying to cancel the offer: ${err.message}`
                        );
                    }

                    return this.bot.sendMessage(
                        steamID,
                        `✅ Offer sent (${offer.id}) has been successfully cancelled.`
                    );
                });
            });
        }
    }




    private queueCommand(steamID: SteamID): void {
        const position = this.bot.handler.cartQueue.getPosition(steamID);
        const custom = this.bot.options.commands.queue.customReply;

        if (position === -1) {
            this.bot.sendMessage(steamID, custom.notInQueue ? custom.notInQueue : '❌ You are not in the queue.');
        } else if (position === 0) {
            this.bot.sendMessage(
                steamID,
                custom.offerBeingMade ? custom.offerBeingMade : '⌛ Your offer is being made.'
            );
        } else {
            this.bot.sendMessage(
                steamID,
                custom.hasPosition
                    ? custom.hasPosition.replace(/%position%/g, String(position))
                    : `There are ${position} users ahead of you.`
            );
        }
    }
    private addCartToQueue(cart: Cart, isDonating: boolean, isBuyingPremium: boolean): void {
        const activeOfferID = this.bot.trades.getActiveOffer(cart.partner);

        const custom = this.bot.options.commands.addToQueue;

        if (activeOfferID !== null) {
            return this.bot.sendMessage(
                cart.partner,
                custom.alreadyHaveActiveOffer
                    ? custom.alreadyHaveActiveOffer.replace(
                        /%tradeurl%/g,
                        `https://steamcommunity.com/tradeoffer/${activeOfferID}/`
                    )
                    : `❌ You already have an active offer! Please finish it before requesting a new one: https://steamcommunity.com/tradeoffer/${activeOfferID}/`
            );
        }

        const currentPosition = this.cartQueue.getPosition(cart.partner);

        if (currentPosition !== -1) {
            if (currentPosition === 0) {
                this.bot.sendMessage(
                    cart.partner,
                    custom.alreadyInQueueProcessingOffer
                        ? custom.alreadyInQueueProcessingOffer
                        : '⚠️ You are already in the queue! Please wait while I process your offer.'
                );
            } else {
                this.bot.sendMessage(
                    cart.partner,
                    custom.alreadyInQueueWaitingTurn
                        ? custom.alreadyInQueueWaitingTurn
                            .replace(/%isOrAre%/g, currentPosition !== 1 ? 'are' : 'is')
                            .replace(/%currentPosition%/g, String(currentPosition))
                        : '⚠️ You are already in the queue! Please wait your turn, there ' +
                        (currentPosition !== 1 ? 'are' : 'is') +
                        ` ${currentPosition} in front of you.`
                );
            }
            return;
        }

        const position = this.cartQueue.enqueue(cart, isDonating, isBuyingPremium);

        if (position !== 0) {
            this.bot.sendMessage(
                cart.partner,
                custom.addedToQueueWaitingTurn
                    ? custom.addedToQueueWaitingTurn
                        .replace(/%isOrAre%/g, position !== 1 ? 'are' : 'is')
                        .replace(/%position%/g, String(position))
                    : '✅ You have been added to the queue! Please wait your turn, there ' +
                    (position !== 1 ? 'are' : 'is') +
                    ` ${position} in front of you.`
            );
        }
    }

    // Admin commands




    private async depositAllKeysCommand(steamID: SteamID, message: string, prefix: string): Promise<void> {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const params = CommandParser.parseParams(cleaned);
        const amount = typeof params.amount === 'number'
            ? params.amount
            : /^\s*(\d+)\s*$/.test(cleaned)
                ? parseInt(cleaned)
                : 99999;

        if (!Number.isInteger(amount) || amount <= 0) {
            return this.bot.sendMessage(steamID, '❌ Amount must be a positive integer.');
        }

        const adminInventory = this.adminInventory[steamID.getSteamID64()] || new Inventory(steamID, this.bot, 'their', this.bot.boundInventoryGetter);
        if (this.adminInventory[steamID.getSteamID64()] === undefined) {
            try {
                await adminInventory.fetch();
                this.adminInventory[steamID.getSteamID64()] = adminInventory;
                clearTimeout(this.adminInventoryReset);
                this.adminInventoryReset = setTimeout(() => {
                    delete this.adminInventory[steamID.getSteamID64()];
                }, 5 * 60 * 1000);
            } catch (err) {
                log.error('Error fetching inventory: ', err);
                return this.bot.sendMessage(
                    steamID,
                    `❌ Error fetching inventory, steam might be down. Please try again later. ` +
                    `If you have private profile/inventory, please set it to public and try again.`
                );
            }
        }

        const keySkus = Object.keys(adminInventory.tradable || {}).filter(sku => {
            const name = this.bot.schema.getName(SKU.fromString(sku), false);
            return / key$/i.test(name); // ends with " Key"
        });

        if (keySkus.length === 0) {
            return this.bot.sendMessage(steamID, '❌ You don’t have any tradable keys.');
        }

        const cart = AdminCart.getCart(steamID) || new AdminCart(
            steamID,
            this.bot,
            this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
            this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
        );

        let added = 0;

        for (const sku of keySkus) {
            if (added >= amount) break;

            const theyHave = adminInventory.getAmount({ priceKey: sku, includeNonNormalized: false, tradableOnly: true });
            const already = cart.getTheirCount(sku);
            const canAdd = Math.min(theyHave - already, amount - added);
            if (canAdd <= 0) continue;

            cart.addTheirItem(sku, canAdd);
            added += canAdd;

            const itemName = this.bot.schema.getName(SKU.fromString(sku), false);
            this.bot.sendMessage(steamID, `✅ Added ${pluralize(itemName, canAdd, true)}.`);
        }

        if (added === 0) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already added all your keys.'
            );
        }

        Cart.addCart(cart);
        this.bot.sendMessage(steamID, `🛒 Added ${added} keys. Checking out…`);
        this.checkoutCommand(steamID, prefix);
    }
    private async depositKeysCommand(steamID: SteamID, message: string, prefix: string): Promise<void> {
        /* ---------- active‑cart guard ---------- */
        const active = Cart.getCart(steamID);
        if (active !== null && !(active instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        /* ---------- parse amount ---------- */
        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const p       = CommandParser.parseParams(cleaned);
        let customAmount = false;
        let amount: number;

        if (typeof p.amount === 'number') {
            amount = p.amount;
            customAmount = true;
        } else {
            const match = cleaned.match(/^\s*(\d+)\s*$/);
            if (match) {
                amount = parseInt(match[1]);
                customAmount = true;
            } else {
                amount = 99999; // “as many as possible”
            }
        }


        /* ---------- fetch / cache admin inventory ---------- */
        const sid64 = steamID.getSteamID64();
        const adminInv =
            this.adminInventory[sid64] ||
            new Inventory(steamID, this.bot, 'their', this.bot.boundInventoryGetter);

        if (this.adminInventory[sid64] === undefined) {
            try {
                log.debug('Fetching admin inventory…');
                await adminInv.fetch();
                this.adminInventory[sid64] = adminInv;

                clearTimeout(this.adminInventoryReset);
                this.adminInventoryReset = setTimeout(
                    () => delete this.adminInventory[sid64],
                    5 * 60_000
                );
            } catch (err) {
                log.error('Error fetching inventory:', err);
                return this.bot.sendMessage(
                    steamID,
                    '❌ Error fetching inventory. Steam may be down — try again later.'
                );
            }
        }

        /* ---------- constants ---------- */
        const keySKU  = '5021;6';
        const keyName = this.bot.schema.getName(SKU.fromString(keySKU), false);

        /* ---------- availability check ---------- */
        const dict = adminInv.getItems;
        if (!dict[keySKU]) {
            return this.bot.sendMessage(steamID, `❌ You don't have any ${keyName}.`);
        }

        const theyHave = dict[keySKU].length;
        if (theyHave < amount) {
            if (customAmount) {
                this.bot.sendMessage(
                    steamID,
                    `❌ You only have ${pluralize(keyName, theyHave, true)}.`
                );
            }
            amount = theyHave;
        }

        /* ---------- cart ---------- */
        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft
                    ? this.bot.uncraftWeapons
                    : []
            );

        const alreadyInCart = cart.getTheirCount(keySKU);
        if (alreadyInCart + amount > theyHave) {
            return this.bot.sendMessage(
                steamID,
                `❌ You already have ${alreadyInCart} in the cart and only ${theyHave} in total.`
            );
        }

        /* ---------- add + confirm ---------- */
        cart.addTheirItem(keySKU, amount);
        Cart.addCart(cart);

        this.bot.sendMessage(
            steamID,
            `✅ ${pluralize(keyName, amount, true)} added to your cart. ` // +
            // `Type "${prefix}cart" to view or "${prefix}checkout" to send the offer. 🛒`
        );
        this.checkoutCommand(steamID, prefix);

    }
    private async depositScrapCommand(steamID: SteamID, message: string, prefix: string): Promise<void> {
        /* ---------- active‑cart guard ---------- */
        const active = Cart.getCart(steamID);
        if (active !== null && !(active instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        /* ---------- parse amount ---------- */
        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const p       = CommandParser.parseParams(cleaned);
        let customAmount = false;
        let amount: number;

        if (typeof p.amount === 'number') {
            amount = p.amount;
            customAmount = true;
        } else {
            const match = cleaned.match(/^\s*(\d+)\s*$/);
            if (match) {
                amount = parseInt(match[1]);
                customAmount = true;
            } else {
                amount = 99999; // “as many as possible”
            }
        }


        /* ---------- fetch / cache admin inventory ---------- */
        const sid64 = steamID.getSteamID64();
        const adminInv =
            this.adminInventory[sid64] ||
            new Inventory(steamID, this.bot, 'their', this.bot.boundInventoryGetter);

        if (this.adminInventory[sid64] === undefined) {
            try {
                log.debug('Fetching admin inventory…');
                await adminInv.fetch();
                this.adminInventory[sid64] = adminInv;

                clearTimeout(this.adminInventoryReset);
                this.adminInventoryReset = setTimeout(
                    () => delete this.adminInventory[sid64],
                    5 * 60_000
                );
            } catch (err) {
                log.error('Error fetching inventory:', err);
                return this.bot.sendMessage(
                    steamID,
                    '❌ Error fetching inventory. Steam may be down — try again later.'
                );
            }
        }

        /* ---------- constants ---------- */
        const scrapSKU  = '5000;6';
        const scrapName = this.bot.schema.getName(SKU.fromString(scrapSKU), false);

        /* ---------- availability check ---------- */
        const dict = adminInv.getItems;
        if (!dict[scrapSKU]) {
            return this.bot.sendMessage(steamID, `❌ You don't have any ${scrapName}.`);
        }

        const theyHave = dict[scrapSKU].length;
        if (theyHave < amount) {
            if (customAmount) {
                this.bot.sendMessage(
                    steamID,
                    `❌ You only have ${pluralize(scrapName, theyHave, true)}.`
                );
            }
            amount = theyHave;
        }

        /* ---------- cart ---------- */
        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft
                    ? this.bot.uncraftWeapons
                    : []
            );

        const alreadyInCart = cart.getTheirCount(scrapSKU);
        if (alreadyInCart + amount > theyHave) {
            return this.bot.sendMessage(
                steamID,
                `❌ You already have ${alreadyInCart} in the cart and only ${theyHave} in total.`
            );
        }

        /* ---------- add + confirm ---------- */
        cart.addTheirItem(scrapSKU, amount);
        Cart.addCart(cart);

        this.bot.sendMessage(
            steamID,
            `✅ ${pluralize(scrapName, amount, true)} added to your cart. ` // +
            // `Type "${prefix}cart" to view or "${prefix}checkout" to send the offer. 🛒`
        );
        this.checkoutCommand(steamID, prefix);

    }
    private async depositAllPureCommand(
        steamID: SteamID,
        message: string,
        prefix: string
    ): Promise<void> {
        // Cart guard
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        // Amount parsing
        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const params  = CommandParser.parseParams(cleaned);
        let   amount  = typeof params.amount === 'number'
            ? params.amount
            : /^\s*(\d+)\s*$/.test(cleaned)
                ? parseInt(cleaned)
                : 99999;

        if (!Number.isInteger(amount) || amount <= 0) {
            return this.bot.sendMessage(steamID, '❌ Amount must be a positive integer.');
        }

        /* ---------- fetch admin inventory ---------- */
        const sid64 = steamID.getSteamID64();
        const adminInv =
            this.adminInventory[sid64] ||
            new Inventory(steamID, this.bot, 'their', this.bot.boundInventoryGetter);

        if (this.adminInventory[sid64] === undefined) {
            try {
                await adminInv.fetch();
                this.adminInventory[sid64] = adminInv;
                clearTimeout(this.adminInventoryReset);
                this.adminInventoryReset = setTimeout(() => delete this.adminInventory[sid64], 5 * 60_000);
            } catch (err) {
                log.error('Error fetching inventory:', err);
                return this.bot.sendMessage(
                    steamID,
                    '❌ Error fetching inventory. Steam may be down — try again later.'
                );
            }
        }

        /* ---------- build list of pure SKUs ---------- */
        const metalSKUs = ['5000;6', '5001;6', '5002;6']; // scrap / reclaimed / refined

        const keySkus = Object.keys(adminInv.tradable || {}).filter(sku => {
            const name = this.bot.schema.getName(SKU.fromString(sku), false);
            return / key/i.test(name); // any key
        });

        const pureSKUs = [...metalSKUs, ...keySkus];

        if (pureSKUs.length === 0) {
            return this.bot.sendMessage(steamID, '❌ You have no tradable pure or keys.');
        }

        /* ---------- cart ---------- */
        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft
                    ? this.bot.uncraftWeapons
                    : []
            );

        let added = 0;

        for (const sku of pureSKUs) {
            if (added >= amount) break;

            const tradable = adminInv.getAmount({ priceKey: sku, includeNonNormalized: false, tradableOnly: true });
            const inCart   = cart.getTheirCount(sku);
            const canAdd   = Math.min(tradable - inCart, amount - added);
            if (canAdd <= 0) continue;

            cart.addTheirItem(sku, canAdd);
            added += canAdd;

            const name = this.bot.schema.getName(SKU.fromString(sku), false);
            this.bot.sendMessage(steamID, `✅ Added ${pluralize(name, canAdd, true)}.`);
        }

        if (added === 0) {
            return this.bot.sendMessage(
                steamID,
                '❌ You don’t have any tradable metal or keys to deposit.'
            );
        }

        Cart.addCart(cart);
        this.bot.sendMessage(steamID, `🛒 Added ${added} pure items. Checking out…`);
        this.checkoutCommand(steamID, prefix);
    }
    private async depositMetalCommand(steamID: SteamID, message: string, prefix: string): Promise<void> {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const params = CommandParser.parseParams(cleaned);
        const amount = typeof params.amount === 'number'
            ? params.amount
            : /^\s*(\d+)\s*$/.test(cleaned)
                ? parseInt(cleaned)
                : 99999;

        if (!Number.isInteger(amount)) {
            return this.bot.sendMessage(steamID, `❌ amount must be an integer.`);
        }

        const steamid64 = steamID.getSteamID64();
        const adminInventory = this.adminInventory[steamid64] || new Inventory(steamID, this.bot, 'their', this.bot.boundInventoryGetter);

        if (this.adminInventory[steamid64] === undefined) {
            try {
                await adminInventory.fetch();
                this.adminInventory[steamid64] = adminInventory;
                clearTimeout(this.adminInventoryReset);
                this.adminInventoryReset = setTimeout(() => {
                    delete this.adminInventory[steamid64];
                }, 5 * 60 * 1000);
            } catch (err) {
                log.error('Error fetching inventory: ', err);
                return this.bot.sendMessage(
                    steamID,
                    `❌ Error fetching inventory, Steam might be down. Please try again later. ` +
                    `If you have private profile/inventory, please set it to public and try again.`
                );
            }
        }

        const metalSKUs = ['5000;6', '5001;6', '5002;6'];

        const cart = AdminCart.getCart(steamID) || new AdminCart(
            steamID,
            this.bot,
            this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
            this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
        );

        let added = 0;

        for (const sku of metalSKUs) {
            if (added >= amount) break;

            const name = this.bot.schema.getName(SKU.fromString(sku), false);
            const alreadyInCart = cart.getTheirCount(sku);
            const theyHave = adminInventory.getAmount({ priceKey: sku, includeNonNormalized: false, tradableOnly: true });
            const canTake = theyHave - alreadyInCart;

            if (canTake <= 0) continue;

            const take = Math.min(canTake, amount - added);
            if (take <= 0) continue;

            cart.addTheirItem(sku, take);
            added += take;

            this.bot.sendMessage(steamID, `✅ Added ${pluralize(name, take, true)}.`);
        }

        if (added === 0) {
            return this.bot.sendMessage(
                steamID,
                `❌ You don't have any scrap, reclaimed, or refined metal available to deposit.`
            );
        }

        Cart.addCart(cart);
        this.bot.sendMessage(steamID, `🛒 Added ${added} metal items to your cart. Checking out...`);
        this.checkoutCommand(steamID, prefix);
    }
    private async depositPureCommand(steamID: SteamID, message: string, prefix: string): Promise<void> {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const params = CommandParser.parseParams(cleaned);
        const amount = typeof params.amount === 'number'
            ? params.amount
            : /^\s*(\d+)\s*$/.test(cleaned)
                ? parseInt(cleaned)
                : 99999;

        if (!Number.isInteger(amount)) {
            return this.bot.sendMessage(steamID, `❌ amount must be an integer.`);
        }

        const adminInventory = this.adminInventory[steamID.getSteamID64()] || new Inventory(steamID, this.bot, 'their', this.bot.boundInventoryGetter);
        if (this.adminInventory[steamID.getSteamID64()] === undefined) {
            try {
                await adminInventory.fetch();
                this.adminInventory[steamID.getSteamID64()] = adminInventory;
                clearTimeout(this.adminInventoryReset);
                this.adminInventoryReset = setTimeout(() => {
                    delete this.adminInventory[steamID.getSteamID64()];
                }, 5 * 60 * 1000);
            } catch (err) {
                log.error('Error fetching inventory: ', err);
                return this.bot.sendMessage(
                    steamID,
                    `❌ Error fetching inventory, steam might be down. Please try again later. ` +
                    `If you have private profile/inventory, please set it to public and try again.`
                );
            }
        }

        const pureSKUs = ['5000;6', '5001;6', '5002;6', '5021;6'];

        const cart = AdminCart.getCart(steamID) || new AdminCart(
            steamID,
            this.bot,
            this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
            this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
        );

        let addedSomething = false;

        for (const sku of pureSKUs) {
            const name = this.bot.schema.getName(SKU.fromString(sku), false);

            const alreadyInCart = cart.getTheirCount(sku);
            const theyHave = adminInventory.getAmount({ priceKey: sku, includeNonNormalized: false, tradableOnly: true });

            const canTake = theyHave - alreadyInCart;
            if (canTake <= 0) continue;

            const take = Math.min(canTake, amount);

            cart.addTheirItem(sku, take);
            addedSomething = true;

            this.bot.sendMessage(steamID, `✅ Added ${pluralize(name, take, true)}.`);
        }

        if (!addedSomething) {
            return this.bot.sendMessage(
                steamID,
                `❌ You don't have any pure metal or keys available to deposit.`
            );
        }

        Cart.addCart(cart);
        this.bot.sendMessage(steamID, `🛒 Added pure items to your cart. Checking out...`);
        this.checkoutCommand(steamID, prefix);
    }
    private async depositAllFestivizedCommand(
        steamID: SteamID,
        message: string,
        prefix: string
    ): Promise<void> {
        // Guard: no overlapping carts
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        // Parse amount
        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const params  = CommandParser.parseParams(cleaned);
        let   amount  = typeof params.amount === 'number'
            ? params.amount
            : /^\s*(\d+)\s*$/.test(cleaned)
                ? parseInt(cleaned)
                : 99999;

        if (!Number.isInteger(amount) || amount <= 0) {
            return this.bot.sendMessage(steamID, '❌ Amount must be a positive integer.');
        }

        /* ---------- fetch admin inventory (their side) ---------- */
        const sid64 = steamID.getSteamID64();
        const adminInv =
            this.adminInventory[sid64] ||
            new Inventory(steamID, this.bot, 'their', this.bot.boundInventoryGetter);

        if (this.adminInventory[sid64] === undefined) {
            try {
                await adminInv.fetch();
                this.adminInventory[sid64] = adminInv;
                clearTimeout(this.adminInventoryReset);
                this.adminInventoryReset = setTimeout(() => delete this.adminInventory[sid64], 5 * 60_000);
            } catch (err) {
                log.error('Error fetching inventory:', err);
                return this.bot.sendMessage(
                    steamID,
                    '❌ Error fetching inventory. Steam may be down — try later or make profile/inventory public.'
                );
            }
        }

        /* ---------- select festivized SKUs ---------- */
        const festiveSkus = Object.keys(adminInv.tradable || {}).filter(sku =>
            sku.includes(';6;') && sku.includes('festive')
        );

        if (festiveSkus.length === 0) {
            return this.bot.sendMessage(steamID, '❌ You don’t have any tradable Festivized items.');
        }

        /* ---------- build / reuse admin cart ---------- */
        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft
                    ? this.bot.uncraftWeapons
                    : []
            );

        /* ---------- add to cart ---------- */
        let added = 0;
        for (const sku of festiveSkus) {
            if (added >= amount) break;

            const tradable = adminInv.getAmount({ priceKey: sku, includeNonNormalized: false, tradableOnly: true });
            const inCart   = cart.getTheirCount(sku);
            const canAdd   = Math.min(tradable - inCart, amount - added);
            if (canAdd <= 0) continue;

            cart.addTheirItem(sku, canAdd);
            added += canAdd;

            const name = this.bot.schema.getName(SKU.fromString(sku), false);
            this.bot.sendMessage(steamID, `✅ Added ${pluralize(name, canAdd, true)}.`);
        }

        if (added === 0) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already added all your Festivized items.'
            );
        }

        Cart.addCart(cart);
        this.bot.sendMessage(steamID, `🛒 Added ${added} Festivized items. Checking out…`);
        this.checkoutCommand(steamID, prefix);
    }

    private withdrawAllPureCommand(steamID: SteamID, message: string, prefix: string): void {
        // 1. Active cart guard
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        // 2. Parse amount
        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const params = CommandParser.parseParams(cleaned);
        const amount = typeof params.amount === 'number'
            ? params.amount
            : /^\s*(\d+)\s*$/.test(cleaned)
                ? parseInt(cleaned)
                : 99999;

        if (!Number.isInteger(amount) || amount <= 0) {
            return this.bot.sendMessage(steamID, '❌ Amount must be a positive integer.');
        }

        // 3. Get or create admin cart
        const cart = AdminCart.getCart(steamID) || new AdminCart(
            steamID,
            this.bot,
            this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
            this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
        );

        const inv = this.bot.inventoryManager.getInventory;
        const tradable = inv.tradable || {};

        let totalAdded = 0;

        // 4. Add all keys (market name contains " key")
        const keySkus = Object.keys(tradable).filter(sku => {
            const name = this.bot.schema.getName(SKU.fromString(sku), false);
            return / key/i.test(name); // loosened match as you wanted
        });

        console.log('Detected key SKUs:', keySkus);

        for (const sku of keySkus) {
            if (totalAdded >= amount) break;

            const tradableAmount = inv.getAmount({ priceKey: sku, includeNonNormalized: false, tradableOnly: true });
            const alreadyInCart = cart.getOurCount(sku);
            const canAdd = Math.min(tradableAmount - alreadyInCart, amount - totalAdded);
            if (canAdd <= 0) continue;

            cart.addOurItem(sku, canAdd);
            totalAdded += canAdd;

            const itemName = this.bot.schema.getName(SKU.fromString(sku), false);
            this.bot.sendMessage(steamID, `✅ Added ${pluralize(itemName, canAdd, true)}.`);
        }

        // 5. Add all metal (scrap, reclaimed, refined)
        const metalSKUs = ['5000;6', '5001;6', '5002;6'];
        for (const sku of metalSKUs) {
            if (totalAdded >= amount) break;

            const tradableAmount = inv.getAmount({ priceKey: sku, includeNonNormalized: false, tradableOnly: true });
            const alreadyInCart = cart.getOurCount(sku);
            const canAdd = Math.min(tradableAmount - alreadyInCart, amount - totalAdded);
            if (canAdd <= 0) continue;

            cart.addOurItem(sku, canAdd);
            totalAdded += canAdd;

            const itemName = this.bot.schema.getName(SKU.fromString(sku), false);
            this.bot.sendMessage(steamID, `✅ Added ${pluralize(itemName, canAdd, true)}.`);
        }

        // 6. Finalize
        if (totalAdded === 0) {
            return this.bot.sendMessage(
                steamID,
                '❌ I have no tradable metal or keys to withdraw.'
            );
        }

        Cart.addCart(cart);
        this.bot.sendMessage(steamID, `🛒 Total pure items added: ${totalAdded}. Checking out...`);
        this.checkoutCommand(steamID, prefix);
    }
    private withdrawScrapCommand(steamID: SteamID, message: string, prefix: string): void {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        // Clean input
        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const params = CommandParser.parseParams(cleaned);

        let amount: number;

        // Accept either `amount=2` or plain `2`
        if (typeof params.amount === 'number') {
            amount = params.amount;
        } else {
            const match = cleaned.match(/^\s*(\d+)\s*$/);
            amount = match ? parseInt(match[1]) : 99999;
        }

        if (!Number.isInteger(amount)) {
            return this.bot.sendMessage(steamID, `❌ amount must be an integer.`);
        }

        const sku = '5000;6'; // scrap metal sku
        const name = this.bot.schema.getName(SKU.fromString(sku), false);

        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
            );

        const cartAmount = cart.getOurCount(sku);
        const ourAmount = this.bot.inventoryManager.getInventory.getAmount({
            priceKey: sku,
            includeNonNormalized: false,
            tradableOnly: true
        });
        const amountCanTrade = ourAmount - cartAmount;

        if (amountCanTrade <= 0) {
            return this.bot.sendMessage(
                steamID,
                `❌ I don't have any ${(ourAmount > 0 ? 'more ' : '') + pluralize(name, 0)}.`
            );
        }

        if (amount > amountCanTrade) amount = amountCanTrade;

        cart.addOurItem(sku, amount);
        Cart.addCart(cart);

        this.bot.sendMessage(
            steamID,
            `✅ ${pluralize(name, amount, true)} added. I’ll check out automatically… 🛒`
        );

        this.checkoutCommand(steamID, prefix);
    }
    private withdrawAllKeysCommand(steamID: SteamID, message: string, prefix: string): void {
        // 1. Block if a non-admin cart is active
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        // 2. Parse amount
        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const params = CommandParser.parseParams(cleaned);
        const amount = typeof params.amount === 'number'
            ? params.amount
            : /^\s*(\d+)\s*$/.test(cleaned)
                ? parseInt(cleaned)
                : 99999;

        if (!Number.isInteger(amount) || amount <= 0) {
            return this.bot.sendMessage(steamID, '❌ Amount must be a positive integer.');
        }

        // 3. Build cart
        const cart = AdminCart.getCart(steamID) || new AdminCart(
            steamID,
            this.bot,
            this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
            this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
        );

        // 4. Detect keys using market names
        const inv = this.bot.inventoryManager.getInventory;
        const tradable = inv.tradable || {};

        const keySkus = Object.keys(tradable).filter(sku => {
            const name = this.bot.schema.getName(SKU.fromString(sku), false);
            return / key$/i.test(name); // ends with " Key"
        });

        console.log('Key SKUs detected:', keySkus);

        let added = 0;

        for (const sku of keySkus) {
            if (added >= amount) break;

            const tradableAmount = inv.getAmount({ priceKey: sku, includeNonNormalized: false, tradableOnly: true });
            const alreadyInCart = cart.getOurCount(sku);
            const canAdd = Math.min(tradableAmount - alreadyInCart, amount - added);
            if (canAdd <= 0) continue;

            cart.addOurItem(sku, canAdd);
            added += canAdd;

            const itemName = this.bot.schema.getName(SKU.fromString(sku), false);
            this.bot.sendMessage(steamID, `✅ Added ${pluralize(itemName, canAdd, true)} to cart.`);
        }

        if (added === 0) {
            return this.bot.sendMessage(
                steamID,
                '❌ I don’t have any tradable keys available right now.'
            );
        }

        Cart.addCart(cart);
        this.bot.sendMessage(steamID, `🛒 Total keys added: ${added}. Checking out…`);
        this.checkoutCommand(steamID, prefix);
    }
    private withdrawAllFestivizedCommand(steamID: SteamID, message: string, prefix: string): void {
        // 1. Active‑cart guard
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        // 2. Amount parsing
        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const p = CommandParser.parseParams(cleaned);
        const amount = typeof p.amount === 'number'
            ? p.amount
            : /^\s*(\d+)\s*$/.test(cleaned)
                ? parseInt(cleaned)
                : 99999;

        if (!Number.isInteger(amount) || amount <= 0) {
            return this.bot.sendMessage(steamID, '❌ Amount must be a positive integer.');
        }

        // 3. Cart bootstrap
        const cart = AdminCart.getCart(steamID) || new AdminCart(
            steamID,
            this.bot,
            this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
            this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
        );

        // 4. Festive filtering
        const inv = this.bot.inventoryManager.getInventory;
        const festiveSkus = Object.keys(inv.tradable || {}).filter(sku => sku.includes(';6;') && sku.includes('festive')
        );
        console.log('Filtered festive SKUs:', festiveSkus);

        // 5. Add to cart
        let added = 0;

        for (const sku of festiveSkus) {
            if (added >= amount) break;

            const tradable = inv.getAmount({ priceKey: sku, includeNonNormalized: false, tradableOnly: true });
            const already = cart.getOurCount(sku);
            const canAdd = Math.min(tradable - already, amount - added);

            if (canAdd > 0) {
                cart.addOurItem(sku, canAdd);
                added += canAdd;

                const name = this.bot.schema.getName(SKU.fromString(sku), false);
                this.bot.sendMessage(steamID, `✅ Added ${pluralize(name, canAdd, true)} to cart.`);
            }
        }

        // 6. No items added
        if (added === 0) {
            return this.bot.sendMessage(
                steamID,
                '❌ I don’t have any tradable Festivized items right now.'
            );
        }

        // 7. Checkout
        Cart.addCart(cart);
        this.bot.sendMessage(steamID, `🛒 Total Festivized items added: ${added}. Checking out…`);
        this.checkoutCommand(steamID, prefix);
    }
    private withdrawMetalCommand(steamID: SteamID, message: string, prefix: string): void {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        // Clean input
        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const params = CommandParser.parseParams(cleaned);

        let amount: number;

        if (typeof params.amount === 'number') {
            amount = params.amount;
        } else {
            const match = cleaned.match(/^\s*(\d+)\s*$/);
            amount = match ? parseInt(match[1]) : 99999;
        }

        if (!Number.isInteger(amount)) {
            return this.bot.sendMessage(steamID, `❌ amount must be an integer.`);
        }

        const metalSKUs = ['5000;6', '5001;6', '5002;6'];
        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
            );

        let addedSomething = false;

        for (const sku of metalSKUs) {
            const name = this.bot.schema.getName(SKU.fromString(sku), false);

            const cartAmount = cart.getOurCount(sku);
            const ourAmount = this.bot.inventoryManager.getInventory.getAmount({
                priceKey: sku,
                includeNonNormalized: false,
                tradableOnly: true
            });

            const amountCanTrade = ourAmount - cartAmount;

            if (amountCanTrade <= 0) {
                continue; // Skip if none available
            }

            const take = Math.min(amount, amountCanTrade);
            cart.addOurItem(sku, take);
            addedSomething = true;

            this.bot.sendMessage(
                steamID,
                `✅ ${pluralize(name, take, true)} added to your cart.`
            );
        }

        if (!addedSomething) {
            return this.bot.sendMessage(
                steamID,
                `❌ I don't have any scrap, reclaimed, or refined metal available to withdraw.`
            );
        }

        Cart.addCart(cart);
        this.checkoutCommand(steamID, prefix);
    }
    private withdrawPureCommand(steamID: SteamID, message: string, prefix: string): void {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        // Clean input
        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const params = CommandParser.parseParams(cleaned);

        let amount: number;

        if (typeof params.amount === 'number') {
            amount = params.amount;
        } else {
            const match = cleaned.match(/^\s*(\d+)\s*$/);
            amount = match ? parseInt(match[1]) : 99999;
        }

        if (!Number.isInteger(amount)) {
            return this.bot.sendMessage(steamID, `❌ amount must be an integer.`);
        }

        const metalSKUs = ['5000;6', '5001;6', '5002;6', '5021;6'];
        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
            );

        let addedSomething = false;

        for (const sku of metalSKUs) {
            const name = this.bot.schema.getName(SKU.fromString(sku), false);

            const cartAmount = cart.getOurCount(sku);
            const ourAmount = this.bot.inventoryManager.getInventory.getAmount({
                priceKey: sku,
                includeNonNormalized: false,
                tradableOnly: true
            });

            const amountCanTrade = ourAmount - cartAmount;

            if (amountCanTrade <= 0) {
                continue; // Skip if none available
            }

            const take = Math.min(amount, amountCanTrade);
            cart.addOurItem(sku, take);
            addedSomething = true;

            this.bot.sendMessage(
                steamID,
                `✅ ${pluralize(name, take, true)} added to your cart.`
            );
        }

        if (!addedSomething) {
            return this.bot.sendMessage(
                steamID,
                `❌ I don't have any pure available to withdraw.`
            );
        }

        Cart.addCart(cart);
        this.checkoutCommand(steamID, prefix);
    }
    /*
    private withdrawItemsCommand(steamID: SteamID, message: string, prefix: string): void {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        // Clean input
        const cleaned = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        const params = CommandParser.parseParams(cleaned);

        let amount: number;

        if (typeof params.amount === 'number') {
            amount = params.amount;
        } else {
            const match = cleaned.match(/^\s*(\d+)\s*$/);
            amount = match ? parseInt(match[1]) : 99999;
        }

        if (!Number.isInteger(amount)) {
            return this.bot.sendMessage(steamID, `❌ amount must be an integer.`);
        }

        const pureSKUs = ['5000;6', '5001;6', '5002;6', '5021;6'];
        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
            );

        let addedSomething = false;

// Create a map to count how many of each SKU we already added to the cart
        const cartCounts = new Map();
// Get all items in our inventory
        const ourInventory = this.bot.inventoryManager.getInventory.getItems;


// Loop through every item we own
        for (const item of ourInventory) { // TS2495: Type 'Dict' is not an array type or a string type.
            const sku = item.sku();

            if (pureSKUs.includes(sku)) continue; // Skip pure items

            const cartAmount = cart.getOurCount(sku) || 0;
            const key = sku;
            const countSoFar = cartCounts.get(key) || 0;

            if (item.isTradable()) {
                cart.addOurItem(sku, 1);
                cartCounts.set(key, countSoFar + 1);
                addedSomething = true;

                const name = this.bot.schema.getName(SKU.fromString(sku), false);
                this.bot.sendMessage(steamID, `✅ ${name} added to your cart.`);
            }
        }

        if (!addedSomething) {
            return this.bot.sendMessage(
                steamID,
                `❌ I don't have any pure available to withdraw.`
            );
        }

        Cart.addCart(cart);
        this.checkoutCommand(steamID, prefix);
    }

     */
// Helper function to extract amount and item from input string
    private extractAmountAndItem(input: string): { amount?: number; item: string } {
        input = input.replace('untradable', 'Non-Tradable').trim();

        let amount: number | undefined;
        let item: string;

        // --- Extract amount if at start or end ---
        let match = input.match(/^(\d+)\s+(.+)$/);
        if (match) {
            amount = parseInt(match[1], 10);
            item = match[2].trim();
        } else {
            match = input.match(/^(.+?)\s+(\d+)$/);
            if (match) {
                amount = parseInt(match[2], 10);
                item = match[1].trim();
            } else {
                item = input;
            }
        }

        // --- Split into words to handle prefixes ---
        const parts = item.split(/\s+/);

        let ncPrefix = '';
        let restParts = [...parts];

        // Check for uncraftable variants at the start
        const uncraftableVariants = ['uncraftable ', 'uncraft ', 'non craftable ', 'non-craftable ', 'noncraft ', 'nc '];
        const firstWord = parts[0].toLowerCase();
        if (uncraftableVariants.includes(firstWord + ' ')) {
            console.log('uncraftableVariants.includes(firstWord is true');
            ncPrefix = 'Non-Craftable ';
            restParts.shift(); // remove the prefix from the rest of the item
        }


        // --- Normalize special shortcuts for the main item ---
        let mainItem = restParts.join(' ').replace('Non-Craftable ', '');

        const lowerMain = mainItem.toLowerCase();
        console.log('This is lowerMain: \'', lowerMain, '\'');
        console.log('This is lowerMain test: \'', 'test', '\'');
        if (lowerMain === 'key' || lowerMain === 'keys') {
            mainItem = 'Mann Co. Supply Crate Key';
        } else if (lowerMain === 'bp' || lowerMain === 'expander') {
            mainItem = 'Backpack Expander';
        } else if (lowerMain === 'tod' || lowerMain === 'tour' || lowerMain === 'duty' || lowerMain === 'ticket') {
            mainItem = 'Tour of Duty Ticket';
        }
        mainItem = mainItem.replace('pro ks ', 'professional killstreak ');
        mainItem = mainItem.replace('spec ks ', 'specialized killstreak ');
        mainItem = mainItem.replace('aussie ', 'australium ');
        console.log('mainItem: ', mainItem);
        console.log('mainItem: ', mainItem);
        console.log('mainItem: ', mainItem);
        console.log('mainItem: ', mainItem);
        console.log('mainItem: ', mainItem);
        console.log('mainItem: ', mainItem);
        console.log('mainItem: ', mainItem);
        console.log('mainItem: ', mainItem);
        console.log('mainItem: ', mainItem);
        console.log('mainItem: ', mainItem);
        console.log('mainItem: ', mainItem);
        console.log('mainItem: ', mainItem);

        // --- Recombine nc prefix if it exists ---
        if (ncPrefix) mainItem = `${ncPrefix}${mainItem}`.trim();

        // --- Build parse string ---
        let parseString = mainItem;
        console.log('parseString: ', parseString)
        if (!(parseString.includes('item=') || parseString.includes('sku=') ||
            parseString.includes('name=') || parseString.includes('id=') ||
            parseString.includes('defindex='))) {
            parseString = `item=${mainItem}`;
        }
        console.log('parseString: ', parseString)
        console.log('mainItem: ', mainItem)

        if (amount !== undefined) parseString += `&amount=${amount}`;

        return { amount, item: parseString };
    }

    private withdrawCommand(steamID: SteamID, message: string, prefix: string): void {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        const rawMessage = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        if (rawMessage.length === 0) {
            return this.bot.sendMessage(steamID, '❌ Please specify an item to withdraw.');
        }

        const { amount, item } = this.extractAmountAndItem(rawMessage);
        /*
        if (!(parseString.includes('item=') || parseString.includes('sku=') || parseString.includes('name=') ||
            parseString.includes('id=') || parseString.includes('defindex='))) parseString = `item=${item}`;
        if (amount !== undefined) {
            parseString += `&amount=${amount}`;
        }
         */

        const params = CommandParser.parseParams(item);
        const tokenName = String(params.item || params.name || '').toLowerCase();

        if (this.tokenGroups[tokenName]) {
            const cart =
                AdminCart.getCart(steamID) ||
                new AdminCart(
                    steamID,
                    this.bot,
                    this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                    this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft
                        ? this.bot.uncraftWeapons
                        : []
                );

            const addedLines: string[] = [];
            const requestedAmount = typeof params.amount === 'number' ? params.amount : Infinity;

            for (const sku of this.tokenGroups[tokenName]) {
                const name = this.bot.schema.getName(SKU.fromString(sku), false);
                const cartAmount = cart.getOurCount(sku);
                const invAmount = this.bot.inventoryManager.getInventory.getAmount({
                    priceKey: sku,
                    includeNonNormalized: false,
                    tradableOnly: true
                });

                let amountToAdd = Math.min(invAmount - cartAmount, requestedAmount);
                if (amountToAdd > 0) {
                    cart.addOurItem(sku, amountToAdd);
                    addedLines.push(`✅ Added ${pluralize(name, amountToAdd, true)}`);
                }
            }

            if (addedLines.length === 0) {
                return this.bot.sendMessage(
                    steamID,
                    `❌ I don't have any matching items for "${tokenName}".`
                );
            }

            Cart.addCart(cart);
            return this.bot.sendMessage(
                steamID,
                `${addedLines.join('\n')}\nType "${prefix}cart" to view your cart summary or "${prefix}checkout" to checkout. 🛒`
            );
        }

        // --- single item logic ---
        if (!params.sku) {
            const it = getItemFromParams(steamID, params, this.bot);
            if (it === null) {
                return this.bot.sendMessage(
                    steamID,
                    '❌ Invalid item name. Could not recognize what you meant. Please double-check the spelling.'
                );
            }

            params.sku = SKU.fromObject(it);
        } else {
            params.sku = SKU.fromObject(fixItem(SKU.fromString(params.sku as string), this.bot.schema));
        }

        const sku = params.sku as string;

        // amount logic
        let customAmount = false;
        let finalAmount: number;
        if (typeof params.amount === 'number') {
            customAmount = true;
            finalAmount = params.amount;
        } else {
            finalAmount = 99999;
        }

        if (!Number.isInteger(finalAmount) || finalAmount <= 0) {
            return this.bot.sendMessage(steamID, `❌ amount should only be a positive integer.`);
        }

        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft
                    ? this.bot.uncraftWeapons
                    : []
            );

        const cartAmount = cart.getOurCount(sku);
        const ourAmount = this.bot.inventoryManager.getInventory.getAmount({
            priceKey: sku,
            includeNonNormalized: false,
            tradableOnly: true
        });

        const amountCanTrade = ourAmount - cartAmount;
        const name = this.bot.schema.getName(SKU.fromString(sku), false);

        if (amountCanTrade <= 0) {
            return this.bot.sendMessage(
                steamID,
                `❌ I don't have any ${(ourAmount > 0 ? 'more ' : '') + pluralize(name, 0)}.`
            );
        }

        if (finalAmount > amountCanTrade) {
            finalAmount = amountCanTrade;

            if (finalAmount === cartAmount && cartAmount > 0) {
                return this.bot.sendMessage(
                    steamID,
                    `❌ I don't have any ${(ourAmount > 0 ? 'more ' : '') + pluralize(name, 0)}.`
                );
            }

            if (customAmount) {
                this.bot.sendMessage(
                    steamID,
                    `I only have ${pluralize(name, finalAmount, true)}. ` +
                    (finalAmount > 1 ? 'They have' : 'It has') +
                    ` been added to your cart. Type "${prefix}cart" to view your cart summary or "${prefix}checkout" to checkout. 🛒`
                );
            }
        }

        if (!customAmount || finalAmount <= amountCanTrade) {
            this.bot.sendMessage(
                steamID,
                `✅ ${pluralize(name, finalAmount, true)} has been added to your cart. ` +
                `Type "${prefix}cart" to view or "${prefix}checkout" to finish. 🛒`
            );
        }

        cart.addOurItem(sku, finalAmount);
        Cart.addCart(cart);
    }

    private async depositCommand(steamID: SteamID, message: string, prefix: string): Promise<void> {
        const active = Cart.getCart(steamID);
        if (active !== null && !(active instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        const rawMessage = CommandParser.removeCommand(removeLinkProtocol(message)).trim();
        if (rawMessage.length === 0) {
            return this.bot.sendMessage(steamID, '❌ Please specify an item to deposit.');
        }

        const { amount, item } = this.extractAmountAndItem(rawMessage);
        //let parseString = `item=${item}`;
        let parseString = item;
        /*
        if (amount !== undefined) {
            parseString += `&amount=${amount}`;
        }

         */

        const params = CommandParser.parseParams(parseString);
        const groupSkus = this.tokenGroups[params.item];

        if (groupSkus !== undefined) {
            const sid64 = steamID.getSteamID64();
            const adminInv =
                this.adminInventory[sid64] ||
                new Inventory(steamID, this.bot, 'their', this.bot.boundInventoryGetter);

            if (this.adminInventory[sid64] === undefined) {
                try {
                    log.debug('fetching admin inventory');
                    await adminInv.fetch();
                    this.adminInventory[sid64] = adminInv;
                    clearTimeout(this.adminInventoryReset);
                    this.adminInventoryReset = setTimeout(() => delete this.adminInventory[sid64], 5 * 60_000);
                } catch (err) {
                    log.error('Error fetching inventory:', err);
                    return this.bot.sendMessage(
                        steamID,
                        '❌ Error fetching inventory, Steam might be down. Try again later.'
                    );
                }
            }

            const dict = adminInv.getItems;
            const cart =
                AdminCart.getCart(steamID) ||
                new AdminCart(
                    steamID,
                    this.bot,
                    this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                    this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft
                        ? this.bot.uncraftWeapons
                        : []
                );

            const requestedAmount = typeof params.amount === 'number' ? params.amount : Infinity;
            const addedLines: string[] = [];

            for (const sku of groupSkus) {
                const available = dict[sku]?.length ?? 0;
                if (available === 0) continue;

                const already = cart.getTheirCount(sku);
                const toAdd = Math.min(available - already, requestedAmount);
                if (toAdd <= 0) continue;

                cart.addTheirItem(sku, toAdd);
                const name = this.bot.schema.getName(SKU.fromString(sku), false);
                addedLines.push(`✅ Added ${pluralize(name, toAdd, true)}`);
            }

            if (addedLines.length > 0) {
                Cart.addCart(cart);
                return this.bot.sendMessage(
                    steamID,
                    `${addedLines.join('\n')}\nType "${prefix}cart" to review or "${prefix}checkout" to finish. 🛒`
                );
            } else {
                return this.bot.sendMessage(
                    steamID,
                    `❌ You don't have any tradable tokens in the "${params.item}" group.`
                );
            }
        }

        // Handle single item logic below...

        if (!params.sku) {
            const it = getItemFromParams(steamID, params, this.bot);
            if (it === null) {
                return this.bot.sendMessage(
                    steamID,
                    '❌ Invalid item name. Could not recognize what you meant. Please double-check the spelling.'
                );
            }

            params.sku = SKU.fromObject(it);
        } else {
            params.sku = SKU.fromObject(fixItem(SKU.fromString(params.sku as string), this.bot.schema));
        }

        const sku = params.sku as string;

        let customAmount = false;
        let finalAmount: number;
        if (typeof params.amount === 'number') {
            customAmount = true;
            finalAmount = params.amount;
        } else {
            finalAmount = 99999;
        }

        if (!Number.isInteger(finalAmount) || finalAmount <= 0) {
            return this.bot.sendMessage(steamID, '❌ amount should only be a positive integer.');
        }

        const sid64 = steamID.getSteamID64();
        const adminInv =
            this.adminInventory[sid64] ||
            new Inventory(steamID, this.bot, 'their', this.bot.boundInventoryGetter);

        if (this.adminInventory[sid64] === undefined) {
            try {
                log.debug('fetching admin inventory');
                await adminInv.fetch();
                this.adminInventory[sid64] = adminInv;
                clearTimeout(this.adminInventoryReset);
                this.adminInventoryReset = setTimeout(() => delete this.adminInventory[sid64], 5 * 60_000);
            } catch (err) {
                log.error('Error fetching inventory:', err);
                return this.bot.sendMessage(
                    steamID,
                    '❌ Error fetching inventory, Steam might be down. Try again later.'
                );
            }
        }

        const dict = adminInv.getItems;
        if (!dict[sku]) {
            delete this.adminInventory[sid64];
            return this.bot.sendMessage(
                steamID,
                `❌ You don't have any ${this.bot.schema.getName(SKU.fromString(sku), false)}.`
            );
        }

        const available = dict[sku].length;

        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft
                    ? this.bot.uncraftWeapons
                    : []
            );

        const already = cart.getTheirCount(sku);
        const maxAddable = available - already;

        if (finalAmount > maxAddable) {
            finalAmount = maxAddable;

            if (customAmount) {
                this.bot.sendMessage(
                    steamID,
                    `❌ You only have ${pluralize(this.bot.schema.getName(SKU.fromString(sku), false), available, true)}, but ${already} ${
                        already === 1 ? 'is' : 'are'
                    } already in your cart. So I added the remaining ${finalAmount}. Type "${prefix}cart" to review. 🛒`
                );
            }
        }

        cart.addTheirItem(sku, finalAmount);
        Cart.addCart(cart);

        this.bot.sendMessage(
            steamID,
            `✅ ${pluralize(this.bot.schema.getName(SKU.fromString(sku), false), finalAmount, true)} added to your cart.` +
            ` Type "${prefix}cart" to review or "${prefix}checkout" to finish. 🛒`
        );
    }

    private async withdrawMptfCommand(steamID: SteamID, message: string): Promise<void> {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        if (this.bot.options.mptfApiKey === '') {
            return this.bot.sendMessage(steamID, '❌ Marketplace.tf API key was not set in the env file.');
        }

        const params = CommandParser.parseParams(CommandParser.removeCommand(removeLinkProtocol(message)));

        const max = typeof params.max === 'number' ? params.max : 1;
        if (!Number.isInteger(max)) {
            return this.bot.sendMessage(steamID, `❌ max should only be an integer.`);
        }

        const ignorePainted =
            typeof params.ignorepainted === 'boolean'
                ? params.ignorepainted
                : typeof params.ignorepainted === 'number'
                    ? !!params.ignorepainted
                    : false;

        const withGroup =
            params.withgroup === '' || typeof params.withgroup !== 'string'
                ? typeof params.withgroup === 'number'
                    ? String(params.withgroup)
                    : undefined
                : params.withgroup;

        try {
            const mptfItemsSkus = await getMptfDashboardItems(this.bot.options.mptfApiKey, ignorePainted);
            const dict = this.bot.inventoryManager.getInventory.getItems;
            const clonedDict = Object.assign({}, dict);

            const weaponsAsCurrency = this.bot.options.miscSettings.weaponsAsCurrency;

            const pureAndWeapons = weaponsAsCurrency.enable
                ? ['5021;6', '5000;6', '5001;6', '5002;6'].concat(
                    weaponsAsCurrency.withUncraft
                        ? this.bot.craftWeapons.concat(this.bot.uncraftWeapons)
                        : this.bot.craftWeapons
                )
                : ['5021;6', '5000;6', '5001;6', '5002;6'];

            for (const sku in clonedDict) {
                if (!Object.prototype.hasOwnProperty.call(clonedDict, sku)) {
                    continue;
                }

                let isWithinGroup = false;

                if (withGroup) {
                    if (withGroup !== this.bot.pricelist.getPrice({ priceKey: sku })?.group) {
                        delete clonedDict[sku];
                        continue;
                    }
                    isWithinGroup = true;
                }

                if (pureAndWeapons.includes(sku) && !isWithinGroup) {
                    delete clonedDict[sku];
                    continue;
                }

                // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
                if (ignorePainted && sku.match(/;[p][0-9]+/) !== null) {
                    delete clonedDict[sku];
                    continue;
                }

                if (mptfItemsSkus[sku] && mptfItemsSkus[sku] >= max) {
                    // If this particular item already exist on mptf and it's more than or equal to max, ignore
                    delete clonedDict[sku];
                }
            }

            if (Object.keys(clonedDict).length === 0) {
                return this.bot.sendMessage(steamID, `❌ Nothing to withdraw.`);
            }

            const cart =
                AdminCart.getCart(steamID) ||
                new AdminCart(
                    steamID,
                    this.bot,
                    this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                    this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
                );

            for (const sku in clonedDict) {
                if (!Object.prototype.hasOwnProperty.call(clonedDict, sku)) {
                    continue;
                }

                const amountInInventory = clonedDict[sku].length;
                const amountInMptf = mptfItemsSkus[sku] ?? 0;
                cart.addOurItem(sku, amountInInventory + amountInMptf >= max ? max - amountInMptf : amountInInventory);
            }

            Cart.addCart(cart);
            this.addCartToQueue(cart, false, false);
        } catch (err) {
            log.error('Error on !withdrawMptf:', err);
            return this.bot.sendMessage(steamID, `❌ Error: ${(err as Error)?.message}`);
        }
    }

    private withdrawAllCommand(steamID: SteamID, message: string): void {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        const params = CommandParser.parseParams(CommandParser.removeCommand(removeLinkProtocol(message)));

        const max = typeof params.max === 'number' ? params.max : Infinity;
        if (params.max && !Number.isInteger(max)) {
            return this.bot.sendMessage(steamID, `❌ max should only be an integer.`);
        }

        const withGroup =
            params.withgroup === '' || typeof params.withgroup !== 'string'
                ? typeof params.withgroup === 'number'
                    ? String(params.withgroup)
                    : undefined
                : params.withgroup;

        const dict = this.bot.inventoryManager.getInventory.getItems;
        const clonedDict = Object.assign({}, dict);

        if (withGroup) {
            for (const sku in clonedDict) {
                if (!Object.prototype.hasOwnProperty.call(clonedDict, sku)) {
                    continue;
                }

                if (withGroup !== this.bot.pricelist.getPrice({ priceKey: sku })?.group) {
                    delete clonedDict[sku];
                    continue;
                }
            }
        }

        if (Object.keys(clonedDict).length === 0) {
            return this.bot.sendMessage(steamID, `❌ Nothing to withdraw.`);
        }

        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
            );

        for (const sku in clonedDict) {
            if (!Object.prototype.hasOwnProperty.call(clonedDict, sku)) {
                continue;
            }

            const amountInInventory = clonedDict[sku].length;
            cart.addOurItem(sku, amountInInventory >= max ? max - amountInInventory : amountInInventory);
        }

        Cart.addCart(cart);
        this.addCartToQueue(cart, false, false);
    }
    private withdrawAllExceptCurrencyCommand(steamID: SteamID, message: string): void {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        const params = CommandParser.parseParams(CommandParser.removeCommand(removeLinkProtocol(message)));

        const max = typeof params.max === 'number' ? params.max : Infinity;
        if (params.max && !Number.isInteger(max)) {
            return this.bot.sendMessage(steamID, `❌ max should only be an integer.`);
        }

        const withGroup =
            params.withgroup === '' || typeof params.withgroup !== 'string'
                ? typeof params.withgroup === 'number'
                    ? String(params.withgroup)
                    : undefined
                : params.withgroup;

        const dict = this.bot.inventoryManager.getInventory.getItems;
        const clonedDict = Object.assign({}, dict);

        // Exclude certain SKUs
        const blacklist = new Set(['5021;6', '5000;6', '5001;6', '5002;6']);

        if (withGroup) {
            for (const sku in clonedDict) {
                if (!Object.prototype.hasOwnProperty.call(clonedDict, sku)) {
                    continue;
                }

                if (withGroup !== this.bot.pricelist.getPrice({ priceKey: sku })?.group) {
                    delete clonedDict[sku];
                }
            }
        }

        // Apply blacklist filter
        for (const sku of Object.keys(clonedDict)) {
            if (blacklist.has(sku)) {
                delete clonedDict[sku];
            }
        }

        if (Object.keys(clonedDict).length === 0) {
            return this.bot.sendMessage(steamID, `❌ Nothing to withdraw (after excluding keys/metal).`);
        }

        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
            );

        for (const sku in clonedDict) {
            if (!Object.prototype.hasOwnProperty.call(clonedDict, sku)) {
                continue;
            }

            const amountInInventory = clonedDict[sku].length;
            cart.addOurItem(sku, amountInInventory >= max ? max - amountInInventory : amountInInventory);
        }

        Cart.addCart(cart);
        this.addCartToQueue(cart, false, false);
    }
    private withdrawAllNCCommand(steamID: SteamID, message: string): void {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof AdminCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one. 🛒'
            );
        }

        const params = CommandParser.parseParams(CommandParser.removeCommand(removeLinkProtocol(message)));

        const max = typeof params.max === 'number' ? params.max : Infinity;
        if (params.max && !Number.isInteger(max)) {
            return this.bot.sendMessage(steamID, `❌ max should only be an integer.`);
        }

        const withGroup =
            params.withgroup === '' || typeof params.withgroup !== 'string'
                ? typeof params.withgroup === 'number'
                    ? String(params.withgroup)
                    : undefined
                : params.withgroup;

        const dict = this.bot.inventoryManager.getInventory.getItems;
        const clonedDict = Object.assign({}, dict);

        // Exclude certain SKUs

        if (withGroup) {
            for (const sku in clonedDict) {
                if (!Object.prototype.hasOwnProperty.call(clonedDict, sku)) {
                    continue;
                }

                if (withGroup !== this.bot.pricelist.getPrice({ priceKey: sku })?.group) {
                    delete clonedDict[sku];
                }
            }
        }

        for (const sku of Object.keys(clonedDict)) {
            if (!sku.includes(';uncraftable')) {
                delete clonedDict[sku];
            }
        }

        if (Object.keys(clonedDict).length === 0) {
            return this.bot.sendMessage(steamID, `❌ Nothing to withdraw (after excluding keys/metal).`);
        }

        const cart =
            AdminCart.getCart(steamID) ||
            new AdminCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
            );

        for (const sku in clonedDict) {
            if (!Object.prototype.hasOwnProperty.call(clonedDict, sku)) {
                continue;
            }

            const amountInInventory = clonedDict[sku].length;
            cart.addOurItem(sku, amountInInventory >= max ? max - amountInInventory : amountInInventory);
        }

        Cart.addCart(cart);
        this.addCartToQueue(cart, false, false);
    }

    private donateBPTFCommand(steamID: SteamID, message: string, prefix: string): void {
        const currentCart = Cart.getCart(steamID);

        if (currentCart !== null && !(currentCart instanceof DonateCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one.'
            );
        }

        const params = CommandParser.parseParams(CommandParser.removeCommand(removeLinkProtocol(message)));
        if (params.sku === undefined) {
            const item = getItemFromParams(steamID, params, this.bot);
            if (item === null) {
                return;
            }

            params.sku = SKU.fromObject(item);
        } else {
            params.sku = SKU.fromObject(fixItem(SKU.fromString(params.sku as string), this.bot.schema));
        }

        const sku = params.sku as string;

        if (!['725;6;uncraftable', '5021;6', '126;6', '143;6', '162;6'].includes(sku)) {
            return this.bot.sendMessage(
                steamID,
                `❌ Invalid item ${this.bot.schema.getName(
                    SKU.fromString(sku),
                    false
                )}. Items that can only be donated to Backpack.tf:\n• ` +
                [
                    'Non-Craftable Tour of Duty Ticket (725;6;uncraftable)',
                    'Mann Co. Supply Crate Key (5021;6)',
                    "Bill's Hat (126;6)",
                    'Earbuds (143;6)',
                    "Max's Severed Head (162;6)"
                ].join('\n• ') +
                '\n\nhttps://backpack.tf/donate'
            );
        }

        let amount = typeof params.amount === 'number' ? params.amount : 1;

        const cart =
            DonateCart.getCart(steamID) ||
            new DonateCart(
                steamID,
                this.bot,
                this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
                this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
            );

        const cartAmount = cart.getOurCount(sku);
        const ourAmount = this.bot.inventoryManager.getInventory.getAmount({
            priceKey: sku,
            includeNonNormalized: false,
            tradableOnly: true
        });
        const amountCanTrade = ourAmount - cart.getOurCount(sku) - cartAmount;

        const name = this.bot.schema.getName(SKU.fromString(sku), false);

        // Correct trade if needed
        if (amountCanTrade <= 0) {
            this.bot.sendMessage(
                steamID,
                `❌ I don't have any ${(ourAmount > 0 ? 'more ' : '') + pluralize(name, 0)}.`
            );
            amount = 0;
        } else if (amount > amountCanTrade) {
            amount = amountCanTrade;

            if (amount === cartAmount && cartAmount > 0) {
                return this.bot.sendMessage(
                    steamID,
                    `❌ I don't have any ${(ourAmount > 0 ? 'more ' : '') + pluralize(name, 0)}.`
                );
            }

            this.bot.sendMessage(
                steamID,
                `I only have ${pluralize(name, amount, true)}. ` +
                (amount > 1 ? 'They have' : 'It has') +
                ` been added to your donate cart. Type "${prefix}donatecart" to view your donation cart summary or "${prefix}donatenow" to donate. 💰`
            );
        } else {
            this.bot.sendMessage(
                steamID,
                `✅ ${pluralize(name, Math.abs(amount), true)} has been ` +
                (amount >= 0 ? 'added to' : 'removed from') +
                ` your donate cart. Type "${prefix}donatecart" to view your donation cart summary or "${prefix}donatenow" to donate. 💰`
            );
        }

        this.isDonating = true;

        cart.addOurItem(sku, amount);
        Cart.addCart(cart);
    }

    private donateNowCommand(steamID: SteamID, prefix: string): void {
        if (!this.isDonating) {
            return this.bot.sendMessage(
                steamID,
                `You're currently not donating to backpack.tf. If a cart already been created, cancel it with "${prefix}clearcart"`
            );
        }

        const cart = Cart.getCart(steamID);
        if (cart === null) {
            return this.bot.sendMessage(steamID, '💰 Your donation cart is empty.');
        }

        this.isDonating = false;

        cart.setNotify = true;
        cart.isDonating = true;

        this.addCartToQueue(cart, true, false);
    }

    private donateCartCommand(steamID: SteamID, prefix: string): void {
        if (!this.isDonating) {
            return this.bot.sendMessage(
                steamID,
                `You're currently not donating to backpack.tf. If a cart already been created, cancel it with "${prefix}clearcart"`
            );
        }
        this.bot.sendMessage(steamID, Cart.stringify(steamID, true, prefix));
    }

    private buyBPTFPremiumCommand(steamID: SteamID, message: string): void {
        const currentCart = Cart.getCart(steamID);
        if (currentCart !== null && !(currentCart instanceof PremiumCart)) {
            return this.bot.sendMessage(
                steamID,
                '❌ You already have an active cart, please finalize it before making a new one.'
            );
        }

        const params = CommandParser.parseParams(CommandParser.removeCommand(removeLinkProtocol(message)));

        if (
            params.months === undefined ||
            typeof params.months !== 'number' ||
            !Number.isInteger(params.months) ||
            params.months < 1
        ) {
            return this.bot.sendMessage(
                steamID,
                '❌ Wrong syntax. Example: !premium months=1' +
                '\n\n📌 Note: 📌\n- ' +
                [
                    '1 month = 3 keys',
                    '2 months = 5 keys',
                    '3 months = 8 keys',
                    '4 months = 10 keys',
                    '1 year (12 months) = 30 keys'
                ].join('\n- ')
            );
        }

        const amountMonths = params.months;
        const numMonths = params.months;
        const numOdds = numMonths % 2 !== 0 ? (numMonths - 1) / 2 + 1 : (numMonths - 1) / 2;
        const numEvens = numMonths - numOdds;
        const amountKeys = Math.round(numOdds * 3 + numEvens * 2);

        const ourAmount = this.bot.inventoryManager.getInventory.getAmount({
            priceKey: '5021;6',
            includeNonNormalized: false,
            tradableOnly: true
        });

        if (ourAmount < amountKeys) {
            return this.bot.sendMessage(
                steamID,
                `❌ I don't have enough keys to buy premium for ${pluralize(
                    'month',
                    amountMonths,
                    true
                )}. I have ${pluralize('key', ourAmount, true)} and need ${pluralize(
                    'key',
                    amountKeys - ourAmount,
                    true
                )} more.`
            );
        }

        if (params.i_am_sure !== 'yes_i_am') {
            return this.bot.sendMessage(
                steamID,
                `⚠️ Are you sure that you want to buy premium for ${pluralize('month', amountMonths, true)}?` +
                `\nThis will cost you ${pluralize('key', amountKeys, true)}.` +
                `\nIf yes, retry by sending !premium months=${amountMonths}&i_am_sure=yes_i_am`
            );
        }

        const cart = new PremiumCart(
            steamID,
            this.bot,
            this.weaponsAsCurrency.enable ? this.bot.craftWeapons : [],
            this.weaponsAsCurrency.enable && this.weaponsAsCurrency.withUncraft ? this.bot.uncraftWeapons : []
        );

        cart.addOurItem('5021;6', amountKeys);
        Cart.addCart(cart);

        cart.setNotify = true;
        cart.isBuyingPremium = true;

        this.addCartToQueue(cart, false, true);
    }
}

const paintCanDefindexes = [
    5023, // Paint Can
    5027, // Indubitably Green
    5028, // Zepheniah's Greed
    5029, // Noble Hatter's Violet
    5030, // Color No. 216-190-216
    5031, // A Deep Commitment to Purple
    5032, // Mann Co. Orange
    5033, // Muskelmannbraun
    5034, // Peculiarly Drab Tincture
    5035, // Radigan Conagher Brown
    5036, // Ye Olde Rustic Colour
    5037, // Australium Gold
    5038, // Aged Moustache Grey
    5039, // An Extraordinary Abundance of Tinge
    5040, // A Distinctive Lack of Hue
    5046, // Team Spirit
    5051, // Pink as Hell
    5052, // A Color Similar to Slate
    5053, // Drably Olive
    5054, // The Bitter Taste of Defeat and Lime
    5055, // The Color of a Gentlemann's Business Pants
    5056, // Dark Salmon Injustice
    5060, // Operator's Overalls
    5061, // Waterlogged Lab Coat
    5062, // Balaclavas Are Forever
    5063, // An Air of Debonair
    5064, // The Value of Teamwork
    5065, // Cream Spirit
    5076, // A Mann's Mint
    5077 // After Eight
];

function getMptfDashboardItems(mptfApiKey: string, ignorePainted = false): Promise<GetMptfDashboardItemsReturn> {
    return new Promise((resolve, reject) => {
        apiRequest<GetMptfDashboardItems>({
            method: 'GET',
            url: 'https://marketplace.tf/api/Seller/GetDashboardItems/v2',
            headers: {
                'User-Agent': 'TF2Autobot@' + process.env.BOT_VERSION
            },
            params: {
                key: mptfApiKey
            }
        })
            .then(body => {
                if (body.success === false) {
                    return reject(body);
                }

                const items = body.items
                    .map(item => {
                        let sku = item.sku
                            .replace(/;ks-\d+/, '') // Sheen
                            .replace(/;ke-\d+/, ''); // Killstreaker

                        if (ignorePainted || paintCanDefindexes.includes(item.defindex)) {
                            sku = sku.replace(/;[p][0-9]+/, ''); // Painted
                        }

                        return {
                            sku,
                            amount: item.num_for_sale
                        };
                    })
                    .filter(item => testPriceKey(item.sku));

                const itemsSize = items.length;
                const toReturn = {};

                for (let i = 0; i < itemsSize; i++) {
                    toReturn[items[i].sku] = items[i].amount;
                }

                return resolve(toReturn);
            })
            .catch(err => reject(err));
    });
}

interface GetMptfDashboardItemsReturn {
    [sku: string]: number;
}

interface GetMptfDashboardItems {
    success: boolean;
    error?: string;
    num_item_groups?: number;
    total_items?: number;
    items?: Item[];
}

interface Item {
    sku: string;
    full_sku: string;
    name: string;
    defindex: number | null;
    quality: number | null;
    num_for_sale: number;
    price: number; // cent
}
