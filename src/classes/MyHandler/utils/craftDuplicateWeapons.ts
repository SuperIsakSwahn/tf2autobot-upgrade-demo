import Bot from '../../Bot';

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
    '140;6'
];
export default function craftDuplicateWeapons(bot: Bot): Promise<void> {
    return new Promise(resolve => {
        if (!bot.options.crafting.weapons.enable) {
            return resolve();
        }

        const currencies = bot.inventoryManager.getInventory.getCurrencies(bot.craftWeapons, false);
        const craftAll = bot.craftWeapons.filter(sku => uselessWeapons.includes(sku));


        for (const sku of craftAll) {
            const weapon = currencies[sku].length;

            if (weapon >= 2 && bot.pricelist.getPrice({ priceKey: sku, onlyEnabled: true }) === null) {
                // Only craft if duplicated and not exist in pricelist
                const combineWeapon = Math.trunc(weapon / 2);

                for (let i = 0; i < combineWeapon; i++) {
                    // give a little time between each craft job
                    bot.tf2gc.combineWeapon(sku);
                }
            }
        }

        return resolve();
    });
}
