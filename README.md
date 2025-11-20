Should be simple, just replace the existing files with src then run tsc in the bot's folder or whatever it is you use to create the dist folder

Steam group: https://steamcommunity.com/groups/tf2autobot-upgrade
Discord: https://discord.gg/rwDN7tdzMB

Description of the full version:

This is an upgrade to tf2autobot.
Showcase: https://github.com/SuperIsakSwahn/tf2autobot-upgrade-demo/raw/main/Showcase.rar

A lot of changes have been made. The biggest change was key rates, it correctly uses the key rates in any situation. If you find something I missed, let me know.

There are fallback prices in case your bot gets an item that isn't in its pricelist. Of course, the fallback only applies to the customer's items, not your bot's. Here is the full list:
Festivized items: 5 ref
Normal items: 50 keys
Australiums: 5 keys
Killstreak items: 6 ref
Specialized: 20 ref
Professional: 40 ref
There are also fallbacks for craft-only weapons, such as 1.22 ref for Quäckenbirdts.
Genuine and vintage items: 1 ref
Unusual items: 36 ref
Self-made: 50 keys
Strange and haunted: 2 ref
Collector's: 20 keys

There are more commands available, such as !w pda2, it withdraws the pda2 and spy tokens, or if you only want pda2, you type !w pda2only. This is configurable in Commands.ts at tokenGroups.

Also, the option to disable keys banking is ignored when a user trades keys, now it accepts keys<>metal trades. With the accurate rates implemented, it's much less of a risk, not to mention that even if I didn't make it ignore the option, the user can bypass it by adding any non-pure item to the trade like a noise maker or a ubersaw.

The program also has a new feature which you are using right now, you can sell files, works similar to normal pricelists.

There's an upgrade to the upgrade that makes it so no matter what the pricelist says, your bot buys tickets and expanders for 1/3 keys each and sells for 1/2 keys. If your bot gets offers matching the pricelist, it will be sent for review.

Do not download pirated versions of this! Only go to the links my bot give you. Pirated versions could be dangerous and steal your items.
